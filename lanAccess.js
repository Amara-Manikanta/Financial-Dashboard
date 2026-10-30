/**
 * The only door to this Mac's finance data for other devices on the Wi-Fi.
 *
 * server.js (3000) and json-server (3001) answer this machine and nothing
 * else — they hold unauthenticated reads and writes to the whole database,
 * and used to answer anything on the network that asked. A phone gets in
 * through this gateway instead, and only after it has been paired:
 *
 *   1. The Mac's Profile page shows a six-digit code (good for five minutes,
 *      single use, dead after five wrong guesses).
 *   2. The phone sends it to POST /pair and gets back a long random token.
 *   3. Every later request carries that token (cookie for the web view,
 *      bearer header for the app itself). Only its hash is stored here, so
 *      reading this file does not let anyone in.
 *
 * Off by default. While on, the gateway serves the built UI and forwards
 * everything else to server.js over loopback, so the write guard, backups and
 * version checks apply to the phone exactly as they do to the Mac. It never
 * forwards the pairing controls (`/api/lan/*`): a paired phone must not be able
 * to mint codes or unpair others.
 *
 * Plain HTTP, because there is no certificate for a .local name; the traffic
 * stays on the home network, which is why pairing exists at all.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import os from 'os';
import { spawn } from 'child_process';

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_WRONG_GUESSES = 5;
const COOKIE = 'kubera_token';
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json', '.map': 'application/json',
};

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export const isLoopback = (addr) => {
    const a = String(addr || '').replace(/^::ffff:/, '');
    return a === '127.0.0.1' || a === '::1';
};

/** This machine's Wi-Fi address, for the phone to show and for manual entry. */
export const lanAddress = () => {
    for (const list of Object.values(os.networkInterfaces())) {
        for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return i.address;
    }
    return null;
};

