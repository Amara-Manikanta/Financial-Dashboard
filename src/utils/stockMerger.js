/**
 * Mergers (amalgamations): one company's shares exchanged for another's, e.g.
 * Indian Petrochemicals into Reliance at 1 for 5.
 *
 * Recorded as a pair of legs sharing a `mergerId`:
 *   merger_out on the company that merged away — its shares leave, nothing is
 *              sold and no gain is booked;
 *   merger_in  on the acquirer — the new shares arrive carrying the cost, and
 *              under FIFO the original purchase dates, of the shares given up.
 *
 * The carried cost is derived from the source's history, so any change to that
 * history must go through `relinkMergers`, or the acquirer keeps the old cost.
 */
import { recomputeStockMetrics } from './investmentSync.js';
import { matchLots } from './capitalGains.js';

export const MERGER_OUT = 'merger_out';
export const MERGER_IN = 'merger_in';
export const isMergerLeg = (tx) => !!tx && (tx.type === MERGER_OUT || tx.type === MERGER_IN);

const round6 = (v) => Math.round((Number(v) || 0) * 1e6) / 1e6;

/** The source position on the merger date, ignoring the merger's own leg. */
const positionOn = (transactions, date, mergerId) => {
    const before = (transactions || []).filter((t) => t && t.date
        && String(t.date) <= String(date) && !(mergerId && t.mergerId === mergerId));
    const { shares, totalCost } = recomputeStockMetrics(before);
    const { openLots } = matchLots(before);
    return { shares, totalCost, openLots };
};

/** Cost and FIFO lots for `given` shares, restated per share received. */
const carriedFor = (position, given, received) => {
    const cost = position.shares > 0 ? position.totalCost * (given / position.shares) : 0;
    const factor = given > 0 ? received / given : 0;
    const lots = [];
    let left = given;
    for (const lot of position.openLots) {
        if (left <= 0) break;
        const take = Math.min(left, lot.quantity);
        left -= take;
        if (factor > 0) lots.push({ date: lot.date, quantity: round6(take * factor), costPerShare: round6(lot.costPerShare / factor) });
    }
    return { cost, lots };
};

const withMetrics = (stock, transactions) => {
    const { shares, avgCost, dividends } = recomputeStockMetrics(transactions);
    return { ...stock, transactions, shares, avgCost, dividends: { ...stock.dividends, ...dividends } };
};

/**
 * Record a merger. Returns the new stocks array, or throws a message fit to show.
 */
export const recordMerger = (stocks, { sourceId, targetId, date, surrendered, received, ratioNew, ratioOld }) => {
    const source = stocks.find((s) => String(s.id) === String(sourceId));
    const target = stocks.find((s) => String(s.id) === String(targetId));
    if (!source || !target || source === target) throw new Error('Pick the company these shares merged into.');
    const given = Number(surrendered) || 0;
    const got = Number(received) || 0;
    if (given <= 0 || got <= 0) throw new Error('Enter the shares given up and the shares received.');

    const position = positionOn(source.transactions, date);
    if (given > position.shares + 1e-9) {
        throw new Error(`Only ${position.shares} shares were held on ${date}. Record the purchase first.`);
    }
    const { cost, lots } = carriedFor(position, given, got);
    const mergerId = `m${Date.now()}`;
    const common = { date, mergerId, ratioNew: Number(ratioNew) || null, ratioOld: Number(ratioOld) || null };

    const outLeg = { ...common, id: `${mergerId}-out`, type: MERGER_OUT, quantity: given, price: round6(cost / given), mergedIntoId: target.id, receivedQuantity: got };
    const inLeg = { ...common, id: `${mergerId}-in`, type: MERGER_IN, quantity: got, price: round6(cost / got), mergedFromId: source.id, surrenderedQuantity: given, lots };

    return stocks.map((s) => {
        if (s === source) return withMetrics(s, [...(s.transactions || []), outLeg]);
        if (s === target) return withMetrics(s, [...(s.transactions || []), inLeg]);
        return s;
    });
};

/** Delete both legs of a merger together; one alone would create or destroy shares. */
export const removeMerger = (stocks, mergerId) => stocks.map((s) => {
    const txs = s.transactions || [];
    return txs.some((t) => t.mergerId === mergerId) ? withMetrics(s, txs.filter((t) => t.mergerId !== mergerId)) : s;
});

/**
 * Re-derive every merger's carried cost and lots from the current histories.
 * Run after any change to a holding's transactions. Oldest merger first, so a
 * chain (A into B, B into C) picks up the corrected cost at each step.
 */
export const relinkMergers = (stocks) => {
    const outs = [];
    stocks.forEach((s) => (s.transactions || []).forEach((t) => {
        if (t.type === MERGER_OUT && t.mergerId) outs.push({ sourceId: s.id, mergerId: t.mergerId, date: t.date });
    }));
    outs.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    let next = stocks;
    const touched = new Set();
    outs.forEach(({ sourceId, mergerId, date }) => {
        const source = next.find((s) => s.id === sourceId);
        const outLeg = source.transactions.find((t) => t.mergerId === mergerId && t.type === MERGER_OUT);
        const given = Math.min(Number(outLeg.quantity) || 0, positionOn(source.transactions, date, mergerId).shares);
        const got = Number(outLeg.receivedQuantity) || 0;
        if (given <= 0 || got <= 0) return;
        const { cost, lots } = carriedFor(positionOn(source.transactions, date, mergerId), given, got);
        next = next.map((s) => {
            const txs = s.transactions || [];
            if (!txs.some((t) => t.mergerId === mergerId)) return s;
            touched.add(s.id);
            return {
                ...s,
                transactions: txs.map((t) => {
                    if (t.mergerId !== mergerId) return t;
                    return t.type === MERGER_OUT
                        ? { ...t, quantity: given, price: round6(cost / given) }
                        : { ...t, price: round6(cost / got), surrenderedQuantity: given, lots };
                }),
            };
        });
    });
    return next.map((s) => (touched.has(s.id) ? withMetrics(s, s.transactions) : s));
};
