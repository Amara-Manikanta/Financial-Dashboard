/**
 * Money-weighted return (XIRR).
 *
 * A simple percentage — value over cost — answers a question almost nobody is
 * asking. It says the same thing about ₹1,000 that doubled in three months and
 * ₹1,000 that doubled in nine years, and it has no way to account for money
 * added along the way. A SIP running for four years has fifty different
 * holding periods inside it, and the average of them is not the return.
 *
 * XIRR is the single annual rate at which every cash flow, discounted from its
 * own date, sums to zero. It is what a bank means by "interest rate", applied
 * to an irregular series.
 *
 * Where this matters here: one holding in this portfolio shows +2904% on a
 * simple calculation. Almost all of that is time — it has been held for years —
 * and stating it as a return invites comparison with holdings bought last
 * month, which is not a comparison that means anything.
 *
 * ## What it cannot tell you
 *
 * XIRR is undefined when every flow points the same way. A holding never sold
 * and never valued has only outflows, and no rate makes them sum to zero. Those
 * return `null` rather than 0 — a rate of zero is a claim, and "not computable"
 * is the truth.
 *
 * Over very short periods it also annualises noise: three weeks of +4% becomes
 * a headline near 100% a year. Anything under about three months is reported
 * with that caveat attached rather than suppressed, because the underlying gain
 * is real even when the annualisation is meaningless.
 */

const DAY = 86400000;
const num = (v) => Number(v) || 0;

/** Newton-Raphson needs a starting point; bisection needs a bracket. */
const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;

const npv = (rate, flows, t0) => flows.reduce((sum, f) => {
    const years = (f.date - t0) / (365 * DAY);
    // (1 + rate) can go non-positive during the search; guard rather than NaN.
    const base = 1 + rate;
    if (base <= 0) return sum + f.amount * Math.pow(1e-10, years);
    return sum + f.amount / Math.pow(base, years);
}, 0);

/**
 * Solve for the rate.
 *
 * Newton-Raphson first because it converges fast on well-behaved series, then
 * bisection as a fallback: real cash flow series can have several sign changes,
 * and Newton will happily run off to infinity on one of those. Bisection is
 * slower and cannot fail once a bracket exists.
 */
export const xirr = (cashflows = []) => {
    const flows = (cashflows || [])
        .map((f) => ({ date: new Date(f.date).getTime(), amount: num(f.amount) }))
        .filter((f) => !Number.isNaN(f.date) && f.amount !== 0)
        .sort((a, b) => a.date - b.date);

    if (flows.length < 2) return null;

    const hasPositive = flows.some((f) => f.amount > 0);
    const hasNegative = flows.some((f) => f.amount < 0);
    if (!hasPositive || !hasNegative) return null;

    const t0 = flows[0].date;
    const span = (flows[flows.length - 1].date - t0) / DAY;
    if (span <= 0) return null;

    // Scale the tolerance to the size of the flows. A fixed 1e-7 is an
    // unreachable target on a series measured in lakhs and a needlessly strict
    // one on a series measured in rupees.
    const scale = Math.max(1, flows.reduce((s, f) => s + Math.abs(f.amount), 0) / flows.length);
    const tol = TOLERANCE * scale;

    // Newton-Raphson
    let rate = 0.1;
    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
        const f = npv(rate, flows, t0);
        if (Math.abs(f) < tol) return rate;
        const dRate = 1e-6;
        const derivative = (npv(rate + dRate, flows, t0) - f) / dRate;
        if (!Number.isFinite(derivative) || derivative === 0) break;
        const next = rate - f / derivative;
        if (!Number.isFinite(next)) break;
        // A step small enough to stop on is only an answer if the function is
        // actually near zero there. Newton stalls on flat stretches, and
        // returning the stall point would report a rate that solves nothing.
        if (Math.abs(next - rate) < TOLERANCE) {
            return Math.abs(npv(next, flows, t0)) < tol ? next : null;
        }
        rate = next;
    }

    // Bisection over a wide bracket: -99.99% to +10000% a year.
    let low = -0.9999;
    let high = 100;
    let fLow = npv(low, flows, t0);
    let fHigh = npv(high, flows, t0);
    if (fLow * fHigh > 0) return null;

    for (let i = 0; i < 200; i += 1) {
        const mid = (low + high) / 2;
        const fMid = npv(mid, flows, t0);
        if (Math.abs(fMid) < tol) return mid;
        if (fLow * fMid < 0) { high = mid; fHigh = fMid; } else { low = mid; fLow = fMid; }
    }
    return (low + high) / 2;
};

const ACQUIRE = ['buy', 'ipo'];
const DISPOSE = ['sell', 'buyback'];

/** Units on a transaction, however it is spelled. */
const qtyOf = (tx) => num(tx.quantity ?? tx.shares ?? tx.units);
/** Cash on a transaction: an explicit amount, else quantity times price. */
const cashOf = (tx) => num(tx.amount) || qtyOf(tx) * num(tx.price ?? tx.nav);

/**
 * Cash flows for one stock, from your side of the account.
 *
 * Money out is negative, money in is positive, and whatever is still held is a
 * final inflow at today's price — the amount you would have if you closed the
 * position now. Corporate actions that move no money (bonus, split, demerger)
 * contribute nothing: they change the share count, not the cash, and their
 * effect already shows in the closing value.
 */
