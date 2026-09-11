/**
 * The things worth interrupting someone about.
 *
 * Every rule here derives its dates from data that already exists and reuses
 * the formula that already owns it — `warrantyRows` for cover, `kindFor` for
 * what counts as spending. Nothing is recomputed a second way, because two
 * answers to "is this due" is how a reminder ends up disagreeing with the page
 * it came from.
 *
 * Deliberately read-only: this module decides what to say, never writes. What
 * has already been said is remembered outside db.json — that file holds
 * financial records, and notification bookkeeping has no business travelling
 * through dbGuard and the SQLite mirror.
 */

import { warrantyRows } from './warranty';
import { kindFor, isDebit } from './transactionKind';

/** Insurance cover lapsing within this many days is worth saying now. */
export const POLICY_SOON_DAYS = 30;

/**
 * A money-leaves-the-account date is announced the day before and again on the
 * day — the first so the account can be funded, the second because that is when
 * it happens. A renewal is different and keeps its 30 days: renewing takes time,
 * topping up a balance does not.
 */
export const DEBIT_NOTICE_DAYS = [1, 0];

/**
 * How long a missed debit keeps being worth mentioning. Each occurrence is
 * announced once regardless, so this only bounds how far back the rules look.
 */
export const OVERDUE_GRACE_DAYS = 30;

/**
 * When there is no recorded debit date and the next one has to be inferred,
 * this is how far ahead the guess is worth acting on. Deliberately wider than
 * the recorded case: an inferred date is approximate, so a single day's notice
 * would land on the wrong day as often as the right one.
 */
export const INFERRED_SOON_DAYS = 14;

/**
 * How far ahead of the month spending has to run before it is worth flagging,
 * in percentage points, and how far into the month before the question is even
 * fair. Backtested over Jan–Sep 2026: at 20pp it fired once, in June, on day 14
 * — and June did end at 107% of its own baseline. The other five months stayed
 * silent. Lower it and an ordinary rent day sets it off in the first week.
 */
export const PACE_THRESHOLD_PP = 20;
export const PACE_MIN_ELAPSED_PCT = 20;
/** Months of history averaged into the baseline, and the least that will do. */
export const PACE_BASELINE_MONTHS = 6;
export const PACE_MIN_HISTORY = 3;

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toDate = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};
const daysUntil = (value, today) => {
    const d = toDate(value);
    if (!d) return null;
    return Math.round((startOfDay(d) - startOfDay(today)) / 86400000);
};
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const isoOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toLocaleDateString('en-CA');

/**
 * The next time a given day-of-month comes round, on or after today.
 * A 31st falls on the 30th in a short month rather than slipping into the next
 * one, matching how a bank actually takes a payment.
 */
const nextOnDayOfMonth = (dayOfMonth, today) => {
    const day = Number(dayOfMonth);
    if (!day || day < 1 || day > 31) return null;

    for (let ahead = 0; ahead <= 1; ahead += 1) {
        const y = today.getFullYear();
        const m = today.getMonth() + ahead;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const when = new Date(y, m, Math.min(day, lastDay));
        if (startOfDay(when) >= startOfDay(today)) return when;
    }
    return null;
};

/**
 * Whether a due date is one this run should announce, and under which label.
 * Returns null when nothing should be said at all.
 *
 * A recorded date is never reported as overdue. It says when the bank takes the
 * money, not whether it succeeded — so once the day has passed there is no
 * evidence either way, and "overdue" would be a guess dressed as a fact. Only
 * the inferred path can claim that, because there the missing installment is
 * itself the evidence.
 */
const debitNotice = (days, { recorded }) => {
    if (days === null) return null;
    if (recorded) return DEBIT_NOTICE_DAYS.includes(days) ? 'due' : null;
    if (days < 0) return days >= -OVERDUE_GRACE_DAYS ? 'overdue' : null;
    return days <= INFERRED_SOON_DAYS ? 'due' : null;
};

/** "in 19 days" / "today" / "12 days ago" — the same phrasing everywhere. */
const when = (days) => {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days > 1) return `in ${days} days`;
    if (days === -1) return 'yesterday';
    return `${Math.abs(days)} days ago`;
};

/**
 * Insurance about to lapse.
 * `premiums[]` is a payment history, not a schedule, so the forward-looking
 * date is the policy's own expiry rather than anything in that array.
 */
