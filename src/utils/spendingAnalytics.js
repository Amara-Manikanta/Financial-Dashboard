/**
 * Analytics that answer a question.
 *
 * The old Analytics page drew four bar charts of the same totals sliced four
 * ways — monthly, by main category, by sub category, by category over time —
 * and left the reader to do the work. A chart of what you spent is not an
 * analysis of your spending: you already know you spent money on groceries.
 *
 * What is actually hard to see from a ledger, and what this file computes:
 *
 *   what changed     which categories moved against their own normal this
 *                    month, in rupees, ranked. This is the only view that
 *                    surfaces a problem you did not already know about.
 *   the direction    whether a category is drifting up over months, which no
 *                    single month reveals
 *   what it costs    real spending against income, so the surplus is visible
 *   the exceptions   single transactions far outside their category's normal
 *
 * Everything is measured on **real spending** — see transactionKind.js. The old
 * page counted credit-card settlements and SIP debits as expenditure, which
 * roughly doubled every figure on it and made the category rankings wrong: the
 * top "expense" was paying off a card whose purchases were already in the list.
 *
 * ## Median, not mean, for every baseline
 *
 * A category's normal is its median month. The mean is dragged by the very
 * outlier being looked for — one ₹90,000 laptop turns a ₹2,000 electronics
 * habit into a ₹9,000 one, and then the month it happened does not stand out.
 * The median ignores it, which is the whole point.
 */

import { isSpending, isDebit, kindFor, allTransactions, isVagueCategory } from './transactionKind.js';

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/** Categories that are earnings rather than money moving between your own pots. */
const INCOME_CATEGORIES = [
    'salary received', 'salary', 'income', 'bonus', 'interest income',
    'dividend', 'dividends', 'rental income', 'rent received', 'freelance',
    'commission', 'incentive', 'arrears',
];

const clean = (v) => String(v ?? '').trim().toLowerCase();

/**
 * What a credit is.
 *
 * The direction alone does not say. A salary credit is income; ₹1 crore of
 * `bank transfer` credits are mostly money arriving from the user's own
 * accounts; a refund is spending coming back. Counting all three as income
 * would put this person's earnings at ten times their salary.
 *
 * The user's own category classification is reused, unchanged: a category they
 * marked as a transfer is a transfer whichever way the money went.
 */
export const creditKind = (tx, categoryKinds = {}) => {
    const cat = clean(tx?.category);
    if (INCOME_CATEGORIES.includes(cat)) return 'earned';
    const kind = kindFor({ ...tx, deductFromSalary: undefined }, categoryKinds);
    if (kind === 'transfer' || kind === 'settlement') return 'transfer-in';
    if (kind === 'lending') return 'repayment';
    // A credit in a category too vague to place is not a refund. There is over
    // a crore of `bank transfer` credits in this ledger, almost all of it money
    // arriving from the user's own accounts, and calling that a refund would
    // erase whole months of spending.
    if (isVagueCategory(cat)) return 'unclassified';
    return 'refund';
};

const isCredit = (tx) => !!tx && (tx.isCredited === true || tx.transactionType === 'credit');

const monthOf = (tx) => {
    const key = String(tx?.date || '').slice(0, 7);
    return /^\d{4}-\d{2}$/.test(key) ? key : null;
};

