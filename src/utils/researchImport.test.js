import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResearch, matchHoldings, compareCalls, latestCalls, callHistory, normaliseCall } from './researchImport.js';

// Rows in the shape Antigravity produced, including the awkward cells.
const MARKDOWN = `
| Stock | Recommendation | Reason | Key News (Date & Source) | What Would Change My View |
| :--- | :---: | :--- | :--- | :--- |
| **Infosys Limited** <br>\`₹1,182.00\` *(Bottom: 27.0%)* | **HOLD** | Trading near the bottom of its range. | Lowered FY27 guidance (*24 Oct 2026, NDTV*). | Guidance above 3.5%. |
| **Adani Ports & SEZ** <br>\`₹1,852.00\` *(Top: 93.5%)* | **HOLD** | Near the high. | Q2 revenue up 24% (*28 Oct 2026*). | A break below ₹1,700. |
| **Tata Power Company** <br>\`₹353.30\` *(Bottom: 15.3%)* | **BUY** | Bottom 15% of range. | Renewables up 130%. | Below ₹330. |
| **Vodafone Idea Limited** <br>\`₹12.08\` *(Middle: 51.6%)* | **REVIEW** | Solvency risk. | SBI-led debt talks. | Debt closure. |
| **Mystery Co** <br>\`₹1.00\` | **WATCH CLOSELY** | ? | ? | ? |
`;

const HOLDINGS = [
    { id: '1', name: 'Infosys Limited' },
    { id: '2', name: 'Adani Ports and Special Economic Zone Limited' },
    { id: '3', name: 'Tata Power Company Limited' },
    { id: '4', name: 'Vodafone Idea Limited' },
    { id: '5', name: 'Tata Motors Commercial Vehicles' },
    { id: '6', name: 'Nippon India Etf Gold Bees' },
    { id: '7', name: 'Indian Oil Corporation Limited' },
    { id: '8', name: 'The Indian Hotels Company Limited' },
    { id: '9', name: 'Adani Enterprises Limited' },
    { id: '10', name: 'Adani power Ltd' },
    { id: '11', name: 'Mindspace Business P Riet' },
    { id: '12', name: 'Larsen & Toubro Limited' },
];

test('reads the pasted markdown table: names, calls, reasons, price and range', () => {
    const { rows, skipped } = parseResearch(MARKDOWN);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((r) => r.call), ['HOLD', 'HOLD', 'BUY', 'REVIEW']);
    assert.equal(rows[0].name, 'Infosys Limited');
    assert.equal(rows[0].price, 1182);
    assert.deepEqual(rows[0].range, { label: 'Bottom', pct: 27 });
    assert.match(rows[0].news, /Lowered FY27 guidance/);
    assert.equal(rows[0].trigger, 'Guidance above 3.5%.');
    assert.equal(skipped.length, 1, 'a row with no readable call is reported, not guessed');
    assert.equal(skipped[0].name, 'Mystery Co');
});

test('only the first table is read; a second table below it is ignored', () => {
    const text = `${MARKDOWN}\n\nSector summary\n\n| Sector | Share |\n| --- | --- |\n| Banks | 22.9% |\n`;
    assert.equal(parseResearch(text).rows.length, 4);
});

test('reads tab-separated text copied from a rendered table', () => {
    const tsv = ['Stock\tRecommendation\tReason', 'Infosys Limited\tHOLD\tNear the low', 'Axis Bank\tAccumulate\tCheap'].join('\n');
    const { rows } = parseResearch(tsv);
    assert.deepEqual(rows.map((r) => [r.name, r.call]), [['Infosys Limited', 'HOLD'], ['Axis Bank', 'ACCUMULATE']]);
});

test('a missing table is an error, not an empty success', () => {
    assert.match(parseResearch('just some words').error, /No table/);
    assert.match(parseResearch('').error, /No table/);
});

