// Detects repeating charges (subscriptions, EMIs, standing transfers) from the
// transaction history.
//
// Deliberately deterministic: no fuzzy/AI matching anywhere. Everything here is
// derived from dates and amounts so the same history always yields the same
// result, and a wrong grouping can be traced to a rule rather than a guess.

const MONTH_WORDS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';

// City/bank/plumbing words that appear inside statement descriptors and carry no
// brand information. Stripping them is what merges "ADOBE SYSTEMS ... US" and
// "Adobe Subscription" into one series.
const NOISE_WORDS = /\b(in|us|uk|pvt|ltd|limited|india|payment|payments|paid|recd|received|purchase|purchases|log|import|txn|ref|bank|okhdfcbank|paytm|upi|gpay|phonepe|razorpay|billdesk|new|delhi|gurgaon|kakinada|mumbai|hyderabad|bangalore|bengaluru|chennai|pune|noida|www|com|http|https|the|and|for)\b/g;

// Series whose normalised name is this generic are noise, not merchants.
const TOO_GENERIC = new Set([
    'auto', 'share', 'return', 'fuel', 'cash', 'amount', 'behalf', 'transfer',
    'credit', 'debit', 'bill', 'misc', 'other', 'others', 'self', 'test',
]);

export const normaliseMerchant = (raw) => {
    let s = String(raw || '').toLowerCase();
    s = s.replace(/https?:\/\/\S+|www\.\S+/g, ' ');
    s = s.replace(/\b\d{4,}\b/g, ' ');          // reference numbers
    s = s.replace(/\b(x{2,}|\d+)\b/g, ' ');     // masked digits, standalone numbers
    s = s.replace(/[^a-z ]/g, ' ');
    s = s.replace(new RegExp(`\\b(${MONTH_WORDS})\\b`, 'g'), ' ');  // month names in titles
    s = s.replace(NOISE_WORDS, ' ');
    const tokens = s.split(/\s+/).filter(Boolean);
    return tokens.slice(0, 2).join(' ').slice(0, 24);
};

const CADENCES = [
    { name: 'Weekly', days: 7, tolerance: 3, perYear: 52 },
    { name: 'Monthly', days: 30, tolerance: 8, perYear: 12 },
    { name: 'Quarterly', days: 91, tolerance: 18, perYear: 4 },
    { name: 'Half-yearly', days: 182, tolerance: 25, perYear: 2 },
    { name: 'Yearly', days: 365, tolerance: 45, perYear: 1 },
];

const toOrdinal = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};
const fromOrdinal = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

