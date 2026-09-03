/**
 * Not every debit is money spent.
 *
 * A naive sum of this database's debits gives about ₹3.18 lakh a month, which
 * is roughly two and a half times what is actually consumed. The gap is not
 * error — it is four different things sharing one column:
 *
 *   spend        money gone: rent, groceries, fuel, a phone
 *   transfer     money moved into something you still own — an FD, a SIP, a
 *                savings account. Net worth does not change; only its shape.
 *   settlement   paying a credit card or BNPL bill. Every purchase on that bill
 *                was already logged as its own row, so counting the payment too
 *                counts the same rupee twice.
 *   lending      money handed to someone who is expected to return it.
 *   payroll      never left the bank at all, because it was taken before the
 *                salary landed (see payrollDeductions.js).
 *
 * Only `spend` is expenditure. The rest stay in the ledger — they are real
 * movements and worth seeing — but they must not inflate a spending figure, a
 * budget, or the denominator of "how many months does my emergency fund cover".
 *
 * ## Why the defaults stop where they do
 *
 * The two largest debit categories in this database are `other` (₹66.0 lakh)
 * and `bank transfer` (₹22.4 lakh). Between them that is over a quarter of all
 * money out, and neither name says what happened. They are deliberately NOT
 * classified here. A rule that guessed would move millions of rupees between
 * buckets on the strength of a word, and be wrong silently.
 *
 * They are reported as `unreviewed` instead, so the number is visible as a
 * question rather than buried inside an answer.
 */

export const KINDS = ['spend', 'transfer', 'settlement', 'lending', 'payroll'];

export const KIND_LABELS = {
    spend: 'Spending',
    transfer: 'Moved to savings',
    settlement: 'Bill settlement',
    lending: 'Lent out',
    payroll: 'Taken from salary',
};

export const KIND_BLURBS = {
    spend: 'Money consumed. This is what a budget is about.',
    transfer: 'Moved into something you still own — an FD, a SIP, a savings account.',
    settlement: 'Paying off a card. The purchases on it were already counted individually.',
    lending: 'Handed to someone who is expected to return it.',
    payroll: 'Deducted before the salary arrived, so it never left the bank.',
};

/**
 * Categories whose meaning is unambiguous, matched on the exact lowercased
 * category name rather than a substring.
 *
 * Substring matching was tried and is wrong here: `credit card interest` is a
 * genuine cost that contains `credit card`, and `loan emi` contains `loan`
 * while `loan given` means the opposite direction of money.
 */
const DEFAULTS = {
    // Settling a bill for purchases already logged one by one.
    'credit card payment': 'settlement',
    'credit card bill': 'settlement',
    'credit card': 'settlement',
    'card payment': 'settlement',
    'slice': 'settlement',
    'bnpl': 'settlement',

    // Into something still owned.
    'fixed deposit': 'transfer',
    'recurring deposit': 'transfer',
    'savings account': 'transfer',
    'mutual funds': 'transfer',
    'mutual fund': 'transfer',
    'stocks': 'transfer',
    'stock': 'transfer',
    'sip': 'transfer',
    'ppf': 'transfer',
    'nps': 'transfer',
    'gold scheme': 'transfer',
    'gold bond': 'transfer',
    'sovereign gold bond': 'transfer',
    'cash reserve': 'transfer',
    'investment': 'transfer',
    'investments': 'transfer',
    'emergency fund': 'transfer',
    // A chit or committee contribution comes back in full when your turn
    // arrives. Treating the ₹55,000 that returned in August 2026 as a refund of
    // spending wiped out that month's expenses almost exactly.
    'kitty amount': 'transfer',
    'food wallet': 'transfer',
    'wallet load': 'transfer',

    // Expected back.
    'loan given': 'lending',
    'family borrowed': 'lending',
    'friend borrowed': 'lending',
    'money lent': 'lending',
    'lent': 'lending',
    // The repayment side of the same arrangement. Without these the money
    // coming back read as a refund on consumption that never happened.
    'family lent': 'lending',
    'friend lent': 'lending',
    'loan repaid': 'lending',
    'money received back': 'lending',
};

/**
 * Categories large enough to matter and too vague to classify.
 *
 * These are reported separately rather than defaulted, because defaulting them
 * either way is a guess about ₹88 lakh.
 */
const VAGUE = ['other', 'others', 'bank transfer', 'transfers', 'transfer',
    'miscellaneous', 'misc', 'general', 'uncategorized', 'uncategorised', ''];

export const isVagueCategory = (category = '') => VAGUE.includes(String(category).trim().toLowerCase());

/**
 * A loan EMI stays `spend` on purpose.
 *
 * Part of it repays principal, which is a balance-sheet move, and part is
 * interest, which is a cost — and nothing in the row says how it splits. But
 * the whole payment is cash you are obliged to produce every month, so for the
 * question this classification mostly serves ("what do I need to cover?") the
 * honest answer is to count all of it. Splitting it would need a schedule the
 * ledger does not carry.
 */

const clean = (v) => String(v ?? '').trim().toLowerCase();

/**
 * What kind of movement a transaction is.
 *
 * Resolution order, most specific first:
 *   1. `tx.kind` — set by hand on this one row, and always wins.
 *   2. `deductFromSalary: false` — the older flag, still authoritative.
 *   3. the user's own category map, from appData.
 *   4. the built-in table above.
 *   5. `spend`.
 *
 * Credits are never classified: money coming in is not a kind of spending.
 */
