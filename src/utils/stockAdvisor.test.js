import test from 'node:test';
import assert from 'node:assert/strict';
import {
    analysePortfolio, simulateSale, taxYear, llmFacts, indexMirror, symbolFor, RULES,
} from './stockAdvisor.js';
import { disposalsForStocks } from './capitalGains.js';

// 29 Sep 2026, local noon: financial year 2026-27, 183 days before 31 March.
const AS_OF = new Date(2026, 8, 29, 12);

let seq = 0;
const tx = (type, date, quantity, price) => ({ id: `t${++seq}`, type, date, quantity, price });
const buy = (date, quantity, price) => tx('buy', date, quantity, price);
const sell = (date, quantity, price) => tx('sell', date, quantity, price);
const dividend = (date, amount) => tx('dividend', date, 0, amount);

let ids = 0;
const stock = (name, price, transactions, extra = {}) => {
    let shares = 0;
    transactions.forEach((t) => {
        if (t.type === 'buy') shares += t.quantity;
        if (t.type === 'sell') shares -= t.quantity;
    });
    ids += 1;
    return {
        id: ids, name, ticker: name.toUpperCase().replace(/[^A-Z]/g, ''), sector: 'Industrials',
        currentPrice: price, shares, transactions, ...extra,
    };
};

/** Positions bought at today's price this year: weight without gains, losses or tax. */
const fillers = (count, value) => Array.from({ length: count }, (_, i) => stock(`Filler ${i}`, 100, [buy('2026-01-05', value / 100, 100)]));

const run = (opts) => analysePortfolio({ asOf: AS_OF, pricesUpdatedAt: AS_OF.toISOString(), ...opts });
const byId = (analysis, prefix) => analysis.findings.filter((f) => f.id.startsWith(prefix));
const evidence = (finding, label) => finding.evidence.find((e) => e.label === label)?.value;

