import test from 'node:test';
import assert from 'node:assert/strict';
import { stockCashflows, stockReturn } from './xirr.js';

const asOf = new Date('2025-01-01');
const holding = (dividend) => ({
    id: 1, name: 'ITC', shares: 100, currentPrice: 100,
    transactions: [{ id: 'b', date: '2023-01-01', type: 'buy', quantity: 100, price: 100 }, dividend],
});

test('a dividend saved the way the form saves it — quantity 0, amount in price — is a cash flow', () => {
    const stock = holding({ id: 'd', date: '2024-01-01', type: 'dividend', quantity: 0, price: 1000 });
    assert.deepEqual(stockCashflows(stock, asOf).map((f) => f.amount), [-10000, 1000, 10000]);
    const r = stockReturn(stock, asOf);
    assert.equal(r.profit, 1000);
    assert.ok(r.xirrPct > 5 && r.xirrPct < 5.3, `xirr ${r.xirrPct}`);
});

test('a dividend carrying an explicit amount is counted once, at that amount', () => {
    const stock = holding({ id: 'd', date: '2024-01-01', type: 'dividend', quantity: 0, price: 1000, amount: 1000 });
    assert.deepEqual(stockCashflows(stock, asOf).map((f) => f.amount), [-10000, 1000, 10000]);
});
