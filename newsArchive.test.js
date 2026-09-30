import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { configureArchive, mergeIntoArchive, archiveDigest, readArchive, themeOf } from './newsArchive.js';
import { heldStocksIn } from './news.js';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

test('themes come from keywords, first rule wins', () => {
    assert.equal(themeOf({ title: 'Infosys announces buyback at ₹1,800' }), 'corporate action');
    assert.equal(themeOf({ title: 'Infosys Q2 profit rises 5%' }), 'results');
    assert.equal(themeOf({ title: 'Jefferies downgrades Infosys, cuts target' }), 'analyst ratings');
    assert.equal(themeOf({ title: 'SEBI issues notice to company' }), 'regulation & legal');
    assert.equal(themeOf({ title: 'Infosys bags $1.5 billion deal' }), 'deals & orders');
    assert.equal(themeOf({ title: 'Markets open flat' }), 'other');
});

test('archive keeps each story once, fills a missing description, and prunes after a year', () => {
    configureArchive({ archiveDir: fs.mkdtempSync(path.join(os.tmpdir(), 'arch-')) });
    mergeIntoArchive('INFY.NS', 'Infosys', [
        { title: 'Infosys Q2 profit rises 5%', source: 'Mint', published: daysAgo(2) },
        { title: 'Ancient story', source: 'X', published: daysAgo(400) },
    ], NOW);
    const second = mergeIntoArchive('INFY.NS', 'Infosys', [
        { title: 'Infosys Q2 profit rises 5%!', source: 'BS', published: daysAgo(2), summary: 'Beat estimates.' },
        { title: 'Infosys bags $1.5 billion deal', source: 'ET', published: daysAgo(45) },
    ], NOW);
    assert.equal(second.added, 1);
    const { items } = readArchive('INFY.NS');
    assert.deepEqual(items.map((i) => i.title), ['Infosys Q2 profit rises 5%', 'Infosys bags $1.5 billion deal']);
    assert.equal(items[0].summary, 'Beat estimates.');
});

test('the digest counts by theme per window and lists older stories by theme', () => {
    const d = archiveDigest('INFY.NS', 'Infosys', { now: NOW });
    assert.equal(d.count, 2);
    assert.match(d.lines[0], /2 headlines stored since 16 Aug 2026\. last 7 days: 1 \(results 1\); last 30 days: 1 \(results 1\); last 90 days: 2/);
    assert.ok(d.lines.some((l) => /earlier stories by theme/.test(l)));
    assert.ok(d.lines.some((l) => /\[deals & orders\] Infosys bags/.test(l)));
});

test('the collector reads only your own held stocks', () => {
    const db = { savings: [{ type: 'stock_market', stocks: [
        { name: 'Infosys', ticker: 'INFY', shares: 10 },
        { name: 'Sold', ticker: 'OLD', shares: 0 },
        { name: 'Dad', ticker: 'ITC', shares: 5, owner: 'fam_1' },
        { name: 'BSE one', ticker: 'ABC.BO', shares: 1 },
    ] }] };
    assert.deepEqual(heldStocksIn(db).map((s) => s.symbol), ['INFY.NS', 'ABC.BO']);
});
