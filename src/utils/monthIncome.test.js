import test from 'node:test';
import assert from 'node:assert/strict';
import { monthIncome, isIncomeTx } from './monthIncome.js';

test('a refund filed under Income counts, so the list and the month page agree', () => {
    const month = { categories: {}, transactions: [
        { category: 'salary', amount: 93656.67, mainCategory: 'Income', isCredited: true },
        { category: 'itr retruns', amount: 41520, mainCategory: 'Income', isCredited: true },
        { category: 'groceries', amount: 1399 },
    ] };
    const r = monthIncome(month, 0);
    assert.equal(Math.round(r.total * 100) / 100, 135176.67);
    assert.deepEqual(Object.keys(r.incomeTotals).sort(), ['itr retruns', 'salary']);
});

test('a payslip stands in only when no row is a salary', () => {
    const bonusOnly = { transactions: [{ category: 'bonus', amount: 5000 }] };
    assert.equal(monthIncome(bonusOnly, 80000).total, 85000);
    const withSalary = { transactions: [{ category: 'salary', amount: 90000 }] };
    assert.equal(monthIncome(withSalary, 80000).total, 90000);
    assert.equal(monthIncome({ categories: { salary: 70000 } }, 0).total, 70000, 'legacy category total');
    assert.equal(monthIncome(undefined, 0).total, 0);
});

test('only income-type rows count', () => {
    assert.equal(isIncomeTx({ category: 'groceries' }), false);
    assert.equal(isIncomeTx({ category: 'anything', mainCategory: 'Income' }), true);
    assert.equal(isIncomeTx({ category: 'Dividend Q2' }), true);
});
