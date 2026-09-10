/**
 * Bank lockers, and working out where a metal item actually is.
 *
 * The items already carried a `location` string before this existed, but
 * nothing rendered or edited it, so it had drifted into seven inconsistent
 * values across 73 items — "KKD", "KKD Locker", "Anvitha", "In RDM" — while the
 * other 66 were blank. A registered locker plus free text for everywhere else
 * keeps the values that are already there rather than blanking them, and stops
 * the same holding being written three different ways.
 *
 * Renewal state is derived from the locker's own fields the way warranty.js
 * derives cover from an item's, and for the same reason: a stored "is it due"
 * flag would silently keep whatever answer was true the day it was written.
 */

/** A renewal this close is worth acting on before it lapses. */
export const RENEWAL_SOON_DAYS = 45;

const toDate = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const daysBetween = (from, to) => Math.round((to - from) / 86400000);

/**
 * What to call a locker in a list. Falls back through the fields rather than
 * rendering "undefined — undefined" for a half-filled record.
 */
export const lockerLabel = (locker) => {
    if (!locker) return '';
    const number = String(locker.lockerNumber || '').trim();
    const bank = String(locker.bankName || '').trim();
    const branch = String(locker.branch || '').trim();
    if (bank && number) return `${bank} ${branch ? `(${branch}) ` : ''}· ${number}`;
    return bank || number || branch || 'Unnamed locker';
};

/**
 * Renewal state of a locker.
 *
 * `unknown` is deliberately not `overdue`. A locker whose renewal date nobody
 * recorded is a gap in the records; one that lapsed last month is a fact.
 * Collapsing the two would bury the lockers actually worth chasing behind the
 * ones simply never filled in.
 */
export const renewalStatus = (locker, today = new Date()) => {
    const due = toDate(locker?.renewalDate);
    if (!due) return { state: 'unknown', due: null, daysLeft: null };

    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysLeft = daysBetween(now, due);

    let state = 'ok';
    if (daysLeft < 0) state = 'overdue';
    else if (daysLeft <= RENEWAL_SOON_DAYS) state = 'due';

    return { state, due, daysLeft };
};

/**
 * `ok` deliberately does not say "Renewed". A due date in the future says the
 * next renewal is not close; it says nothing about whether the last one was
 * paid, and claiming otherwise would put a reassuring green label on a locker
 * nobody has actually renewed. The date itself is the honest version.
 */
export const RENEWAL_LABEL = {
    ok: 'Renews',
    due: 'Renewal due',
    overdue: 'Renewal overdue',
    unknown: 'No renewal date',
};

/** The renewal line as shown on a locker card, date and all. */
export const renewalText = (locker, today = new Date()) => {
    const { state, due, daysLeft } = renewalStatus(locker, today);
    if (state === 'unknown') return RENEWAL_LABEL.unknown;

    const when = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (state === 'overdue') return `${RENEWAL_LABEL.overdue} · ${Math.abs(daysLeft)}d ago`;
    if (state === 'due') return `${RENEWAL_LABEL.due} · ${daysLeft}d · ${when}`;
    return `${RENEWAL_LABEL.ok} ${when}`;
};

export const RENEWAL_COLOR = {
    ok: '#34d399',
    due: '#fbbf24',
    overdue: '#f87171',
    unknown: '#71717a',
};

/** Every metal item across every category, tagged with the category it came from. */
export const allMetalItems = (metals = {}) => (
    Object.entries(metals).flatMap(([category, items]) => (
        (Array.isArray(items) ? items : []).map((item) => ({ ...item, category }))
    ))
);

/**
 * Where an item is, as one displayable string.
 * A registered locker wins over the free-text field, so an item moved into a
 * locker does not keep showing whatever place it used to be kept in.
 */
export const itemLocation = (item, lockers = []) => {
    const locker = item?.lockerId
        ? lockers.find((l) => String(l.id) === String(item.lockerId))
        : null;
    if (locker) return { kind: 'locker', label: lockerLabel(locker), locker };

    const free = String(item?.location || '').trim();
    if (free) return { kind: 'other', label: free, locker: null };

    return { kind: 'none', label: 'Not recorded', locker: null };
};

/**
 * What each locker holds: how many items, their combined weight and value.
 * Weight is summed per category because grams of gold and grams of silver are
 * not the same quantity and adding them would produce a number that means
 * nothing.
 */
export const lockerContents = (locker, metals = {}) => {
    const items = allMetalItems(metals).filter(
        (item) => item.lockerId && String(item.lockerId) === String(locker?.id)
    );

    const weightByCategory = {};
    let value = 0;
    items.forEach((item) => {
        const grams = Number(item.weightGm) || 0;
        weightByCategory[item.category] = (weightByCategory[item.category] || 0) + grams;
        value += Number(item.currentValue) || 0;
    });

    return { items, count: items.length, value, weightByCategory };
};

/** Items with nothing recorded about where they are — the worklist worth filling in. */
export const unplacedItems = (metals = {}) => (
    allMetalItems(metals).filter(
        (item) => !item.lockerId && !String(item.location || '').trim()
    )
);