const median = (values = []) => {
    const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Month by month: what came in, what actually went out, and what is left.
 *
 * Refunds are netted off spending rather than counted as income — a returned
 * purchase is not earnings, and treating it as such inflates both sides.
 */
export const monthlySeries = (expenses = {}, categoryKinds = {}) => {
    const months = {};

    allTransactions(expenses).forEach((tx) => {
        const month = monthOf(tx);
        if (!month) return;
        const amount = Math.abs(num(tx.amount));
        if (!amount) return;

        months[month] = months[month] || {
            month, income: 0, spend: 0, transfers: 0, settlements: 0,
            lending: 0, refunds: 0, transfersIn: 0, payroll: 0, count: 0,
            spendByCategory: {}, refundByCategory: {},
        };
        const m = months[month];
        const cat = clean(tx.category) || 'uncategorised';

        if (isCredit(tx)) {
            const k = creditKind(tx, categoryKinds);
            if (k === 'earned') m.income += amount;
            else if (k === 'refund') m.refundByCategory[cat] = (m.refundByCategory[cat] || 0) + amount;
            else if (k === 'unclassified') { /* neither income nor a refund */ }
            else m.transfersIn += amount;
            return;
        }

        if (!isDebit(tx)) return;
        const kind = kindFor(tx, categoryKinds);
        if (kind === 'spend') {
            m.spend += amount;
            m.spendByCategory[cat] = (m.spendByCategory[cat] || 0) + amount;
            m.count += 1;
        } else if (kind === 'transfer') m.transfers += amount;
        else if (kind === 'settlement') m.settlements += amount;
        else if (kind === 'lending') m.lending += amount;
        else if (kind === 'payroll') m.payroll += amount;
    });

    return Object.values(months)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
            // A refund can only give back what was spent.
            //
            // Capped per category, per month, because a credit larger than the
            // debits it is supposedly reversing is not a refund — it is money
            // arriving for some other reason that happens to share a category
            // name. Uncapped, August 2026 netted ₹92,019 of spending against
            // ₹91,983 of "refunds" and reported ₹35 spent for the month.
            const refunds = Object.entries(m.refundByCategory).reduce(
                (sum, [cat, amount]) => sum + Math.min(amount, m.spendByCategory[cat] || 0),
                0,
            );
            const netSpend = Math.max(0, m.spend - refunds);
            const surplus = m.income - netSpend;
            // eslint-disable-next-line no-param-reassign
            m.refunds = refunds;
            return {
                ...m,
                income: money(m.income),
                spend: money(m.spend),
                netSpend: money(netSpend),
                refunds: money(m.refunds),
                transfers: money(m.transfers),
                settlements: money(m.settlements),
                lending: money(m.lending),
                transfersIn: money(m.transfersIn),
                payroll: money(m.payroll),
                surplus: money(surplus),
                /**
                 * Income too small to be this month's actual income.
                 *
                 * Salary is not logged as a transaction in every month — four
                 * of the last twelve have none at all, and January 2026 has
                 * ₹163 of it against ₹147,000 spent. That is a gap in the
                 * records, not a month of living on ₹163, and computing a rate
                 * from it produced "-90,084%".
                 */
                incomeIncomplete: m.income > 0 && netSpend > 0 && m.income < netSpend * 0.25,
                noIncomeRecorded: m.income === 0,
                /**
                 * Share of income not consumed. Null wherever the income figure
                 * cannot carry the division — a rate is worse than no rate when
                 * its denominator is a data gap.
                 */
                savingsRate: m.income > 0 && !(netSpend > 0 && m.income < netSpend * 0.25)
                    ? (surplus / m.income) * 100
                    : null,
            };
        });
};

/** Real spending per category for one month. */
const categorySpendForMonth = (transactions = [], categoryKinds = {}) => {
    const totals = {};
    transactions.forEach((tx) => {
        if (!isDebit(tx) || !isSpending(tx, categoryKinds)) return;
        const cat = clean(tx.category) || 'uncategorised';
        totals[cat] = (totals[cat] || 0) + Math.abs(num(tx.amount));
    });
    return totals;
};

/** Every month's per-category spend, keyed month -> category -> amount. */
export const categoryByMonth = (expenses = {}, categoryKinds = {}) => {
    const byMonth = {};
    allTransactions(expenses).forEach((tx) => {
        const month = monthOf(tx);
        if (!month || !isDebit(tx) || !isSpending(tx, categoryKinds)) return;
        const cat = clean(tx.category) || 'uncategorised';
        byMonth[month] = byMonth[month] || {};
        byMonth[month][cat] = money((byMonth[month][cat] || 0) + Math.abs(num(tx.amount)));
    });
    return byMonth;
};

/**
 * What moved, and by how much, against each category's own median month.
 *
 * The single most useful thing this page can show. A ranking of categories by
 * size tells you rent is expensive, which you knew. A ranking by *change* tells
 * you the electricity bill has doubled, which you did not.
 *
 * Categories seen in fewer than `minMonths` of the baseline are reported with
 * `establishedBaseline: false` rather than dropped: a brand new category is a
 * genuine change, but calling a first-ever ₹5,000 an "increase of ₹5,000 on a
 * median of zero" would rank it above everything on a technicality.
 */