export const policyAlerts = (savings = [], today = new Date()) => {
    const out = [];
    savings.filter((s) => s?.type === 'Policy' && !s.isArchived).forEach((policy) => {
        const expiry = policy.policyDetails?.expiryDate;
        const days = daysUntil(expiry, today);
        if (days === null) return;

        // A policy that ran out years ago is history, not news. Only recent
        // lapses are still actionable.
        if (days < -60 || days > POLICY_SOON_DAYS) return;

        const name = policy.title || policy.policyDetails?.planName || 'A policy';
        out.push({
            id: `policy:${policy.id}:${expiry}`,
            kind: 'policy',
            severity: days < 0 ? 'overdue' : 'due',
            title: days < 0 ? 'Insurance has lapsed' : 'Insurance expiring',
            body: `${name} ${days < 0 ? 'expired' : 'expires'} ${when(days)} (${expiry}).`,
            days,
            route: '/savings',
        });
    });
    return out;
};

/**
 * The next LIC-style premium.
 *
 * Nothing records a premium schedule, so it is derived: premiums fall on the
 * anniversary of `startDate`, and the number already settled says which one is
 * next. Only rows marked `Paid` count — Plan 920 carries a "Received Back" row
 * that is a survival payout, and counting it would skip a year's premium.
 */
export const premiumAlerts = (savings = [], today = new Date()) => {
    const out = [];
    savings.filter((s) => s?.type === 'Policy' && !s.isArchived).forEach((policy) => {
        const details = policy.policyDetails || {};
        const term = Number(details.premiumPayingTerm);
        if (!term) return;

        const paid = (policy.premiums || []).filter(
            (p) => String(p?.status || '').toLowerCase() === 'paid'
        ).length;
        if (paid >= term) return; // fully paid up

        // A recorded debit date beats the anniversary: it survives a premium
        // being paid early or late, which shifts the inferred date every time.
        const recordedDate = toDate(details.premiumDeductionDate);
        const start = toDate(details.startDate);
        let due = null;

        if (recordedDate) {
            // Repeats yearly. Roll forward to the next one still to come.
            due = new Date(recordedDate);
            while (startOfDay(due) < startOfDay(today)) {
                due.setFullYear(due.getFullYear() + 1);
            }
        } else if (start) {
            due = new Date(start);
            due.setFullYear(start.getFullYear() + paid);
        }
        if (!due) return;

        const days = daysUntil(due, today);
        const notice = debitNotice(days, { recorded: Boolean(recordedDate) });
        if (!notice) return;

        const name = policy.title || details.planName || 'A policy';
        const amount = Number(details.premiumAmount) || 0;
        out.push({
            id: `premium:${policy.id}:${isoOf(due)}:${notice === 'overdue' ? 'late' : days}`,
            kind: 'premium',
            severity: notice,
            title: notice === 'overdue' ? 'Premium overdue' : 'Premium due',
            body: `${name}${amount ? ` — ${money(amount)}` : ''} ${notice === 'overdue' ? 'was due' : 'due'} ${when(days)}. Premium ${paid + 1} of ${term}.`,
            days,
            route: '/savings',
        });
    });
    return out;
};

/**
 * The next recurring-deposit installment.
 * Cadence comes from the installments already recorded — the deposit runs
 * monthly on the day it started, and the latest entry says which month is
 * covered. Nothing is due once the deposit reaches its end date.
 */
export const recurringDepositAlerts = (savings = [], today = new Date()) => {
    const out = [];
    savings.filter((s) => s?.type === 'recurring_deposit').forEach((account) => {
        (account.recurringDeposits || []).forEach((rd) => {
            if (String(rd?.status || '').toLowerCase() !== 'active') return;

            const start = toDate(rd.startDate);
            if (!start) return;
            const end = toDate(rd.endDate);

            // A recorded debit day beats inference. Guessing "a month after the
            // last one recorded" is only ever as accurate as the last entry, and
            // drifts by a day every time an installment is logged late.
            let due = null;
            const recordedDay = rd.deductionDay;
            if (recordedDay) {
                due = nextOnDayOfMonth(recordedDay, today);
            } else {
                const paidDates = (rd.installments || [])
                    .map((i) => toDate(i?.date))
                    .filter(Boolean)
                    .sort((a, b) => a - b);
                const last = paidDates[paidDates.length - 1] || null;
                due = last ? new Date(last) : new Date(start);
                if (last) due.setMonth(due.getMonth() + 1);
            }
            if (!due) return;

            if (end && startOfDay(due) > startOfDay(end)) return; // matured
            const days = daysUntil(due, today);
            const notice = debitNotice(days, { recorded: Boolean(recordedDay) });
            if (!notice) return;

            const amount = Number(rd.installmentAmount) || 0;
            out.push({
                id: `rd:${rd.id}:${isoOf(due)}:${notice === 'overdue' ? 'late' : days}`,
                kind: 'recurring-deposit',
                severity: notice,
                title: notice === 'overdue' ? 'RD installment overdue' : 'RD installment due',
                body: `${rd.name || 'Recurring deposit'}${amount ? ` — ${money(amount)}` : ''} ${notice === 'overdue' ? 'was due' : 'due'} ${when(days)}.`,
                days,
                route: `/savings/recurring-deposit/${account.id}`,
            });
        });
    });
    return out;
};

