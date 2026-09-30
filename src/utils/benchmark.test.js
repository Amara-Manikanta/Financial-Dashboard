import test from 'node:test';
import assert from 'node:assert/strict';
import { proceeds, compareToIndex } from './benchmark.js';

// Ten bought at 100, five sold at 150, five still held at 160.
const partlySold = {
    name: 'ITC', shares: 5, currentPrice: 160,
    transactions: [
        { id: 'b', date: '2024-01-02', type: 'buy', quantity: 10, price: 100 },
        { id: 's', date: '2024-06-03', type: 'sell', quantity: 5, price: 150 },
    ],
};

const closes = { '2024-01-02': 100, '2024-06-03': 110, '2025-01-02': 120 };

test('a sale returns its whole amount, not just the gain on it', () => {
    assert.equal(proceeds([partlySold]), 750);
});

test('a merger leg returns no cash', () => {
    const merged = { name: 'X', shares: 0, currentPrice: 0, transactions: [
        { id: 'm', date: '2024-05-01', type: 'merger_out', quantity: 10, price: 100 },
    ] };
    assert.equal(proceeds([merged]), 0);
});

test('an archived holding is out of both sides of the comparison', () => {
    assert.equal(proceeds([{ ...partlySold, isArchived: true }]), 0);
});

test('a partly sold position is not reported as flat when it has doubled', () => {
    const r = compareToIndex({
        stocks: [partlySold], closes,
        portfolioValue: 5 * 160, saleProceeds: proceeds([partlySold]), dividends: 0,
    });
    // 1,000 deployed; 800 still held plus 750 returned = 1,550.
    assert.equal(r.comparableInvested, 1000);
    assert.equal(r.portfolioTotal, 1550);
    assert.equal(Math.round(r.portfolioReturnPct), 55);
    // Booking only the 250 gain would have reported +5%.
    assert.ok(r.portfolioReturnPct > 50, `got ${r.portfolioReturnPct}`);
});
