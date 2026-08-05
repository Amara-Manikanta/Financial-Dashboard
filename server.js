import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { handleInsightsRequest, handleChatRequest, handleSummarizeRequest } from './insightsEngine.js';
import { inspectWrite, verifySnapshot, countRecords } from './dbGuard.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_FILE = path.join(__dirname, 'db.json');

// Collections that must always exist. Used to validate snapshots before they
// are trusted, so we never keep a "backup" that is already missing data.
const REQUIRED_COLLECTIONS = ['expenses', 'savings', 'metals', 'assets', 'appData'];

// Uploaded images live on disk here rather than as base64 inside db.json.
// Embedding them bloated every read and write of the database, and made the
// images collateral damage whenever a bad write landed. This directory is
// gitignored: the pictures are personal and are not source code.
const UPLOAD_DIR = path.join(__dirname, 'db', 'images');
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Photos plus PDF, so purchase bills can be kept alongside the item.
const UPLOAD_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
};

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
// Overridable so an isolated instance can be run against a throwaway copy of the
// database for testing, without disturbing the live server or the real db.json.
const INTERNAL_PORT = Number(process.env.INTERNAL_PORT) || 3001;
const PROXY_PORT = Number(process.env.PROXY_PORT) || 3000;

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

console.log(`[SafetyGuard] Starting internal json-server on port ${INTERNAL_PORT}...`);

// Spawn the actual json-server
const jsonServerProcess = spawn('json-server', ['--watch', 'db.json', '--port', String(INTERNAL_PORT)], {
    stdio: 'inherit',
    shell: true
});

const ICLOUD_DIR = path.join(process.env.HOME || '/Users/manikantaamara', 'Library/Mobile Documents/com~apple~CloudDocs/FinanceAnalyser');
const ICLOUD_DB_FILE = path.join(ICLOUD_DIR, 'db.json');

const syncToICloud = () => {
    try {
        if (!fs.existsSync(ICLOUD_DIR)) {
            fs.mkdirSync(ICLOUD_DIR, { recursive: true });
        }
        if (fs.existsSync(DB_FILE)) {
            fs.copyFileSync(DB_FILE, ICLOUD_DB_FILE);
            console.log(`[SafetyGuard] ☁️  Synced db.json to iCloud Drive: ${ICLOUD_DB_FILE}`);
        }
    } catch (err) {
        console.error('[SafetyGuard] ⚠️  iCloud sync failed:', err.message);
    }
};

