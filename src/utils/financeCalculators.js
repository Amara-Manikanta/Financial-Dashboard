/**
 * The figures that more than one page reports.
 *
 * Each of these was computed independently in two or three places and had
 * already drifted. They live here so a correction lands everywhere at once.
 */
import { loanBalances } from './netWorthHistory.js';

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/**
 * What is still owed on every recorded loan, today.
 *
 * Amortised from the payments actually recorded rather than from the schedule,
 * which is what `netWorthHistory` already does for its debt line — so the
 * Dashboard and the Net Worth page cannot disagree about the same loans.
 *
 * The Loans page shows a different, larger figure (`emiAmount × tenure` less
 * payments made). That one is the remaining *cash* commitment including all
 * future interest; this one is the principal outstanding now. Both are right
 * for their own question, and a balance sheet wants the principal.
 */
export const outstandingDebt = (loans = []) => money(
    (loans || []).reduce((sum, loan) => {
        const byMonth = loanBalances(loan);
        const months = Object.keys(byMonth).sort();
        return sum + (months.length ? byMonth[months[months.length - 1]] : 0);
    }, 0),
);

/**
 * Net worth at today's values: everything owned, less everything owed.
 *
 * Liabilities were missing from the Dashboard entirely, which reported gross
 * assets under the label "Total Combined Net Worth".
 *
 * Not the same measure as the Net Worth Over Time chart, and deliberately so:
 * that series is capital *contributed* over time, valued at what was paid,
 * because no historical prices are stored. This is what the holdings are worth
 * now. The two figures should not be expected to match.
 */
export const calculateNetWorth = ({
    savings = [], metals = {}, assets = [], loans = [], gratuity = 0,
    valueOf = () => 0,
} = {}) => {
    const totalSavings = (savings || []).reduce((sum, item) => sum + num(valueOf(item)), 0);

    const totalMetals = Object.values(metals || {})
        .reduce((sum, list) => sum + (list || []).reduce((s, item) => s + num(item?.currentValue), 0), 0);

    const totalAssets = (assets || []).reduce(
        (sum, cat) => sum + (cat?.items || []).reduce(
            (s, item) => s + (num(item?.currentValue) || num(item?.purchasePrice)), 0,
        ), 0,
    );

    const debt = outstandingDebt(loans);
    const gross = totalSavings + totalMetals + totalAssets + num(gratuity);

    return {
        totalSavings: money(totalSavings),
        totalMetals: money(totalMetals),
        totalAssets: money(totalAssets),
        gratuity: money(gratuity),
        gross: money(gross),
        debt,
        netWorth: money(gross - debt),
    };
};

/**
 * Gratuity accrued to date, across every employment tenure.
 *
 * The statutory formula, (15 × last drawn basic × completed years) / 26, and
 * the 5-year eligibility rule that decides whether any of it is payable.
 *
 * Was written out twice, in Savings and in Salary. Identical today only
 * because no employment tenures are configured and both fall through to the
 * same fallback; the moment one was added the two pages would have diverged on
 * whichever copy was corrected first.
 */
export const calculateGratuity = (employments = [], salaryDetails = [], now = new Date()) => {
    const details = [];
    let total = 0;

    if (employments && employments.length > 0) {
        employments.forEach((emp) => {
            const start = emp.startDate ? new Date(emp.startDate) : null;
            const end = emp.isCurrent || !emp.endDate ? now : new Date(emp.endDate);

            let totalYears = 0;
            let fullYears = 0;
            let durationString = 'N/A';

            if (start && !Number.isNaN(start.getTime())) {
                const diff = Math.max(0, end.getTime() - start.getTime());
                totalYears = diff / (1000 * 60 * 60 * 24 * 365.25);
                fullYears = Math.floor(totalYears);
                const months = Math.floor((diff / (1000 * 60 * 60 * 24 * 30.4375)) % 12);
                durationString = `${fullYears} Yrs, ${months} Mos`;
            }

            const isFiveYearEligible = totalYears >= 5.0;
            let status = emp.status || 'active';
            // Leaving before five years forfeits it, unless overridden by hand.
            if (!emp.isCurrent && !isFiveYearEligible && status === 'active') status = 'forfeited';

            let amount = 0;
            if (status !== 'forfeited' && status !== 'claimed') {
                if (num(emp.lastDrawnBasic) > 0 && fullYears > 0) {
                    amount = (15 * num(emp.lastDrawnBasic) * fullYears) / 26;
                } else {
                    // No basic recorded, so fall back to the gratuity line of
                    // each Annual CTC that overlaps this tenure.
                    const startYr = start ? start.getFullYear() : 0;
                    const endYr = end ? end.getFullYear() : 9999;
                    (salaryDetails || []).forEach((s) => {
                        if (s.month !== 'Annual') return;
                        const yr = num(s.year);
                        if (yr >= startYr && yr <= endYr) amount += num(s.gratuity);
                    });
                }
            }

            total += amount;
            details.push({
                ...emp, totalYears, fullYears, durationString,
                isFiveYearEligible, computedStatus: status, calculatedAmount: amount,
            });
        });
    } else {
        (salaryDetails || []).forEach((s) => {
            if (s.month === 'Annual') total += num(s.gratuity);
        });
    }

    return { total: money(total), tenureDetails: details };
};

/** The gratuity recorded on one Annual CTC year. */
export const gratuityForYear = (salaryDetails = [], year) => money(
    (salaryDetails || [])
        .filter((s) => s.month === 'Annual' && s.year === year)
        .reduce((sum, s) => sum + num(s.gratuity), 0),
);
