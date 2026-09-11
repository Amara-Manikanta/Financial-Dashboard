/**
 * Money you'd rather not have spent.
 *
 * A flag set by hand, never inferred. Nothing here guesses that a restaurant
 * bill was a waste and a train ticket was not — only the person who spent it
 * knows, and a heuristic that got it wrong would quietly poison the total.
 *
 * Deliberately separate from `transactionKind`. That answers "is this really
 * spending, or a transfer dressed up as one"; this answers "was it worth it".
 * A wasted payment is still spending, so folding the two together would make
 * every flagged row vanish from the spending figures it belongs in.
 */

import { isDebit } from './transactionKind';

/** Was this flagged as a regret? */
export const isWasteful = (tx) => tx?.wasteful === true;

/** The note explaining why, if one was left. */
export const wasteNoteOf = (tx) => String(tx?.wasteNote || '').trim();

/**
 * The patch that flags or unflags a row.
 *
 * Unflagging clears the note too: a note left behind on an unflagged row is
 * invisible everywhere and would reappear, confusingly, if it were ever
 * flagged again. `null` rather than `undefined` so the value actually
 * overwrites what is stored — an undefined is dropped by JSON.stringify and
 * the old flag would survive the write.
 */
export const wastePatch = (flagged, note = '') => (
    flagged
        ? { wasteful: true, wasteNote: note.trim() || null }
        : { wasteful: false, wasteNote: null }
);

/** Every flagged debit in a flat transaction list. */
export const wastefulRows = (transactions = []) => (
    (transactions || []).filter((tx) => isWasteful(tx) && isDebit(tx))
);

/**
 * What the flagged rows add up to, and where they cluster.
 *
 * Credits are excluded even when flagged: a refund marked as a regret is not
 * money going out, and counting it would net against the very total it was
 * flagged to highlight.
 */
export const wasteSummary = (transactions = []) => {
    const rows = wastefulRows(transactions);

    const byCategory = {};
    const byMonth = {};
    let total = 0;

    rows.forEach((tx) => {
        const amount = Math.abs(Number(tx.amount) || 0);
        total += amount;

        const category = String(tx.category || 'uncategorised').toLowerCase();
        byCategory[category] = (byCategory[category] || 0) + amount;

        const month = String(tx.date || '').slice(0, 7); // YYYY-MM
        if (month.length === 7) byMonth[month] = (byMonth[month] || 0) + amount;
    });

    return {
        total: Math.round(total * 100) / 100,
        count: rows.length,
        rows,
        byCategory: Object.entries(byCategory)
            .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
            .sort((a, b) => b.amount - a.amount),
        byMonth: Object.entries(byMonth)
            .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))
            .sort((a, b) => a.month.localeCompare(b.month)),
    };
};
