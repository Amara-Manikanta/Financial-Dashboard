import test from 'node:test';
import assert from 'node:assert/strict';
import { promptHoldings, dailyPrompt, weeklyPrompt, deepDivePrompt, sectorSummary, scheduledPrompt, holdingsMarkdown } from './researchPrompt.js';
import { parseResearch } from './researchImport.js';

const stocks = [
    { id: 1, name: 'Infosys Limited', sector: 'IT', currentPrice: 1182, transactions: [
        { id: 'a', type: 'buy', date: '2025-03-01', quantity: 10, price: 1200 }, { id: 'b', type: 'buy', date: '2025-09-01', quantity: 8, price: 1400 }] },
    { id: 2, name: 'Sold Out Ltd', currentPrice: 10, transactions: [{ id: 'c', type: 'buy', date: '2025-01-01', quantity: 1, price: 10 }, { id: 'd', type: 'sell', date: '2025-02-01', quantity: 1, price: 12 }] },
    { id: 3, name: 'Archived Co', isArchived: true, currentPrice: 5, transactions: [{ id: 'e', type: 'buy', date: '2025-01-01', quantity: 5, price: 5 }] },
    { id: 4, name: 'Big One', sector: 'Banks', currentPrice: 100, transactions: [{ id: 'f', type: 'buy', date: '2024-01-01', quantity: 100, price: 90 }] },
];

test('holdings carry worked-out figures and exclude sold-out and archived ones, largest first', () => {
    const rows = promptHoldings(stocks, new Map([['1', { call: 'HOLD', date: '2026-11-01' }]]));
    assert.deepEqual(rows.map((r) => r.name), ['Infosys Limited', 'Big One']);
    const inf = rows[0];
    assert.equal(inf.qty, 18);
    assert.equal(Math.round(inf.avg * 100) / 100, 1288.89);
    assert.equal(inf.since, '2025-03-01');
    assert.equal(inf.lastCall, 'HOLD (2026-11-01)');
    assert.ok(inf.gainPct < 0);
});

test('the daily prompt asks for the exact table the importer reads, and lists every holding', () => {
    const rows = promptHoldings(stocks);
    const p = dailyPrompt(rows, { today: '2026-11-02' });
    assert.match(p, /as of 2 November 2026/);
    assert.match(p, /\| Stock \| Price \| 52-week position \| Recommendation \| Confidence \| Reason \| Key News \(Date & Source\) \| What Would Change My View \|/);
    assert.match(p, /exactly ONE word per stock/);
    assert.match(p, /3 October 2026|3 October/);
    assert.match(p, /must come FIRST/);
    rows.forEach((r) => assert.ok(p.includes(`| ${r.name} |`)));
    // A reply in the requested shape reads back cleanly.
    const reply = '| Stock | Price | 52-week position | Recommendation | Confidence | Reason | Key News (Date & Source) | What Would Change My View |\n|---|---|---|---|---|---|---|---|\n| Infosys Limited | 1,182.00 | Bottom: 27.0% | ACCUMULATE | MEDIUM | Cheap. | Guidance cut (24 Oct, NDTV https://x) | Below 980 |';
    const parsed = parseResearch(reply);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].price, 1182);
    assert.deepEqual(parsed.rows[0].range, { label: 'Bottom', pct: 27 });
    assert.equal(parsed.rows[0].call, 'ACCUMULATE');
    assert.equal(parsed.rows[0].confidence, 'MEDIUM');
});

test('the deep-dive prompt names each flagged stock and why', () => {
    const rows = promptHoldings(stocks).slice(0, 1);
    const p = deepDivePrompt(rows, { [rows[0].id]: 'call changed HOLD → REVIEW' }, { today: '2026-11-02' });
    assert.match(p, /Infosys Limited: call changed HOLD → REVIEW/);
    assert.match(p, /1 Indian stock below/);
});

test('the daily prompt names the file to write only when the app knows the folder', () => {
    const rows = promptHoldings(stocks);
    assert.doesNotMatch(dailyPrompt(rows, { today: '2026-11-02' }), /Saving:/);
    const p = dailyPrompt(rows, { today: '2026-11-02', saveTo: '/Users/me/proj/db/research/inbox/' });
    assert.match(p, /\/Users\/me\/proj\/db\/research\/inbox\/research-2026-11-02-HHMM\.md/);
    assert.match(p, /current time in India/);
    assert.match(p, /changing no other file/);
});

test('the weekly prompt hands over weights and sector shares worked out here, and asks for an importable table first', () => {
    const rows = promptHoldings(stocks);
    const p = weeklyPrompt(rows, { today: '2026-11-02', saveTo: '/x/inbox' });
    assert.match(p, /Weight %/);
    assert.match(p, /Value by sector/);
    assert.match(p, /\/x\/inbox\/research-2026-11-02-weekly\.md/);
    assert.match(p, /PART 2/);
    const sectors = sectorSummary(rows);
    assert.equal(Math.round(sectors.reduce((a, x) => a + x.pct, 0)), 100);
    assert.equal(sectors[0].sector, 'Information Technology');
});

test('the scheduled prompt carries no date or figures, points at the holdings file and asks for an importable table', () => {
    const p = scheduledPrompt({ holdingsPath: '/x/db/research/holdings.md', saveTo: '/x/db/research/inbox/' });
    assert.match(p, /\/x\/db\/research\/holdings\.md/);
    assert.match(p, /research-YYYY-MM-DD-HHMM\.md/);
    assert.match(p, /inbox\/research-YYYY/);
    assert.doesNotMatch(p, /20\d\d-\d\d-\d\d(?!-HH)/);
    assert.doesNotMatch(p, /Infosys/);
    assert.match(p, /My last call/);
    assert.match(p, /market hours/i);
    const header = p.split('\n').find((l) => l.startsWith('| Stock |'));
    assert.equal(parseResearch(`${header}\n|---|---|---|---|---|---|---|---|\n| Infosys Limited | 1,182.00 | Bottom: 27% | HOLD | HIGH | r | n | t |`).rows[0].call, 'HOLD');
});

test('the holdings file lists every holding with the time it was written', () => {
    const md = holdingsMarkdown(promptHoldings(stocks, new Map([['1', { call: 'HOLD', date: '2026-11-02' }]])), { asOf: '2026-11-02 10:15' });
    assert.match(md, /Written: 2026-11-02 10:15/);
    assert.match(md, /Infosys Limited/);
    assert.match(md, /Big One/);
    assert.doesNotMatch(md, /Sold Out/);
});
