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

                // Rotation: Keep last 50 backups
                const files = fs.readdirSync(BACKUP_DIR)
                    .filter(f => f.startsWith('db-backup-'))
                    .sort();

                if (files.length > 50) {
                    const toDelete = files.slice(0, files.length - 50);
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
