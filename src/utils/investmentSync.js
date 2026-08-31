/**
 * The single copy of the "what does this holding add up to" maths.
 *
 * These formulas used to exist twice each: once on the detail page that owns
 * the asset, and once inside FinanceContext's expense->investment sync. The
 * two copies had already drifted. The sync's stock formula handled only `buy`
 * and `sell`, while the real one on StockDetails also replays `ipo`, `bonus`,
 * `split`, `buyback` and `demerger`. Syncing a leg onto a stock whose history
 * contains a split would therefore have recomputed `shares` with the wrong
 * maths and silently corrupted the holding.
 *
 * This is the same failure mode as the `categories` aggregate described in
 * CLAUDE.md. If one of these formulas changes, every caller changes with it,
 * because there is only one.
 */

/**
 * Replay a stock's transaction history to get its current position.
 * Lifted verbatim from StockDetails' recalculateStockMetrics so the numbers on
 * the page and the numbers written by a sync cannot disagree.
 */
export const recomputeStockMetrics = (txList = []) => {
    let currentShares = 0;
    let totalCost = 0;
    let realised = 0;
    const calculatedDividends = {};
    // Realised P/L attributed to the individual sell that booked it. The replay
    // already works out the average cost at each disposal; keeping it means the
    // transaction table can show what a sell actually earned instead of a dash.
    const realisedByTx = {};

    // Sort by date ascending: a split applies to whatever was held at the time,
    // so replaying out of order gives a different — and wrong — answer.
    const chronologicalTx = [...txList].sort((a, b) => new Date(a.date) - new Date(b.date));

    chronologicalTx.forEach((tx) => {
        const qty = Number(tx.quantity) || 0;
        const price = Number(tx.price) || 0;

        if (tx.type === 'buy' || tx.type === 'ipo') {
            totalCost = currentShares === 0 ? qty * price : totalCost + (qty * price);
            currentShares += qty;
        } else if (tx.type === 'sell' || tx.type === 'buyback') {
            const avgCost = currentShares > 0 ? totalCost / currentShares : 0;
            // Booked on the shares actually held. A history that sells more than
            // it holds is already clamped below, and letting the surplus book a
            // gain would invent profit on shares that were never owned.
            const booked = Math.min(qty, currentShares) * (price - avgCost);
            realised += booked;
            if (tx.id !== undefined && tx.id !== null) {
                realisedByTx[String(tx.id)] = {
                    realised: Math.round(booked * 100) / 100,
                    avgCostAtSale: Math.round(avgCost * 100) / 100,
                    sharesBooked: Math.min(qty, currentShares),
                };
            }
            currentShares = Math.max(0, currentShares - qty);
            totalCost = currentShares * avgCost;
        } else if (tx.type === 'bonus') {
            currentShares += qty;
        } else if (tx.type === 'split') {
            if (tx.splitFrom && tx.splitTo) {
                currentShares = currentShares * (tx.splitTo / tx.splitFrom);
            } else {
                currentShares += qty;
            }
        } else if (tx.type === 'demerger') {
            currentShares += qty;
            totalCost = currentShares * price;
        } else if (tx.type === 'dividend') {
            const year = new Date(tx.date).getFullYear().toString();
            calculatedDividends[year] = (calculatedDividends[year] || 0) + price;
        }
    });

    // Rounded only at the end. `totalCost` keeps full precision through the
    // replay, so rounding cannot compound across a long history — a cost basis
    // divided by three shares would otherwise render as 974.3366666666667.
    const finalAvgCost = currentShares > 0 ? Math.round((totalCost / currentShares) * 100) / 100 : 0;
    // `realised` is additive to the existing return, so every caller that only
    // destructures shares/avgCost/dividends is unaffected.
    return {
        shares: currentShares,
        avgCost: finalAvgCost,
        dividends: calculatedDividends,
        realised: Math.round(realised * 100) / 100,
        realisedByTx
    };
};

/**
 * Total units held in a mutual fund.
 * Older rows predate the `type` field and carry the intent in `remarks`, which
 * is why the fallback sniffs for "sip" rather than assuming a buy.
 */
