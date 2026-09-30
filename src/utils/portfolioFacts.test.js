import test from 'node:test';
import assert from 'node:assert/strict';
import { fundFacts } from './portfolioFacts.js';

const valueOf = (f) => f.v;
const investedOf = (f) => f.c;

test('fund lines are sorted, weighted and skip archived or empty funds', () => {
    const out = fundFacts([
        { title: 'Small', v: 25000, c: 20000 },
        { title: 'Big', v: 75000, c: 80000 },
        { title: 'Gone', v: 5000, c: 5000, isArchived: true },
        { title: 'Empty', v: 0, c: 0 },
    ], { valueOf, investedOf, stockValue: 100000 });
    assert.deepEqual(out.lines, [
        'Big: ₹75,000 now, invested ₹80,000, -6.3% vs cost, 75.0% of funds',
        'Small: ₹25,000 now, invested ₹20,000, +25.0% vs cost, 25.0% of funds',
    ]);
    assert.match(out.summary, /₹1,00,000 across 2 funds, \+0\.0% vs cost/);
    assert.match(out.summary, /₹2,00,000, of which funds are 50\.0%/);
});

test('no funds says so', () => {
    assert.equal(fundFacts([], { valueOf, investedOf }).summary, 'No mutual fund holdings.');
});

test('dashboard facts leave out the demo loans and sum net worth', async () => {
    const { dashboardFacts } = await import('./portfolioFacts.js');
    const text = dashboardFacts({
        savings: [{ type: 'ppf', v: 100000, c: 0 }, { type: 'mutual_fund', v: 50000, c: 40000 }],
        valueOf, investedOf, metalsValue: 50000,
        loans: [
            { name: 'SBI Home Loan', accountNumber: 'HL-98765432' },
            { name: 'Bike', interestRate: 10, emiAmount: 3000 },
        ],
        loanOutstanding: () => 20000,
        cards: { outstanding: 10000, cards: 2, utilisation: 5, interestPaid: 0 },
    });
    assert.match(text, /Net worth: ₹1,70,000 \(assets ₹2,00,000, debts ₹30,000\)/);
    assert.match(text, /- Mutual funds: ₹50,000, 25\.0% of assets, \+25\.0% vs cost/);
    assert.match(text, /- Bike: ₹20,000 outstanding at 10% a year, EMI ₹3,000/);
    assert.doesNotMatch(text, /SBI Home Loan/);
});
