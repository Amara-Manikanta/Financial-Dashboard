// Rental / tenancy helpers for real-estate assets.
//
// Scope note: this is deliberately self-contained inside Assets. Rent entries
// recorded here do NOT flow into the monthly dashboard or income totals — that
// was an explicit decision, so nothing in this file touches the expenses tree.

// Entry kinds recorded against a property. `direction` decides whether the
// amount is money in or out; `countsAsYield` keeps deposits out of the return
// figure, since an advance is money held, not money earned.
/**
 * `hasPeriod` marks a kind that belongs to a month rather than to the day it
 * was paid. Rent for August is routinely paid in September, and so is the
 * August electricity bill — bucketing either by payment date reports the month
 * unpaid and the next one double.
 */
export const ENTRY_KINDS = {
    rent: { label: 'Rent', direction: 'income', countsAsYield: true, hasPeriod: true, color: '#10b981' },
    advance: { label: 'Advance / Deposit', direction: 'income', countsAsYield: false, color: '#6366f1' },
    advance_refund: { label: 'Advance Refunded', direction: 'expense', countsAsYield: false, color: '#8b5cf6' },
    current_bill: { label: 'Current Bill', direction: 'expense', countsAsYield: true, hasPeriod: true, color: '#f59e0b' },
    // The other half of a bill the landlord fronts.
    //
    // On a let shop the meter is usually in the owner's name: you pay the
    // board and take it back from the tenant, and you are out nothing. Without
    // this kind that recovery had nowhere to go, so a bill paid and fully
    // recovered still showed as a straight reduction in yield — a shop billing
    // ₹4,000 a month looked ₹48,000 a year worse than it was.
    // Superseded by the "who pays this" question on the bill itself, which
    // answers it where it is asked instead of requiring a second row. Kept so
    // any entry already recorded this way still reads correctly, and hidden
    // from the picker so there are not two ways to say the same thing.
    bill_recovered: { label: 'Bill Recovered from Tenant', direction: 'income', countsAsYield: true, hasPeriod: true, legacy: true, color: '#fbbf24' },
    property_tax: { label: 'Property Tax', direction: 'expense', countsAsYield: true, hasPeriod: true, color: '#ef4444' },
    maintenance: { label: 'Maintenance / Repairs', direction: 'expense', countsAsYield: true, color: '#f97316' },
    other_income: { label: 'Other Income', direction: 'income', countsAsYield: true, color: '#22d3ee' },
    other_expense: { label: 'Other Expense', direction: 'expense', countsAsYield: true, color: '#94a3b8' },
};

/** Does this kind belong to a month rather than to its payment date? */
export const kindHasPeriod = (kind) => !!ENTRY_KINDS[kind]?.hasPeriod;

// Entries saved before kinds existed only carry type: 'income' | 'expense'.
export const kindOf = (entry) => {
    if (entry?.kind && ENTRY_KINDS[entry.kind]) return entry.kind;
    return entry?.type === 'expense' ? 'other_expense' : 'other_income';
};

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * The `YYYY-MM` a rent entry's period refers to, whatever shape it was stored in.
 *
 * The form uses `<input type="month">`, which yields `2026-08`. Safari does not
 * implement that input type and renders a plain text box instead, so an entry
 * made there carries whatever was typed — "August 2026" in this database. The
 * ledger keyed months with `String(period).slice(0, 7)`, which turns that into
 * `"August "`, matches no month, and reports rent that was paid as unpaid.
 *
 * Accepts, in order: an ISO month or date (`2026-08`, `2026-08-01`), a month
 * name with a year in either order ("August 2026", "Aug 2026", "2026 August"),
 * and numeric forms ("08/2026", "8-2026"). Returns null when it cannot tell,
 * rather than guessing — a rent payment filed against the wrong month is worse
 * than one the ledger admits it cannot place.
 */
export const parsePeriod = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    // 2026-08 or 2026-08-01
    const iso = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (iso) {
        const month = Number(iso[2]);
        if (month >= 1 && month <= 12) return `${iso[1]}-${String(month).padStart(2, '0')}`;
        return null;
    }

    const year = raw.match(/\b(19|20)\d{2}\b/);
    if (!year) return null;

    const lower = raw.toLowerCase();
    const nameIndex = MONTH_NAMES.findIndex((m) => lower.includes(m.slice(0, 3)));
    if (nameIndex >= 0) return `${year[0]}-${String(nameIndex + 1).padStart(2, '0')}`;

    // 08/2026, 8-2026, 2026/08 — the number that is not the year is the month.
    const numeric = raw.match(/^\s*(\d{1,2})\s*[/\-.\s]\s*(\d{4})\s*$/)
        || raw.match(/^\s*(\d{4})\s*[/\-.\s]\s*(\d{1,2})\s*$/);
    if (numeric) {
        const month = Number(numeric[1].length === 4 ? numeric[2] : numeric[1]);
        if (month >= 1 && month <= 12) return `${year[0]}-${String(month).padStart(2, '0')}`;
    }
    return null;
};

