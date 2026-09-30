/**
 * Mutual fund holdings as pre-formatted lines for the local model.
 *
 * Same contract as llmFacts in stockAdvisor.js: every figure is computed here
 * and written out, so the model copies numbers rather than working them out.
 * Holdings only — never expenses, salary or balances.
 */
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
const signedPct = (n) => `${n >= 0 ? '+' : ''}${pct(n)}`;

/**
 * @param funds      mutual fund savings items (already filtered to your own)
 * @param valueOf    item → current value (FinanceContext.calculateItemCurrentValue)
 * @param investedOf item → cost of what is still held (calculateItemInvestedValue)
 * @param stockValue current value of the stock portfolio, for the split line
 */
export const fundFacts = (funds, { valueOf, investedOf, stockValue = 0, maxFunds = 30 } = {}) => {
    const rows = (funds || [])
        .filter((f) => f && !f.isArchived)
        .map((f) => ({ name: String(f.title || f.name || 'Unnamed fund'), value: Number(valueOf(f)) || 0, invested: Number(investedOf(f)) || 0 }))
        .filter((f) => f.value > 0)
        .sort((a, b) => b.value - a.value);

    const value = rows.reduce((s, f) => s + f.value, 0);
    const invested = rows.reduce((s, f) => s + f.invested, 0);
    const combined = value + (Number(stockValue) || 0);
    const vsCost = (v, c) => (c > 0 ? ((v - c) / c) * 100 : 0);

    return {
        summary: rows.length
            ? `${inr(value)} across ${rows.length} funds, ${signedPct(vsCost(value, invested))} vs cost (invested ${inr(invested)}). `
              + `Stocks and funds together: ${inr(combined)}, of which funds are ${pct(combined > 0 ? (value / combined) * 100 : 0)}.`
            : 'No mutual fund holdings.',
        lines: rows.slice(0, maxFunds).map((f) =>
            `${f.name}: ${inr(f.value)} now, invested ${inr(f.invested)}, ${signedPct(vsCost(f.value, f.invested))} vs cost, ${pct(value > 0 ? (f.value / value) * 100 : 0)} of funds`),
    };
};

const TYPE_LABELS = {
    stock_market: 'Stocks', mutual_fund: 'Mutual funds', sgb: 'Sovereign gold bonds', ppf: 'PPF', nps: 'NPS',
    fixed_deposit: 'Fixed deposits', savings: 'Savings accounts',
};

/**
 * The loans FinanceContext shows when none are saved. They are demo rows, not
 * the owner's debt, and must never reach an analysis as if they were.
 */
const DEMO_LOAN_ACCOUNTS = new Set(['HL-98765432', 'AUTO-456789']);

/**
 * The whole dashboard in a few lines, for a prompt that asks about everything.
 * Opt-in: unlike the stock facts this includes income, spending and debt.
 *
 * Aggregates are passed in already computed (spendingOverview, cardTotals,
 * loanOutstanding) so this file stays free of the React-side imports and the
 * figures are the ones the dashboard's own pages show.
 */
export const dashboardFacts = ({
    savings = [], valueOf, investedOf, metalsValue = 0, assetsValue = 0,
    loans = [], loanOutstanding, cards = null, spending = null, receivable = 0, taxes = [],
} = {}) => {
    const groups = {};
    savings.filter((s) => s && !s.isArchived).forEach((s) => {
        const label = TYPE_LABELS[s.type] || 'Other savings';
        const g = groups[label] || (groups[label] = { value: 0, invested: 0 });
        g.value += Number(valueOf(s)) || 0;
        g.invested += Number(investedOf(s)) || 0;
    });
    if (metalsValue > 0) groups['Gold and silver'] = { value: Number(metalsValue), invested: 0 };
    if (assetsValue > 0) groups['Other assets'] = { value: Number(assetsValue), invested: 0 };

    const realLoans = loans.filter((l) => l && !DEMO_LOAN_ACCOUNTS.has(l.accountNumber))
        .map((l) => ({ ...l, outstanding: Number(loanOutstanding(l)) || 0 }))
        .filter((l) => l.outstanding > 0);
    const debt = realLoans.reduce((s, l) => s + l.outstanding, 0) + (Number(cards?.outstanding) || 0);
    const assets = Object.values(groups).reduce((s, g) => s + g.value, 0) + (Number(receivable) || 0);

    const lines = [
        `Net worth: ${inr(assets - debt)} (assets ${inr(assets)}, debts ${inr(debt)}).`,
        'What is held, largest first:',
        ...Object.entries(groups).filter(([, g]) => g.value > 0).sort((a, b) => b[1].value - a[1].value)
            .map(([label, g]) => `- ${label}: ${inr(g.value)}, ${pct(assets > 0 ? (g.value / assets) * 100 : 0)} of assets`
                + (g.invested > 0 ? `, ${signedPct(((g.value - g.invested) / g.invested) * 100)} vs cost` : '')),
        ...(receivable > 0 ? [`- Money lent out and still owed back: ${inr(receivable)}`] : []),
        '',
        realLoans.length ? 'Loans:' : 'Loans: none recorded.',
        ...realLoans.map((l) => `- ${l.name || l.type || 'Loan'}: ${inr(l.outstanding)} outstanding at ${Number(l.interestRate) || 0}% a year`
            + (Number(l.emiAmount) > 0 ? `, EMI ${inr(l.emiAmount)} a month` : '')),
        cards?.cards > 0 ? `Credit cards: ${inr(cards.outstanding)} outstanding on ${cards.cards} cards, ${pct(cards.utilisation)} of limits used, ${inr(cards.interestPaid)} interest paid so far.` : null,
        '',
        spending && (spending.normalIncome > 0 || spending.normalSpend > 0) ? [
            `Monthly cash flow (median of the last six complete months): income ${inr(spending.normalIncome)}, spending ${inr(spending.normalSpend)}, surplus ${inr(spending.normalSurplus)}.`,
            spending.medianSavingsRate !== null && spending.medianSavingsRate !== undefined ? `Median savings rate over the last year: ${pct(spending.medianSavingsRate)}.` : null,
            spending.lastVsNormal ? `Last complete month spent ${signedPct(spending.lastVsNormal.pct)} vs normal.` : null,
        ].filter(Boolean).join('\n') : 'Spending: not enough months recorded.',
        '',
        ...[...taxes].filter((t) => t && t.financialYear)
            .sort((a, b) => String(b.financialYear).localeCompare(String(a.financialYear))).slice(0, 3)
            .map((t) => `Income tax FY ${t.financialYear}: paid ${inr(t.taxesPaid)}, payable/refundable ${inr(t.taxPayableRefundable)}.`),
    ].filter((l) => l !== null);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
