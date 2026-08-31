/**
 * Dividends as income, not as a footnote on a holding.
 *
 * Three things live here that the stock pages could not answer:
 *
 *   yield on cost   what a holding pays against what YOU paid for it, which is
 *                   not the yield a broker quotes (dividends over today's price)
 *   consistency     whether a payer is dependable or paid once and stopped
 *   income          dividends arranged by when the cash actually arrived
 *
 * Dividend amounts are read from the transactions, where the payout sits in
 * `price` with `quantity: 0`. The `dividends` object on a stock is derived from
 * those same transactions by recomputeStockMetrics, so anything that sums both
 * counts every payout twice.
 */

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/** A dividend leg's cash. Payouts are recorded in `price`, not `amount`. */
const payout = (tx) => num(tx.amount) || num(tx.price);

const dividendTxs = (stock) => (stock?.transactions || []).filter((t) => t.type === 'dividend');

/** What was actually paid for the shares — buys and IPO allotments. */
const investedIn = (stock) => (stock?.transactions || []).reduce((sum, tx) => {
    if (tx.type !== 'buy' && tx.type !== 'ipo') return sum;
    return sum + (num(tx.amount) || num(tx.quantity ?? tx.shares) * num(tx.price));
}, 0);

/**
 * Yield on cost: dividends received against money put in.
 *
 * Deliberately measured against cost rather than market value. Market yield
 * answers "what would this pay if I bought it today"; this answers "what is the
 * money I actually committed returning me in cash", which is the question an
 * owner has. It also rises over time as a company grows its payout while your
 * cost stays where it was.
 */
export const yieldOnCost = (stock) => {
    const invested = investedIn(stock);
    const total = dividendTxs(stock).reduce((s, t) => s + payout(t), 0);
    return {
        invested: money(invested),
        total: money(total),
        pct: invested > 0 ? (total / invested) * 100 : 0,
        /** Cash returned per year of holding, once there is enough history. */
        annualisedPct: null,
    };
};

/**
 * How dependable a payer this is.
 *
 * `paidYears` counts calendar years with at least one payout, measured from the
 * first payout rather than the first purchase — a stock bought in January that
 * first paid in November has one year of history, not two.
 */
export const payoutConsistency = (stock, now = new Date()) => {
    const txs = dividendTxs(stock);
    if (txs.length === 0) {
        return { everPaid: false, payments: 0, paidYears: 0, spanYears: 0,
                 consistency: 0, lastPaid: null, yearsSinceLast: null, lapsed: false, byYear: {} };
    }

    const byYear = {};
    txs.forEach((t) => {
        const y = String(new Date(t.date).getFullYear());
        byYear[y] = money((byYear[y] || 0) + payout(t));
    });

    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const firstYear = years[0];
    const thisYear = now.getFullYear();
    const spanYears = Math.max(1, thisYear - firstYear + 1);
    const paidYears = years.length;

    const lastPaid = txs
        .map((t) => t.date)
        .sort()
        .slice(-1)[0];
    const yearsSinceLast = thisYear - new Date(lastPaid).getFullYear();

    return {
        everPaid: true,
        payments: txs.length,
        paidYears,
        spanYears,
        /** Share of years since the first payout in which it paid at all. */
        consistency: (paidYears / spanYears) * 100,
        lastPaid,
        yearsSinceLast,
        // Two full calendar years without a payout from a stock that used to pay
        // is worth surfacing: it usually means something changed at the company.
        lapsed: yearsSinceLast >= 2,
        byYear,
    };
};

/** One stock, both measures, for a table. */
export const dividendProfile = (stock) => {
    const y = yieldOnCost(stock);
    const c = payoutConsistency(stock);
    return {
        id: stock?.id,
        name: stock?.name || stock?.ticker || 'Unnamed',
        shares: num(stock?.shares),
        held: num(stock?.shares) > 0,
        ...y,
        ...c,
    };
};

/** Every dividend payer, best yield on cost first. */
export const dividendPayers = (stocks = []) => (stocks || [])
    .filter((s) => s && !s.isArchived)
    .map(dividendProfile)
    .filter((p) => p.everPaid)
    .sort((a, b) => b.pct - a.pct);

/** Payers that have gone quiet for two years or more. */
export const lapsedPayers = (stocks = []) => dividendPayers(stocks).filter((p) => p.lapsed && p.held);

/**
 * Dividend income by calendar year, across the portfolio.
 * Archived holdings are included: the cash arrived, whatever you did later.
 */
export const incomeByYear = (stocks = []) => {
    const years = {};
    (stocks || []).forEach((s) => {
        dividendTxs(s).forEach((t) => {
            const y = String(new Date(t.date).getFullYear());
            years[y] = (years[y] || 0) + payout(t);
        });
    });
    return Object.entries(years)
        .map(([year, amount]) => ({ year, amount: money(amount) }))
        .sort((a, b) => a.year.localeCompare(b.year));
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Dividend income by month for one year, with every month present.
 *
 * Empty months are kept rather than dropped, because the gaps are the point —
 * dividend income is lumpy, and a chart that omits the silent months makes it
 * look like a salary.
 */
export const incomeByMonth = (stocks = [], year) => {
    const target = String(year);
    const totals = MONTHS.map((month) => ({ month, amount: 0, payments: 0 }));
    (stocks || []).forEach((s) => {
        dividendTxs(s).forEach((t) => {
            const d = new Date(t.date);
            if (String(d.getFullYear()) !== target) return;
            const row = totals[d.getMonth()];
            row.amount = money(row.amount + payout(t));
            row.payments += 1;
        });
    });
    return totals;
};

/** Headline figures for the income view. */
export const incomeSummary = (stocks = [], now = new Date()) => {
    const years = incomeByYear(stocks);
    const thisYear = String(now.getFullYear());
    const current = years.find((y) => y.year === thisYear)?.amount || 0;
    const lifetime = money(years.reduce((s, y) => s + y.amount, 0));
    const payers = dividendPayers(stocks);
    const invested = payers.reduce((s, p) => s + p.invested, 0);

    // The best full year on record, ignoring the year in progress — comparing a
    // part-year against complete ones would understate it every January.
    const completed = years.filter((y) => y.year !== thisYear);
    const best = completed.sort((a, b) => b.amount - a.amount)[0] || null;

    return {
        lifetime,
        thisYear: money(current),
        bestYear: best,
        payerCount: payers.length,
        lapsedCount: payers.filter((p) => p.lapsed && p.held).length,
        portfolioYieldOnCost: invested > 0 ? (lifetime / invested) * 100 : 0,
        years,
    };
};