export const kindFor = (tx, categoryKinds = {}) => {
    if (!tx) return 'spend';
    if (KINDS.includes(tx.kind)) return tx.kind;
    if (tx.deductFromSalary === false) return 'payroll';

    const cat = clean(tx.category);
    const chosen = categoryKinds?.[cat];
    if (KINDS.includes(chosen)) return chosen;

    return DEFAULTS[cat] || 'spend';
};

/** The built-in guess for a category, for showing what a rule would do. */
export const defaultKindForCategory = (category) => DEFAULTS[clean(category)] || 'spend';

/** Does this row belong in a spending total? */
export const isSpending = (tx, categoryKinds = {}) => kindFor(tx, categoryKinds) === 'spend';

/** A debit — money out. Refunds and income are credits and are excluded. */
export const isDebit = (tx) => !!tx && tx.isCredited !== true && tx.transactionType !== 'credit';

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Split a set of transactions into the five kinds.
 *
 * `unreviewed` counts the rows sitting in `spend` only because their category
 * is too vague to place. It overlaps with `spend` deliberately: it is not a
 * sixth bucket, it is a caveat on the size of the first one.
 */
export const flowBreakdown = (transactions = [], categoryKinds = {}) => {
    const buckets = {};
    KINDS.forEach((k) => { buckets[k] = { kind: k, total: 0, count: 0, categories: {} }; });

    let unreviewedTotal = 0;
    let unreviewedCount = 0;
    const unreviewedCategories = {};

    (transactions || []).forEach((tx) => {
        if (!isDebit(tx)) return;
        const amount = Math.abs(Number(tx.amount) || 0);
        if (!amount) return;

        const kind = kindFor(tx, categoryKinds);
        const bucket = buckets[kind] || buckets.spend;
        bucket.total += amount;
        bucket.count += 1;
        const cat = clean(tx.category) || 'uncategorised';
        bucket.categories[cat] = money((bucket.categories[cat] || 0) + amount);

        // Only an unclassified row inside `spend` is a question. A vague
        // category the user has already assigned a kind to has been reviewed.
        if (kind === 'spend' && isVagueCategory(tx.category) && !categoryKinds?.[cat] && !tx.kind) {
            unreviewedTotal += amount;
            unreviewedCount += 1;
            unreviewedCategories[cat] = money((unreviewedCategories[cat] || 0) + amount);
        }
    });

    const gross = KINDS.reduce((s, k) => s + buckets[k].total, 0);

    return {
        gross: money(gross),
        rows: KINDS.map((k) => ({
            ...buckets[k],
            total: money(buckets[k].total),
            label: KIND_LABELS[k],
            blurb: KIND_BLURBS[k],
            pct: gross > 0 ? (buckets[k].total / gross) * 100 : 0,
            categories: Object.entries(buckets[k].categories)
                .map(([category, amount]) => ({ category, amount }))
                .sort((a, b) => b.amount - a.amount),
        })),
        spend: money(buckets.spend.total),
        transfer: money(buckets.transfer.total),
        settlement: money(buckets.settlement.total),
        lending: money(buckets.lending.total),
        payroll: money(buckets.payroll.total),
        unreviewed: {
            total: money(unreviewedTotal),
            count: unreviewedCount,
            pctOfSpend: buckets.spend.total > 0 ? (unreviewedTotal / buckets.spend.total) * 100 : 0,
            categories: Object.entries(unreviewedCategories)
                .map(([category, amount]) => ({ category, amount }))
                .sort((a, b) => b.amount - a.amount),
        },
    };
};

/** Every transaction in the nested `expenses` tree, flattened, newest last. */
export const allTransactions = (expenses = {}) => {
    const out = [];
    Object.entries(expenses || {}).forEach(([year, months]) => {
        if (!months || typeof months !== 'object') return;
        Object.entries(months).forEach(([month, node]) => {
            (node?.transactions || []).forEach((tx) => {
                if (tx && typeof tx === 'object') out.push({ ...tx, _year: year, _month: month });
            });
        });
    });
    return out;
};

/**
 * Real spending per month, as an ISO `YYYY-MM` map.
 * Used wherever a monthly average is needed — a budget, a runway, a forecast.
 */
export const spendingByMonth = (expenses = {}, categoryKinds = {}) => {
    const months = {};
    allTransactions(expenses).forEach((tx) => {
        if (!isDebit(tx) || !isSpending(tx, categoryKinds)) return;
        const key = String(tx.date || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(key)) return;
        months[key] = money((months[key] || 0) + Math.abs(Number(tx.amount) || 0));
    });
    return months;
};

/**
 * Average real monthly spending over the last `months` complete months.
 *
 * The month in progress is excluded. Including it drags the average down every
 * time you look early in a month, which is exactly when a runway figure would
 * be most reassuring and least true.
 */
export const averageMonthlySpend = (expenses = {}, categoryKinds = {}, months = 6, now = new Date()) => {
    const byMonth = spendingByMonth(expenses, categoryKinds);
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const keys = Object.keys(byMonth).filter((k) => k < current).sort();
    const window = keys.slice(-months);
    if (window.length === 0) return { average: 0, months: 0, window: [] };
    const total = window.reduce((s, k) => s + byMonth[k], 0);
    return {
        average: money(total / window.length),
        months: window.length,
        window: window.map((k) => ({ month: k, amount: byMonth[k] })),
    };
};
