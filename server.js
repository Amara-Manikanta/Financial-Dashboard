import http from 'http';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { handleInsightsRequest, handleChatRequest, handleSummarizeRequest } from './insightsEngine.js';
import { inspectWrite, verifySnapshot, countRecords } from './dbGuard.js';
import * as sqliteReads from './sqliteReads.js';
import * as sqliteWrites from './sqliteWrites.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, 'backups');
// Overridable so an isolated instance can be pointed at a throwaway copy of the
// database. The guard, the backups and json-server itself all read this one
// value, so a test instance never touches the live file by accident.
const DB_FILE = process.env.DB_FILE
    ? path.resolve(process.env.DB_FILE)
    : path.join(__dirname, 'db.json');

// Collections that must always exist. Used to validate snapshots before they
// are trusted, so we never keep a "backup" that is already missing data.
const REQUIRED_COLLECTIONS = ['expenses', 'savings', 'metals', 'assets', 'appData'];

// Uploaded images live on disk here rather than as base64 inside db.json.
// Embedding them bloated every read and write of the database, and made the
// images collateral damage whenever a bad write landed. This directory is
// gitignored: the pictures are personal and are not source code.
const UPLOAD_DIR = path.join(__dirname, 'db', 'images');
// Policy paperwork — receipts, RC copies, original insurance documents — is
// kept apart from item photos so the folders stay meaningful when browsed.
const DOCUMENT_DIR = path.join(__dirname, 'db', 'documents');
const UPLOAD_FOLDERS = { images: UPLOAD_DIR, documents: DOCUMENT_DIR };
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Photos plus PDF, so purchase bills can be kept alongside the item.
const UPLOAD_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
};

Object.values(UPLOAD_FOLDERS).forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
// Overridable so an isolated instance can be run against a throwaway copy of the
// database for testing, without disturbing the live server or the real db.json.
const INTERNAL_PORT = Number(process.env.INTERNAL_PORT) || 3001;
const PROXY_PORT = Number(process.env.PROXY_PORT) || 3000;

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

/**
 * A short fingerprint of one collection as it currently stands on disk.
 *
 * Used for the lost-update check: a client sends back the version it read, and
 * a write is only allowed on top of that exact version. Content-based rather
 * than a counter, so it survives restarts and stays correct no matter who wrote
 * last — including edits made to db.json by hand.
 */
const collectionVersion = (name) => {
    try {
        const value = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))[name];
        if (value === undefined) return null;
        return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16);
    } catch {
        return null;
    }
};

console.log(`[SafetyGuard] Starting internal json-server on port ${INTERNAL_PORT}...`);

