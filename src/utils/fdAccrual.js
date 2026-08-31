/**
 * What a fixed deposit is worth today.
 *
 * A deposit stores three different numbers and they are easy to confuse:
 *
 *   originalAmount   what was put in
 *   currentValue     what it was worth WHEN THE DEPOSIT WAS LAST SAVED
 *   maturityAmount   what it will be worth on the end date
 *
 * `currentValue` is the trap. FixedDepositModal computes it once on save and
 * stores the result, so it is only correct on the day it was written and then
 * silently falls behind — an FD entered eight months ago still reports its
 * eight-month-old value. The Savings card summed that stored field while the
 * Fixed Deposits page recomputed accrual live, so the same portfolio read
 * differently on two screens.
 *
 * Accrual is cheap. Compute it, never store it.
 *
 * This is the single copy of the formula. It previously existed twice — in
 * FixedDepositModal and in FixedDepositDetails.getDepositAccruedDetails — with
 * the modal working in fractional years and the page in whole days, which is
 * why the two screens disagreed even before staleness came into it.
 */

const num = (v) => Number(v) || 0;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Midnight local, so a deposit does not gain a few hours of interest. */
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Slice compounds daily; standard Indian FDs compound quarterly. Getting this
 * wrong is worth real money on the larger deposits, so it is decided from the
 * bank name in one place rather than at each call site.
 */
const compoundsPerYear = (bank) =>
    String(bank || '').toLowerCase().includes('slice') ? 365 : 4;

/**
 * Value and interest for one deposit as of `asOf` (default: now).
 *
 * Interest stops at the end date — a matured deposit sitting uncollected does
 * not keep compounding at the contracted rate, so `daysElapsed` is capped
 * there and a matured FD correctly reports its maturity value.
 */
export const depositAccrual = (deposit, asOf = new Date()) => {
    const P = num(deposit?.originalAmount);
    const fallback = {
        accruedValue: num(deposit?.currentValue) || P,
        accruedInterest: num(deposit?.interestEarned),
        daysElapsed: 0,
        totalDays: 0,
        matured: false,
    };
    if (!deposit || !P || !deposit.startDate) return fallback;

    const start = new Date(deposit.startDate);
    const end = new Date(deposit.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return fallback;

    const startDay = midnight(start);
    const endDay = midnight(end);
    const today = midnight(asOf);

    const effectiveEnd = today < endDay ? today : endDay;
    const daysElapsed = Math.max(0, Math.round((effectiveEnd - startDay) / MS_PER_DAY));
    const totalDays = Math.max(1, Math.round((endDay - startDay) / MS_PER_DAY));

    const r = num(deposit.interestRate) / 100;
    const n = compoundsPerYear(deposit.bank);
    // Days, not fractional years, so the figure moves once a day rather than
    // drifting with the clock — two loads of the same page must agree.
    const periods = n * (daysElapsed / 365.25);
    const accruedInterest = P * (Math.pow(1 + r / n, periods) - 1);

    return {
        accruedValue: P + accruedInterest,
        accruedInterest,
        daysElapsed,
        totalDays,
        matured: today >= endDay,
    };
};

/** Projected value on the end date, from the same formula. */
export const depositMaturity = (deposit) => {
    const P = num(deposit?.originalAmount);
    if (!deposit || !P || !deposit.startDate || !deposit.endDate) return num(deposit?.maturityAmount);
    const start = new Date(deposit.startDate);
    const end = new Date(deposit.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return num(deposit.maturityAmount);

    const years = Math.max(0, (midnight(end) - midnight(start)) / MS_PER_DAY / 365.25);
    const r = num(deposit.interestRate) / 100;
    const n = compoundsPerYear(deposit.bank);
    return P * Math.pow(1 + r / n, n * years);
};

/**
 * Today's value of a whole set of deposits.
 *
 * Archived deposits are excluded, matching every other view: archiving is the
 * user saying "stop counting this".
 */
export const totalAccruedValue = (deposits = []) => (deposits || [])
    .filter((d) => d && !d.isArchived)
    .reduce((sum, d) => sum + depositAccrual(d).accruedValue, 0);

/** Principal actually at work today, on the same archived rule. */
export const totalPrincipal = (deposits = []) => (deposits || [])
    .filter((d) => d && !d.isArchived)
    .reduce((sum, d) => sum + num(d.originalAmount), 0);
