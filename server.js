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

// A quote older than this is a delisted or renamed series, not a live price.
// Generous enough to survive a long market holiday.
const STALE_QUOTE_DAYS = 10;

/** Yahoo omits fields rather than sending nulls; absent means "not known". */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

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
    const stale = [];

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
            const meta = data?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
                failed.push(symbol);
                return;
            }

            // A dead listing still answers with a price — it is simply the last
            // one ever traded. MINDSPACE.NS returns ₹345.06 from July 2024 and
            // looks exactly like a live quote, so accepting any number here
            // silently wrote a two-year-old price into the portfolio.
            const tradedAt = typeof meta.regularMarketTime === 'number'
                ? meta.regularMarketTime * 1000
                : null;
            const ageDays = tradedAt ? Math.round((Date.now() - tradedAt) / 86400000) : null;

            if (ageDays !== null && ageDays > STALE_QUOTE_DAYS) {
                stale.push({ symbol, price, ageDays, lastTraded: new Date(tradedAt).toISOString() });
                return;
            }

            // The whole quote, not just the price. The 52-week range, the day's
            // move and the previous close all arrive in this same response and
            // were being discarded — refetching them later would be a second
            // round trip for data already in hand.
            quotes[symbol] = {
                price,
                previousClose: num(meta.chartPreviousClose ?? meta.previousClose),
                dayLow: num(meta.regularMarketDayLow),
                dayHigh: num(meta.regularMarketDayHigh),
                fiftyTwoWeekLow: num(meta.fiftyTwoWeekLow),
                fiftyTwoWeekHigh: num(meta.fiftyTwoWeekHigh),
                volume: num(meta.regularMarketVolume),
                currency: meta.currency || null,
                longName: meta.longName || meta.shortName || null,
                tradedAt: tradedAt ? new Date(tradedAt).toISOString() : null,
            };
        } catch (err) {
            failed.push(symbol);
        }
    }));

    res.writeHead(200);
    res.end(JSON.stringify({ quotes, failed, stale }));
};


/**
 * Daily closes for one symbol, for comparing a portfolio against an index.
 *
 * A separate endpoint from /api/quote because the shape is different: one
 * symbol, many days, and the response is large enough that folding it into the
 * quote path would make every price refresh pay for data it does not use.
 *
 * GET /api/history?symbol=^NSEI&range=5y
 *   -> { symbol, closes: { "2021-09-02": 17234.15, ... } }
 */