// Spawn the actual json-server.
//
// Always the copy pinned in node_modules, never whatever `json-server` happens
// to resolve to on PATH. A globally installed 1.0.0-beta.5 was being picked up
// instead of the pinned beta.3, and beta.5 ships a body parser that rejects any
// request over 100 KB with a 500. Every write here sends a whole collection —
// expenses alone is ~1.8 MB — so saving an expense failed silently, the change
// stayed in React state, looked saved, and vanished on the next reload.
const JSON_SERVER_BIN = path.join(__dirname, 'node_modules', '.bin', 'json-server');
if (!fs.existsSync(JSON_SERVER_BIN)) {
    console.error(`[SafetyGuard] ✖ json-server not found at ${JSON_SERVER_BIN}. Run "npm install" first.`);
    process.exit(1);
}
const jsonServerProcess = spawn(JSON_SERVER_BIN, ['--watch', DB_FILE, '--port', String(INTERNAL_PORT)], {
    stdio: 'inherit'
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

                // Keep a short rolling window of per-mutation snapshots.
                //
                // This was 100. Each snapshot is a full copy of db.json — about
                // 3.5 MB — so the tier alone reached 350 MB, and with per-row
                // writes now firing on every logged transaction it refills in
                // hours rather than weeks. A hundred snapshots of a single busy
                // afternoon is not a better safety net than ten; it is the same
                // afternoon, stored a hundred times.
                //
                // The daily and monthly tiers are the real protection. This one
                // exists only to undo something you just did.
                const MUTATION_SNAPSHOTS = 10;
                if (remainingFiles.length > MUTATION_SNAPSHOTS) {
                    const toDelete = remainingFiles.slice(0, remainingFiles.length - MUTATION_SNAPSHOTS);
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

// Responses the proxy generates itself — rejections, upload errors, gateway
// failures — need their own CORS headers. Only the responses that come back
// from json-server carry its headers, so without these the browser refuses to
// read the body and `fetch` rejects with a bare network error. A blocked write
// then surfaced to the user as "Load failed" instead of the reason it was
// blocked, which is precisely the information they need.
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,If-Match',
    'Access-Control-Expose-Headers': 'X-DB-Version',
};

// Mutations run one at a time.
//
// mergePatchIntoPut reads db.json, merges the body into it and forwards a PUT.
// Two mutations in flight together both read the same pre-write file, so the
// second one's PUT is built from state that already lacks the first one's
// change — and silently erases it. Proved with two PATCHes to *different*
// appData keys: one of them vanished.
//
// The guard has the same shape (it reads db.json to compare against), as does
// collectionVersion. Serialising every mutation fixes the whole class in one
// place rather than per collection. These are local writes measured in
// milliseconds, so the queue costs effectively nothing.
let mutationQueue = Promise.resolve();
const runExclusive = (task) => {
    const next = mutationQueue.then(task, task);
    // Keep the chain alive even if a task rejects, or one failure stalls
    // every write that follows it.
    mutationQueue = next.catch(() => {});
    return next;
};

const sendJson = (res, status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
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
            const { dataUrl, name, folder } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            // Only the folders declared above are writable; anything else is
            // rejected rather than being coerced into a path.
            const targetKey = folder === 'documents' ? 'documents' : 'images';
            const targetDir = UPLOAD_FOLDERS[targetKey];
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

            fs.writeFileSync(path.join(targetDir, fileName), buffer);
            console.log(`[SafetyGuard] 📎 Saved upload: db/${targetKey}/${fileName} (${(buffer.length / 1024).toFixed(0)} KB)`);

            // Relative URL keeps the DB portable across hosts and ports.
            sendJson(res, 201, { url: `/api/${targetKey}/${fileName}` });
        } catch (err) {
            console.error('[SafetyGuard] Upload failed:', err.message);
            sendJson(res, 400, { error: 'Could not process upload' });
        }
    });
};

/** Serve a stored image. The filename is confined to UPLOAD_DIR. */
const handleImageRequest = (req, res) => {
    const folderKey = req.url.startsWith('/api/documents/') ? 'documents' : 'images';
    const baseDir = UPLOAD_FOLDERS[folderKey];
    // basename strips any traversal ("../"), so the path cannot escape the dir.
    const requested = path.basename(decodeURIComponent(req.url.replace(`/api/${folderKey}/`, '').split('?')[0]));
    const filePath = path.join(baseDir, requested);

    if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath)) {
        return sendJson(res, 404, { error: 'Image not found' });
    }

    const extension = path.extname(filePath).toLowerCase();
    const mimeType = Object.keys(UPLOAD_TYPES).find((type) => UPLOAD_TYPES[type] === extension) || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=31536000' });
    fs.createReadStream(filePath).pipe(res);
};


/**
 * Live quotes, fetched server-side.
 *
 * The client used to call Yahoo through api.allorigins.win, a public CORS relay.
 * That relay is a single point of failure outside anyone's control, and when it
 * started answering 500 every refresh silently kept the old price — the catch
 * returned `stock.currentPrice`, so a total outage and a successful refresh
 * looked identical on screen.
 *
 * Node has no CORS to satisfy, so the request works directly from here. It also
 * means the list of tickers someone holds is no longer handed to a third party
 * on every refresh.
 *
 * GET /api/quote?symbols=LT.NS,SBIN.NS
 *   -> { quotes: { "LT.NS": 3996.4 }, failed: ["BADSYM.NS"] }
 *
 * Failures are named rather than papered over, so the caller can tell the user
 * which holdings did not update.
 */