test('a position over SEBI\'s 10% line gets a trim sized back to 10%, taxed first in, first out', () => {
    const big = stock('Big Co', 100, [buy('2021-03-01', 150, 60)]);
    const a = run({ stocks: [big, ...fillers(17, 5000)] });
    const [f] = byId(a, 'concentration:');
    assert.equal(f.severity, 'review');
    assert.match(f.title, /15\.0% of your stock portfolio/);
    assert.equal(f.trim.quantity, 50);
    // The oldest shares go first: a long-term gain inside the exemption.
    assert.equal(f.trim.longGain, 2000);
    assert.match(f.action, /inside this year's ₹1\.25L long-term exemption — no tax/);
    assert.equal(evidence(f, 'Tax on trim'), '₹0');
});

test('twice the line is urgent', () => {
    const big = stock('Big Co', 100, [buy('2021-03-01', 150, 60)]);
    const [f] = byId(run({ stocks: [big, ...fillers(9, 5000)] }), 'concentration:');
    assert.equal(f.severity, 'act');
});

test('a trim of shares about to turn long term says what waiting would save', () => {
    const big = stock('Big Co', 100, [buy('2025-10-20', 1500, 60)]);
    const [f] = byId(run({ stocks: [big, ...fillers(17, 50000)] }), 'concentration:');
    assert.equal(f.trim.quantity, 500);
    assert.match(f.action, /estimated tax ₹4,000/);
    assert.match(f.action, /Waiting until 21 Oct 2026 \(22 days\).*save about ₹4,000/);
});

test('sector limits are yours: a breach is reported against them, and none set is one nudge', () => {
    const fin = (name) => stock(name, 100, [buy('2026-01-05', 100, 100)], { sector: 'Financials' });
    const stocks = [fin('Bank A'), fin('Bank B'), fin('Bank C'), ...fillers(7, 10000)];

    const limited = run({ stocks, sectorLimits: { Financials: 20 } });
    const [breach] = byId(limited, 'sector:Financials');
    assert.match(breach.title, /30\.0% of your portfolio — over your 20% limit/);
    assert.equal(breach.impact, 10000);
    assert.equal(breach.severity, 'act');

    const unlimited = run({ stocks });
    assert.deepEqual(byId(unlimited, 'sector:').map((f) => f.id), ['sector:no-limits']);
    assert.equal(byId(unlimited, 'sector:')[0].severity, 'info');
});

test('alerts you set fire for holdings and the watchlist, but never on a missing price', () => {
    const held = stock('Held', 1720, [buy('2026-01-05', 1, 1720)], { alerts: [{ id: 'a1', type: 'above', price: 1700, note: 'take profit' }] });
    const unpriced = stock('Unpriced', 0, [buy('2021-01-05', 10, 50)], { alerts: [{ id: 'a2', type: 'below', price: 40 }] });
    const watch = { id: 'w1', name: 'Watched', ticker: 'WATCHED', priority: 'ready', currentPrice: 5200, alerts: [{ id: 'a3', type: 'below', price: 5300 }] };
    const a = run({ stocks: [held, unpriced, ...fillers(20, 10000)], watchlist: [watch] });
    const alerts = byId(a, 'alert:');
    assert.deepEqual(alerts.map((f) => f.id).sort(), [`alert:holding:${held.id}:a1`, 'alert:watchlist:w1:a3']);
    assert.ok(alerts.every((f) => f.severity === 'act'));
    assert.match(alerts.find((f) => f.id.includes('holding')).detail, /Your note: “take profit”/);
    // The alert already covers it, so the watchlist rule stays quiet.
    assert.equal(byId(a, 'watchlist:').length, 0);
});

test('watchlist: your priority decides, the 52-week range only times it', () => {
    const entry = (id, priority, price) => ({
        id, name: id, ticker: id, priority, currentPrice: price,
        quote: { price, fiftyTwoWeekLow: 2650, fiftyTwoWeekHigh: 3400 },
    });
    const a = run({
        stocks: fillers(10, 10000),
        watchlist: [entry('ready', 'ready', 2750), entry('interested', 'interested', 2750), entry('watching', 'watching', 2750), entry('readyhigh', 'ready', 3300)],
    });
    const found = Object.fromEntries(byId(a, 'watchlist:').map((f) => [f.watchlistId, f.severity]));
    assert.deepEqual(found, { ready: 'review', interested: 'info' });
});

test('the unused long-term exemption is harvested to the rupee, most gain per rupee sold first', () => {
    const sold = stock('Sold Co', 3650, [buy('2021-05-10', 20, 1400), sell('2026-07-10', 20, 3600)]); // +44,000 LT this year
    const ntpc = stock('NTPC', 340, [buy('2022-02-14', 300, 170)]); // +51,000 on 1,02,000: 50%
    const itc = stock('ITC', 405, [buy('2021-01-18', 400, 210)]); // +78,000 on 1,62,000: 48%
    const stocks = [sold, ntpc, itc, ...fillers(30, 50000)];
    const a = run({ stocks });
    const [f] = byId(a, 'tax:harvest-exemption:');
    assert.match(f.title, /Book up to ₹80,835/);
    assert.match(f.action, /NTPC 300 shares \(gain ₹51,000\) · ITC 153 shares \(gain ₹29,835\)/);
    assert.equal(evidence(f, 'Exemption left'), '₹81,000');
    assert.equal(evidence(f, 'Tax now'), '₹0');

    // The plan is the most the allowance takes: one more ITC share is taxed.
    const taxWith = (itcShares) => taxYear([
        ...disposalsForStocks([sold]).disposals,
        ...simulateSale(ntpc, 300, 340, '2026-09-29').disposals,
        ...simulateSale(itc, itcShares, 405, '2026-09-29').disposals,
    ], '2026-27').row.estimatedTax;
    assert.equal(taxWith(153), 0);
    assert.ok(taxWith(154) > 0);
});

test('while losses are carried forward there is no exemption to harvest — the pool is reported instead', () => {
    const loser = stock('Loser', 300, [buy('2023-01-10', 100, 500), sell('2024-06-10', 100, 300)]); // LT loss 20,000
    const winner = stock('Winner', 340, [buy('2022-02-14', 300, 170)]);
    const a = run({ stocks: [loser, winner, ...fillers(20, 50000)] });
    assert.equal(byId(a, 'tax:harvest-exemption:').length, 0);
    const [pool] = byId(a, 'tax:carried:');
    assert.equal(pool.severity, 'info');
    assert.match(pool.title, /₹20,000 of capital losses on record/);
    assert.match(pool.detail, /until FY 2032-33/);
});

test('losses in their last usable year raise an urgent plan that really uses them', () => {
    const old = stock('Old Loss', 300, [buy('2018-05-01', 100, 500), sell('2018-12-01', 100, 300)]); // ST loss 20,000 in FY 2018-19
    const winner = stock('Winner', 340, [buy('2022-02-14', 300, 170)]);
    const a = run({ stocks: [old, winner, ...fillers(20, 50000)] });
    const [f] = byId(a, 'tax:carried-lapsing:');
    assert.equal(f.severity, 'act');
    assert.match(f.title, /₹20,000 of carried-forward losses lapse after 31 March/);
    assert.match(f.action, /Winner 117 shares \(gain ₹19,890\)/);
    assert.equal(evidence(f, 'Used by this plan'), '₹19,890');
});

test('a short-term loss is suggested only when it cuts tax actually due', () => {
    const gain = stock('Gain', 7950, [buy('2025-12-01', 10, 6800), sell('2026-06-15', 10, 7900)]); // +11,000 ST this year
    const stLoss = stock('Short Loser', 265, [buy('2026-03-10', 200, 290)]); // -5,000 ST
    const ltLoss = stock('Long Loser', 2450, [buy('2022-03-14', 25, 3100)]); // -16,250 LT: cannot meet a ST gain
    const a = run({ stocks: [gain, stLoss, ltLoss, ...fillers(20, 50000)] });
    const found = byId(a, 'tax:loss:');
    assert.deepEqual(found.map((f) => f.holdingId), [stLoss.id]);
    assert.match(found[0].title, /Booking the ₹5,000 loss on Short Loser cuts this year's tax by ₹1,000/);
});

test('a short-term loss offsets a long-term gain above the exemption in the same year', () => {
    const lt = stock('Big Sale', 300, [buy('2020-01-01', 1000, 100), sell('2026-05-01', 1000, 300)]); // +2,00,000 LT
    const stLoss = stock('Short Loser', 265, [buy('2026-03-10', 200, 390)]); // -25,000 ST
    const a = run({ stocks: [lt, stLoss, ...fillers(20, 50000)] });
    const [f] = byId(a, 'tax:loss:');
    // Taxable long-term drops from ₹75,000 to ₹50,000 at 12.5%.
    assert.match(f.title, /cuts this year's tax by ₹3,125/);
});

test('profitable lots turning long term soon say when, and what waiting saves', () => {
    const coal = stock('Coal', 412, [buy('2025-10-20', 120, 330)]);
    const a = run({ stocks: [coal, ...fillers(20, 50000)] });
    const [f] = byId(a, 'tax:wait:');
    assert.equal(f.id, `tax:wait:${coal.id}:2026-10-21`);
    assert.equal(f.impact, 1968);
    assert.match(f.title, /selling after 21 Oct 2026 saves about ₹1,968/);
});

test('fundamentals: "Review for Exit" is worth a look, "Consider Trimming" is information, "Buy" is silence', () => {
    const exit = stock('Exit Co', 690, [buy('2024-05-06', 60, 980)]);
    const trim = stock('Trim Co', 405, [buy('2021-01-18', 40, 210)]);
    const fine = stock('Fine Co', 100, [buy('2026-01-05', 100, 100)]);
    const score = (action, label, checks) => ({ signal: { action, label, reasons: ['r1', 'r2'] }, healthScore: { total: 1, max: 5, checks } });
    const fundamentals = {
        [symbolFor(exit)]: score('sell', 'Review for Exit', [{ name: 'Debt Health', status: 'bad', detail: 'D/E ratio 1.50' }]),
        [symbolFor(trim)]: score('trim', 'Consider Trimming', [{ name: 'Valuation', status: 'caution', detail: 'Forward P/E 24.0x' }]),
        [symbolFor(fine)]: score('buy', 'Buy on Dips', []),
    };
    const a = run({ stocks: [exit, trim, fine, ...fillers(20, 50000)], fundamentals });
    const found = Object.fromEntries(byId(a, 'fundamentals:').map((f) => [f.holdingId, f]));
    assert.equal(found[exit.id].severity, 'review');
    assert.equal(evidence(found[exit.id], 'Debt Health'), 'D/E ratio 1.50');
    assert.match(found[exit.id].action, /below cost/);
    assert.equal(found[trim.id].severity, 'info');
    assert.equal(evidence(found[trim.id], 'Valuation'), 'Forward P/E 24.0x', 'caution checks shown when none failed outright');
    assert.equal(found[fine.id], undefined);
});

test('index comparison mirrors every cash flow, and skips what the history cannot cover', () => {
    const closes = {};
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2026, 8, 29);
    for (let t = start; t <= end; t += 86400000) closes[new Date(t).toISOString().slice(0, 10)] = 100 * (1 + (t - start) / (end - start));

    const flat = stock('Flat Co', 100, [buy('2021-01-04', 100, 100), dividend('2023-06-01', 500)]);
    const early = stock('Early Co', 100, [buy('2019-06-03', 100, 100)]);
    const m = indexMirror(flat, closes, AS_OF);
    assert.equal(m.invested, 10000);
    assert.equal(m.returned, 500);
    assert.equal(indexMirror(early, closes, AS_OF), null);

    const a = run({ stocks: [flat, early, ...fillers(10, 10000)], indexCloses: closes });
    const found = byId(a, 'laggard:');
    assert.deepEqual(found.map((f) => f.holdingId), [flat.id]);
    assert.match(found[0].title, /Flat Co has returned \+5%/);
});

test('a payer that has gone quiet for two years is noted', () => {
    const quiet = stock('Quiet Co', 2450, [buy('2022-03-14', 25, 3100), dividend('2022-06-10', 480), dividend('2023-06-10', 530)]);
    const a = run({ stocks: [quiet, ...fillers(20, 50000)] });
    assert.deepEqual(byId(a, 'income:').map((f) => f.id), [`income:lapsed:${quiet.id}`]);
});

test('gaps in the data are said out loud rather than papered over', () => {
    const unpriced = stock('Unpriced', 0, [buy('2021-07-01', 100, 55)]);
    const noSector = stock('No Sector', 1150, [buy('2024-12-02', 20, 1000)], { sector: '' });
    const orphan = stock('Orphan Sale', 100, [sell('2025-01-01', 10, 100)]);
    const a = run({ stocks: [unpriced, noSector, orphan, ...fillers(20, 50000)] });
    assert.equal(byId(a, 'data:no-price')[0].severity, 'review');
    assert.match(byId(a, 'data:no-sector')[0].detail, /No Sector counts as “Other”/);
    assert.match(byId(a, 'data:unmatched-sales')[0].detail, /Orphan Sale/);
});

test('archived holdings are never suggested, but their sales still count toward this year\'s tax', () => {
    const archived = stock('Archived', 100, [buy('2021-01-05', 1000, 50), sell('2026-05-01', 500, 100)], { isArchived: true });
    const a = run({ stocks: [archived, ...fillers(5, 10000)] });
    assert.ok(!a.findings.some((f) => f.holdingId === archived.id));
    assert.equal(a.snapshot.realisedLong, 25000);
    assert.equal(a.snapshot.heldCount, 5);
});

test('findings are ranked by urgency, then by the rupees at stake', () => {
    const big = stock('Big Co', 100, [buy('2021-03-01', 150, 60)], { alerts: [{ id: 'x', type: 'above', price: 90 }] });
    const quiet = stock('Quiet Co', 2450, [buy('2022-03-14', 25, 3100), dividend('2022-06-10', 480)]);
    const a = run({ stocks: [big, quiet, ...fillers(17, 5000)] });
    const rank = { act: 0, review: 1, info: 2 };
    for (let i = 1; i < a.findings.length; i += 1) {
        const [prev, cur] = [a.findings[i - 1], a.findings[i]];
        assert.ok(rank[prev.severity] < rank[cur.severity]
            || (rank[prev.severity] === rank[cur.severity] && prev.impact >= cur.impact), `${prev.id} before ${cur.id}`);
    }
    assert.deepEqual(a.counts, {
        act: a.findings.filter((f) => f.severity === 'act').length,
        review: a.findings.filter((f) => f.severity === 'review').length,
        info: a.findings.filter((f) => f.severity === 'info').length,
    });
});

test('prices older than a trading day are flagged as stale', () => {
    const old = new Date(AS_OF.getTime() - (RULES.stalePriceHours + 2) * 3600000).toISOString();
    assert.equal(run({ stocks: fillers(3, 1000) }).snapshot.pricesStale, false);
    assert.equal(run({ stocks: fillers(3, 1000), pricesUpdatedAt: old }).snapshot.pricesStale, true);
    assert.equal(analysePortfolio({ stocks: fillers(3, 1000), asOf: AS_OF }).snapshot.pricesStale, true);
});

test('the facts for a local model are pre-formatted, bounded and carry every finding id', () => {
    const big = stock('Big Co', 100, [buy('2021-03-01', 150, 60)]);
    const stocks = [big, ...fillers(17, 5000)];
    const a = run({ stocks });
    const facts = llmFacts(a, { stocks, maxFindings: 2, maxHoldings: 3 });
    assert.equal(facts.findings.length, Math.min(2, a.findings.length));
    assert.equal(facts.holdings.length, 3);
    assert.match(facts.holdings[0], /^Big Co \(BIGCO\): 15\.0% of portfolio, ₹15,000/);
    assert.match(facts.portfolio, /₹1,00,000 across 18 holdings/);
    facts.findings.forEach((f, i) => assert.equal(f.id, a.findings[i].id));
});
