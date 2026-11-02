import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { configureStrategy, writeSettings, readSnapshots, listInbox } from './strategy.js';
import { importWaiting, writeHoldingsFile, holdingsFilePath } from './researchAuto.js';

const HEADER = '| Stock | Recommendation | Confidence | Reason |\n|---|---|---|---|\n';
const setup = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-'));
    const inbox = path.join(root, 'research', 'inbox');
    fs.mkdirSync(inbox, { recursive: true });
    const dbFile = path.join(root, 'db.json');
    fs.writeFileSync(dbFile, JSON.stringify({ savings: [{ type: 'stock_market', stocks: [
        { id: 1, name: 'Infosys Limited', shares: 18 }, { id: 2, name: 'Tata Power Company Limited', shares: 16 },
        { id: 3, name: 'Archived Co', shares: 5, isArchived: true }, { id: 4, name: 'Family Co', shares: 5, owner: 'father' },
    ] }] }));
    configureStrategy({ strategyDir: path.join(root, 'strategy'), inboxDir: inbox });
    return { root, inbox, dbFile };
};
const drop = (inbox, name, body, ageMs = 60000) => {
    const f = path.join(inbox, name);
    fs.writeFileSync(f, body);
    const t = new Date(Date.now() - ageMs);
    fs.utimesSync(f, t, t);
};

test('nothing is imported unless auto-import is switched on', () => {
    const { inbox, dbFile } = setup();
    drop(inbox, 'research-2026-11-02-0900.md', `${HEADER}| Infosys Limited | HOLD | HIGH | r |`);
    assert.match(importWaiting({ dbFile }).skipped, /off/);
    assert.equal(listInbox().length, 1);
});

test('a clean file is imported under its own date, then moved to done/', () => {
    const { inbox, dbFile } = setup();
    writeSettings({ autoImport: true });
    drop(inbox, 'research-2026-11-02-0900.md', `${HEADER}| Infosys Limited | HOLD | HIGH | r |\n| Tata Power Company | BUY | MEDIUM | r |`);
    const out = importWaiting({ dbFile });
    assert.deepEqual(out.results.map((r) => [r.status, r.date, r.rows]), [['imported', '2026-11-02', 2]]);
    const snap = readSnapshots()[0];
    assert.deepEqual(snap.rows.map((r) => [r.holdingId, r.call, r.confidence]), [['1', 'HOLD', 'HIGH'], ['2', 'BUY', 'MEDIUM']]);
    assert.equal(listInbox().length, 0);
});

test('hourly files for one day import oldest first, so the newest of the day stands', () => {
    const { inbox, dbFile } = setup();
    writeSettings({ autoImport: true });
    drop(inbox, 'research-2026-11-02-1000.md', `${HEADER}| Infosys Limited | BUY | LOW | later |`, 60000);
    drop(inbox, 'research-2026-11-02-0900.md', `${HEADER}| Infosys Limited | HOLD | LOW | earlier |`, 120000);
    importWaiting({ dbFile });
    const snaps = readSnapshots();
    assert.equal(snaps.length, 1);
    assert.equal(snaps[0].rows[0].reason, 'later');
});

test('a file with a name it cannot match, an unreadable row, or no table is left for a person', () => {
    const { inbox, dbFile } = setup();
    writeSettings({ autoImport: true });
    drop(inbox, 'a.md', `${HEADER}| Infosys Limited | HOLD | HIGH | r |\n| Mystery Co | BUY | HIGH | r |`);
    drop(inbox, 'b.md', `${HEADER}| Infosys Limited | HOLD | HIGH | r |\n| Tata Power Company | WATCH | HIGH | r |`);
    drop(inbox, 'c.md', 'no table here');
    drop(inbox, 'd.md', `${HEADER}| Family Co | HOLD | HIGH | r |`);
    const out = importWaiting({ dbFile });
    assert.deepEqual(out.results.map((r) => r.status), ['left', 'left', 'left', 'left']);
    assert.match(out.results.find((r) => r.name === 'a.md').why, /Mystery Co/);
    assert.match(out.results.find((r) => r.name === 'b.md').why, /not read/);
    assert.equal(readSnapshots().length, 0, 'nothing partial was saved');
    assert.equal(listInbox().length, 4);
});

test('a file written moments ago is left alone, and a remembered name match is used', () => {
    const { inbox, dbFile } = setup();
    writeSettings({ autoImport: true, aliases: { 'tata power co.': '2' } });
    drop(inbox, 'fresh.md', `${HEADER}| Infosys Limited | HOLD | HIGH | r |`, 1000);
    assert.equal(importWaiting({ dbFile }).results.length, 0);
    drop(inbox, 'research-2026-11-03-0800.md', `${HEADER}| Tata Power Co. | SELL | HIGH | r |`);
    assert.equal(importWaiting({ dbFile }).results[0].status, 'imported');
    assert.equal(readSnapshots()[0].rows[0].holdingId, '2');
});

test('settings keep only known keys', () => {
    setup();
    const s = writeSettings({ autoImport: true, evil: 'x', aliases: { 'A B': '5', bad: 7 } });
    assert.deepEqual(s, { autoImport: true, aliases: { 'a b': '5' } });
    assert.equal(writeSettings({ autoImport: 'yes' }).autoImport, true, 'a non-boolean leaves it as it was');
});

test('the holdings file lists current holdings only and is rewritten only when its content changes', () => {
    const { inbox, dbFile } = setup();
    const file = writeHoldingsFile({ dbFile, now: new Date('2026-11-02T04:45:00Z') });
    assert.equal(file, holdingsFilePath());
    assert.equal(path.dirname(file), path.dirname(inbox));
    const body = fs.readFileSync(file, 'utf8');
    assert.match(body, /Written: 2026-11-02 10:15/);
    assert.match(body, /Infosys Limited/);
    assert.doesNotMatch(body, /Archived Co|Family Co/);
    const t = new Date(Date.now() - 600000);
    fs.utimesSync(file, t, t);
    writeHoldingsFile({ dbFile, now: new Date('2026-11-02T05:45:00Z') });
    assert.equal(Math.round((Date.now() - fs.statSync(file).mtimeMs) / 60000), 10);
});
