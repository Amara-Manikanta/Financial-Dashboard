// Forecast of committed money over the coming weeks.
//
// Two things this deliberately does NOT do:
//
// 1. It does not claim to predict a bank balance. There is no bank balance in
//    this database, so any running total would be invented. It forecasts
//    *commitments* against *expected income* — which is the answerable
//    question: what is already spoken for before the next payday.
//
// 2. It does not double count card spending. A subscription billed to a credit
//    card is not a separate withdrawal from your bank — it arrives inside that
//    card's bill. Money leaves the bank two ways only: direct payments, and
//    credit-card bill payments. Card-based recurring charges are listed under
//    the bill they belong to, never alongside it.

import { detectRecurring, applyOverrides } from './recurring';
import { cardForOrder } from './emiOrders';

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);

const lastDayOfMonth = (year, monthIndex) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/** The next occurrence of a given day-of-month, on or after `from`. */
export const nextOnDay = (from, dayOfMonth, limit) => {
    const out = [];
    if (!dayOfMonth) return out;
    const start = new Date(from);
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();

    for (let i = 0; i < 24 && out.length < 24; i += 1) {
        // A 31st lands on the 30th in a 30-day month, not the 1st of the next.
        const day = Math.min(dayOfMonth, lastDayOfMonth(y, m));
        const when = new Date(Date.UTC(y, m, day));
        if (when >= start && (!limit || when <= limit)) out.push(when);
        if (limit && when > limit) break;
        m += 1;
        if (m > 11) { m = 0; y += 1; }
    }
    return out;
};

/** What one card currently owes: spends since its last statement, less payments. */
export const cardOutstanding = (expenses, cardName) => {
    let total = 0;
    Object.values(expenses || {}).forEach((months) => {
        if (!months || typeof months !== 'object') return;
        Object.values(months).forEach((node) => {
            (node?.transactions || []).forEach((t) => {
                if (!t || t.paymentMode !== 'credit_card') return;
                if (String(t.creditCardName || '').trim() !== cardName) return;
                const amount = Math.abs(Number(t.amount) || 0);
                const cat = String(t.category || '').toLowerCase();
                const isPayment = cat === 'credit card bill' || cat === 'credit card payment';
                const credited = t.isCredited || t.transactionType === 'credit';
                if (isPayment || credited) total -= amount;
                else total += amount;
            });
        });
    });
    return total;
};

/**
 * Build the forecast.
 *
 * @returns {{ events: Array, cycles: Array, monthlyCommitted: number }}
 */
