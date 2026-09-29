import test from 'node:test';
import assert from 'node:assert/strict';
import { gainsLedger, isLongTerm, longTermFrom, openLotPositions } from './capitalGains.js';

const disposal = (fy, term, gain) => ({
    fy, term, gain, proceeds: 0, cost: 0, dividendIncome: 0, treatedAsDividend: false,
});

test('a lot is long term from the day after its anniversary, and the page says so', () => {
    assert.equal(longTermFrom('2025-10-20'), '2026-10-21');
    assert.equal(isLongTerm('2025-10-20', '2026-10-20'), false, 'twelve months exactly is still short term');
    assert.equal(isLongTerm('2025-10-20', longTermFrom('2025-10-20')), true);

    const stocks = [{ id: 1, name: 'X', currentPrice: 120, transactions: [{ id: 'b', date: '2025-10-20', type: 'buy', quantity: 10, price: 100 }] }];
    const [before] = openLotPositions(stocks, new Date(2026, 8, 29, 12));
    assert.equal(before.longTermFrom, '2026-10-21');
    assert.equal(before.daysToLongTerm, 22);

    // On the anniversary itself, whatever the hour, a sale is still short term.
    const [onDay] = openLotPositions(stocks, new Date(2026, 9, 20, 18));
    assert.equal(onDay.term, 'short');
    assert.equal(onDay.daysToLongTerm, 1);

    const [after] = openLotPositions(stocks, new Date(2026, 9, 21, 9));
    assert.equal(after.term, 'long');
    assert.equal(after.daysToLongTerm, 0);
});

test('a short-term loss is set against the same year\'s long-term gain before anything is carried (s.70)', () => {
    const [year] = gainsLedger([disposal('2025-26', 'short', -50000), disposal('2025-26', 'long', 200000)]).years;
    assert.equal(year.setOffCurrentShortLossAgainstLong, 50000);
    assert.equal(year.netLong, 150000);
    assert.equal(year.taxableLong, 25000);
    assert.equal(year.estimatedTax, 3125);
    assert.equal(year.closingCarriedShort, 0);
});

test('only the part of a short-term loss the long-term gain cannot absorb is carried forward', () => {
    const [year] = gainsLedger([disposal('2025-26', 'short', -80000), disposal('2025-26', 'long', 30000)]).years;
    assert.equal(year.netLong, 0);
    assert.equal(year.estimatedTax, 0);
    assert.equal(year.closingCarriedShort, 50000);
});

test('a long-term loss never meets a short-term gain', () => {
    const [year] = gainsLedger([disposal('2025-26', 'long', -40000), disposal('2025-26', 'short', 40000)]).years;
    assert.equal(year.netShort, 40000);
    assert.equal(year.estimatedTax, 8000);
    assert.equal(year.closingCarriedLong, 40000);
});

test('a carried loss can be used in its eighth year but not its ninth (s.74(3))', () => {
    const eighth = gainsLedger([disposal('2018-19', 'short', -40000), disposal('2026-27', 'short', 40000)])
        .years.find((y) => y.fy === '2026-27');
    assert.equal(eighth.setOffShortAgainstShort, 40000);
    assert.equal(eighth.estimatedTax, 0);

    const ninth = gainsLedger([disposal('2017-18', 'short', -40000), disposal('2026-27', 'short', 40000)])
        .years.find((y) => y.fy === '2026-27');
    assert.equal(ninth.setOffShortAgainstShort, 0);
    assert.equal(ninth.estimatedTax, 8000);
    assert.equal(ninth.lapsed, 40000);
});

test('the expiry label agrees with when the ledger stops using a loss', () => {
    const ledger = gainsLedger([disposal('2018-19', 'short', -40000), disposal('2026-27', 'short', 1000)]);
    assert.equal(ledger.carried.short[0].expiresAfter, '2026-27');
});