/** A period rendered for reading: "August 2026". */
export const formatPeriod = (value) => {
    const key = parsePeriod(value);
    if (!key) return String(value ?? '');
    const [y, m] = key.split('-');
    const name = MONTH_NAMES[Number(m) - 1];
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
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

/* ------------------------------------------------------------------ *
 * Who actually carries a cost
 * ------------------------------------------------------------------ */

/**
 * A bill against a let property has three quite different meanings, and the
 * amount on its own tells you none of them:
 *
 *   owner      you paid it and you are out the money
 *   recovered  you paid it and took it back from the tenant — you are out
 *              nothing, or out the part they have not repaid yet
 *   tenant     the tenant paid the provider directly. Worth recording, because
 *              you want the service history and the meter readings, but it is
 *              not your expense and must not reduce your yield
 *
 * Without this, all three looked identical: a ₹4,000 monthly bill the tenant
 * always paid dragged ₹48,000 a year off the return on a property that had
 * never actually spent it.
 *
 * Absent means `owner`. Every entry recorded before this existed was one the
 * owner paid, so the default cannot change any figure already on screen.
 */
export const BORNE_BY = {
    owner: {
        label: 'I paid it, and I am carrying it',
        short: 'You paid',
        blurb: 'Counts as your expense in full.',
        color: '#f87171',
    },
    recovered: {
        label: 'I paid it, and the tenant pays me back',
        short: 'Recovered',
        blurb: 'Costs you nothing once repaid — enter a part amount if only some has come back.',
        color: '#34d399',
    },
    tenant: {
        label: 'The tenant paid it directly',
        short: 'Tenant paid',
        blurb: 'Kept for the record. Never counted as your expense.',
        color: '#818cf8',
    },
};

/** Which kinds it makes sense to ask about — an expense a tenant might cover. */
export const asksWhoPays = (kind) =>
    ENTRY_KINDS[kind]?.direction === 'expense' && kind !== 'advance_refund';

export const borneBy = (entry) => {
    const b = String(entry?.borne || '').trim().toLowerCase();
    return BORNE_BY[b] ? b : 'owner';
};

/**
 * What an expense actually cost you.
 *
 * A `recovered` entry with no figure means fully recovered — that is what
 * choosing it says. A figure narrows it to a partial repayment, and is clamped
 * to the bill: getting back more than was billed is an earlier month's arrear
 * arriving, not a profit on electricity.
 */
export const netCost = (entry) => {
    const amount = Math.abs(Number(entry?.amount) || 0);
    const borne = borneBy(entry);
    if (borne === 'tenant') return 0;
    if (borne === 'recovered') {
        const raw = entry?.recoveredAmount;
        const back = raw === '' || raw === undefined || raw === null
            ? amount
            : Math.min(amount, Math.max(0, Number(raw) || 0));
        return amount - back;
    }
    return amount;
};

/** How much of an expense has come back from the tenant. */
export const recoveredFrom = (entry) => Math.abs(Number(entry?.amount) || 0) - netCost(entry);

/** Totals per kind, deposit still held, and net yield. */
export const summariseRental = (entries = []) => {
    const byKind = {};
    Object.keys(ENTRY_KINDS).forEach((k) => {
        byKind[k] = { total: 0, net: 0, recovered: 0, count: 0 };
    });

    entries.forEach((e) => {
        const k = kindOf(e);
        const amount = Math.abs(Number(e.amount) || 0);
        const isExpense = ENTRY_KINDS[k].direction === 'expense';
        byKind[k].total += amount;
        byKind[k].net += isExpense ? netCost(e) : amount;
        byKind[k].recovered += isExpense ? recoveredFrom(e) : 0;
        byKind[k].count += 1;
    });

    const income = Object.entries(byKind)
        .filter(([k]) => ENTRY_KINDS[k].direction === 'income' && ENTRY_KINDS[k].countsAsYield)
        .reduce((s, [, v]) => s + v.total, 0);
    // Net, not gross: an expense the tenant paid or repaid never left you.
    const expense = Object.entries(byKind)
        .filter(([k]) => ENTRY_KINDS[k].direction === 'expense' && ENTRY_KINDS[k].countsAsYield)
        .reduce((s, [, v]) => s + v.net, 0);

    // Money held on behalf of the tenant, still owed back at lease end.
    const depositHeld = byKind.advance.total - byKind.advance_refund.total;

    // A recovery logged as its own income row still works, for anyone who wants
    // it dated. It is subtracted here rather than in `expense` so it cannot be
    // counted twice alongside a `recovered` flag on the bill itself.
    const separateRecoveries = byKind.bill_recovered.total;

    return {
        byKind,
        rentReceived: byKind.rent.total,
        billsPaid: byKind.current_bill.total,
        billsRecovered: byKind.current_bill.recovered + separateRecoveries,
        billsBorne: Math.max(0, byKind.current_bill.net - separateRecoveries),
        taxPaid: byKind.property_tax.net,
        maintenancePaid: byKind.maintenance.net,
        maintenanceBilled: byKind.maintenance.total,
        maintenanceRecovered: byKind.maintenance.recovered,
        depositHeld,
        income,
        expense: Math.max(0, expense - separateRecoveries),
        /** Everything a tenant covered, however it was recorded. */
        coveredByTenant: Object.values(byKind).reduce((s, v) => s + v.recovered, 0) + separateRecoveries,
        net: income - Math.max(0, expense - separateRecoveries),
    };
};

/**
 * Bills charged against bills recovered, by the month each covers.
 *
 * Separate from the rent ledger because there is no schedule to compare
 * against — electricity is whatever the meter said, so nothing here can say a
 * bill is "due". It reports only what was recorded: billed, recovered, and
 * what that left you carrying.
 */
export const billLedger = (entries = []) => {
    const months = new Map();
    const unplaced = [];

    entries.forEach((e) => {
        const kind = kindOf(e);
        if (kind !== 'current_bill' && kind !== 'bill_recovered') return;
        const key = e.period ? parsePeriod(e.period) : parsePeriod(String(e.date || '').slice(0, 7));
        if (!key) { unplaced.push(e); return; }
        if (!months.has(key)) months.set(key, { month: key, billed: 0, recovered: 0, tenantPaid: 0 });
        const row = months.get(key);
        const amount = Math.abs(Number(e.amount) || 0);
        if (kind === 'bill_recovered') { row.recovered += amount; return; }

        // A bill the tenant settled directly is reported in its own column,
        // not as a bill you paid and got back — you never handled the money,
        // and showing it as recovered would imply you had.
        if (borneBy(e) === 'tenant') { row.tenantPaid += amount; return; }
        row.billed += amount;
        row.recovered += recoveredFrom(e);
    });

    const rows = [...months.values()]
        .map((r) => ({ ...r, borne: r.billed - r.recovered }))
        .sort((a, b) => b.month.localeCompare(a.month));
    rows.unplaced = unplaced;
    return rows;
};

/** Rent months expected vs received, so shortfalls are visible. */
export const rentLedger = (rental, entries = [], asOf = new Date()) => {
    if (!rental?.leaseStart || !Number(rental.monthlyRent)) return [];

    const todayISO = asOf.toISOString().slice(0, 10);
    const endISO = rental.leaseEnd && rental.leaseEnd < todayISO ? rental.leaseEnd : todayISO;

    const received = new Map();
    const unplaced = [];
    const rentEntries = entries.filter((e) => kindOf(e) === 'rent');
    rentEntries.forEach((e) => {
        // `period` is the month the rent covers; the payment date is only a
        // fallback, because rent for August is routinely paid in September and
        // bucketing by payment date reports August unpaid and September double.
        const key = e.period ? parsePeriod(e.period) : parsePeriod(String(e.date || '').slice(0, 7));
        if (key) {
            received.set(key, (received.get(key) || 0) + (Math.abs(Number(e.amount)) || 0));
        } else {
            unplaced.push(e);
        }
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
    rows.reverse();

    // Rent recorded for a month the lease does not cover.
    //
    // The ledger runs from lease start to today, so a payment dated outside
    // that window — rent for September against a lease starting on the 4th, an
    // advance month paid up front, a row still on the old lease's dates —
    // matched no row and simply disappeared. It is money that was recorded and
    // then shown nowhere, which is the same failure as an unreadable period.
    const covered = new Set(rows.map((r) => r.month));
    rentEntries.forEach((e) => {
        const key = e.period ? parsePeriod(e.period) : parsePeriod(String(e.date || '').slice(0, 7));
        if (key && !covered.has(key)) unplaced.push({ ...e, outsideLease: true, month: key });
    });

    // Carried on the array so a caller can say which payments could not be
    // placed. Silently dropping them is what made a paid month read as unpaid.
    rows.unplaced = unplaced;
    return rows;
};
