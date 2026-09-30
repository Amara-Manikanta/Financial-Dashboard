import test from 'node:test';
import assert from 'node:assert/strict';
import { triggeredAlerts } from './priceRange.js';

const below = { id: 'a1', type: 'below', price: 500 };

test('a price of zero is a failed quote, not a crash through every alert', () => {
    // The whole point: 0 is what an empty fetch leaves behind. Before the
    // guard it satisfied every "below" alert a holding had.
    const holding = { currentPrice: 0, alerts: [below] };
    assert.deepEqual(triggeredAlerts(holding), []);
});

test('a zero quote falls back to the stored price rather than masking it', () => {
    const holding = { quote: { price: 0 }, currentPrice: 450, alerts: [below] };
    const fired = triggeredAlerts(holding);
    assert.equal(fired.length, 1);
    assert.equal(fired[0].currentPrice, 450);
});

test('a real price below the target still fires', () => {
    const fired = triggeredAlerts({ currentPrice: 480, alerts: [below] });
    assert.equal(fired.length, 1);
    assert.equal(fired[0].currentPrice, 480);
});

test('a real price above the target does not', () => {
    assert.deepEqual(triggeredAlerts({ currentPrice: 520, alerts: [below] }), []);
});

test('an above alert is unaffected by the guard', () => {
    const above = { id: 'a2', type: 'above', price: 500 };
    assert.equal(triggeredAlerts({ currentPrice: 510, alerts: [above] }).length, 1);
    // ...and zero must not read as "above" either.
    assert.deepEqual(triggeredAlerts({ currentPrice: 0, alerts: [above] }), []);
});