/** Cover about to lapse on something owned. Unknown is not expired: an item */
/* nobody recorded a warranty for is a gap, and nagging about it is not useful. */
export const warrantyAlerts = (assets = [], today = new Date()) => (
    warrantyRows(assets, today)
        .filter((row) => row.status.state === 'expiring')
        .map((row) => ({
            id: `warranty:${row.item.id}:${row.status.expiryIso}`,
            kind: 'warranty',
            severity: 'due',
            title: 'Warranty expiring',
            body: `${row.item.name} is out of cover ${when(row.status.daysLeft)} (${row.status.expiryIso}). Anything worth claiming has to be done before then.`,
            days: row.status.daysLeft,
            route: '/warranties',
        }))
);

/** Real spending this month, on the app's own definition of spending. */
const spendOnOrBefore = (transactions, categoryKinds, day) => (transactions || [])
    .filter((t) => isDebit(t) && kindFor(t, categoryKinds) === 'spend')
    .filter((t) => {
        const d = Number(String(t.date || '').slice(8, 10));
        return day === null || (d && d <= day);
    })
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

/**
 * Spending running ahead of the month.
 *
 * Measured against what recent months actually cost rather than against
 * income, because income here swings by more than spending does — a low-salary
 * month would otherwise read as overspending on its own.
 */
export const spendingPaceAlert = (expenses = {}, categoryKinds = {}, today = new Date()) => {
    const year = String(today.getFullYear());
    const monthName = MONTHS[today.getMonth()];
    const thisMonth = expenses?.[year]?.[monthName];
    if (!thisMonth) return null;

    // Baseline: the months before this one, most recent first.
    const priorTotals = [];
    for (let i = 1; i <= 12 && priorTotals.length < PACE_BASELINE_MONTHS; i += 1) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const node = expenses?.[String(d.getFullYear())]?.[MONTHS[d.getMonth()]];
        if (node) priorTotals.push(spendOnOrBefore(node.transactions, categoryKinds, null));
    }
    if (priorTotals.length < PACE_MIN_HISTORY) return null;

    const baseline = priorTotals.reduce((s, v) => s + v, 0) / priorTotals.length;
    if (baseline <= 0) return null;

    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const elapsedPct = (today.getDate() / daysInMonth) * 100;
    if (elapsedPct < PACE_MIN_ELAPSED_PCT) return null;

    const spent = spendOnOrBefore(thisMonth.transactions, categoryKinds, today.getDate());
    const spentPct = (spent / baseline) * 100;
    if (spentPct - elapsedPct < PACE_THRESHOLD_PP) return null;

    return {
        // Keyed by month, so it can only be raised once per month.
        id: `pace:${year}-${String(today.getMonth() + 1).padStart(2, '0')}`,
        kind: 'spending-pace',
        severity: 'warning',
        title: 'Spending is ahead of the month',
        body: `${money(spent)} spent — ${Math.round(spentPct)}% of a usual month, ${Math.round(elapsedPct)}% of the way through it. Typical is about ${money(baseline)}.`,
        days: 0,
        route: '/expenses',
    };
};

/**
 * Everything worth saying right now, most urgent first.
 * Overdue things lead, then whatever is closest to falling due.
 */
export const collectAlerts = ({
    savings = [], assets = [], expenses = {}, categoryKinds = {},
} = {}, today = new Date()) => {
    const alerts = [
        ...policyAlerts(savings, today),
        ...premiumAlerts(savings, today),
        ...recurringDepositAlerts(savings, today),
        ...warrantyAlerts(assets, today),
    ];

    const pace = spendingPaceAlert(expenses, categoryKinds, today);
    if (pace) alerts.push(pace);

    return alerts.sort((a, b) => {
        const overdue = (x) => (x.severity === 'overdue' ? 0 : 1);
        if (overdue(a) !== overdue(b)) return overdue(a) - overdue(b);
        return (a.days ?? 0) - (b.days ?? 0);
    });
};
