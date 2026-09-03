/**
 * What six credit cards are actually doing.
 *
 * The cards pages answer "what do I owe on this card". They do not answer the
 * questions that decide whether a card is working for you:
 *
 *   utilisation      how much of the limit is in use, now and at its worst
 *   revolving        which months were not paid in full, because those are the
 *                    only months a credit card costs anything
 *   interest         what carrying a balance has actually cost, in rupees
 *   concentration    which card carries which kind of spending
 *   dormancy         cards nobody has used in months
 *
 * ₹10.1 lakh a year moves through these cards. None of the above was visible
 * anywhere in the app.
 *
 * ## The one thing this cannot tell you
 *
 * Nothing here knows a card's due date, interest rate, annual fee, or reward
 * rate — none of those are recorded. So this file computes what the ledger
 * supports and says plainly where it stops, rather than assuming a standard
 * 18-day grace period or a 3.5% monthly rate and presenting the result as
 * fact. A wrong due date is worse than no due date.
 */

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/**
 * Names in the ledger do not always match names on the card record.
 *
 * Kept identical to the matching in CreditCardDetails so the two pages cannot
 * disagree about which transactions belong to which card — they already would
 * have, since the ledger spells two of these cards differently.
 */
const ALIASES = { 'coral rupay': ['icici rupay'], hpcl: ['icici hp card'] };

const PAYMENT_CATEGORIES = ['credit card bill', 'credit card payment'];

/**
 * A charge for carrying a balance, however the ledger spells it.
 *
 * The real data uses five different names — `credit card interest`,
 * `emi interest`, `emi interest charge`, `final emi interest` and
 * `gst on emi interest` — so an exact list would have missed ₹2,195 of it. A
 * substring match is safe here because this only ever runs over credit-card
 * transactions: `interest income`, the one row that must not match, is a direct
 * bank credit and never reaches this function.
 */
const isInterestCategory = (cat) => {
    const c = String(cat).toLowerCase();
    if (c.includes('income')) return false;
    return c.includes('interest') || c.includes('finance charge') || c.includes('late payment');
};

export const matchesCard = (txCardName, card) => {
    if (!txCardName || !card?.name) return false;
    const t = String(txCardName).trim().toLowerCase();
    const c = String(card.name).trim().toLowerCase();
    return t === c || c.includes(t) || t.includes(c) || (ALIASES[c] || []).includes(t);
};

/** A `Month/Year` baseline as a Date, or null. Anything before it is ignored. */
const baselineOf = (card) => {
    if (!card?.carryForwardBaseline) return null;
    const [month, year] = String(card.carryForwardBaseline).split('/');
    const d = new Date(`${month} 1, ${year}`);
    return Number.isNaN(d.getTime()) ? null : d;
};

const parseLocalDate = (s) => {
    const parts = String(s || '').split('-').map(Number);
    return parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(s);
};

/** Every credit-card transaction, flattened out of the nested expenses tree. */
export const cardTransactions = (expenses = {}) => {
    const out = [];
    Object.values(expenses || {}).forEach((year) => {
        if (!year || typeof year !== 'object') return;
        Object.values(year).forEach((month) => {
            (month?.transactions || []).forEach((tx) => {
                if (tx?.paymentMode === 'credit_card' && tx.creditCardName) out.push(tx);
            });
        });
    });
    return out;
};

const classify = (tx) => {
    const cat = String(tx.category || '').toLowerCase();
    if (PAYMENT_CATEGORIES.includes(cat)) return 'payment';
    if (isInterestCategory(cat)) return 'interest';
    if (tx.isRewardPoints) return 'reward';
    if (tx.isCredited || tx.transactionType === 'credit') return 'refund';
    return 'spend';
};

/**
 * A card's statement cycle.
 *
 * `billingDay` is the day the statement is generated. The due date is typically
 * some days after that, but "typically" is not recorded anywhere, so this
 * returns the statement dates and leaves the due date alone.
 */
