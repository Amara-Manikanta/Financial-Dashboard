import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { configureStrategy, saveSnapshot, readSnapshots, deleteSnapshot } from './strategy.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'strategy-'));
const row = (name, call = 'HOLD', extra = {}) => ({ name, call, holdingId: '1', reason: 'r', ...extra });

test('saving a day, reading it back, and replacing it the same day', () => {
    configureStrategy({ strategyDir: tmp() });
    const a = saveSnapshot({ date: '2026-11-02', rows: [row('Infosys Limited', 'HOLD'), row('IRCTC', 'REVIEW', { holdingId: '2' })], source: 'antigravity' });
    assert.equal(a.rows.length, 2);
    saveSnapshot({ date: '2026-11-02', rows: [row('Infosys Limited', 'BUY')] });
    saveSnapshot({ date: '2026-11-03', rows: [row('Infosys Limited', 'SELL')] });
    const all = readSnapshots();
    assert.deepEqual(all.map((s) => s.date), ['2026-11-02', '2026-11-03']);
    assert.equal(all[0].rows.length, 1, 'the second paste of the same day replaced the first');
    assert.equal(all[0].rows[0].call, 'BUY');
});

test('bad input is refused with a reason and writes nothing', () => {
    const dir = tmp();
    configureStrategy({ strategyDir: dir });
    assert.match(saveSnapshot({ date: 'tomorrow', rows: [row('A')] }).error, /date/);
    assert.match(saveSnapshot({ date: '2026-02-30', rows: [row('A')] }).error, /date/, 'a day that does not exist');
    assert.match(saveSnapshot({ date: '2026-11-02', rows: [] }).error, /no rows/);
    assert.match(saveSnapshot({ date: '2026-11-02', rows: [{ name: 'A', call: 'MAYBE' }] }).error, /None of the rows/);
    assert.match(saveSnapshot({ date: '2026-11-02', rows: Array.from({ length: 201 }, () => row('A')) }).error, /Too many/);
    assert.deepEqual(fs.existsSync(dir) ? fs.readdirSync(dir) : [], []);
});

test('a path in the date cannot escape the folder; long text is cut; a damaged file is skipped', () => {
    const dir = tmp();
    configureStrategy({ strategyDir: dir });
    assert.ok(saveSnapshot({ date: '../../etc/passwd', rows: [row('A')] }).error);
    const s = saveSnapshot({ date: '2026-11-02', rows: [row('A', 'HOLD', { reason: 'x'.repeat(5000) })] });
    assert.equal(s.rows[0].reason.length, 1500);
    fs.writeFileSync(path.join(dir, '2026-11-01.json'), '{ not json');
    assert.deepEqual(readSnapshots().map((x) => x.date), ['2026-11-02']);
    assert.equal(deleteSnapshot('2026-11-02'), true);
    assert.equal(deleteSnapshot('2026-11-02'), false);
    assert.equal(deleteSnapshot('../x'), false);
});