const handleHistoryRequest = async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    const symbol = (url.searchParams.get('symbol') || '').trim();
    const range = (url.searchParams.get('range') || '5y').trim();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (!/^[A-Za-z0-9.^\-&]{1,20}$/.test(symbol)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'a valid symbol is required' }));
    }
    if (!/^(1mo|3mo|6mo|1y|2y|5y|10y|max)$/.test(range)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'unsupported range' }));
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const r = await fetch(
            `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
            { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal },
        );
        clearTimeout(timer);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const result = data?.chart?.result?.[0];
        const stamps = result?.timestamp || [];
        const closes = result?.indicators?.quote?.[0]?.close || [];

        const byDate = {};
        stamps.forEach((t, i) => {
            const c = closes[i];
            if (typeof c === 'number' && Number.isFinite(c)) {
                byDate[new Date(t * 1000).toISOString().slice(0, 10)] = c;
            }
        });

        if (Object.keys(byDate).length === 0) throw new Error('no closes returned');

        res.writeHead(200);
        res.end(JSON.stringify({ symbol, range, closes: byDate }));
    } catch (err) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: `could not fetch history for ${symbol}: ${err.message}` }));
    }
};

// --- NEW CODE: Yahoo Finance Session Manager for quoteSummary ---
let yfSession = { cookie: null, crumb: null, expiresAt: 0 };
async function getYfSession() {
    if (Date.now() < yfSession.expiresAt && yfSession.cookie && yfSession.crumb) {
        return yfSession;
    }
    const r = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const cookies = r.headers.get('set-cookie');
    if (!cookies) throw new Error('No cookie from fc.yahoo.com');
    const cookie = cookies.split(';')[0];
    
    const crumbR = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie }
    });
    if (!crumbR.ok) throw new Error('Failed to get crumb');
    const crumb = await crumbR.text();
    yfSession = { cookie, crumb, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
    return yfSession;
}

const financialsCache = new Map();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const handleStockFinancialsRequest = async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    const symbol = (url.searchParams.get('symbol') || '').trim();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (!/^[A-Za-z0-9.\-&]{1,20}$/.test(symbol)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ symbol, error: 'a valid symbol is required', healthScore: null, signal: null }));
    }

    const cached = financialsCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`[Cache Hit] Financials for ${symbol}`);
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
    }
    console.log(`[Cache Miss] Financials for ${symbol}`);

    try {
        const { cookie, crumb } = await getYfSession();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const yfUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?crumb=${crumb}&modules=financialData,defaultKeyStatistics,earnings`;
        const r = await fetch(yfUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
            signal: controller.signal
        });
        clearTimeout(timer);

        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        
        const summary = data?.quoteSummary?.result?.[0];
        if (!summary) throw new Error('No data found for symbol');

        const fd = summary.financialData || {};
        const dks = summary.defaultKeyStatistics || {};
        const earn = summary.earnings?.financialsChart?.quarterly || [];

        const quarterly = earn.map(q => ({
            date: q.date,
            revenue: q.revenue?.raw || 0,
            revenueFmt: q.revenue?.fmt || '0',
            earnings: q.earnings?.raw || 0,
            earningsFmt: q.earnings?.fmt || '0',
            profitMargin: (q.revenue?.raw && q.earnings?.raw) ? (q.earnings.raw / q.revenue.raw * 100) : 0
        }));

        let goodChecks = 0;
        const checks = [];

        const revGrowth = fd.revenueGrowth?.raw || 0;
        let revGrowthStatus, revGrowthDetail;
        if (revGrowth > 0.10) { revGrowthStatus = 'good'; goodChecks++; }
        else if (revGrowth > 0) revGrowthStatus = 'caution';
        else revGrowthStatus = 'bad';
        revGrowthDetail = `${(revGrowth > 0 ? '+' : '')}${(revGrowth * 100).toFixed(1)}% YoY`;
        checks.push({ name: 'Revenue Growth', status: revGrowthStatus, detail: revGrowthDetail });

        let profitStatus = 'bad';
        let profitDetail = 'Has quarterly losses';
        if (quarterly.length > 0) {
            const allProfitable = quarterly.every(q => q.earnings > 0);
            const growing = quarterly.length >= 2 && quarterly[quarterly.length-1].earnings > quarterly[0].earnings;
            if (allProfitable && growing) { profitStatus = 'good'; goodChecks++; profitDetail = 'Consistent growth'; }
            else if (allProfitable) { profitStatus = 'caution'; profitDetail = 'Positive but flat/declining'; }
        }
        checks.push({ name: 'Profitability', status: profitStatus, detail: profitDetail });

        const opMargin = fd.operatingMargins?.raw || 0;
        let marginStatus, marginDetail;
        if (opMargin > 0.15) { marginStatus = 'good'; goodChecks++; }
        else if (opMargin >= 0.08) marginStatus = 'caution';
        else marginStatus = 'bad';
        marginDetail = `Operating margin ${(opMargin * 100).toFixed(1)}%`;
        checks.push({ name: 'Margins', status: marginStatus, detail: marginDetail });

        // Yahoo omits debtToEquity for banks and finance companies, and `|| 0`
        // turned "not reported" into "no debt at all" — the most leveraged
        // businesses there are scored a point for it. SBI read 5/5 partly
        // because the app believed a bank had no borrowings. Missing data now
        // scores nothing and says so.
        const debtRaw = typeof fd.debtToEquity?.raw === 'number' && fd.debtToEquity.raw > 0
            ? fd.debtToEquity.raw
            : null;
        let debtStatus, debtDetail;
        if (debtRaw === null) {
            debtStatus = 'unknown';
            debtDetail = 'Not reported — common for banks and lenders';
        } else if (debtRaw < 50) {
            debtStatus = 'good'; goodChecks++;
            debtDetail = `D/E ratio ${(debtRaw / 100).toFixed(2)} (low debt)`;
        } else if (debtRaw <= 100) {
            debtStatus = 'caution';
            debtDetail = `D/E ratio ${(debtRaw / 100).toFixed(2)}`;
        } else {
            debtStatus = 'bad';
            debtDetail = `D/E ratio ${(debtRaw / 100).toFixed(2)}`;
        }
        checks.push({ name: 'Debt Health', status: debtStatus, detail: debtDetail });

        const fpe = dks.forwardPE?.raw || 0;
        let valStatus, valDetail;
        if (fpe > 0 && fpe < 20) { valStatus = 'good'; goodChecks++; }
        else if (fpe >= 20 && fpe <= 50) valStatus = 'caution';
        else valStatus = 'bad';
        valDetail = fpe > 0 ? `Forward P/E ${fpe.toFixed(1)}x` : 'Negative earnings';
        checks.push({ name: 'Valuation', status: valStatus, detail: valDetail });

        const healthScore = {
            total: goodChecks,
            max: 5,
            label: goodChecks >= 4 ? 'Strong Fundamentals' : goodChecks >= 3 ? 'Good Fundamentals' : goodChecks >= 2 ? 'Mixed Fundamentals' : 'Poor Fundamentals',
            color: goodChecks >= 4 ? '#34d399' : goodChecks >= 3 ? '#4ade80' : goodChecks >= 2 ? '#fbbf24' : '#f87171',
            checks
        };

        let action, label, color, icon;
        // quarterly.every(...) is vacuously true on an empty array, so without
        // the length guard a stock with no earnings history at all could reach
        // "Strong Buy". The health score already guards this; the signal did not.
        const allQuartersProfitable = quarterly.length > 0 && quarterly.every(q => q.earnings > 0);
        const noQuarterLoss = quarterly.length > 0 && quarterly.every(q => q.earnings >= 0);
        if (goodChecks >= 4 && revGrowth > 0.10 && allQuartersProfitable) {
            action = 'strong_buy'; label = 'Strong Buy / Accumulate'; color = '#34d399'; icon = '🟢';
        } else if (goodChecks >= 3 && revGrowth > 0 && noQuarterLoss) {
            action = 'buy'; label = 'Buy on Dips'; color = '#4ade80'; icon = '🟢';
        } else if (goodChecks <= 1 || quarterly.filter(q => q.earnings < 0).length > 1 || (revGrowth < 0 && marginStatus === 'bad')) {
            action = 'sell'; label = 'Review for Exit'; color = '#f87171'; icon = '🔴';
        } else if (goodChecks <= 2 || (valStatus === 'bad' && marginStatus === 'bad')) {
            action = 'trim'; label = 'Consider Trimming'; color = '#fb923c'; icon = '🟠';
        } else {
            action = 'hold'; label = 'Hold & Watch'; color = '#fbbf24'; icon = '🟡';
        }

        const reasons = [];
        if (revGrowth > 0.10) reasons.push(`Revenue grew +${(revGrowth*100).toFixed(1)}% — strong momentum`);
        else if (revGrowth < 0) reasons.push(`Revenue declining (${(revGrowth*100).toFixed(1)}%) — contracting business`);
        else reasons.push('Revenue growth is modest but positive');
        
        if (marginStatus === 'bad') reasons.push(`Operating margins are weak at ${(opMargin*100).toFixed(1)}%`);
        else if (marginStatus === 'good') reasons.push(`Strong operating margins (${(opMargin*100).toFixed(1)}%)`);

        if (debtStatus === 'bad') reasons.push(`High debt-to-equity ratio (${(debtEq/100).toFixed(2)}x)`);
        
        if (valStatus === 'bad' && fpe > 0) reasons.push(`Valuation is stretched at ${fpe.toFixed(1)}x forward P/E`);

        if (reasons.length === 0) reasons.push('Fundamentals are mixed', 'No major red flags', 'Watch for earnings growth');

        const signal = { action, label, color, icon, reasons: reasons.slice(0, 3) };

        const responseData = {
            symbol,
            quarterly,
            fundamentals: {
                operatingMargins: { raw: fd.operatingMargins?.raw || 0, fmt: fd.operatingMargins?.fmt || '0%' },
                profitMargins: { raw: fd.profitMargins?.raw || 0, fmt: fd.profitMargins?.fmt || '0%' },
                revenueGrowth: { raw: fd.revenueGrowth?.raw || 0, fmt: fd.revenueGrowth?.fmt || '0%' },
                debtToEquity: { raw: fd.debtToEquity?.raw || 0, fmt: fd.debtToEquity?.fmt || '0' },
                forwardPE: { raw: dks.forwardPE?.raw || 0, fmt: dks.forwardPE?.fmt || '0' },
                priceToBook: { raw: dks.priceToBook?.raw || 0, fmt: dks.priceToBook?.fmt || '0' },
                beta: { raw: dks.beta?.raw || 0, fmt: dks.beta?.fmt || '0' }
            },
            healthScore,
            signal,
            cachedAt: new Date().toISOString()
        };

        financialsCache.set(symbol, { timestamp: Date.now(), data: responseData });
        res.writeHead(200);
        res.end(JSON.stringify(responseData));
    } catch (err) {
        console.error(`[Financials] Error fetching ${symbol}:`, err.message);
        res.writeHead(200);
        res.end(JSON.stringify({ symbol, error: err.message, healthScore: null, signal: null }));
    }
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
    if (req.url.startsWith('/api/history') && req.method === 'GET') {
        return handleHistoryRequest(req, res);
    }
    if (req.url.startsWith('/api/stock-financials') && req.method === 'GET') {
        return handleStockFinancialsRequest(req, res);
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