export const recomputeFundUnits = (txList = []) => {
    let totalUnits = 0;
    txList.forEach((t) => {
        const type = t.type || (t.remarks && t.remarks.toLowerCase().includes('sip') ? 'sip' : 'buy');
        if (type === 'buy' || type === 'sip') totalUnits += Number(t.units) || 0;
        if (type === 'sell' || type === 'withdraw') totalUnits -= Number(t.units) || 0;
    });
    // Prevent negative zero and float dust from rendering as a tiny holding.
    if (totalUnits < 0.0001) totalUnits = 0;
    return totalUnits;
};

/** A fund's current value, given its units and the NAV recorded on the fund. */
export const recomputeFundAmount = (fund, txList) => (
    recomputeFundUnits(txList !== undefined ? txList : fund.transactions) * (fund.currentNav || 0)
);

/* ------------------------------------------------------------------ *
 * Legs
 * ------------------------------------------------------------------ */

/**
 * One expense row can fund several holdings at once — a single ₹5,000 debit
 * leaving the bank is often five SIPs. The transaction therefore carries a
 * list of legs rather than one asset.
 *
 * Older/never-populated rows used a flat single-asset shape; normalising here
 * means the rest of the code only ever deals with an array.
 */
export const normaliseLegs = (investmentData) => {
    if (!investmentData) return [];
    if (Array.isArray(investmentData.legs)) return investmentData.legs.filter(Boolean);
    if (investmentData.assetId) return [investmentData];
    return [];
};

/**
 * Legs are linked back to the expense row that created them. The id must be
 * unique per leg — two legs sharing the expense id would collide inside one
 * fund, and deleting the expense would only remove one of them.
 */
export const legTransactionId = (expenseId, index) => `${expenseId}::${index}`;

/** True when this investment transaction is linked to that expense row. */
export const belongsToExpense = (tx, expenseId) => {
    if (!tx || expenseId === undefined || expenseId === null) return false;
    const id = String(expenseId);
    if (tx.expenseId !== undefined && tx.expenseId !== null) return String(tx.expenseId) === id;
    // Rows written before legs existed reused the expense id directly.
    return String(tx.id) === id || String(tx.id).startsWith(`${id}::`);
};

/* ------------------------------------------------------------------ *
 * Adoption
 * ------------------------------------------------------------------ *
 *
 * The investment pages are the more accurate record here — 429 stock
 * transactions against 23 stock expense rows — so linking an expense usually
 * means pointing at a purchase that is ALREADY recorded on the holding, not
 * creating a new one. Blindly pushing a transaction per leg would double the
 * position: a Coal India buy of 1 share would become 2.
 *
 * So a leg first tries to adopt a matching unlinked transaction, and only
 * creates one when there is nothing to adopt.
 */

/**
 * How far apart the expense and the investment transaction may sit and still be
 * the same event. A bank debit and the fund's allotment routinely land a day or
 * two apart, so requiring the same date would treat every SIP as a new purchase.
 *
 * This MUST stay the same window the picker offers candidates from. When the
 * two disagreed — picker ±7 days, matcher exact-date — the form filled itself
 * from an existing row, promised it would link, and then created a duplicate
 * because the matcher rejected the very row the picker had chosen. That put six
 * duplicate SIPs into real funds.
 */
export const MATCH_WINDOW_DAYS = 7;

/** Does an existing investment transaction describe the same event as this leg? */
export const matchesLeg = (tx, leg, date) => {
    if (!tx) return false;
    if (date && daysApart(tx.date, date) > MATCH_WINDOW_DAYS) return false;

    const txType = tx.type || 'buy';
    // A SIP and a manually entered buy are the same purchase.
    const sameKind = txType === leg.action
        || (['buy', 'sip'].includes(txType) && ['buy', 'sip'].includes(leg.action));
    if (!sameKind) return false;

    if (leg.assetType === 'stock') {
        if (leg.action === 'dividend') {
            return Math.abs(Number(tx.price || 0) - Number(leg.amount || 0)) < 0.01;
        }
        return Math.abs(Number(tx.quantity || 0) - Number(leg.quantity || 0)) < 0.001
            && Math.abs(Number(tx.price || 0) - Number(leg.price || 0)) < 0.01;
    }
    // Funds: units is the figure that actually moves the holding.
    return Math.abs(Number(tx.units || 0) - Number(leg.units || 0)) < 0.001;
};

