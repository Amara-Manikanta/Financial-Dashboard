// Electron shell for the finance dashboard.
//
// This does not reimplement anything. It starts the same `server.js` the web
// version uses, serves the same built `dist/`, and points a native window at
// it — so every formula, the write guard, the backups and the SQLite mirror all
// behave exactly as they already do. Nothing under src/ is aware this exists.
//
// Two details are load-bearing:
//
// 1. The renderer is served over http://localhost, never file://. FinanceContext
//    derives API_URL from `window.location.protocol//hostname:3000`, so a
//    file:// origin would resolve it to "file://localhost:3000" and every
//    request would fail. Serving over http keeps that derivation correct with
//    no change to the React code.
//
// 2. The API is only spawned if nothing is already answering on port 3000.
//    Running `npm run server` in a terminal and opening this app at the same
//    time is a normal thing to do, and a second instance would die on
//    EADDRINUSE — or worse, a second json-server would attach to the same
//    db.json and the two would overwrite each other.

const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const API_PORT = 3000;
const UI_PORT = 5180;

// Where the real installation lives.
//
// The packaged .app deliberately does NOT carry its own copy of the project.
// db.json, the backups/ folder and finance.sqlite are all anchored beside each
// other in the project directory, and server.js spawns the pinned json-server
// from that node_modules by absolute path. A second bundled copy would mean two
// databases that drift apart — the failure CLAUDE.md spends its first section
// warning about — and node-llama-cpp alone would add 325 MB to the bundle.
//
// So the app is a window onto the existing installation. It also means a
// rebuild of the project shows up in the app on next launch, with nothing to
// repackage.
const DEFAULT_PROJECT_ROOT = '/Users/manikantaamara/Desktop/Antigravity/Finance_Analyser';

const configPath = () => path.join(app.getPath('userData'), 'project-path.json');

const readConfiguredRoot = () => {
    try {
        const raw = fs.readFileSync(configPath(), 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.projectRoot === 'string') return parsed.projectRoot;
    } catch {
        // No config yet, or it is unreadable. The default is used instead.
    }
    return null;
};

const writeConfiguredRoot = (root) => {
    try {
        fs.mkdirSync(path.dirname(configPath()), { recursive: true });
        fs.writeFileSync(configPath(), JSON.stringify({ projectRoot: root }, null, 2));
    } catch (err) {
        console.error('[electron] could not remember the project path:', err.message);
    }
};

/** A directory is only the project if the pieces this app drives are in it. */
const looksLikeProject = (dir) => Boolean(dir)
    && fs.existsSync(path.join(dir, 'server.js'))
    && fs.existsSync(path.join(dir, 'package.json'));

let PROJECT_ROOT = app.isPackaged
    ? (readConfiguredRoot() || DEFAULT_PROJECT_ROOT)
    : path.resolve(__dirname, '..');

const distDir = () => path.join(PROJECT_ROOT, 'dist');

let apiProcess = null;
let staticServer = null;
let mainWindow = null;

/** Is something already answering on the API port? */
const apiAlreadyRunning = () => new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: API_PORT, path: '/appData', timeout: 1500 }, (res) => {
        res.resume();
        resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
});

/** Wait until the API answers, so the window never loads against a dead backend. */
const waitForApi = async (timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await apiAlreadyRunning()) return true;
        await new Promise((r) => setTimeout(r, 400));
    }
    return false;
};

