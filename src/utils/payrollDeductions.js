/**
 * Some debits never actually left the bank account, because the money was taken
 * before the salary arrived.
 *
 * The salary credited each month is already net: gross minus EPF, VPF,
 * professional tax and income tax. Logging one of those deductions as an
 * ordinary expense subtracts it a second time and understates the surplus by
 * exactly that amount.
 *
 * `deductFromSalary: false` marks such a row. It stays visible in the ledger —
 * the payment is real and worth seeing — but it is skipped by the categories
 * aggregate and by every expense total, so it is recorded without being counted.
 *
 * The importer applied this rule on its own (`!sub.includes('tax')`) while the
 * manual form had no control for it at all, so hand-entered tax rows counted
 * and imported ones did not. One rule, imported by both, is what stops that
 * happening again.
 */

/**
 * Categories that are payroll deductions rather than spending.
 *
 * Matched as substrings, because the real data spells the same thing several
 * ways — `tax payment`, `Tax Payment`, `income tax`. `tax charges` deliberately
 * matches too: GST on a card fee is a genuine bank debit, but it is caught by
 * the same substring, so the default is only ever a starting point the user can
 * override on the form.
 */
const DEDUCTION_HINTS = ['tax', 'epf', 'vpf', 'provident fund'];

/**
 * Whether a category looks like something already taken out of the payslip.
 * Used only to pick the toggle's default — never to override a stored value.
 */
export const looksLikePayrollDeduction = (category = '') => {
    const c = String(category).toLowerCase();
    return DEDUCTION_HINTS.some((hint) => c.includes(hint));
};

/**
 * Does this row count towards expense totals?
 *
 * Absent means yes: the flag was added later, and thousands of older rows
 * predate it. Only an explicit `false` excludes a row.
 */
export const countsAsSpending = (tx) => !tx || tx.deductFromSalary !== false;
