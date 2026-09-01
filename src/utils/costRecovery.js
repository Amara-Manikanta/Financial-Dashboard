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
    let receivedShares = 0;  // shares that arrived without a payment
    let allocatedBasis = 0;  // cost carried across in a demerger

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
                receivedShares += qtyOf(tx);
                break;
            case 'demerger':
                // No cash changes hands, so this is not `invested`. But it is
                // not free either: a demerger splits the parent's cost basis
                // between the two companies, and the price on this leg is the
                // share of it that travelled here. Recorded separately so a
                // holding acquired this way is neither counted as a purchase
                // nor mistaken for something that cost nothing.
                receivedShares += qtyOf(tx);
                allocatedBasis += qtyOf(tx) * num(tx.price);
                break;
            default:
                // dividend is counted below; split moves no cash and no basis.
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
        receivedShares,
        allocatedBasis: money(allocatedBasis),
        /**
         * Nothing was ever paid in cash for this holding — it arrived by
         * demerger or bonus. Such a position has no cost to recover, so it sits
         * outside the recovery ranking entirely rather than at 0% or 100%.
         */
        cashless: invested === 0 && shares > 0 && receivedShares > 0,
        held: shares > 0,
        /** Every rupee back, and shares still in hand. */
        isFree: invested > 0 && recovered >= invested && shares > 0,
        /** Cost per remaining share once recovery is applied. Zero when free. */
        netCostPerShare: shares > 0 ? money(Math.max(0, outstandingCost) / shares) : 0,
    };
};

/**
 * Positions still held, ranked by how much of their cost is back.
 *
 * Holdings bought with cash only. A demerged or bonus holding has no cash cost,
 * so a recovery percentage for it would be a division by zero dressed up as a
 * fact; those are reported by `cashlessHoldings` instead.
 */
export const recoveryRanking = (stocks = []) => (stocks || [])
    .filter((s) => s && !s.isArchived)
    .map(costRecovery)
    .filter((r) => r.held && r.invested > 0)
    .sort((a, b) => b.rawPct - a.rawPct);

/**
 * Holdings that arrived without a payment.
 *
 * These used to vanish: the ranking required `invested > 0`, so a demerged
 * holding appeared nowhere at all — Tata Motors Commercial Vehicles, eleven
 * shares worth thousands, was simply absent from every recovery view.
 */
export const cashlessHoldings = (stocks = []) => (stocks || [])
    .filter((s) => s && !s.isArchived)
    .map(costRecovery)
    .filter((r) => r.cashless)
    .sort((a, b) => b.value - a.value);

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

/**
 * A demerged holding and the parent it came out of, as one position.
 *
 * On their own neither tells the truth. The child shows no cost because no cash
 * was paid for it; the parent shows a cost that partly bought something now
 * sitting under another name. Only together do they answer "did this investment
 * give my money back" — for Tata Motors that is ₹15,805 in, ₹10,418 back, and
 * ₹6,651 still held across the two.
 *
 * The parent is included even when archived: archiving hides a holding from
 * the day-to-day views, but the money that went into it was still spent.
 */
export const combinedWithParent = (child, allStocks = []) => {
    const parentId = child?.demergedFrom;
    if (!parentId) return null;
    const parent = (allStocks || []).find((s) => s && String(s.id) === String(parentId));
    if (!parent) return null;

    const c = costRecovery(child);
    const p = costRecovery(parent);

    const invested = money(c.invested + p.invested);
    const recovered = money(c.recovered + p.recovered);
    const value = money(c.value + p.value);

    return {
        parentId: parent.id,
        parentName: parent.name || parent.ticker || 'Parent holding',
        parentArchived: !!parent.isArchived,
        child: c,
        parent: p,
        invested,
        recovered,
        value,
        outstandingCost: money(invested - recovered),
        recoveredPct: invested > 0 ? (recovered / invested) * 100 : 0,
        /** Recovered in cash — sales and dividends alone, nothing marked to market. */
        isFree: invested > 0 && recovered >= invested,
        /** Cash back plus what is still held, against what went in. */
        totalReturnPct: invested > 0 ? ((recovered + value) / invested) * 100 : 0,
    };
};
