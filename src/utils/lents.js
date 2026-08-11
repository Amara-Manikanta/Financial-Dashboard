/**
 * What a peer debt currently stands at.
 *
 * The opening `amount` is adjusted by its history: `additional` entries lend
 * more, `repayment` entries pay some back. The same formula drives the Loans &
 * Lents page and any goal funded by money owed to you, so it lives here rather
 * than being written twice — two copies of one formula have already drifted
 * apart in this codebase more than once.
 */
export const lentOutstanding = (item) => (
    (Number(item?.amount) || 0) + (item?.transactions || []).reduce((acc, tx) => {
        const value = Number(tx.amount) || 0;
        if (tx.type === 'repayment') return acc - value;
        if (tx.type === 'additional') return acc + value;
        return acc;
    }, 0)
);

/**
 * Below a rupee is settled.
 *
 * Adding and subtracting decimal amounts leaves floating-point residue: one
 * fully repaid loan here comes out at 0.000000000002 rather than 0, which a
 * plain `> 0` test happily treats as outstanding. It would then be offered as a
 * funding source displaying "₹0".
 */
const SETTLED_BELOW = 1;

/**
 * Debts owed TO you, with anything already settled dropped.
 *
 * `borrowed` rows are deliberately excluded: money you owe someone else is a
 * liability and cannot fund a goal. A fully repaid loan is excluded too — it is
 * history, not an asset, and listing it would invite counting it twice once the
 * cash has landed in a bank account that some other goal already tracks.
 */
export const receivableLents = (lents = []) => (lents || [])
    .filter((item) => item?.type === 'lent' && lentOutstanding(item) >= SETTLED_BELOW);

/** Total still owed to you. */
export const totalReceivable = (lents = []) => receivableLents(lents)
    .reduce((sum, item) => sum + lentOutstanding(item), 0);