/**
 * The transaction this leg should attach to, if there is one.
 *
 * When the user picked a row in the form, the leg carries its id and that is
 * authoritative — no amount of date or rounding drift can turn a deliberate
 * choice into a duplicate. Figure matching is only the fallback for legs typed
 * in by hand.
 */
export const findAdoptable = (txList, leg, date, expenseId) => {
    const list = txList || [];
    const free = (t) => !t.expenseId || (expenseId !== undefined && String(t.expenseId) === String(expenseId));

    if (leg?.sourceTxId) {
        return list.find(t => String(t.id) === String(leg.sourceTxId) && free(t)) || null;
    }
    return list.find(t => free(t) && matchesLeg(t, leg, date)) || null;
};

/**
 * Link an existing transaction to an expense without altering its figures.
 * `adoptedByExpense` records that it predates the link, so unlinking releases
 * it instead of deleting a record the user entered on the investment page.
 */
export const adoptTransaction = (tx, expenseId) => ({
    ...tx,
    expenseId: String(expenseId),
    adoptedByExpense: true
});

/** Undo an adoption, leaving the original transaction exactly as it was. */
export const releaseTransaction = (tx) => {
    const { expenseId, adoptedByExpense, ...rest } = tx;
    return rest;
};

/**
 * Strip an expense's links from a transaction list.
 * Transactions this expense created are removed; ones it merely adopted are
 * kept and unlinked, because deleting them would destroy investment records
 * that existed first.
 */
export const detachExpense = (txList, expenseId) => (
    (txList || []).flatMap((t) => {
        if (!belongsToExpense(t, expenseId)) return [t];
        return t.adoptedByExpense ? [releaseTransaction(t)] : [];
    })
);

/* ------------------------------------------------------------------ *
 * Suggesting which holding an expense refers to
 * ------------------------------------------------------------------ */

// Words that appear in nearly every fund name and so carry no signal.
const STOP_WORDS = new Set([
    'mf', 'fund', 'funds', 'mutual', 'india', 'the', 'prudential',
    'of', 'cap', 'index', 'sip', 'ltd', 'limited'
]);

const tokenise = (s) => String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

/**
 * Score how well a free-text title matches a holding's name.
 * Titles are written by hand ("SBI small cap fund" vs "SBi Small Cap Fund"),
 * so this compares tokens with prefix matching rather than requiring equality.
 */
export const scoreTitleMatch = (title, assetName) => {
    const a = tokenise(title);
    const b = tokenise(assetName);
    if (!a.length || !b.length) return 0;
    const hits = a.filter((w) => b.some((g) => g.startsWith(w) || w.startsWith(g))).length;
    return hits / Math.max(1, Math.min(a.length, b.length));
};

// Below this the guess is worse than no guess: measured against the real data,
// 37 of 44 mutual-fund rows clear it and the 7 that do not are genuinely
// ambiguous titles like "Mutual Fund" and "kitty amount".
export const CONFIDENT_MATCH = 0.5;

/**
 * Best-guess holding for a title. Returns null rather than a weak guess —
 * a silently wrong fund would put units in the wrong place, which is worse
 * than asking. Callers should treat this as a default, never as an answer.
 */
export const suggestAsset = (title, assets) => {
    let best = null;
    let bestScore = 0;
    (assets || []).forEach((asset) => {
        const score = scoreTitleMatch(title, asset.name);
        if (score > bestScore) {
            bestScore = score;
            best = asset;
        }
    });
    return bestScore >= CONFIDENT_MATCH ? best : null;
};

/**
 * Flatten savings into the pickable list: every mutual fund, and every stock
 * inside every stock-market holding. Stocks are addressed as `marketId|stockId`
 * because a stock is nested inside its market row.
 */