export const categoryMovers = (expenses = {}, categoryKinds = {}, {
    month = null, baselineMonths = 6, minMonths = 3,
} = {}) => {
    const byMonth = categoryByMonth(expenses, categoryKinds);
    const allMonths = Object.keys(byMonth).sort();
    if (allMonths.length === 0) return { month: null, baseline: [], rows: [] };

    const target = month || allMonths[allMonths.length - 1];
    const targetIndex = allMonths.indexOf(target);
    if (targetIndex < 0) return { month: target, baseline: [], rows: [] };

    const baseline = allMonths.slice(Math.max(0, targetIndex - baselineMonths), targetIndex);
    const current = byMonth[target] || {};

    const categories = new Set([
        ...Object.keys(current),
        ...baseline.flatMap((m) => Object.keys(byMonth[m] || {})),
    ]);

    const rows = [...categories].map((category) => {
        // Absent months count as zero, not as missing. A category you spent
        // nothing on in three of six months has a low median, and it should:
        // that IS its normal.
        const history = baseline.map((m) => num(byMonth[m]?.[category]));
        const seen = history.filter((v) => v > 0).length;
        const normal = median(history);
        const now = num(current[category]);
        return {
            category,
            current: money(now),
            normal: money(normal),
            change: money(now - normal),
            changePct: normal > 0 ? ((now - normal) / normal) * 100 : null,
            monthsSeen: seen,
            baselineMonths: baseline.length,
            establishedBaseline: seen >= minMonths,
            isNew: seen === 0 && now > 0,
            stopped: seen >= minMonths && now === 0,
        };
    });

    return {
        month: target,
        baseline,
        rows: rows.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)),
        increases: rows.filter((r) => r.change > 0).sort((a, b) => b.change - a.change),
        decreases: rows.filter((r) => r.change < 0).sort((a, b) => a.change - b.change),
    };
};

/**
 * Whether a category is drifting, across the whole window.
 *
 * Compares the median of the recent half against the median of the earlier
 * half. A slope fitted through monthly points would be swayed by one spike;
 * comparing two medians is blunter and much harder to fool.
 */
export const categoryTrends = (expenses = {}, categoryKinds = {}, windowMonths = 12) => {
    const byMonth = categoryByMonth(expenses, categoryKinds);
    const months = Object.keys(byMonth).sort().slice(-windowMonths);
    if (months.length < 4) return [];

    const half = Math.floor(months.length / 2);
    const earlier = months.slice(0, half);
    const recent = months.slice(half);

    const categories = new Set(months.flatMap((m) => Object.keys(byMonth[m] || {})));

    return [...categories].map((category) => {
        const earlierValues = earlier.map((m) => num(byMonth[m]?.[category]));
        const recentValues = recent.map((m) => num(byMonth[m]?.[category]));
        const before = median(earlierValues);
        const after = median(recentValues);
        const total = money([...earlierValues, ...recentValues].reduce((s, v) => s + v, 0));
        return {
            category,
            total,
            before: money(before),
            after: money(after),
            change: money(after - before),
            changePct: before > 0 ? ((after - before) / before) * 100 : null,
            direction: after > before ? 'up' : after < before ? 'down' : 'flat',
            months: months.map((m) => ({ month: m, amount: num(byMonth[m]?.[category]) })),
            activeMonths: [...earlierValues, ...recentValues].filter((v) => v > 0).length,
        };
    }).sort((a, b) => b.total - a.total);
};

/**
 * Single transactions far outside what that category normally costs.
 *
 * Compared against the median *transaction* in the category, not the median
 * month — the question is "was this purchase unusual", and a category with one
 * purchase a month and one with forty are not comparable on monthly totals.
 *
 * Categories with fewer than five transactions are skipped. With three
 * examples, everything is an outlier.
 */