export const stockCashflows = (stock, asOf = new Date()) => {
    const flows = [];
    (stock?.transactions || []).forEach((tx) => {
        const type = String(tx.type || '').toLowerCase();
        const cash = cashOf(tx);
        if (!cash) return;
        if (ACQUIRE.includes(type)) flows.push({ date: tx.date, amount: -cash });
        else if (DISPOSE.includes(type)) flows.push({ date: tx.date, amount: cash });
        else if (type === 'dividend') {
            // A payout sits in `price` with quantity 0, so cashOf would read 0.
            flows.push({ date: tx.date, amount: num(tx.amount) || num(tx.price) });
        }
    });

    const held = num(stock?.shares);
    const value = held * num(stock?.currentPrice);
    if (value > 0) flows.push({ date: asOf, amount: value, closing: true });
    return flows;
};

/** The same, for a mutual fund. */
export const fundCashflows = (fund, asOf = new Date()) => {
    const flows = [];
    let units = 0;
    (fund?.transactions || []).forEach((tx) => {
        const type = String(tx.type || '').toLowerCase();
        const cash = cashOf(tx);
        const u = qtyOf(tx);
        if (type === 'sell' || type === 'withdraw') {
            units -= u;
            if (cash) flows.push({ date: tx.date, amount: cash });
        } else {
            units += u;
            if (cash) flows.push({ date: tx.date, amount: -cash });
        }
    });
    const value = Math.max(0, units) * num(fund?.currentNav);
    if (value > 0) flows.push({ date: asOf, amount: value, closing: true });
    return flows;
};

const money = (v) => Math.round(num(v) * 100) / 100;

/** A holding's return, with everything needed to judge whether to trust it. */
const profileFrom = (flows, { id, name, asOf }) => {
    const invested = money(flows.filter((f) => f.amount < 0).reduce((s, f) => s - f.amount, 0));
    const returned = money(flows.filter((f) => f.amount > 0 && !f.closing).reduce((s, f) => s + f.amount, 0));
    const closing = money(flows.filter((f) => f.closing).reduce((s, f) => s + f.amount, 0));

    const dates = flows.map((f) => new Date(f.date).getTime()).filter((t) => !Number.isNaN(t));
    const first = dates.length ? Math.min(...dates) : null;
    const last = dates.length ? Math.max(...dates) : null;

    // Measured first flow to LAST flow, not to today.
    //
    // For a position still held the last flow IS today's valuation, so the two
    // agree. For a closed position they do not, and using today would have
    // called a six-day trade a five-year holding: Vijaya Diagnostics was bought
    // and sold inside one week in 2021 for +16.5%, which annualises to over six
    // million percent. The rate is arithmetically correct and completely
    // useless, and only the real span reveals that.
    const days = first !== null && last !== null ? Math.round((last - first) / DAY) : 0;

    const rate = xirr(flows);
    const simple = invested > 0 ? ((returned + closing - invested) / invested) * 100 : null;

    return {
        id,
        name,
        invested,
        returned,
        closing,
        profit: money(returned + closing - invested),
        simplePct: simple,
        /** Annualised, as a percentage. Null when it cannot be computed. */
        xirrPct: rate === null ? null : rate * 100,
        firstFlow: first ? new Date(first).toISOString().slice(0, 10) : null,
        lastFlow: last ? new Date(last).toISOString().slice(0, 10) : null,
        days,
        /** Under a quarter, annualising turns noise into a headline. */
        tooShortToAnnualise: days > 0 && days < 90,
        flowCount: flows.length,
    };
};

export const stockReturn = (stock, asOf = new Date()) => profileFrom(
    stockCashflows(stock, asOf),
    { id: stock?.id, name: stock?.name || stock?.ticker || 'Unnamed', asOf },
);

export const fundReturn = (fund, asOf = new Date()) => profileFrom(
    fundCashflows(fund, asOf),
    { id: fund?.id, name: fund?.title || fund?.name || 'Unnamed fund', asOf },
);

/**
 * Every holding ranked by money-weighted return.
 *
 * Holdings whose rate is not computable are kept and sorted last rather than
 * dropped: a position with no valuation is a gap in the records, and hiding it
 * makes the list look complete when it is not.
 */
export const rankedReturns = (stocks = [], funds = [], asOf = new Date()) => {
    const rows = [
        ...(stocks || []).filter(Boolean).map((s) => ({ ...stockReturn(s, asOf), kind: 'stock', archived: !!s.isArchived })),
        ...(funds || []).filter(Boolean).map((f) => ({ ...fundReturn(f, asOf), kind: 'fund', archived: !!f.isArchived })),
    ];
    return rows.sort((a, b) => {
        if (a.xirrPct === null && b.xirrPct === null) return b.invested - a.invested;
        if (a.xirrPct === null) return 1;
        if (b.xirrPct === null) return -1;
        return b.xirrPct - a.xirrPct;
    });
};

/**
 * The portfolio's own XIRR: every holding's flows pooled into one series.
 *
 * Not the average of the individual rates. Averaging them would weight a ₹500
 * position the same as a ₹2 lakh one, and the answer would move when you bought
 * something small.
 */
export const portfolioReturn = (stocks = [], funds = [], asOf = new Date()) => {
    const flows = [
        ...(stocks || []).filter(Boolean).flatMap((s) => stockCashflows(s, asOf)),
        ...(funds || []).filter(Boolean).flatMap((f) => fundCashflows(f, asOf)),
    ];
    return profileFrom(flows, { id: 'portfolio', name: 'Whole portfolio', asOf });
};