export const investableAssets = (savings = []) => {
    const assets = [];
    savings.forEach((s) => {
        if (s.type === 'mutual_fund') {
            assets.push({
                assetType: 'mutual_fund',
                assetId: String(s.id),
                name: s.title || 'Untitled fund',
                currentNav: s.currentNav || null
            });
        } else if (s.type === 'stock_market') {
            (s.stocks || []).forEach((stock) => {
                assets.push({
                    assetType: 'stock',
                    assetId: `${s.id}|${stock.id}`,
                    name: stock.name || stock.ticker || 'Untitled stock',
                    ticker: stock.ticker || '',
                    currentPrice: stock.currentPrice || null
                });
            });
        }
    });
    return assets;
};

/** The transaction list of one holding, whichever kind it is. */
export const transactionsForAsset = (savings, assetType, assetId) => {
    if (!assetId) return [];
    if (assetType === 'stock') {
        const [marketId, stockId] = String(assetId).split('|');
        const market = (savings || []).find(s => String(s.id) === String(marketId));
        const stock = market && (market.stocks || []).find(s => String(s.id) === String(stockId));
        return stock ? (stock.transactions || []) : [];
    }
    const fund = (savings || []).find(s => String(s.id) === String(assetId));
    return fund ? (fund.transactions || []) : [];
};

const daysApart = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

/**
 * Unlinked transactions on a holding that could be the one this expense paid
 * for, nearest date first.
 *
 * This is the common case, not the exception: the investment pages already hold
 * the purchase, and the expense is being linked to it after the fact. Offering
 * these lets the form fill itself from the authoritative record instead of the
 * user retyping figures that then fail to match.
 */
export const candidateTransactions = (savings, assetType, assetId, date, windowDays = 7) => {
    if (!date) return [];
    return transactionsForAsset(savings, assetType, assetId)
        .filter(t => !t.expenseId && daysApart(t.date, date) <= windowDays)
        .sort((a, b) => daysApart(a.date, date) - daysApart(b.date, date));
};

/**
 * Fill a leg's figures from an existing transaction and remember which one.
 *
 * `sourceTxId` is the important part: it records the row the user actually
 * chose, so the sync links to that exact transaction instead of trying to
 * re-identify it from figures that may differ by a day or a rounding.
 */
export const legFromTransaction = (tx, assetType) => {
    if (assetType === 'stock') {
        const qty = Number(tx.quantity) || 0;
        const price = Number(tx.price) || 0;
        return {
            sourceTxId: tx.id,
            action: tx.type || 'buy',
            quantity: qty,
            price,
            // A dividend records its total in `price`; everything else is qty x price.
            amount: tx.type === 'dividend' ? price : Number((qty * price).toFixed(2))
        };
    }
    const units = Number(tx.units) || 0;
    const nav = Number(tx.nav) || 0;
    return {
        sourceTxId: tx.id,
        action: tx.type || 'buy',
        units,
        nav,
        amount: Number(tx.amount) || Number((units * nav).toFixed(2))
    };
};

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Short human label for an existing transaction, for the picker.
 *
 * The amount leads on both kinds, because that is the figure being matched
 * against the expense — units and NAV confirm *which* purchase it was, but the
 * rupee value is what tells you it is the right one.
 */
export const describeTransaction = (tx, assetType) => {
    const kind = (tx.type || 'buy').toUpperCase();
    if (assetType === 'stock') {
        return tx.type === 'dividend'
            ? `${tx.date} · ${kind} · ${rupees(tx.price)}`
            : `${tx.date} · ${kind} · ${rupees(Number(tx.quantity || 0) * Number(tx.price || 0))} · ${tx.quantity} @ ${rupees(tx.price)}`;
    }
    // Older fund rows predate the `amount` field, so fall back to units x NAV
    // rather than showing a blank where the paid amount should be.
    const amount = Number(tx.amount) || (Number(tx.units || 0) * Number(tx.nav || 0));
    return `${tx.date} · ${kind} · ${rupees(amount)} · ${tx.units} units @ ${rupees(tx.nav)}`;
};

