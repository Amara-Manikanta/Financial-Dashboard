import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    configureArchive, mergeIntoArchive, archiveDigest, readArchive, themeOf, toCsv, parseCsv, attachAnalysis, fileFor,
} from './newsArchive.js';
import { heldStocksIn, analyseLatest } from './news.js';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const fresh = () => configureArchive({ archiveDir: fs.mkdtempSync(path.join(os.tmpdir(), 'arch-')) });

test('themes come from keywords, first rule wins', () => {
    assert.equal(themeOf({ title: 'Infosys announces buyback at ₹1,800' }), 'corporate action');
    assert.equal(themeOf({ title: 'Infosys Q2 profit rises 5%' }), 'results');
    assert.equal(themeOf({ title: 'Jefferies downgrades Infosys, cuts target' }), 'analyst ratings');
    assert.equal(themeOf({ title: 'SEBI issues notice to company' }), 'regulation & legal');
    assert.equal(themeOf({ title: 'Infosys bags $1.5 billion deal' }), 'deals & orders');
    assert.equal(themeOf({ title: 'Markets open flat' }), 'other');
});

test('CSV survives commas, quotes, line breaks, and defuses spreadsheet formulas', () => {
    const csv = toCsv([{ id: 'a', title: 'Profit up, "beats" estimates', key_points: 'One.\nTwo.', summary: '=HYPERLINK("x")', why_it_matters: '-3.8% margin' }]);
    assert.match(csv, /'=HYPERLINK/);
    const [row] = parseCsv(csv);
    assert.equal(row.title, 'Profit up, "beats" estimates');
    assert.equal(row.key_points, 'One.\nTwo.');
    assert.equal(row.summary, '=HYPERLINK("x")');
    assert.equal(row.why_it_matters, '-3.8% margin');
});

test('one CSV row per story: outlets join it, a year is kept, analysis survives new headlines', () => {
    fresh();
    mergeIntoArchive('INFY.NS', 'Infosys', [
        { title: 'Infosys Q2 profit rises 5%', source: 'Mint', url: 'https://mint/1', published: daysAgo(2) },
        { title: 'Ancient story', source: 'X', url: 'https://x/1', published: daysAgo(400) },
    ], NOW);
    const [story] = readArchive('INFY.NS').items;
    attachAnalysis('INFY.NS', story.id, { keyPoints: ['Net profit rose 5% to ₹6,500 crore.'], impact: 'positive', why: 'Growth resumed.', analysedBy: 'qwen', analysedAt: daysAgo(1), basis: 'article' });

    const second = mergeIntoArchive('INFY.NS', 'Infosys', [
        { title: 'Infosys Q2 net profit rises 5 per cent', source: 'ET', url: 'https://et/1', published: daysAgo(2), summary: 'Beat estimates.' },
        { title: 'Infosys bags $1.5 billion deal', source: 'BS', url: 'https://bs/1', published: daysAgo(45) },
    ], NOW);
    assert.equal(second.added, 1);
    const items = readArchive('INFY.NS').items;
    assert.deepEqual(items.map((i) => i.title), ['Infosys Q2 profit rises 5%', 'Infosys bags $1.5 billion deal']);
    assert.deepEqual(items[0].sources, ['Mint', 'ET']);
    assert.deepEqual(items[0].keyPoints, ['Net profit rose 5% to ₹6,500 crore.']);
    assert.equal(items[0].id, story.id);
    assert.match(fs.readFileSync(fileFor('INFY.NS'), 'utf8'), /^id,date,first_seen,company,theme,title,outlets,sources,impact,key_points/);
});

test('the digest gives today, dates with days ago, counts, and stored key points', () => {
    const d = archiveDigest('INFY.NS', 'Infosys', { now: NOW });
    assert.equal(d.count, 2);
    assert.equal(d.analysed, 1);
    assert.match(d.lines[0], /^Today is 30 Sept 2026\./);
    assert.match(d.lines[1], /2 stories stored since 16 Aug 2026\. last 7 days: 1 story \(results 1; read as positive 1\)/);
    assert.ok(d.lines.some((l) => /28 Sept 2026 \(2 days ago, collected 30 Sept 2026\) \[results\] Infosys Q2 profit rises 5% \(Mint, ET — 2 outlets\)/.test(l)));
    assert.ok(d.lines.some((l) => /Key points \(positive; read 29 Sept 2026 from the article\): Net profit rose 5%/.test(l)));
    assert.ok(d.lines.some((l) => /16 Aug 2026 \(45 days ago, collected 30 Sept 2026\) \[deals & orders\] Infosys bags/.test(l)));
});

test('analysing reads the article, stores key points only, and records unreadable stories', async (t) => {
    fresh();
    mergeIntoArchive('TCS.NS', 'TCS', [
        { title: 'TCS wins large UK pension deal', source: 'Reuters', url: 'https://example.com/tcs-deal', published: new Date().toISOString() },
        { title: 'TCS board meets on Friday', source: 'Mint', url: 'https://news.google.com/rss/articles/abc', published: new Date(Date.now() - 3600000).toISOString() },
    ]);
    const article = 'Tata Consultancy Services said on Monday it had won a ten-year contract to run administration for a large UK pension scheme. '.repeat(4);
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        const u = String(url);
        if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'qwen3-4b-instruct' }] }), { status: 200 });
        if (u.endsWith('/chat/completions')) {
            const body = JSON.parse(init.body);
            assert.match(body.messages[1].content, /ten-year contract/);
            return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ key_points: ['TCS won a ten-year UK pension administration contract.'], impact: 'positive', why_it_matters: 'Adds long-term revenue.' }) } }] }), { status: 200 });
        }
        return new Response(`<html><body><article><h1>Deal</h1><p>${article}</p></article></body></html>`, { status: 200 });
    });
    const done = await analyseLatest('TCS.NS', 'TCS');
    assert.deepEqual({ analysed: done.analysed, skipped: done.skipped }, { analysed: 1, skipped: 1 });
    const [deal, board] = readArchive('TCS.NS').items;
    assert.deepEqual(deal.keyPoints, ['TCS won a ten-year UK pension administration contract.']);
    assert.equal(deal.impact, 'positive');
    assert.equal(deal.basis, 'article');
    assert.match(board.status, /^not read: no direct link/);
    assert.doesNotMatch(fs.readFileSync(fileFor('TCS.NS'), 'utf8'), /administration for a large UK pension scheme\. Tata/); // the article itself is not kept
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
