// Rental / tenancy helpers for real-estate assets.
//
// Scope note: this is deliberately self-contained inside Assets. Rent entries
// recorded here do NOT flow into the monthly dashboard or income totals — that
// was an explicit decision, so nothing in this file touches the expenses tree.

// Entry kinds recorded against a property. `direction` decides whether the
// amount is money in or out; `countsAsYield` keeps deposits out of the return
// figure, since an advance is money held, not money earned.
export const ENTRY_KINDS = {
    rent: { label: 'Rent', direction: 'income', countsAsYield: true, color: '#10b981' },
    advance: { label: 'Advance / Deposit', direction: 'income', countsAsYield: false, color: '#6366f1' },
    advance_refund: { label: 'Advance Refunded', direction: 'expense', countsAsYield: false, color: '#8b5cf6' },
    current_bill: { label: 'Current Bill', direction: 'expense', countsAsYield: true, color: '#f59e0b' },
    property_tax: { label: 'Property Tax', direction: 'expense', countsAsYield: true, color: '#ef4444' },
    maintenance: { label: 'Maintenance / Repairs', direction: 'expense', countsAsYield: true, color: '#f97316' },
    other_income: { label: 'Other Income', direction: 'income', countsAsYield: true, color: '#22d3ee' },
    other_expense: { label: 'Other Expense', direction: 'expense', countsAsYield: true, color: '#94a3b8' },
};

// Entries saved before kinds existed only carry type: 'income' | 'expense'.
export const kindOf = (entry) => {
    if (entry?.kind && ENTRY_KINDS[entry.kind]) return entry.kind;
    return entry?.type === 'expense' ? 'other_expense' : 'other_income';
};

const monthsBetween = (fromISO, toISO) => {
    if (!fromISO || !toISO) return 0;
    const [fy, fm, fd] = fromISO.split('-').map(Number);
    const [ty, tm, td] = toISO.split('-').map(Number);
    if (!fy || !ty) return 0;
    let months = (ty - fy) * 12 + (tm - fm);
    if (td < fd) months -= 1;          // not yet a full month
    return months;
};

/**
 * Rent payable on a given date, applying the escalation rule.
 *
 * Escalation is stored as a rule rather than by editing monthlyRent each year,
 * so past periods stay reconstructable — otherwise last year's arrears would be
 * recalculated at today's rent.
 */
export const expectedRentOn = (rental, isoDate) => {
    const base = Number(rental?.monthlyRent) || 0;
    if (!base || !rental?.leaseStart) return base;

    const every = Number(rental.escalationEveryMonths) || 12;
    const value = Number(rental.escalationValue) || 0;
    if (!value || every <= 0) return base;

    const elapsed = monthsBetween(rental.leaseStart, isoDate);
    if (elapsed < 0) return base;
    const steps = Math.floor(elapsed / every);
    if (steps <= 0) return base;

    if (rental.escalationType === 'fixed') return base + value * steps;
    return base * ((1 + value / 100) ** steps);   // percent, compounding
};

/** Every escalation step from lease start up to `untilISO`, for display. */
export const escalationSchedule = (rental, untilISO) => {
    const base = Number(rental?.monthlyRent) || 0;
    if (!base || !rental?.leaseStart) return [];
    const every = Number(rental.escalationEveryMonths) || 12;
    const value = Number(rental.escalationValue) || 0;
    if (!value || every <= 0) return [{ from: rental.leaseStart, rent: base }];

    const rows = [];
    const [sy, sm, sd] = rental.leaseStart.split('-').map(Number);
    const limit = monthsBetween(rental.leaseStart, untilISO);
    const steps = Math.max(0, Math.floor(limit / every)) + 1;

    for (let i = 0; i <= steps; i += 1) {
        const addMonths = i * every;
        const d = new Date(Date.UTC(sy, sm - 1 + addMonths, sd));
        const iso = d.toISOString().slice(0, 10);
        rows.push({ from: iso, rent: expectedRentOn(rental, iso), step: i });
    }
    return rows;
};

/** Totals per kind, deposit still held, and net yield. */
export const summariseRental = (entries = []) => {
    const byKind = {};
    Object.keys(ENTRY_KINDS).forEach((k) => { byKind[k] = { total: 0, count: 0 }; });

    entries.forEach((e) => {
        const k = kindOf(e);
        const amount = Math.abs(Number(e.amount) || 0);
        byKind[k].total += amount;
        byKind[k].count += 1;
    });

    const income = Object.entries(byKind)
        .filter(([k]) => ENTRY_KINDS[k].direction === 'income' && ENTRY_KINDS[k].countsAsYield)
        .reduce((s, [, v]) => s + v.total, 0);
    const expense = Object.entries(byKind)
        .filter(([k]) => ENTRY_KINDS[k].direction === 'expense' && ENTRY_KINDS[k].countsAsYield)
        .reduce((s, [, v]) => s + v.total, 0);

    // Money held on behalf of the tenant, still owed back at lease end.
    const depositHeld = byKind.advance.total - byKind.advance_refund.total;

    return {
        byKind,
        rentReceived: byKind.rent.total,
        billsPaid: byKind.current_bill.total,
        taxPaid: byKind.property_tax.total,
        maintenancePaid: byKind.maintenance.total,
        depositHeld,
        income,
        expense,
        net: income - expense,
    };
};

/** Rent months expected vs received, so shortfalls are visible. */
export const rentLedger = (rental, entries = [], asOf = new Date()) => {
    if (!rental?.leaseStart || !Number(rental.monthlyRent)) return [];

    const todayISO = asOf.toISOString().slice(0, 10);
    const endISO = rental.leaseEnd && rental.leaseEnd < todayISO ? rental.leaseEnd : todayISO;

    const received = new Map();
    entries.filter((e) => kindOf(e) === 'rent').forEach((e) => {
        // `period` is the month the rent covers; fall back to the payment date.
        const key = String(e.period || e.date || '').slice(0, 7);
        if (key) received.set(key, (received.get(key) || 0) + (Math.abs(Number(e.amount)) || 0));
    });

    const rows = [];
    const [sy, sm] = rental.leaseStart.split('-').map(Number);
    const total = monthsBetween(rental.leaseStart, endISO);
    for (let i = 0; i <= total; i += 1) {
        const d = new Date(Date.UTC(sy, sm - 1 + i, 1));
        const monthKey = d.toISOString().slice(0, 7);
        const due = expectedRentOn(rental, `${monthKey}-01`);
        const got = received.get(monthKey) || 0;
        rows.push({ month: monthKey, due, received: got, shortfall: Math.max(0, due - got) });
    }
    return rows.reverse();
};