export const cycleFor = (card, now = new Date()) => {
    const day = num(card?.billingDay);
    if (!day) return null;

    const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
    const on = (y, m) => new Date(y, m, Math.min(day, daysIn(y, m)));

    let last = on(now.getFullYear(), now.getMonth());
    if (last > now) last = on(now.getFullYear(), now.getMonth() - 1);
    const next = on(last.getFullYear(), last.getMonth() + 1);

    return {
        billingDay: day,
        lastStatement: last.toISOString().slice(0, 10),
        nextStatement: next.toISOString().slice(0, 10),
        daysToNextStatement: Math.max(0, Math.ceil((next - now) / 86400000)),
        /** Spending since the last statement lands on the NEXT bill, not this one. */
        cycleStart: last.toISOString().slice(0, 10),
    };
};

/**
 * Month-by-month history for one card: what was charged, what was paid, and
 * therefore whether a balance was carried.
 *
 * "Revolving" here means the month's payments came to less than its charges.
 * That is a rough test — a bill is paid in the month after it is generated, so
 * a single month can look short while the pair is square — which is exactly why
 * the rolling balance is tracked alongside it rather than relying on the
 * per-month comparison alone.
 */
export const cardHistory = (card, transactions) => {
    const baseline = baselineOf(card);
    const baselineKey = baseline
        ? `${baseline.getFullYear()}-${String(baseline.getMonth() + 1).padStart(2, '0')}`
        : null;
    const months = {};

    // Every month is kept, including those before the baseline.
    //
    // The baseline exists so the *balance* can start from a figure the user
    // reconciled by hand — it is not a statement that nothing happened before
    // it. Filtering the transactions by it truncated the lifetime totals too,
    // and reported ₹30,518 of lifetime spend on a card that has ₹287,020 of
    // personal shopping alone. It also hid every interest charge on the Amazon
    // card, because all sixteen of them predate its August 2026 baseline.
    transactions.forEach((tx) => {
        if (!matchesCard(tx.creditCardName, card)) return;
        const key = String(tx.date || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(key)) return;

        months[key] = months[key] || { month: key, spend: 0, payment: 0, interest: 0, refund: 0, reward: 0, count: 0 };
        const amount = Math.abs(num(tx.amount));
        const kind = classify(tx);
        months[key][kind] += amount;
        if (kind === 'spend') months[key].count += 1;
    });

    let balance = null;
    return Object.values(months)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
            // The running balance starts at the baseline month and is undefined
            // before it — there is no reconciled opening figure to start from.
            if (baselineKey && m.month === baselineKey) balance = num(card?.baselineOpeningBalance);
            else if (!baselineKey && balance === null) balance = 0;

            const opening = balance;
            if (balance !== null) {
                // Interest is charged to the card, so it adds to what is owed.
                balance = balance + m.spend + m.interest - m.payment - m.refund;
            }
            return {
                ...m,
                spend: money(m.spend),
                payment: money(m.payment),
                interest: money(m.interest),
                refund: money(m.refund),
                reward: money(m.reward),
                openingBalance: opening === null ? null : money(opening),
                closingBalance: balance === null ? null : money(balance),
                trackedBalance: balance !== null,
                /** Charges the month's payments did not cover. */
                revolved: m.payment + m.refund < m.spend + m.interest,
                shortfall: money(Math.max(0, (m.spend + m.interest) - (m.payment + m.refund))),
            };
        });
};

