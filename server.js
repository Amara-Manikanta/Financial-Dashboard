import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_FILE = path.join(__dirname, 'db.json');
const INTERNAL_PORT = 3001;
const PROXY_PORT = 3000;

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

const proxy = http.createServer((req, res) => {
    // 1. BACKUP LOGIC: Only for destructive methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        try {
            // Check if db.json exists before backing up
            if (fs.existsSync(DB_FILE)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.json`);

                // Synchronous copy to ensure backup completes before request is forwarded
                fs.copyFileSync(DB_FILE, backupFile);
                console.log(`[SafetyGuard] 🛡️  Backup created: ${path.basename(backupFile)}`);

                // Rotation: Cleanup old backups
                const files = fs.readdirSync(BACKUP_DIR)
                    .filter(f => f.startsWith('db-backup-'))
                    .sort(); // Oldest first (default string sort works for ISO timestamps)

                const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
                const now = Date.now();
                let remainingFiles = [];

                files.forEach(f => {
                    // Extract timestamp from filename: db-backup-2023-10-27T10-00-00-000Z.json
                    // Format: db-backup-YYYY-MM-DDTHH-mm-ss-sssZ.json
                    const match = f.match(/db-backup-(.+)\.json/);
                    if (match) {
                        try {
                            // Convert filename timestamp back to valid ISO string (replace - with : where needed)
                            // Actually, simpler: construct date from parts or use consistent format
                            // Our format: 2023-10-27T10-00-00-000Z with - replacing :.
                            // Reverting to standard ISO for parsing
                            const isoStr = match[1].replace(/-/g, (m, offset) => {
                                // Replace dashes with colons only in the time part?
                                // Actually, simpler approach: The filename sorts correctly.
                                // We need accurate time parsing.
                                // Current format: YYYY-MM-DDTHH-mm-ss-sssZ
                                // Standard ISO: YYYY-MM-DDTHH:mm:ss.sssZ
                                // Let's try to parse carefully.
                                const parts = match[1].split('T');
                                if (parts.length === 2) {
                                    const datePart = parts[0];
                                    const timePart = parts[1].replace(/-/g, ':').replace('Z', '');
                                    // The milliseconds part might be tricky if it has dashes.
                                    // Let's assume standard stats.mtime is easier!
                                    return m;
                                }
                                return m;
                            });

                            // BETTER APPROACH: Use file metadata (mtime)
                            const filePath = path.join(BACKUP_DIR, f);
                            const stats = fs.statSync(filePath);

                            if (now - stats.mtimeMs > RETENTION_MS) {
                                fs.unlinkSync(filePath);
                                console.log(`[SafetyGuard] 🧹 Deleted old backup: ${f}`);
                            } else {
                                remainingFiles.push(f);
                            }
                        } catch (e) {
                            // If stat fails or anything else, keep the file to be safe
                            remainingFiles.push(f);
                        }
                    } else {
                        remainingFiles.push(f);
                    }
                });

                // Secondary Safety: Keep max 10 recent files
                if (remainingFiles.length > 10) {
                    const toDelete = remainingFiles.slice(0, remainingFiles.length - 10);
                    toDelete.forEach(f => {
                        fs.unlinkSync(path.join(BACKUP_DIR, f));
                    });
                }
            }
        } catch (err) {
            console.error('[SafetyGuard] ⚠️  Backup failed:', err);
            // We proceed anyway, but log the error
        }
    }

    // 2. PROXY LOGIC: Forward to internal server
    const options = {
        hostname: '127.0.0.1',
        port: INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error(`[SafetyGuard] Headers Proxy error: ${e.message}`);
        // If internal server is not ready yet
        if (e.code === 'ECONNREFUSED') {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Service Unavailable. Server is starting...' }));
        } else {
            res.writeHead(502);
            res.end('Bad Gateway');
        }
    });

    // Pipe the client request body to the proxy request
    req.pipe(proxyReq);
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