/**
 * Actions offered when logging from the expenses side.
 *
 * Deliberately narrower than the investment pages. Bonus, split and demerger
 * change a share count without any money moving, so they have no business on a
 * form whose whole purpose is recording cash leaving or entering an account —
 * logging one there would invent a payment that never happened. They stay on
 * the stock page, which is the right place for them.
 */
export const MF_ACTIONS = [
    { value: 'sip', label: 'SIP', direction: 'out' },
    { value: 'buy', label: 'Buy', direction: 'out' },
    { value: 'sell', label: 'Sell / Redeem', direction: 'in' }
];

export const STOCK_ACTIONS = [
    { value: 'buy', label: 'Buy', direction: 'out' },
    { value: 'ipo', label: 'IPO Allotment', direction: 'out' },
    { value: 'sell', label: 'Sell', direction: 'in' },
    { value: 'buyback', label: 'Buyback', direction: 'in' },
    { value: 'dividend', label: 'Dividend', direction: 'in' }
];

export const actionsFor = (assetType) => (assetType === 'stock' ? STOCK_ACTIONS : MF_ACTIONS);

/** Whether an action brings money in rather than sending it out. */
export const isInflowAction = (assetType, action) => (
    actionsFor(assetType).find((a) => a.value === action)?.direction === 'in'
);

/**
 * Turn one leg into the transaction the investment page expects.
 * Each asset type stores a different shape, and dividends are recorded as
 * `quantity: 0, price: <total received>` — matching what the stock page writes.
 */
export const legToInvestmentTx = (leg, { expenseId, index, date, title }) => {
    const base = {
        id: legTransactionId(expenseId, index),
        expenseId: String(expenseId),
        date,
        type: leg.action,
        remarks: leg.remarks || title || 'Logged from expenses'
    };

    if (leg.assetType === 'stock') {
        return leg.action === 'dividend'
            ? { ...base, quantity: 0, price: Number(leg.amount) || 0 }
            : { ...base, quantity: Number(leg.quantity) || 0, price: Number(leg.price) || 0 };
    }

    return {
        ...base,
        amount: Number(leg.amount) || 0,
        nav: Number(leg.nav) || 0,
        units: Number(leg.units) || 0
    };
};

/**
 * Validate legs against the expense they belong to.
 * The amounts must add up: if a ₹5,000 debit is split across five funds, those
 * five legs are the whole of that ₹5,000. A mismatch means one side is wrong,
 * and quietly accepting it would leave the two pages disagreeing again.
 */
export const validateLegs = (legs, expenseAmount) => {
    const errors = [];
    if (!legs.length) return errors;

    legs.forEach((leg, i) => {
        const n = i + 1;
        if (!leg.assetId) errors.push(`Leg ${n}: choose a fund or stock.`);
        if (!leg.action) errors.push(`Leg ${n}: choose what this is.`);
        if (!(Number(leg.amount) > 0)) errors.push(`Leg ${n}: enter an amount.`);

        if (leg.assetType === 'mutual_fund') {
            if (!(Number(leg.nav) > 0)) errors.push(`Leg ${n}: enter the NAV.`);
            if (!(Number(leg.units) > 0)) errors.push(`Leg ${n}: units could not be worked out.`);
        } else if (leg.assetType === 'stock' && leg.action !== 'dividend') {
            if (!(Number(leg.quantity) > 0)) errors.push(`Leg ${n}: enter the quantity.`);
            if (!(Number(leg.price) > 0)) errors.push(`Leg ${n}: enter the price.`);
        }
    });

    const total = legs.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const expected = Number(expenseAmount) || 0;
    // A rupee of slack absorbs rounding when units are derived from NAV.
    if (expected > 0 && Math.abs(total - expected) > 1) {
        errors.push(
            `The legs add up to ₹${total.toLocaleString('en-IN')}, but the transaction is ₹${expected.toLocaleString('en-IN')}.`
        );
    }

    return errors;
};