/** Everything worth knowing about one card. */
export const cardProfile = (card, transactions, now = new Date()) => {
    const history = cardHistory(card, transactions);
    const mine = transactions.filter((t) => matchesCard(t.creditCardName, card));

    const tracked = history.filter((m) => m.trackedBalance);
    const outstanding = tracked.length ? Math.max(0, tracked[tracked.length - 1].closingBalance) : 0;
    const limit = num(card?.creditLimit);

    const lifetimeSpend = money(history.reduce((s, m) => s + m.spend, 0));
    const interestPaid = money(history.reduce((s, m) => s + m.interest, 0));
    const rewards = money(history.reduce((s, m) => s + m.reward, 0));

    // Peak utilisation from the month-end balances. Intra-month peaks are
    // higher, but a daily balance would need every posting date and this
    // ledger records only the transaction date.
    const peakBalance = tracked.reduce((max, m) => Math.max(max, m.closingBalance), 0);

    const dates = mine.map((t) => t.date).filter(Boolean).sort();
    const lastUsed = dates.length ? dates[dates.length - 1] : null;
    const daysIdle = lastUsed
        ? Math.floor((now - parseLocalDate(lastUsed)) / 86400000)
        : null;

    // Where this card gets used, by category.
    const byCategory = {};
    mine.forEach((t) => {
        if (classify(t) !== 'spend') return;
        const c = String(t.category || 'uncategorised').toLowerCase();
        byCategory[c] = money((byCategory[c] || 0) + Math.abs(num(t.amount)));
    });

    const revolvingMonths = history.filter((m) => m.revolved && m.shortfall > 1);
    const recent = history.slice(-6);

    return {
        id: card?.id,
        name: card?.name,
        bank: card?.bankName,
        last4: card?.last4Digits,
        isWallet: card?.type === 'wallet' || limit === 0,
        limit,
        outstanding: money(outstanding),
        available: limit > 0 ? money(Math.max(0, limit - outstanding)) : null,
        utilisation: limit > 0 ? (outstanding / limit) * 100 : null,
        peakBalance: money(peakBalance),
        peakUtilisation: limit > 0 ? (peakBalance / limit) * 100 : null,
        lifetimeSpend,
        interestPaid,
        rewards,
        transactionCount: mine.length,
        lastUsed,
        daysIdle,
        cycle: cycleFor(card, now),
        history,
        recentMonths: recent,
        averageMonthlySpend: recent.length
            ? money(recent.reduce((s, m) => s + m.spend, 0) / recent.length)
            : 0,
        revolvingMonths: revolvingMonths.length,
        worstShortfall: revolvingMonths.reduce((max, m) => Math.max(max, m.shortfall), 0),
        /**
         * Months the bank actually charged interest.
         *
         * Preferred over `revolvingMonths` wherever one number has to be shown.
         * A bill generated in one month is paid in the next, so comparing a
         * month's charges against its own payments marks almost every month as
         * revolving — 92 of them here — and says nothing. An interest charge is
         * not an inference: it is a row in the ledger, and it only appears when
         * a balance was genuinely carried.
         */
        interestMonths: history.filter((m) => m.interest > 0)
            .map((m) => ({ month: m.month, amount: m.interest })),
        topCategories: Object.entries(byCategory)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 8),
    };
};

export const allCardProfiles = (creditCards = [], expenses = {}, now = new Date()) => {
    const txs = cardTransactions(expenses);
    return (creditCards || [])
        .map((c) => cardProfile(c, txs, now))
        .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
};

/**
 * Portfolio-level view across every card.
 *
 * Utilisation is computed on the combined limit rather than averaged per card.
 * An average would say two cards at 5% and 95% are "at 50%", which describes
 * neither of them and is the number that matters least.
 */
export const cardTotals = (profiles = []) => {
    const real = profiles.filter((p) => !p.isWallet);
    const limit = real.reduce((s, p) => s + p.limit, 0);
    const outstanding = real.reduce((s, p) => s + p.outstanding, 0);
    return {
        cards: real.length,
        wallets: profiles.length - real.length,
        limit: money(limit),
        outstanding: money(outstanding),
        available: money(Math.max(0, limit - outstanding)),
        utilisation: limit > 0 ? (outstanding / limit) * 100 : 0,
        interestPaid: money(profiles.reduce((s, p) => s + p.interestPaid, 0)),
        lifetimeSpend: money(profiles.reduce((s, p) => s + p.lifetimeSpend, 0)),
        revolvingMonths: profiles.reduce((s, p) => s + p.revolvingMonths, 0),
        idle: profiles.filter((p) => p.daysIdle !== null && p.daysIdle > 90 && !p.isWallet),
        highestUtilisation: real
            .filter((p) => p.utilisation !== null)
            .sort((a, b) => b.utilisation - a.utilisation)[0] || null,
    };
};