const MAX_SYMBOLS_PER_REQUEST = 60;

const handleQuoteRequest = async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    const raw = (url.searchParams.get('symbols') || '').trim();
    const symbols = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_SYMBOLS_PER_REQUEST);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (symbols.length === 0) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'symbols query parameter is required' }));
    }

    const quotes = {};
    const failed = [];

    await Promise.all(symbols.map(async (symbol) => {
        // Only a ticker shape is ever interpolated into the URL — never raw
        // client input, which would otherwise be a request-forgery hole.
        if (!/^[A-Za-z0-9.\-&]{1,20}$/.test(symbol)) {
            failed.push(symbol);
            return;
        }
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const r = await fetch(
                `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal },
            );
            clearTimeout(timer);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
                quotes[symbol] = price;
            } else {
                failed.push(symbol);
            }
        } catch (err) {
            failed.push(symbol);
        }
    }));

    res.writeHead(200);
    res.end(JSON.stringify({ quotes, failed }));
};

const proxy = http.createServer((req, res) => {
    // Image routes are handled here, before the json-server proxy, so uploads
    // are never mistaken for a database mutation.
    if (req.url === '/api/upload' && req.method === 'POST') {
        return handleImageUpload(req, res);
    }
    if ((req.url.startsWith('/api/images/') || req.url.startsWith('/api/documents/')) && req.method === 'GET') {
        return handleImageRequest(req, res);
    }
    if (req.url.startsWith('/api/quote') && req.method === 'GET') {
        return handleQuoteRequest(req, res);
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

    // Per-row transaction writes (phase 3). A change touches one row instead of
    // replacing a whole collection, which is what makes two tabs editing
    // different transactions safe. Additive: nothing uses this unless the
    // client opts in, and it is refused entirely unless SQLITE_WRITES=on.
    if (req.url === '/api/tx' || req.url.startsWith('/api/tx/')) {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, CORS_HEADERS);
            res.end();
            return;
        }
        const txId = req.url.startsWith('/api/tx/') ? decodeURIComponent(req.url.slice('/api/tx/'.length)) : null;
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
            let parsed = {};
            if (raw) {
                try {
                    parsed = JSON.parse(raw);
                } catch (err) {
                    sendJson(res, 400, { error: 'Malformed JSON body', reason: err.message });
                    return;
                }
            }
            // DELETE /api/tx/by-category removes every transaction in one
            // category for one month. It is a genuine bulk operation, so it
            // runs as a single statement rather than N per-row calls each
            // rebuilding the whole database.
            const isBulkCategory = req.method === 'DELETE' && txId === 'by-category';

            const op = isBulkCategory ? 'delete-category'
                : req.method === 'POST' ? 'create'
                    : req.method === 'PATCH' ? 'update'
                        : req.method === 'DELETE' ? 'delete' : null;
            if (!op) {
                sendJson(res, 405, { error: `${req.method} is not supported on /api/tx` });
                return;
            }
            if (!isBulkCategory && (op === 'update' || op === 'delete') && !txId) {
                sendJson(res, 400, { error: `${req.method} /api/tx requires an id: /api/tx/<id>` });
                return;
            }

            // Same backup discipline as every other mutation.
            if (sqliteWrites.isEnabled) createVerifiedBackup();

            const result = sqliteWrites.applyChange(
                { op, id: isBulkCategory ? null : txId, transaction: parsed.transaction || parsed, patch: parsed },
                inspectWrite,
            );
            if (!result.ok) {
                console.error(`[SQLite] ⛔ per-row ${op} refused: ${result.body.reason || result.body.error}`);
            }
            sendJson(res, result.status, result.body);
            if (result.ok) setTimeout(syncToICloud, 200);
        });
        return;
    }

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

    const collectionOf = (url) => /^\/([A-Za-z0-9_-]+)$/.exec(url.split('?')[0])?.[1] || null;

    // SQLITE_READS=on: answer whole-collection reads from the mirror. Writes
    // still go to json-server and db.json remains the source of truth, so the
    // mirror is rebuilt whenever that file changes. Anything this cannot serve
    // — a query string, a per-item path, an unknown collection — falls through
    // untouched rather than guessing.
    if (sqliteReads.MODE === 'on' && req.method === 'GET' && !req.url.includes('?')) {
        const name = collectionOf(req.url);
        if (name) {
            const body = sqliteReads.readCollection(name);
            if (body !== undefined) {
                const payload = JSON.stringify(body);
                const version = collectionVersion(name);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    ...CORS_HEADERS,
                    ...(version ? { 'X-DB-Version': version } : {}),
                });
                res.end(payload);
                return;
            }
        }
    }

    // Turn `PATCH /<collection>` into the merged `PUT` that json-server beta.3
    // should have performed itself. Anything else is passed through untouched:
    // requests with an id (`/savings/123`) take json-server's per-item path,
    // which merges correctly, and array collections are replaced wholesale by
    // design. Returns the verb and body to actually send.
    const mergePatchIntoPut = (request, rawBody) => {
        const untouched = { verb: request.method, body: rawBody };
        if (request.method !== 'PATCH') return untouched;

        const name = collectionOf(request.url);
        if (!name) return untouched;

        try {
            const incoming = JSON.parse(rawBody);
            if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return untouched;

            const existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))[name];
            if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return untouched;

            return { verb: 'PUT', body: JSON.stringify({ ...existing, ...incoming }) };
        } catch (err) {
            // A body that will not parse is the guard's problem, not ours.
            console.error(`[SafetyGuard] ⚠️  Could not merge PATCH ${request.url}: ${err.message}`);
            return untouched;
        }
    };

    // bufferedBody is null for reads, which stay streamed as before.
    // onDone fires once the write has actually completed, so a serialised
    // mutation holds its slot until json-server has finished with db.json —
    // releasing it any earlier would reopen the race the queue exists to close.
    const forward = (bufferedBody, methodOverride, onDone) => {
        const finish = () => { if (onDone) { const f = onDone; onDone = null; f(); } };
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
            method: methodOverride || req.method,
            headers,
        };

        const proxyReq = http.request(options, (proxyRes) => {
            const outHeaders = { ...proxyRes.headers };

            // Hand back the version of the collection as it now stands, so the
            // client can base its next write on it. json-server has already
            // written db.json by the time it responds, so this reads the result.
            const name = collectionOf(req.url);
            if (name) {
                const version = collectionVersion(name);
                if (version) {
                    outHeaders['x-db-version'] = version;
                    // Custom headers are invisible to fetch() unless exposed.
                    outHeaders['access-control-expose-headers'] = 'X-DB-Version';
                }
            }

            // Shadow mode: json-server's answer is still the one served. We
            // only buffer a copy to compare against SQLite and log differences,
            // so a wrong mirror can be discovered without anyone relying on it.
            const shadowing = sqliteReads.MODE === 'shadow'
                && !isMutation && name && proxyRes.statusCode === 200;

            res.writeHead(proxyRes.statusCode, outHeaders);

            if (shadowing) {
                const chunks = [];
                proxyRes.on('data', (chunk) => {
                    chunks.push(chunk);
                    res.write(chunk);
                });
                proxyRes.on('end', () => {
                    res.end();
                    // After the response is sent, so comparison never delays it.
                    setImmediate(() => sqliteReads.shadowCompare(name, Buffer.concat(chunks).toString('utf8')));
                });
            } else {
                proxyRes.pipe(res);
            }

            if (isMutation) {
                proxyRes.on('end', () => {
                    setTimeout(syncToICloud, 200);
                });
            }
            proxyRes.on('end', finish);
            proxyRes.on('error', finish);
        });

        proxyReq.on('error', (e) => {
            console.error(`[SafetyGuard] Headers Proxy error: ${e.message}`);
            if (!res.headersSent) {
                if (e.code === 'ECONNREFUSED') {
                    sendJson(res, 503, { error: 'Service Unavailable. Server is starting...' });
                } else {
                    sendJson(res, 502, { error: 'Bad Gateway' });
                }
            }
            // Release the queue slot: a failed write must not stall every
            // write behind it.
            finish();
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
      // Everything from here on reads db.json, decides, and writes. Run one at
      // a time so each decision sees the previous write's result.
      runExclusive(() => new Promise((release) => {
        let body = Buffer.concat(chunks).toString('utf8');

        // LOST-UPDATE CHECK. A whole-collection write replaces everything, so a
        // client working from a stale copy silently erases whatever it never saw
        // — two browser tabs, or a tab left open while something else wrote.
        // Clients that send the version they read may only write on top of that
        // exact version; if the database has moved, the write is refused and the
        // client is told to reload rather than quietly winning.
        const baseVersion = req.headers['if-match'];
        const targetCollection = collectionOf(req.url);
        if (baseVersion && targetCollection) {
            const current = collectionVersion(targetCollection);
            if (current && current !== baseVersion) {
                console.error(`[SafetyGuard] ⛔ STALE ${req.method} ${req.url} (based on ${baseVersion}, current ${current})`);
                sendJson(res, 409, {
                    error: 'Write refused: this data changed since you loaded it',
                    reason: 'Another tab or device saved first. Reload before saving, or this write would erase their changes.',
                    currentVersion: current,
                });
                release();
                return;
            }
        }

        // json-server 1.0.0-beta.3 does not merge PATCH. lib/service.js writes
        //     db.data[name] = { item, ...body }
        // where the author meant `{ ...item, ...body }`. The shorthand buries the
        // entire existing collection under a literal "item" key and lets the body
        // replace everything at the top level — so PATCH /metals { gold } moves
        // silver into metals.item and leaves metals.silver gone. That is what
        // corrupted the metals collection, and it nests one level deeper on every
        // repeat. beta.5 fixes it but rejects bodies over 100 KB, which is every
        // write here, so neither release is usable as shipped.
        //
        // Do the merge in the proxy instead — the one place every write passes
        // through — and forward it as PUT, which beta.3 stores verbatim. The
        // guard below then judges the merged result, and a merged body can never
        // drop a sibling key.
        const method = mergePatchIntoPut(req, body);
        if (method.body !== body) {
            console.log(`[SafetyGuard] 🔀 PATCH ${req.url} merged server-side and sent as PUT`);
        }
        body = method.body;

        const verdict = inspectWrite({ method: method.verb, url: req.url, body, dbFile: DB_FILE });

        if (!verdict.safe) {
            console.error(`[SafetyGuard] ⛔ BLOCKED ${req.method} ${req.url}`);
            console.error(`[SafetyGuard]    Reason: ${verdict.reason}`);
            sendJson(res, 409, {
                error: 'Write blocked by SafetyGuard to prevent data loss',
                reason: verdict.reason,
            });
            release();
            return;
        }

        // 2. BACKUP: only once the write is known to be sane.
        createVerifiedBackup();
        // release() runs when json-server has finished writing, not when the
        // request is dispatched — otherwise the next mutation would merge
        // against a db.json this one has not updated yet.
        forward(body, method.verb, release);
      }));
    });
});

proxy.listen(PROXY_PORT, () => {
    console.log(`[SafetyGuard] 🛡️  Protection Active on port ${PROXY_PORT}`);
    console.log(`[SafetyGuard] Requests are backed up and forwarded to internal server.`);
    // Off unless SQLITE_READS says otherwise, so the default path is untouched.
    // The mirror lives beside whichever database this instance is pointed at,
    // so an isolated instance (DB_FILE=/tmp/...) builds its own and never
    // touches the real one. Overridable with SQLITE_FILE.
    const mirrorFile = process.env.SQLITE_FILE
        ? path.resolve(process.env.SQLITE_FILE)
        : path.join(path.dirname(DB_FILE), 'finance.sqlite');
    sqliteReads.init({ dbFile: DB_FILE, mirrorFile });
    sqliteWrites.init({ dbFile: DB_FILE, mirrorFile });
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log('\n[SafetyGuard] Shutting down...');
    jsonServerProcess.kill();
    process.exit();
});