export const createLanAccess = ({ stateFile, distDir, apiPort, port, log = console.log }) => {
    let state = { enabled: false, devices: [] };   // devices: { id, name, hash, pairedAt, lastSeen }
    let pairing = null;                            // { code, expiresAt, wrong }
    let server = null;
    let advert = null;

    try {
        const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        state = {
            enabled: saved.enabled === true,
            devices: Array.isArray(saved.devices) ? saved.devices.filter((d) => d?.id && d?.hash) : [],
        };
    } catch { /* first run: off, nobody paired */ }

    const save = () => {
        try {
            const tmp = `${stateFile}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
            fs.renameSync(tmp, stateFile);
        } catch (err) { log(`[lan] could not save pairing state: ${err.message}`); }
    };

    const findDevice = (token) => {
        if (!token) return null;
        const h = Buffer.from(sha(token));
        return state.devices.find((d) => {
            const b = Buffer.from(d.hash);
            return b.length === h.length && crypto.timingSafeEqual(b, h);
        }) || null;
    };

    const tokenOf = (req) => {
        const auth = String(req.headers.authorization || '');
        if (/^Bearer /i.test(auth)) return auth.slice(7).trim();
        const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`));
        return m ? m[1] : null;
    };

    const json = (res, status, body, extra = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra });
        res.end(JSON.stringify(body));
    };

    /* ------------------------------ pairing ------------------------------ */

    const startPairing = () => {
        pairing = { code: String(crypto.randomInt(0, 1000000)).padStart(6, '0'), expiresAt: Date.now() + CODE_TTL_MS, wrong: 0 };
        return { code: pairing.code, expiresAt: new Date(pairing.expiresAt).toISOString() };
    };

    const redeem = (code, name) => {
        if (!pairing || Date.now() > pairing.expiresAt) { pairing = null; return { ok: false, status: 410, error: 'No pairing code is active. Show a new one on the Mac.' }; }
        const given = Buffer.from(String(code || '').padStart(6, ' '));
        const want = Buffer.from(pairing.code);
        if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
            pairing.wrong += 1;
            if (pairing.wrong >= MAX_WRONG_GUESSES) { pairing = null; return { ok: false, status: 429, error: 'Too many wrong codes. Show a new one on the Mac.' }; }
            return { ok: false, status: 403, error: 'That code is not right.' };
        }
        pairing = null;
        const token = crypto.randomBytes(32).toString('hex');
        const device = {
            id: crypto.randomBytes(6).toString('hex'),
            name: String(name || 'iPhone').replace(/[^\p{L}\p{N} ._'’-]/gu, '').slice(0, 40) || 'iPhone',
            hash: sha(token),
            pairedAt: new Date().toISOString(),
            lastSeen: null,
        };
        state.devices.push(device);
        save();
        log(`[lan] paired "${device.name}"`);
        return { ok: true, token, device: { id: device.id, name: device.name } };
    };

    /* ------------------------------ gateway ------------------------------ */

    const forward = (req, res, upstreamPath) => {
        const headers = { ...req.headers, host: `127.0.0.1:${apiPort}`, 'x-kubera-lan': '1' };
        // The token is for this gateway; the API behind it never needs to see it.
        delete headers.cookie; delete headers.authorization; delete headers.origin;
        const up = http.request({ host: '127.0.0.1', port: apiPort, path: upstreamPath, method: req.method, headers }, (r) => {
            res.writeHead(r.statusCode || 502, r.headers);
            r.pipe(res);
        });
        up.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('The finance server on the Mac did not answer.'); });
        req.pipe(up);
    };

    const goldPrice = (req, res) => {
        const up = https.request({
            host: 'data-asg.goldprice.org', path: req.url.replace(/^\/api\/goldprice/, '') || '/', method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'application/json, text/plain, */*', Referer: 'https://goldprice.org/',
            },
        }, (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); });
        up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
        up.end();
    };

    const serveUi = (req, res, urlPath) => {
        let file = path.join(distDir, urlPath);
        if (!file.startsWith(distDir + path.sep) && file !== distDir) { res.writeHead(403).end('Forbidden'); return; }
        const isIndex = !path.extname(file) || !fs.existsSync(file);
        if (isIndex) file = path.join(distDir, 'index.html');
        fs.readFile(file, (err, body) => {
            if (err) { res.writeHead(404).end('Not found'); return; }
            const type = MIME[path.extname(file)] || 'application/octet-stream';
            if (isIndex) {
                // Same origin for the API, so the cookie reaches it and no CORS is needed.
                const html = body.toString('utf8').replace('<head>', '<head><script>window.__KUBERA_API__="/_api"</script>');
                res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
                res.end(html);
                return;
            }
            res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' });
            res.end(body);
        });
    };

    const handle = (req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

        // Anyone may ask whether a Kubera is here; the answer holds nothing.
        if (urlPath === '/ping') { json(res, 200, { app: 'kubera', paired: !!findDevice(tokenOf(req)) }); return; }

        if (urlPath === '/pair' && req.method === 'POST') {
            let raw = '';
            req.on('data', (c) => { raw += c; if (raw.length > 2000) req.destroy(); });
            req.on('end', () => {
                let body = {};
                try { body = JSON.parse(raw || '{}'); } catch { /* treated as a wrong code */ }
                const r = redeem(body.code, body.name);
                if (!r.ok) { json(res, r.status, { error: r.error }); return; }
                json(res, 200, { token: r.token, device: r.device }, {
                    'Set-Cookie': `${COOKIE}=${r.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
                });
            });
            return;
        }

        const device = findDevice(tokenOf(req));
        if (!device) {
            if (req.method === 'GET' && !urlPath.startsWith('/_api') && !urlPath.startsWith('/api')) {
                res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:-apple-system,sans-serif;background:#09090b;color:#e4e4e7;padding:2rem"><h2>Not paired</h2><p>Open the Kubera app on your iPhone and enter the code shown on the Mac (Profile → iPhone connection).</p>');
                return;
            }
            json(res, 401, { error: 'This device is not paired with the Mac.' });
            return;
        }
        if (!device.lastSeen || Date.now() - Date.parse(device.lastSeen) > 60000) { device.lastSeen = new Date().toISOString(); save(); }

        if (urlPath.startsWith('/api/lan')) { json(res, 403, { error: 'Pairing is managed on the Mac only.' }); return; }
        if (urlPath.startsWith('/api/goldprice')) { goldPrice(req, res); return; }
        if (urlPath.startsWith('/_api/')) { forward(req, res, req.url.slice('/_api'.length)); return; }
        // Root-relative photo and document URLs stored in the database.
        if (urlPath.startsWith('/api/')) { forward(req, res, req.url); return; }
        if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { error: 'Not allowed' }); return; }
        serveUi(req, res, urlPath);
    };

    /* --------------------------- start and stop --------------------------- */

    const startAdvert = () => {
        // Bonjour via the system's own dns-sd, so there is nothing to install.
        if (advert || process.platform !== 'darwin') return;
        const name = `Kubera on ${os.hostname().replace(/\.local$/, '')}`;
        advert = spawn('dns-sd', ['-R', name, '_kubera._tcp', 'local', String(port), 'v=1'], { stdio: 'ignore' });
        advert.on('error', () => { advert = null; });
        advert.on('exit', () => { advert = null; });
    };

    const stopAdvert = () => { if (advert) { advert.kill(); advert = null; } };

    const start = () => new Promise((resolve) => {
        if (server) { resolve(true); return; }
        const s = http.createServer(handle);
        s.on('error', (err) => { log(`[lan] could not listen on ${port}: ${err.message}`); server = null; resolve(false); });
        s.listen(port, '0.0.0.0', () => { server = s; startAdvert(); log(`[lan] iPhone gateway on port ${port}`); resolve(true); });
    });

    const stop = () => new Promise((resolve) => {
        stopAdvert();
        if (!server) { resolve(); return; }
        const s = server; server = null;
        s.closeAllConnections?.();
        s.close(() => resolve());
    });

    return {
        port,
        status: () => ({
            enabled: state.enabled,
            listening: !!server,
            port,
            address: lanAddress(),
            host: `${os.hostname().replace(/\.local$/, '')}.local`,
            pairing: pairing && Date.now() < pairing.expiresAt ? { expiresAt: new Date(pairing.expiresAt).toISOString() } : null,
            devices: state.devices.map(({ id, name, pairedAt, lastSeen }) => ({ id, name, pairedAt, lastSeen })),
        }),
        init: async () => { if (state.enabled) await start(); },
        setEnabled: async (on) => {
            state.enabled = !!on;
            save();
            if (on) await start(); else { pairing = null; await stop(); }
        },
        startPairing,
        unpair: (id) => {
            const before = state.devices.length;
            state.devices = id === 'all' ? [] : state.devices.filter((d) => d.id !== id);
            if (state.devices.length !== before) save();
            return before - state.devices.length;
        },
        stop,
    };
};
