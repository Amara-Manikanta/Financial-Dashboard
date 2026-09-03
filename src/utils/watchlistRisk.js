/**
 * How risky *you* think a watchlist entry is.
 *
 * This is stored, never derived. The app could compute something that looks
 * like a risk score — volatility, beta, distance from a 52-week high — and it
 * would be wrong in the way that matters: a number the app produced reads as
 * the app's opinion about whether to buy, and it has none. Risk here means
 * whatever you meant when you set it, which is the only definition that is
 * useful for sorting your own list.
 *
 * Absent is not "low". An entry nobody has rated is unrated, and the two are
 * kept apart so an unfiltered list cannot be mistaken for a list of safe bets.
 */

export const RISK_LEVELS = ['low', 'medium', 'high'];

export const RISK_META = {
    low: {
        label: 'Low',
        color: '#34d399',
        bg: 'rgba(52, 211, 153, 0.12)',
        border: 'rgba(52, 211, 153, 0.3)',
        blurb: 'You consider this a steady holding.',
    },
    medium: {
        label: 'Medium',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.12)',
        border: 'rgba(251, 191, 36, 0.3)',
        blurb: 'Somewhere in between.',
    },
    high: {
        label: 'High',
        color: '#f87171',
        bg: 'rgba(248, 113, 113, 0.12)',
        border: 'rgba(248, 113, 113, 0.3)',
        blurb: 'You expect this one to move a lot, either way.',
    },
    unrated: {
        label: 'Unrated',
        color: '#71717a',
        bg: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
        blurb: 'No risk level set yet — not the same as low.',
    },
};

/** The stored level, or `unrated`. Never guesses. */
export const riskOf = (item) => {
    const r = String(item?.risk || '').trim().toLowerCase();
    return RISK_LEVELS.includes(r) ? r : 'unrated';
};

export const riskMeta = (item) => RISK_META[riskOf(item)];

/** Highest risk first, then unrated last — the order you review a list in. */
const ORDER = { high: 0, medium: 1, low: 2, unrated: 3 };
export const byRiskDescending = (a, b) => ORDER[riskOf(a)] - ORDER[riskOf(b)];

/** How many entries sit at each level, including the unrated. */
export const riskCounts = (items = []) => {
    const counts = { low: 0, medium: 0, high: 0, unrated: 0 };
    (items || []).forEach((i) => { counts[riskOf(i)] += 1; });
    return counts;
};

/* ------------------------------------------------------------------ *
 * Priority — how much you want it, as opposed to how risky it is
 * ------------------------------------------------------------------ */

/**
 * Risk and priority are different axes and are stored separately.
 *
 * A high-risk company can be a high priority, and a safe one can be something
 * you are only mildly curious about. Folding them into one rating loses that,
 * and it is the combination that makes a watchlist worth reviewing: the
 * high-priority, high-risk names are the ones worth thinking hardest about.
 *
 * Like risk, this is stored as you set it. The app has no view on what you
 * should want.
 */
export const PRIORITY_LEVELS = ['watching', 'interested', 'ready'];

export const PRIORITY_META = {
    ready: {
        label: 'Ready',
        color: '#818cf8',
        bg: 'rgba(129, 140, 248, 0.14)',
        border: 'rgba(129, 140, 248, 0.35)',
        blurb: 'Decided in principle — waiting on price or cash.',
    },
    interested: {
        label: 'Interested',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.3)',
        blurb: 'Worth more work before doing anything.',
    },
    watching: {
        label: 'Watching',
        color: '#a1a1aa',
        bg: 'rgba(161, 161, 170, 0.1)',
        border: 'rgba(161, 161, 170, 0.25)',
        blurb: 'Following out of curiosity, no intent.',
    },
    unset: {
        label: 'No priority',
        color: '#71717a',
        bg: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
        blurb: 'Not ranked yet.',
    },
};

export const priorityOf = (item) => {
    const p = String(item?.priority || '').trim().toLowerCase();
    return PRIORITY_LEVELS.includes(p) ? p : 'unset';
};

export const priorityMeta = (item) => PRIORITY_META[priorityOf(item)];

/** Most urgent first, unranked last. */
const PRIORITY_ORDER = { ready: 0, interested: 1, watching: 2, unset: 3 };
export const byPriority = (a, b) => PRIORITY_ORDER[priorityOf(a)] - PRIORITY_ORDER[priorityOf(b)];

export const priorityCounts = (items = []) => {
    const counts = { ready: 0, interested: 0, watching: 0, unset: 0 };
    (items || []).forEach((i) => { counts[priorityOf(i)] += 1; });
    return counts;
};
