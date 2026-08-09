// Data-quality checks over the transaction history.
//
// Every check here is deterministic and explains itself: each returns a count,
// a sample of the actual offending rows, and a fix hint. Nothing is repaired
// automatically — this is a worklist, not a migration.

const VAGUE_CATEGORIES = new Set(['other', 'others', 'miscellaneous', 'misc', 'uncategorized', 'uncategorised', 'unknown', '']);

const MONTH_ORDER = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export const flattenTransactions = (expenses) => {
    const out = [];
    if (!expenses || typeof expenses !== 'object') return out;
    Object.entries(expenses).forEach(([year, months]) => {
        if (!months || typeof months !== 'object') return;
        Object.entries(months).forEach(([month, data]) => {
            (data?.transactions || []).forEach((t) => {
                if (t && typeof t === 'object') out.push({ ...t, _year: year, _month: month });
            });
        });
    });
    return out;
};

// Collapse cosmetic differences so "Restaurants", "restaurant" and
// "Food / Restaurant" land on comparable keys. Deliberately conservative:
// spacing, punctuation and a trailing plural only.
const canonicalCategory = (name) => String(name || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/s$/, '');

export const runHealthChecks = (expenses, salaryDetails = [], creditCards = []) => {
    const tx = flattenTransactions(expenses);
    const checks = [];

    // 1. Vague or missing category
    const vague = tx.filter((t) => VAGUE_CATEGORIES.has(String(t.category || '').toLowerCase().trim()));
    checks.push({
        id: 'vague-category',
        title: 'Transactions with a vague category',
        severity: vague.length > 200 ? 'high' : 'medium',
        count: vague.length,
        total: vague.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0),
        detail: `Categorised "other" or left blank, so they are invisible in every category breakdown.`,
        fix: 'Assign real categories, ideally by adding merchant rules so similar rows are handled once.',
        sample: vague.slice(0, 8).map((t) => ({ date: t.date, amount: t.amount, label: t.title || '(no title)' })),
    });

    // 2. Missing title
    const untitled = tx.filter((t) => !String(t.title || '').trim());
    checks.push({
        id: 'no-title',
        title: 'Transactions with no description',
        severity: untitled.length > 200 ? 'high' : 'medium',
        count: untitled.length,
        total: untitled.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0),
        detail: 'Nothing recorded about what the money was for — these cannot be recognised later.',
        fix: 'Add a merchant or purpose. Statement re-imports can often refill these.',
        sample: untitled.slice(0, 8).map((t) => ({ date: t.date, amount: t.amount, label: `${t.category || 'uncategorised'}` })),
    });

    // 3. Category sprawl: near-duplicates that split one real category in two
    const byCanon = new Map();
    tx.forEach((t) => {
        const raw = String(t.category || '').toLowerCase().trim();
        if (!raw) return;
        const key = canonicalCategory(raw);
        if (!key) return;
        if (!byCanon.has(key)) byCanon.set(key, new Map());
        const variants = byCanon.get(key);
        variants.set(raw, (variants.get(raw) || 0) + 1);
    });
    const duplicatePairs = [...byCanon.values()]
        .filter((variants) => variants.size > 1)
        .map((variants) => [...variants.entries()].sort((a, b) => b[1] - a[1]));
    checks.push({
        id: 'category-variants',
        title: 'Categories that are the same thing spelled differently',
        severity: duplicatePairs.length > 8 ? 'medium' : 'low',
        count: duplicatePairs.length,
        detail: 'Each of these splits one real category across two or more labels, so totals under-report.',
        fix: 'Merge them from Budget Limits → Rename Category.',
        sample: duplicatePairs.slice(0, 8).map((variants) => ({
            label: variants.map(([n, c]) => `${n} (${c})`).join('  ·  '),
        })),
    });

    // 4. Long tail of barely-used categories
    const catCounts = new Map();
    tx.forEach((t) => {
        const raw = String(t.category || '').toLowerCase().trim();
        if (raw) catCounts.set(raw, (catCounts.get(raw) || 0) + 1);
    });
    const rare = [...catCounts.entries()].filter(([, c]) => c <= 2);
    checks.push({
        id: 'rare-categories',
        title: 'Categories used two times or fewer',
        severity: rare.length > 60 ? 'medium' : 'low',
        count: rare.length,
        detail: `${rare.reduce((s, [, c]) => s + c, 0)} transactions sit in ${rare.length} one-off categories, fragmenting your breakdowns.`,
        fix: 'Fold them into an existing category unless the distinction genuinely matters.',
        sample: rare.slice(0, 10).map(([n, c]) => ({ label: `${n} (${c})` })),
    });

    // 5. Wallet loads recorded on the card but missing from the payslip
    const walletNames = creditCards.filter((c) => c.type === 'wallet').map((c) => c.name.trim());
    if (walletNames.length) {
        const loadsByMonth = new Map();
        tx.forEach((t) => {
            if (t.paymentMode !== 'credit_card') return;
            if (!walletNames.includes(String(t.creditCardName || '').trim())) return;
            if (!(t.isCredited || t.transactionType === 'credit')) return;
            const key = `${t._year}|${t._month}`;
            loadsByMonth.set(key, (loadsByMonth.get(key) || 0) + (Number(t.amount) || 0));
        });
        const payslip = new Map();
        (salaryDetails || []).forEach((s) => {
            if (s?.type === 'monthly') payslip.set(`${s.year}|${s.month}`, Number(s.foodWallet) || 0);
        });
        const mismatched = [...loadsByMonth.entries()].filter(([k]) => !payslip.get(k));
        checks.push({
            id: 'wallet-vs-payslip',
            title: 'Wallet loaded, but the payslip shows no food allowance',
            severity: mismatched.length > 6 ? 'high' : 'low',
            count: mismatched.length,
            total: mismatched.reduce((s, [, v]) => s + v, 0),
            detail: 'The card was topped up in these months but foodWallet is blank on the payslip, so that income is missing from your inflow totals.',
            fix: 'Fill in foodWallet on those payslips from Salary.',
            sample: mismatched
                .sort((a, b) => a[0].localeCompare(b[0]))
                .slice(0, 8)
                .map(([k, v]) => {
                    const [y, m] = k.split('|');
                    return { label: `${m} ${y}`, amount: v };
                }),
        });
    }

    // 6. Duplicate-import signature: two import batches covering the same rows.
    // Matches on card + date + amount + direction, never on description, because
    // a re-import often tidies the text while keeping the money identical.
    const batchOf = (id) => {
        const m = /^import_(\d{10})/.exec(String(id || ''));
        return m ? m[1] : null;
    };
    const batches = new Map();
    tx.forEach((t) => {
        const b = batchOf(t.id);
        if (!b) return;
        if (!batches.has(b)) batches.set(b, []);
        batches.get(b).push(t);
    });
    const sig = (t) => [
        String(t.creditCardName || '-').trim(),
        String(t.date || '').slice(0, 10),
        Math.round(Math.abs(Number(t.amount) || 0) * 100),
        t.isCredited || t.transactionType === 'credit' ? 'c' : 'd',
    ].join('|');
    const overlaps = [];
    const keys = [...batches.keys()];
    for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
            const a = new Map();
            batches.get(keys[i]).forEach((t) => a.set(sig(t), (a.get(sig(t)) || 0) + 1));
            let shared = 0;
            batches.get(keys[j]).forEach((t) => {
                const k = sig(t);
                if (a.get(k) > 0) { shared += 1; a.set(k, a.get(k) - 1); }
            });
            if (shared > 2) {
                overlaps.push({
                    label: `Batch ${keys[i]} and ${keys[j]} share ${shared} identical rows`,
                    count: shared,
                });
            }
        }
    }
    checks.push({
        id: 'duplicate-imports',
        title: 'Statement imported twice',
        severity: overlaps.length ? 'high' : 'ok',
        count: overlaps.reduce((s, o) => s + o.count, 0),
        detail: overlaps.length
            ? 'Two import runs contain the same card, date, amount and direction — the same statement was almost certainly loaded twice.'
            : 'No import batch overlaps another. Every statement appears once.',
        fix: 'Keep the batch with better descriptions and delete the rows the other duplicates.',
        sample: overlaps.slice(0, 6),
    });

    // 7. Credit cards with no billing day set
    const noBillingDay = creditCards.filter((c) => c.type !== 'wallet' && !c.billingDay);
    checks.push({
        id: 'card-billing-day',
        title: 'Cards with no billing day',
        severity: noBillingDay.length ? 'medium' : 'ok',
        count: noBillingDay.length,
        detail: noBillingDay.length
            ? 'Without a billing day, statement periods and due-date forecasting cannot be calculated for these cards.'
            : 'Every credit card has a billing day.',
        fix: 'Set the billing day on the card.',
        sample: noBillingDay.map((c) => ({ label: c.name })),
    });

    const order = { high: 0, medium: 1, low: 2, ok: 3 };
    return checks.sort((a, b) => (order[a.severity] - order[b.severity]) || (b.count - a.count));
};

export { MONTH_ORDER };