test('call words: strong buy is a buy, exit is a sell, first word wins', () => {
    assert.equal(normaliseCall('**STRONG BUY**'), 'BUY');
    assert.equal(normaliseCall('EXIT'), 'SELL');
    assert.equal(normaliseCall('HOLD (or SELL if it breaks 100)'), 'HOLD');
    assert.equal(normaliseCall('Accumulate on dips'), 'ACCUMULATE');
    assert.equal(normaliseCall('maybe'), null);
});

test('names that differ in wording still find their holding; unclear ones are left for a person', () => {
    const rows = [
        { name: 'Adani Ports & SEZ', call: 'HOLD' }, { name: 'Tata Power Company', call: 'BUY' },
        { name: 'Tata Motors CV (TMCV)', call: 'HOLD' }, { name: 'Nippon Gold BeES', call: 'HOLD' },
        { name: 'Indian Oil Corp (IOC)', call: 'HOLD' }, { name: 'Indian Hotels (IHCL)', call: 'HOLD' },
        { name: 'Mindspace Business REIT', call: 'HOLD' }, { name: 'Larsen & Toubro', call: 'HOLD' },
        { name: 'Adani', call: 'HOLD' }, { name: 'Tata Steel', call: 'HOLD' }, { name: 'Unknown Corp', call: 'HOLD' },
    ];
    const m = matchHoldings(rows, HOLDINGS);
    const id = (name) => m.find((r) => r.name === name).holdingId;
    assert.equal(id('Adani Ports & SEZ'), '2');
    assert.equal(id('Tata Power Company'), '3');
    assert.equal(id('Nippon Gold BeES'), '6');
    assert.equal(id('Indian Oil Corp (IOC)'), '7');
    assert.equal(id('Indian Hotels (IHCL)'), '8');
    assert.equal(id('Larsen & Toubro'), '12');
    assert.equal(id('Tata Motors CV (TMCV)'), '5');
    assert.equal(id('Tata Steel'), null, 'one shared word out of two is not enough');
    assert.equal(id('Unknown Corp'), null);
    // "Adani" alone fits three holdings equally; it must not pick one.
    assert.equal(id('Adani'), null);
});

test('a name the person already resolved is remembered', () => {
    const m = matchHoldings([{ name: 'Tata Motors CV (TMCV)', call: 'HOLD' }], HOLDINGS, { 'tata motors cv (tmcv)': '5' });
    assert.equal(m[0].holdingId, '5');
    assert.equal(m[0].matchedBy, 'alias');
});

test('what changed since the last paste, with direction', () => {
    const prev = [{ holdingId: '1', call: 'HOLD' }, { holdingId: '3', call: 'HOLD' }, { holdingId: '4', call: 'HOLD' }];
    const now = [{ holdingId: '1', call: 'HOLD' }, { holdingId: '3', call: 'BUY' }, { holdingId: '4', call: 'REVIEW' }, { holdingId: '9', call: 'HOLD' }, { holdingId: null, call: 'HOLD' }];
    assert.deepEqual(compareCalls(prev, now).map((r) => r.change), ['same', 'upgrade', 'downgrade', 'new', 'unmatched']);
});

test('the newest call per holding survives a day it was left out; history shows only changes', () => {
    const snaps = [
        { date: '2026-11-01', rows: [{ holdingId: '1', call: 'HOLD', reason: 'a' }, { holdingId: '2', call: 'BUY', reason: 'x' }] },
        { date: '2026-11-02', rows: [{ holdingId: '1', call: 'HOLD', reason: 'b' }] },
        { date: '2026-11-04', rows: [{ holdingId: '1', call: 'SELL', reason: 'c' }] },
    ];
    const latest = latestCalls(snaps, '2026-11-04');
    assert.equal(latest.get('1').call, 'SELL');
    assert.equal(latest.get('2').call, 'BUY');
    assert.equal(latest.get('2').ageDays, 3, 'a stale call says how old it is');
    assert.deepEqual(callHistory(snaps, '1').map((h) => [h.date, h.call, h.changed]),
        [['2026-11-01', 'HOLD', true], ['2026-11-02', 'HOLD', false], ['2026-11-04', 'SELL', true]]);
});
