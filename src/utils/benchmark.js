/**
 * What the same money would have done in the index.
 *
 * Deliberately not built on `snapshots`. There are two of them, five months
 * apart, and the value between them rises tenfold — almost entirely because
 * property and metals already owned were entered into the app during that
 * window, not because anything grew. Neither snapshot separates equities from
 * savings either. Comparing that to an index would produce a confident,
 * meaningless number.
 *
 * The transaction history is the sound basis: 200 dated buys with amounts. For
 * each one, this asks what those same rupees would be worth had they bought the
 * index on the same day instead — a money-weighted comparison that respects
 * *when* money went in. A stock bought last week and one bought in 2021 are not
 * comparable on a simple percentage, and this does not pretend they are.
 */

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/** Buys and IPO allotments — money actually deployed into equities, with dates. */
export const deployments = (stocks = []) => (stocks || [])
    .filter((s) => s && !s.isArchived)
    .flatMap((s) => (s.transactions || [])
        .filter((t) => (t.type === 'buy' || t.type === 'ipo') && t.date)
        .map((t) => ({
            date: String(t.date).slice(0, 10),
            amount: num(t.amount) || num(t.quantity ?? t.shares) * num(t.price),
            stock: s.name || s.ticker,
        })))
    .filter((d) => d.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

/**
 * The index close on or before a date.
 *
 * Markets close at weekends and holidays, so an exact-date lookup would drop
 * every purchase made on one. Walking back finds the price the money would
 * actually have transacted at.
 */
export const closeOnOrBefore = (closes, date, maxBackDays = 10) => {
    const d = new Date(date);
    for (let i = 0; i <= maxBackDays; i += 1) {
        const key = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
        if (closes[key] !== undefined) return closes[key];
    }
    return null;
};

/**
 * Compare money deployed into stocks against the same money in the index.
 *
 * `unmatched` is reported rather than quietly dropped: a purchase made before
 * the index history begins cannot be compared, and leaving it out of the
 * denominator while keeping it in the portfolio side would flatter the result.
 */
export const compareToIndex = ({ stocks = [], closes = {}, portfolioValue = 0, realised = 0, dividends = 0 }) => {
    const buys = deployments(stocks);
    if (buys.length === 0 || Object.keys(closes).length === 0) return null;

    const dates = Object.keys(closes).sort();
    const latestClose = closes[dates[dates.length - 1]];
    const earliest = dates[0];

    let invested = 0;
    let indexUnits = 0;
    const unmatched = [];

    buys.forEach((b) => {
        const close = closeOnOrBefore(closes, b.date);
        if (close === null || b.date < earliest) {
            unmatched.push(b);
            return;
        }
        invested += b.amount;
        indexUnits += b.amount / close;
    });

    const indexValue = indexUnits * latestClose;
    // What the portfolio is actually worth today, including money already taken
    // out — a comparison that ignored realised gains and dividends would punish
    // every position that was sold well.
    const portfolioTotal = num(portfolioValue) + num(realised) + num(dividends);

    return {
        comparableInvested: money(invested),
        portfolioTotal: money(portfolioTotal),
        indexValue: money(indexValue),
        difference: money(portfolioTotal - indexValue),
        portfolioReturnPct: invested > 0 ? ((portfolioTotal - invested) / invested) * 100 : null,
        indexReturnPct: invested > 0 ? ((indexValue - invested) / invested) * 100 : null,
        beatIndex: portfolioTotal > indexValue,
        firstDeployment: buys[0].date,
        indexFrom: earliest,
        unmatchedCount: unmatched.length,
        unmatchedAmount: money(unmatched.reduce((s, u) => s + u.amount, 0)),
        deploymentCount: buys.length - unmatched.length,
    };
};