// Tiered, verified snapshots. Each tier is an immutable point-in-time copy —
// they are never merged, so any one of them can be restored as a known state.
const createVerifiedBackup = () => {
    try {
            // Check if db.json exists before backing up
            if (fs.existsSync(DB_FILE)) {
                const nowObj = new Date();
                const timestamp = nowObj.toISOString().replace(/[:.]/g, '-');
                const dateStr = nowObj.toISOString().split('T')[0]; // YYYY-MM-DD
                const monthStr = dateStr.slice(0, 7); // YYYY-MM

                // Only snapshot state we have verified is intact. Backing up
                // already-corrupt data is what makes corruption unrecoverable.
                const health = verifySnapshot(DB_FILE, REQUIRED_COLLECTIONS);
                if (!health.ok) {
                    console.error(`[SafetyGuard] ⛔ db.json failed integrity check (${health.reason}). Skipping backup so the last good snapshot is preserved.`);
                    return;
                }

                // 1. Save standard mutation backup
                const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.json`);
                fs.copyFileSync(DB_FILE, backupFile);
                console.log(`[SafetyGuard] 🛡️  Backup created: ${path.basename(backupFile)}`);

                // 2. Save permanent daily backup (one per day, never auto-deleted by short-term rotation)
                const dailyBackupFile = path.join(BACKUP_DIR, `db-daily-${dateStr}.json`);
                if (!fs.existsSync(dailyBackupFile)) {
                    fs.copyFileSync(DB_FILE, dailyBackupFile);
                    console.log(`[SafetyGuard] 📅 Permanent daily backup saved: db-daily-${dateStr}.json`);
                }

                // 3. Save permanent monthly archive. Daily files can still age out;
                // this tier is what survives corruption that goes unnoticed for weeks.
                const monthlyBackupFile = path.join(BACKUP_DIR, `db-monthly-${monthStr}.json`);
                if (!fs.existsSync(monthlyBackupFile)) {
                    fs.copyFileSync(DB_FILE, monthlyBackupFile);
                    console.log(`[SafetyGuard] 🗄️  Permanent monthly archive saved: db-monthly-${monthStr}.json`);
                }

                // 4. Track the newest verified state so recovery has an obvious target.
                fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, 'db-last-known-good.json'));

                // Rotation: Cleanup mutation backups older than 30 days
                const files = fs.readdirSync(BACKUP_DIR)
                    .filter(f => f.startsWith('db-backup-'))
                    .sort(); // Oldest first

                const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
                const now = Date.now();
                let remainingFiles = [];

                files.forEach(f => {
                    const filePath = path.join(BACKUP_DIR, f);
                    try {
                        const stats = fs.statSync(filePath);
                        if (now - stats.mtimeMs > RETENTION_MS) {
                            fs.unlinkSync(filePath);
                            console.log(`[SafetyGuard] 🧹 Deleted old backup: ${f}`);
                        } else {
                            remainingFiles.push(f);
                        }
                    } catch (e) {
                        remainingFiles.push(f);
                    }
                });

                // Keep up to 100 mutation backups (instead of just 10)
                if (remainingFiles.length > 100) {
                    const toDelete = remainingFiles.slice(0, remainingFiles.length - 100);
                    toDelete.forEach(f => {
                        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch(e){}
                    });
                }
            }
        } catch (err) {
            console.error('[SafetyGuard] ⚠️  Backup failed:', err);
            // We proceed anyway, but log the error
        }
};

const sendJson = (res, status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
};

/**
 * Accept an image as a data URL and store it as a real file.
 * The client sends the already-resized/compressed result of its canvas step,
 * so no image processing happens here — only validation and writing.
 */
const handleImageUpload = (req, res) => {
    const chunks = [];
    let received = 0;
    let aborted = false;

    req.on('data', (chunk) => {
        if (aborted) return;
        received += chunk.length;
        // Reject oversized uploads while streaming rather than buffering them all.
        if (received > MAX_UPLOAD_BYTES * 2) {
            aborted = true;
            sendJson(res, 413, { error: 'Image too large' });
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });

    req.on('end', () => {
        if (aborted) return;
        try {
            const { dataUrl, name } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl || '');
            if (!match) {
                return sendJson(res, 400, { error: 'Expected a file data URL' });
            }

            const [, mimeType, base64] = match;
            const extension = UPLOAD_TYPES[mimeType];
            if (!extension) {
                return sendJson(res, 415, { error: `Unsupported file type: ${mimeType}` });
            }

            const buffer = Buffer.from(base64, 'base64');
            if (buffer.length === 0) return sendJson(res, 400, { error: 'File data was empty' });
            if (buffer.length > MAX_UPLOAD_BYTES) {
                return sendJson(res, 413, { error: 'File exceeds 10MB' });
            }

            // Build the filename ourselves; never trust client input in a path.
            const slug = String(name || 'image')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 40) || 'image';
            const fileName = `${slug}-${Date.now()}${extension}`;

            fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
            console.log(`[SafetyGuard] 🖼️  Saved upload: db/images/${fileName} (${(buffer.length / 1024).toFixed(0)} KB)`);

            // Relative URL keeps the DB portable across hosts and ports.
            sendJson(res, 201, { url: `/api/images/${fileName}` });
        } catch (err) {
            console.error('[SafetyGuard] Upload failed:', err.message);
            sendJson(res, 400, { error: 'Could not process upload' });
        }
    });
};

/** Serve a stored image. The filename is confined to UPLOAD_DIR. */
const handleImageRequest = (req, res) => {
    // basename strips any traversal ("../"), so the path cannot escape the dir.
    const requested = path.basename(decodeURIComponent(req.url.replace('/api/images/', '').split('?')[0]));
    const filePath = path.join(UPLOAD_DIR, requested);

    if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
        return sendJson(res, 404, { error: 'Image not found' });
    }

    const extension = path.extname(filePath).toLowerCase();
    const mimeType = Object.keys(UPLOAD_TYPES).find((type) => UPLOAD_TYPES[type] === extension) || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=31536000' });
    fs.createReadStream(filePath).pipe(res);
};

const proxy = http.createServer((req, res) => {
    // Image routes are handled here, before the json-server proxy, so uploads
    // are never mistaken for a database mutation.
    if (req.url === '/api/upload' && req.method === 'POST') {
        return handleImageUpload(req, res);
    }
    if (req.url.startsWith('/api/images/') && req.method === 'GET') {
        return handleImageRequest(req, res);
    }

    // 2. PROXY LOGIC: Forward to internal server
    if (req.url === '/api/insights' && req.method === 'GET') {
        return handleInsightsRequest(req, res, INTERNAL_PORT);
    }
    if (req.url === '/api/chat' && (req.method === 'POST' || req.method === 'OPTIONS')) {
        return handleChatRequest(req, res, INTERNAL_PORT);
    }
    if (req.url === '/api/summarize' && (req.method === 'POST' || req.method === 'OPTIONS')) {
        return handleSummarizeRequest(req, res);
    }

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

    // bufferedBody is null for reads, which stay streamed as before.
    const forward = (bufferedBody) => {
        const headers = { ...req.headers };
        if (bufferedBody !== null) {
            // The body was consumed to inspect it, so re-declare its length.
            delete headers['transfer-encoding'];
            headers['content-length'] = Buffer.byteLength(bufferedBody);
        }

        const options = {
            hostname: '127.0.0.1',
            port: INTERNAL_PORT,
            path: req.url,
            method: req.method,
            headers,
        };

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
            if (isMutation) {
                proxyRes.on('end', () => {
                    setTimeout(syncToICloud, 200);
                });
            }
        });

        proxyReq.on('error', (e) => {
            console.error(`[SafetyGuard] Headers Proxy error: ${e.message}`);
            if (!res.headersSent) {
                if (e.code === 'ECONNREFUSED') {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Service Unavailable. Server is starting...' }));
                } else {
                    res.writeHead(502);
                    res.end('Bad Gateway');
                }
            }
        });

        if (bufferedBody !== null) {
            proxyReq.end(bufferedBody);
        } else {
            // Pipe the client request body to the proxy request
            req.pipe(proxyReq);
        }
    };

    if (!isMutation) {
        return forward(null);
    }

    // 1. GUARD: buffer the body so the write can be judged before it happens.
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const verdict = inspectWrite({ method: req.method, url: req.url, body, dbFile: DB_FILE });

        if (!verdict.safe) {
            console.error(`[SafetyGuard] ⛔ BLOCKED ${req.method} ${req.url}`);
            console.error(`[SafetyGuard]    Reason: ${verdict.reason}`);
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Write blocked by SafetyGuard to prevent data loss',
                reason: verdict.reason,
            }));
            return;
        }

        // 2. BACKUP: only once the write is known to be sane.
        createVerifiedBackup();
        forward(body);
    });
});

proxy.listen(PROXY_PORT, () => {
    console.log(`[SafetyGuard] 🛡️  Protection Active on port ${PROXY_PORT}`);
    console.log(`[SafetyGuard] Requests are backed up and forwarded to internal server.`);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log('\n[SafetyGuard] Shutting down...');
    jsonServerProcess.kill();
    process.exit();
});