export const spendingOutliers = (expenses = {}, categoryKinds = {}, {
    sinceMonths = 12, multiple = 4, minSample = 5, limit = 20,
} = {}) => {
    const all = allTransactions(expenses).filter((tx) => isDebit(tx) && isSpending(tx, categoryKinds));
    const months = [...new Set(all.map(monthOf).filter(Boolean))].sort();
    const cutoff = months.slice(-sinceMonths)[0] || '0000-00';

    const byCategory = {};
    all.forEach((tx) => {
        const cat = clean(tx.category) || 'uncategorised';
        byCategory[cat] = byCategory[cat] || [];
        byCategory[cat].push(tx);
    });

    const out = [];
    Object.entries(byCategory).forEach(([category, txs]) => {
        if (txs.length < minSample) return;
        const typical = median(txs.map((t) => Math.abs(num(t.amount))));
        if (typical <= 0) return;
        txs.forEach((tx) => {
            const month = monthOf(tx);
            if (!month || month < cutoff) return;
            const amount = Math.abs(num(tx.amount));
            if (amount < typical * multiple) return;
            out.push({
                id: tx.id,
                date: tx.date,
                month,
                title: tx.title || category,
                category,
                amount: money(amount),
                typical: money(typical),
                timesTypical: amount / typical,
            });
        });
    });

    return out.sort((a, b) => b.amount - a.amount).slice(0, limit);
};

/**
 * How much of spending sits in how few categories.
 *
 * Useful because it says where effort to cut would go. If the top five
 * categories are 80% of spending, the other forty do not matter.
 */
export const concentration = (expenses = {}, categoryKinds = {}, months = 12) => {
    const byMonth = categoryByMonth(expenses, categoryKinds);
    const window = Object.keys(byMonth).sort().slice(-months);

    const totals = {};
    window.forEach((m) => {
        Object.entries(byMonth[m] || {}).forEach(([cat, amount]) => {
            totals[cat] = (totals[cat] || 0) + amount;
        });
    });

    const rows = Object.entries(totals)
        .map(([category, amount]) => ({ category, amount: money(amount) }))
        .sort((a, b) => b.amount - a.amount);

    const total = rows.reduce((s, r) => s + r.amount, 0);
    let running = 0;
    const withShare = rows.map((r) => {
        running += r.amount;
        return {
            ...r,
            share: total > 0 ? (r.amount / total) * 100 : 0,
            cumulativeShare: total > 0 ? (running / total) * 100 : 0,
            perMonth: window.length ? money(r.amount / window.length) : 0,
        };
    });

    const topFive = withShare.slice(0, 5).reduce((s, r) => s + r.amount, 0);
    return {
        rows: withShare,
        total: money(total),
        months: window.length,
        categoryCount: rows.length,
        topFiveShare: total > 0 ? (topFive / total) * 100 : 0,
        /** How many categories it takes to reach 80% of spending. */
        categoriesTo80: withShare.findIndex((r) => r.cumulativeShare >= 80) + 1,
    };
};

/**
 * The headline: this month against normal, and whether the year is on track.
 */
export const spendingOverview = (expenses = {}, categoryKinds = {}, now = new Date()) => {
    const series = monthlySeries(expenses, categoryKinds);
    if (series.length === 0) return null;

    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const complete = series.filter((m) => m.month < currentKey);
    const inProgress = series.find((m) => m.month === currentKey) || null;

    const last6 = complete.slice(-6);
    const last12 = complete.slice(-12);
    const normalSpend = median(last6.map((m) => m.netSpend));
    // Only from months that actually recorded a salary. Including the months
    // with none would halve the figure and make the surplus look negative.
    const incomeMonths = last6.filter((m) => !m.noIncomeRecorded && !m.incomeIncomplete);
    const normalIncome = median(incomeMonths.map((m) => m.income));

    const lastComplete = complete[complete.length - 1] || null;

    // Only rates from months that actually recorded income. Averaging in a
    // month with no salary row would report a savings rate nobody had.
    const rates = last12.map((m) => m.savingsRate).filter((r) => r !== null);

    return {
        series,
        complete,
        inProgress,
        lastComplete,
        normalSpend: money(normalSpend),
        normalIncome: money(normalIncome),
        normalSurplus: money(normalIncome - normalSpend),
        medianSavingsRate: rates.length ? median(rates) : null,
        monthsWithIncome: rates.length,
        monthsTracked: series.length,
        /** Months in the last year where income is missing or implausibly small. */
        monthsMissingIncome: last12.filter((m) => m.noIncomeRecorded || m.incomeIncomplete)
            .map((m) => m.month),
        /** How the last complete month compares with the six before it. */
        lastVsNormal: lastComplete && normalSpend > 0
            ? { change: money(lastComplete.netSpend - normalSpend), pct: ((lastComplete.netSpend - normalSpend) / normalSpend) * 100 }
            : null,
    };
};
