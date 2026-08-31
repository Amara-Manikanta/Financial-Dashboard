/**
 * How much of a holding's cost has already come back out of it.
 *
 * A position can reach a point where selling part of it, plus the dividends it
 * has paid, has returned everything that was ever put in. What remains is held
 * at no net cost — Bajaj Housing Finance here is exactly that: ₹14,980 went in
 * at IPO, ₹15,733 came back from selling 100 of 214 shares, and the 114 shares
 * still held cost nothing.
 *
 * Average-cost accounting cannot express this. It keeps those 114 shares at
 * ₹70 each and reports a modest 20% gain, because the ₹8,733 booked on the sale
 * is filed away as realised profit and never related back to the cost of what
 * is left. Both views are correct; this one answers a question the other cannot
 * — "is any of my own money still at risk here?"
 *
 * Cash in, cash out. Nothing is marked to market, because the point is what has
 * actually been recovered, not what the remaining shares might be worth.
 */
import { recomputeStockMetrics } from './investmentSync.js';

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/** Quantity is spelled two ways across the history. */
const qtyOf = (tx) => num(tx.quantity ?? tx.shares);

/** A leg's cash value: an explicit amount if present, else quantity × price. */
const cashOf = (tx) => num(tx.amount) || qtyOf(tx) * num(tx.price);

/**
 * Cost recovery for one stock.
 *
 * Dividends come from recomputeStockMetrics rather than being re-summed here.
 * The `dividends` object stored on a stock is derived from its dividend
 * transactions, so counting both would double every payout — which is exactly
 * the mistake this comment exists to stop the next person repeating.
 */
export const costRecovery = (stock = {}) => {
    const txs = stock.transactions || [];
    const replay = recomputeStockMetrics(txs);

    let invested = 0;      // money that left your account
    let salesProceeds = 0; // money that came back from selling
    let bonusShares = 0;   // shares received at no cost

    txs.forEach((tx) => {
        switch (tx.type) {
            case 'buy':
            case 'ipo':
                invested += cashOf(tx);
                break;
            case 'sell':
            case 'buyback':
                salesProceeds += cashOf(tx);
                break;
            case 'bonus':
                bonusShares += qtyOf(tx);
                break;
            default:
                // dividend is counted below; split/demerger move no cash.
                break;
        }
    });

    const dividends = Object.values(replay.dividends || {}).reduce((a, b) => a + num(b), 0);
    const recovered = salesProceeds + dividends;
    const shares = num(stock.shares);
    const value = shares * num(stock.currentPrice);

    // Below zero means more came back than went in: the remaining shares are
    // free and there is surplus on top.
    const outstandingCost = invested - recovered;

    return {
        id: stock.id,
        name: stock.name || stock.ticker || 'Unnamed',
        invested: money(invested),
        salesProceeds: money(salesProceeds),
        dividends: money(dividends),
        recovered: money(recovered),
        outstandingCost: money(outstandingCost),
        // Capped for display only; the raw ratio is kept in `rawPct`.
        recoveredPct: invested > 0 ? Math.min(100, (recovered / invested) * 100) : 0,
        rawPct: invested > 0 ? (recovered / invested) * 100 : 0,
        surplus: money(Math.max(0, -outstandingCost)),
        shares,
        value: money(value),
        bonusShares,
        held: shares > 0,
        /** Every rupee back, and shares still in hand. */
        isFree: invested > 0 && recovered >= invested && shares > 0,
        /** Cost per remaining share once recovery is applied. Zero when free. */
        netCostPerShare: shares > 0 ? money(Math.max(0, outstandingCost) / shares) : 0,
    };
};

/** Positions still held, ranked by how much of their cost is back. */
export const recoveryRanking = (stocks = []) => (stocks || [])
    .filter((s) => s && !s.isArchived)
    .map(costRecovery)
    .filter((r) => r.held && r.invested > 0)
    .sort((a, b) => b.rawPct - a.rawPct);

/** Free positions — cost fully recovered, shares still held. */
export const freePositions = (stocks = []) => recoveryRanking(stocks).filter((r) => r.isFree);

/**
 * Positions close enough to free to be worth watching.
 * Deliberately not called "almost free" in figures — it is a watchlist, not a
 * claim that any cost has stopped being at risk.
 */
export const NEARLY_FREE_FROM = 75;
export const nearlyFree = (stocks = []) => recoveryRanking(stocks)
    .filter((r) => !r.isFree && r.rawPct >= NEARLY_FREE_FROM);

/** Portfolio-level totals for the panel header. */
export const recoveryTotals = (stocks = []) => {
    const held = recoveryRanking(stocks);
    const free = held.filter((r) => r.isFree);
    return {
        invested: money(held.reduce((s, r) => s + r.invested, 0)),
        recovered: money(held.reduce((s, r) => s + r.recovered, 0)),
        stillAtRisk: money(held.reduce((s, r) => s + Math.max(0, r.outstandingCost), 0)),
        freeCount: free.length,
        freeValue: money(free.reduce((s, r) => s + r.value, 0)),
        bonusShares: held.reduce((s, r) => s + r.bonusShares, 0),
    };
};
