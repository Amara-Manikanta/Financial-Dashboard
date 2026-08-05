import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { handleInsightsRequest, handleChatRequest, handleSummarizeRequest } from './insightsEngine.js';
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

const proxy = http.createServer((req, res) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    // 1. BACKUP LOGIC: Only for destructive methods
    if (isMutation) {
        try {
            // Check if db.json exists before backing up
            if (fs.existsSync(DB_FILE)) {
                const nowObj = new Date();
                const timestamp = nowObj.toISOString().replace(/[:.]/g, '-');
                const dateStr = nowObj.toISOString().split('T')[0]; // YYYY-MM-DD
                
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