export const buildForecast = ({
    expenses, creditCards = [], loans = [], salaryDetails = [], recurringOverrides = {},
    asOf = new Date(), days = 90,
}) => {
    const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
    const end = addDays(start, days);

    const series = applyOverrides(detectRecurring(expenses, asOf), recurringOverrides)
        .filter((s) => s.status === 'active');

    const cardNames = creditCards.filter((c) => c.type !== 'wallet').map((c) => c.name);
    const events = [];

    // --- income: salary, from the day of month it has actually been landing ---
    const salaryDays = [];
    let salaryAmount = 0;
    Object.values(expenses || {}).forEach((months) => {
        if (!months || typeof months !== 'object') return;
        Object.values(months).forEach((node) => {
            (node?.transactions || []).forEach((t) => {
                if (!t || !(t.isCredited || t.transactionType === 'credit')) return;
                const hay = `${t.category || ''} ${t.title || ''}`.toLowerCase();
                if (!hay.includes('salary')) return;
                const d = String(t.date || '').slice(0, 10);
                if (d.length === 10) salaryDays.push({ day: Number(d.slice(8, 10)), amount: Math.abs(Number(t.amount) || 0), date: d });
            });
        });
    });
    salaryDays.sort((a, b) => a.date.localeCompare(b.date));
    const recent = salaryDays.slice(-6);
    if (recent.length) {
        // The day it usually lands, and what it has usually been.
        const counts = {};
        recent.forEach((s) => { counts[s.day] = (counts[s.day] || 0) + 1; });
        const usualDay = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
        salaryAmount = Math.round(recent.reduce((s, r) => s + r.amount, 0) / recent.length);
        nextOnDay(start, usualDay, end).forEach((when) => {
            events.push({
                date: iso(when), kind: 'income', label: 'Salary',
                amount: salaryAmount, detail: `usually lands on the ${usualDay}`,
            });
        });
    }

    // A gadget EMI billed to a card is charged to that card, so it arrives
    // inside the card's bill — exactly like a subscription. Only EMIs that do
    // not resolve to a card leave the bank on their own.
    const gadgetEmis = (loans || []).filter((l) => l?.type === 'gadget');
    const emiCard = new Map(gadgetEmis.map((l) => [l.id, cardForOrder(l, creditCards)?.name || null]));

    // --- outflow: credit-card bills, carrying their own recurring charges ---
    cardNames.forEach((name) => {
        const card = creditCards.find((c) => c.name === name);
        if (!card?.billingDay) return;
        const outstanding = cardOutstanding(expenses, name);
        const onThisCard = series.filter((s) => {
            // A series belongs to a card if most of its charges were on it.
            const cards = s.events.map((e) => e.card).filter(Boolean);
            return cards.length && cards.filter((c) => c === name).length >= cards.length / 2;
        });
        const emisOnThisCard = gadgetEmis.filter((l) => emiCard.get(l.id) === name);
        nextOnDay(start, card.billingDay, end).forEach((when, i) => {
            events.push({
                date: iso(when), kind: 'card-bill', label: `${name} bill`,
                // Only the first cycle has a knowable figure; later ones are unknown.
                amount: i === 0 ? Math.max(0, outstanding) : null,
                detail: i === 0
                    ? 'current outstanding — will change as you spend'
                    : 'amount not yet known',
                includes: [
                    // A declared EMI is also picked up by the recurring
                    // detector from its own charges, so the same obligation
                    // arrives twice. The declared order is the better record —
                    // it knows the tenure — so the detected twin is dropped.
                    ...emisOnThisCard.map((l) => ({ label: l.name, amount: Number(l.emiAmount) || 0, isEmi: true })),
                    ...onThisCard
                        .filter((x) => !emisOnThisCard.some((l) => {
                            const emi = Number(l.emiAmount) || 0;
                            return emi > 0 && Math.abs(x.typical - emi) <= emi * 0.08;
                        }))
                        .map((x) => ({ label: x.label, amount: x.typical })),
                ],
            });
        });
    });

    // --- outflow: gadget EMIs that are NOT billed to a card ---
    gadgetEmis.filter((l) => !emiCard.get(l.id)).forEach((l) => {
        const startDate = String(l.startDate || '');
        if (!startDate) return;
        const anchor = Number(startDate.slice(8, 10));
        const tenure = Number(l.tenureMonths) || 0;
        const endOfPlan = new Date(Date.UTC(
            Number(startDate.slice(0, 4)),
            Number(startDate.slice(5, 7)) - 1 + tenure,
            anchor,
        ));
        nextOnDay(start, anchor, end < endOfPlan ? end : endOfPlan).forEach((when) => {
            events.push({
                date: iso(when), kind: 'emi', label: l.name,
                amount: Number(l.emiAmount) || 0,
                detail: `${l.lender} · ${tenure} month plan`,
            });
        });
    });

    // --- outflow: recurring charges NOT on a card (direct debits, UPI) ---
    series.forEach((s) => {
        const cards = s.events.map((e) => e.card).filter(Boolean);
        const mostlyOnCard = cards.length && cards.length >= s.events.length / 2;
        if (mostlyOnCard) return;      // already inside a card bill
        if (/emi|loan/i.test(s.kind)) return;  // already covered above

        let when = new Date(`${s.nextExpected}T00:00:00Z`);
        let guard = 0;
        while (when <= end && guard < 40) {
            if (when >= start) {
                events.push({
                    date: iso(when), kind: 'recurring', label: s.label,
                    amount: s.typical, detail: `${s.cadence.toLowerCase()} · paid directly`,
                });
            }
            when = addDays(when, s.medianGap);
            guard += 1;
        }
    });

    events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));

    // --- group into pay cycles: one payday to the next ---
    const paydays = events.filter((e) => e.kind === 'income').map((e) => e.date);
    const cycles = [];
    const bounds = [iso(start), ...paydays, iso(end)]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

    for (let i = 0; i < bounds.length - 1; i += 1) {
        const from = bounds[i];
        const to = bounds[i + 1];
        const inCycle = events.filter((e) => e.date >= from && e.date < to);
        const income = inCycle.filter((e) => e.kind === 'income').reduce((s, e) => s + (e.amount || 0), 0);
        const committed = inCycle.filter((e) => e.kind !== 'income').reduce((s, e) => s + (e.amount || 0), 0);
        const unknown = inCycle.filter((e) => e.kind !== 'income' && e.amount === null).length;
        if (!inCycle.length) continue;
        cycles.push({ from, to, income, committed, unknown, events: inCycle });
    }

    // What is committed every month regardless of card cycles: direct-debit
    // subscriptions plus every running gadget EMI, card-billed or not. Counted
    // once each — the card grouping above is about *when* money leaves, this is
    // about how much is spoken for.
    const monthlyCommitted = series
        .filter((s) => {
            const cards = s.events.map((e) => e.card).filter(Boolean);
            return !(cards.length && cards.length >= s.events.length / 2);
        })
        .reduce((sum, s) => sum + s.annualRunRate / 12, 0)
        + gadgetEmis.reduce((sum, l) => sum + (Number(l.emiAmount) || 0), 0);

    return { events, cycles, monthlyCommitted, salaryAmount };
};