const startApi = async () => {
    if (await apiAlreadyRunning()) {
        console.log('[electron] API already running on', API_PORT, '— attaching to it');
        return;
    }

    console.log('[electron] starting server.js');
    apiProcess = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server.js')], {
        cwd: PROJECT_ROOT,
        env: {
            ...process.env,
            SQLITE_READS: 'on',
            SQLITE_WRITES: 'on',
            // ELECTRON_RUN_AS_NODE makes the bundled Electron binary behave as a
            // plain node, so there is no separate Node install to depend on.
            ELECTRON_RUN_AS_NODE: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    apiProcess.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`));
    apiProcess.stderr.on('data', (d) => process.stderr.write(`[api] ${d}`));
    apiProcess.on('exit', (code) => {
        console.log('[electron] server.js exited with', code);
        apiProcess = null;
    });
};

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
};

// The database stores uploaded photos and paperwork as root-relative URLs
// (/api/images/necklace-1788593441893.jpg) so they stay portable across hosts.
// Vite's dev server proxies these to the API; this shell has to do the same, or
// the SPA fallback below answers an <img> with index.html — a 200 full of HTML,
// so the image simply never appears and nothing logs an error.
const API_PROXY_PREFIXES = ['/api/images', '/api/documents', '/api/upload'];

/** Forward a request to server.js untouched, streaming the reply back. */
const proxyToApi = (req, res) => {
    const upstream = http.request(
        {
            host: '127.0.0.1',
            port: API_PORT,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: `localhost:${API_PORT}` },
        },
        (apiRes) => {
            res.writeHead(apiRes.statusCode || 502, apiRes.headers);
            apiRes.pipe(res);
        }
    );

    upstream.on('error', (err) => {
        console.error('[electron] proxy to API failed:', err.message);
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('The finance server did not answer.');
    });

    // Piped rather than buffered: /api/upload carries whole documents, and
    // photos come back at full resolution.
    req.pipe(upstream);
};

/**
 * The gold rate comes from goldprice.org, which rejects requests without a
 * browser-shaped User-Agent and Referer — the same headers vite.config.js sets.
 * Proxied here too so a rate failure surfaces as the app's own "rate service
 * returned 403" banner rather than as HTML arriving where JSON was expected.
 */
const proxyToGoldPrice = (req, res) => {
    const upstreamPath = req.url.replace(/^\/api\/goldprice/, '') || '/';
    const upstream = https.request(
        {
            host: 'data-asg.goldprice.org',
            path: upstreamPath,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'application/json, text/plain, */*',
                Referer: 'https://goldprice.org/',
            },
        },
        (rateRes) => {
            res.writeHead(rateRes.statusCode || 502, rateRes.headers);
            rateRes.pipe(res);
        }
    );

    upstream.on('error', (err) => {
        console.error('[electron] gold rate proxy failed:', err.message);
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('The rate service could not be reached.');
    });

    upstream.end();
};

/**
 * Serves the built frontend. A path with no file extension falls back to
 * index.html because React Router owns those routes — without it, opening the
 * app on /savings or reloading anywhere but / would 404.
 */
const startStaticServer = () => new Promise((resolve, reject) => {
    staticServer = http.createServer((req, res) => {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);

        // Proxies come first: these paths must never reach the SPA fallback.
        if (urlPath.startsWith('/api/goldprice')) {
            return proxyToGoldPrice(req, res);
        }
        if (API_PROXY_PREFIXES.some((prefix) => urlPath.startsWith(prefix))) {
            return proxyToApi(req, res);
        }

        const root = distDir();
        let filePath = path.join(root, urlPath);

        // Never serve outside dist, whatever the request says.
        if (!filePath.startsWith(root)) {
            res.writeHead(403).end('Forbidden');
            return;
        }

        if (!path.extname(filePath) || !fs.existsSync(filePath)) {
            filePath = path.join(root, 'index.html');
        }

        fs.readFile(filePath, (err, body) => {
            if (err) {
                res.writeHead(404).end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
            res.end(body);
        });
    });

    staticServer.on('error', reject);
    staticServer.listen(UI_PORT, '127.0.0.1', () => resolve());
});

/**
 * Ask where the project lives, once, and remember the answer.
 * Returns null if the user cancels, which quits rather than opening a window
 * onto nothing.
 */
const promptForProjectFolder = async (attempted) => {
    const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Finance project not found',
        message: 'The Finance Analyser folder could not be found.',
        detail: `Looked in:\n${attempted}\n\nIf the folder was moved or renamed, choose its new location. This app reads the database, backups and server from there — it does not keep its own copy.`,
        buttons: ['Choose Folder…', 'Quit'],
        defaultId: 0,
        cancelId: 1,
    });

    if (response !== 0) return null;

    const picked = await dialog.showOpenDialog({
        title: 'Select the Finance_Analyser folder',
        properties: ['openDirectory'],
    });

    if (picked.canceled || !picked.filePaths.length) return null;

    const dir = picked.filePaths[0];
    if (!looksLikeProject(dir)) {
        dialog.showErrorBox(
            'That is not the project folder',
            `${dir}\n\ndoes not contain server.js and package.json. Pick the Finance_Analyser folder itself.`
        );
        return promptForProjectFolder(attempted);
    }
    return dir;
};

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'Kubera',
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0a0a14',
        show: false,
        webPreferences: {
            // The renderer is only ever the app's own built bundle, and it needs
            // no privileged APIs — it talks to the backend over HTTP like the
            // browser version does.
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.loadURL(`http://localhost:${UI_PORT}`);

    // External links open in the real browser rather than replacing the app.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });
};

app.whenReady().then(async () => {
    // Locate the installation before anything tries to read from it. Asking is
    // better than a blank window: a moved or renamed project folder is the one
    // predictable way this app breaks, and it should say so plainly.
    if (!looksLikeProject(PROJECT_ROOT)) {
        const chosen = await promptForProjectFolder(PROJECT_ROOT);
        if (!chosen) {
            app.quit();
            return;
        }
        PROJECT_ROOT = chosen;
        writeConfiguredRoot(chosen);
    }

    if (!fs.existsSync(path.join(distDir(), 'index.html'))) {
        dialog.showErrorBox(
            'The app has not been built yet',
            `No dist/index.html found in:\n${PROJECT_ROOT}\n\nRun "npm run build" there, then start the app again.`
        );
        app.quit();
        return;
    }

    await startApi();
    const ready = await waitForApi();
    if (!ready) {
        dialog.showErrorBox(
            'The finance server did not start',
            'Nothing answered on port 3000 within 30 seconds.\n\nCheck the terminal output for what server.js reported.'
        );
        app.quit();
        return;
    }

    await startStaticServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

/**
 * Only the API instance this app started is stopped. One that was already
 * running belongs to a terminal somebody else is using, and killing it would
 * take down their session — and, with json-server mid-write, could truncate
 * db.json.
 */
const shutdown = () => {
    if (apiProcess) {
        console.log('[electron] stopping the server.js this app started');
        apiProcess.kill('SIGTERM');
        apiProcess = null;
    }
    if (staticServer) {
        staticServer.close();
        staticServer = null;
    }
};

app.on('before-quit', shutdown);
process.on('exit', shutdown);
