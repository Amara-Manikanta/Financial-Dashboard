import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { createLanAccess, isLoopback } from './lanAccess.js';

const PORT = 45000 + Math.floor(Math.random() * 1000);

const setup = async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-'));
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<html><head></head><body>app</body></html>');
    const lan = createLanAccess({ stateFile: path.join(dir, 'lan.json'), distDir: path.join(dir, 'dist'), apiPort: 1, port: PORT, log: () => {} });
    await lan.setEnabled(true);
    return { dir, lan };
};

const call = (method, url, { body, token } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: url, method, agent: false, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; }).on('end', () => resolve({ status: res.statusCode, body: raw, json: (() => { try { return JSON.parse(raw); } catch { return null; } })() }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
});

test('only this Mac counts as loopback, including the IPv6-mapped form', () => {
    assert.ok(isLoopback('127.0.0.1') && isLoopback('::1') && isLoopback('::ffff:127.0.0.1'));
    assert.ok(!isLoopback('192.168.29.65') && !isLoopback(undefined) && !isLoopback('::ffff:192.168.1.5'));
});

test('pairing: a code works once, a token is needed afterwards, and only its hash is stored', async () => {
    const { dir, lan } = await setup();
    try {
        assert.equal((await call('GET', '/_api/expenses')).status, 401);
        const { code } = lan.startPairing();
        const paired = await call('POST', '/pair', { body: { code, name: 'My iPhone' } });
        assert.equal(paired.status, 200);
        const token = paired.json.token;
        assert.equal((await call('POST', '/pair', { body: { code } })).status, 410);          // single use
        assert.equal((await call('GET', '/', { token })).status, 200);
        assert.match((await call('GET', '/', { token })).body, /__KUBERA_API__="\/_api"/);
        assert.equal((await call('GET', '/_api/expenses', { token: 'nope' })).status, 401);
        assert.equal((await call('GET', '/api/lan/status', { token })).status, 403);          // Mac-only controls
        assert.ok(!fs.readFileSync(path.join(dir, 'lan.json'), 'utf8').includes(token));
        // Unpairing cuts access at once.
        lan.unpair(lan.status().devices[0].id);
        assert.equal((await call('GET', '/', { token })).status, 401);
    } finally { await lan.stop(); }
});

test('five wrong guesses kill the code, even if the sixth is right', async () => {
    const { lan } = await setup();
    try {
        const { code } = lan.startPairing();
        const wrong = code === '000000' ? '111111' : '000000';
        for (let i = 0; i < 4; i += 1) assert.equal((await call('POST', '/pair', { body: { code: wrong } })).status, 403);
        assert.equal((await call('POST', '/pair', { body: { code: wrong } })).status, 429);
        assert.equal((await call('POST', '/pair', { body: { code } })).status, 410);
    } finally { await lan.stop(); }
});

test('pairing survives a restart; switching off closes the door and forgets any code', async () => {
    const { dir, lan } = await setup();
    const { code } = lan.startPairing();
    const { json } = await call('POST', '/pair', { body: { code } });
    await lan.stop();
    const again = createLanAccess({ stateFile: path.join(dir, 'lan.json'), distDir: path.join(dir, 'dist'), apiPort: 1, port: PORT, log: () => {} });
    await again.init();
    try {
        assert.equal((await call('GET', '/', { token: json.token })).status, 200);
        await again.setEnabled(false);
        await assert.rejects(call('GET', '/ping'));
    } finally { await again.stop(); }
});