const median = (nums) => {
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const classify = (name, categories) => {
    const hay = `${name} ${categories.join(' ')}`;
    if (/emi|loan|principal|amortization|amortisation/.test(hay)) return 'Loan / EMI';
    if (/transfer|person|lent|sent to|behalf/.test(hay)) return 'Transfer';
    if (/insurance|premium|policy/.test(hay)) return 'Insurance';
    return 'Subscription';
};

/**
 * @param {object} expenses  the FinanceContext expenses tree (year -> month -> {transactions})
 * @param {Date}   asOf      treat this as "today" when deciding active vs stopped
 * @returns {Array} detected series, richest first
 */
export const detectRecurring = (expenses, asOf = new Date()) => {
    if (!expenses || typeof expenses !== 'object') return [];

    const groups = new Map();
    Object.values(expenses).forEach((months) => {
        if (!months || typeof months !== 'object') return;
        Object.values(months).forEach((data) => {
            (data?.transactions || []).forEach((t) => {
                if (!t || t.isCredited || t.transactionType === 'credit') return;
                const title = String(t.title || '').trim();
                const date = String(t.date || '').slice(0, 10);
                const amount = Number(t.amount) || 0;
                if (!title || date.length !== 10 || amount <= 0) return;

                const key = normaliseMerchant(title);
                if (key.length < 4 || TOO_GENERIC.has(key)) return;

                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push({
                    date, amount,
                    category: String(t.category || '').toLowerCase(),
                    displayTitle: title,
                    card: t.paymentMode === 'credit_card'
                        ? String(t.creditCardName || '').trim() || null
                        : null,
                });
            });
        });
    });

    const todayOrd = toOrdinal(asOf.toISOString().slice(0, 10));
    const series = [];

    groups.forEach((rows, key) => {
        // One charge per date: a merchant billed twice on one day is one event.
        const byDate = new Map();
        rows.forEach((r) => {
            if (!byDate.has(r.date)) byDate.set(r.date, r);
        });
        const events = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
        if (events.length < 3) return;

        const ordinals = events.map((e) => toOrdinal(e.date));

        // Find the start index of the latest active segment (split on pauses > 180 days)
        let latestSegmentStart = 0;
        for (let i = 1; i < ordinals.length; i += 1) {
            if (ordinals[i] - ordinals[i - 1] > 180) {
                latestSegmentStart = i;
            }
        }

        const evalEvents = (events.length - latestSegmentStart >= 3)
            ? events.slice(latestSegmentStart)
            : events;
        const evalOrdinals = evalEvents.map((e) => toOrdinal(e.date));

        const gaps = [];
        for (let i = 1; i < evalOrdinals.length; i += 1) {
            const gap = evalOrdinals[i] - evalOrdinals[i - 1];
            if (gap > 0) gaps.push(gap);
        }
        if (gaps.length < 2) return;

        const medianGap = median(gaps);
        const cadence = CADENCES.find((c) => Math.abs(medianGap - c.days) <= c.tolerance);
        if (!cadence) return;

        const evalAmounts = evalEvents.map((e) => e.amount);
        const typical = median(evalAmounts);
        if (typical <= 0) return;

        const nearTypical = evalAmounts.filter((a) => Math.abs(a - typical) <= Math.max(100, 0.25 * typical));
        if (nearTypical.length / evalAmounts.length < 0.5) return;

        const lastOrd = evalOrdinals[evalOrdinals.length - 1];
        const active = todayOrd - lastOrd < Math.max(medianGap * 2.5, 60);

        const allAmounts = events.map((e) => e.amount);
        const firstAmount = events[0].amount;
        const lastAmount = events[events.length - 1].amount;
        const priceChangePct = firstAmount > 0
            ? ((lastAmount - firstAmount) / firstAmount) * 100
            : 0;

        series.push({
            key,
            label: events[events.length - 1].displayTitle,
            kind: classify(key, events.map((e) => e.category)),
            cadence: cadence.name,
            perYear: cadence.perYear,
            medianGap,
            count: events.length,
            typical,
            min: Math.min(...allAmounts),
            max: Math.max(...allAmounts),
            first: events[0].date,
            last: events[events.length - 1].date,
            nextExpected: fromOrdinal(lastOrd + Math.round(medianGap)),
            active,
            total: allAmounts.reduce((s, a) => s + a, 0),
            annualRunRate: typical * cadence.perYear,
            firstAmount,
            lastAmount,
            priceChangePct,
            events,
        });
    });

    return series.sort((a, b) => (Number(b.active) - Number(a.active)) || (b.annualRunRate - a.annualRunRate));
};

/**
 * Layer the user's own status on top of what detection worked out.
 *
 * The override never rewrites history. If you mark something cancelled and a
 * charge lands afterwards, that is the single most valuable thing this page can
 * tell you — you are still being billed for something you cancelled — so it is
 * surfaced as `chargedAfterCancel` rather than being hidden by the override.
 */
export const applyOverrides = (series, overrides = {}) => series.map((s) => {
    const o = overrides[s.key];
    if (!o || !o.status) return { ...s, overridden: false, status: s.active ? 'active' : 'stopped' };

    const chargedAfterCancel = o.status === 'cancelled'
        && Boolean(o.markedOn)
        && s.last > o.markedOn;

    let status = o.status;
    if (o.status === 'cancelled') status = 'stopped';
    if (o.status === 'watching') status = 'active';

    return {
        ...s,
        overridden: true,
        overrideStatus: o.status,
        markedOn: o.markedOn || null,
        note: o.note || '',
        chargedAfterCancel,
        status: o.status === 'ignored' ? 'ignored' : status,
        active: status === 'active',
    };
});
