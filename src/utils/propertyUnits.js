/**
 * One building, several tenancies — and often one part you live in yourself.
 *
 * The rental model assumed a property was let as a whole: one `rental` block,
 * one tenant, one rent ledger. A house with three shops below and a floor above
 * does not fit that, and the only way to record it was to create a separate
 * asset per shop. That works, but it loses what is actually true: they are one
 * building with one purchase price and one valuation, and the part you live in
 * has no place at all — an asset with no rent looks like a vacant one.
 *
 * So a real-estate item may carry `units`. Each is a separately lettable part
 * with its own tenant, rent, lease and entries. The self-occupied part is a
 * unit too, flagged rather than omitted, because "you live there" and "nobody
 * is paying for it" are different facts and only the first is good news.
 *
 * ## Nothing changes for a property let as a whole
 *
 * When `units` is absent the item behaves exactly as before: `item.rental` and
 * `item.transactions` are the single tenancy. Every existing property keeps
 * working with no migration, and a one-tenant property never has to think
 * about units at all.
 *
 * ## Where entries live
 *
 *   item.transactions          whole-building costs: property tax on the
 *                              structure, a new roof, the shared water bill
 *   item.units[].transactions  that unit's rent, its deposit, its meter
 *
 * Both are summed for the property total. Keeping them apart is what lets a
 * roof repair stay a property cost instead of being arbitrarily blamed on
 * whichever shop happened to be selected.
 */

import { summariseRental, rentLedger, billLedger, expectedRentOn } from './rental.js';

export const UNIT_TYPES = {
    shop: { label: 'Shop', icon: '🏪' },
    floor: { label: 'Floor', icon: '🏢' },
    flat: { label: 'Flat', icon: '🚪' },
    room: { label: 'Room', icon: '🛏️' },
    portion: { label: 'Portion', icon: '🧱' },
    other: { label: 'Other', icon: '📦' },
};

export const unitTypeMeta = (type) => UNIT_TYPES[type] || UNIT_TYPES.other;

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/**
 * The id of the tenancy stored directly on the item, rather than in `units`.
 *
 * A property let as a whole keeps its tenancy in `item.rental` with the entries
 * in `item.transactions`, exactly as before units existed. Rather than migrate
 * that into `units[0]` when a second unit is added, it is presented *as* a unit
 * and left where it is.
 *
 * This was not the first design. The first moved the tenancy into `units[0]`
 * and cleared `item.rental` and `item.transactions` — and the write guard
 * refused it, correctly: from outside, a record that just lost its rental and
 * all four of its entries is indistinguishable from a form that rebuilt the
 * record and dropped them. The guard cannot tell "moved" from "lost", and the
 * right answer was to stop moving rather than to teach it to allow deletions.
 *
 * So nothing is ever migrated: adding units to a let property appends to
 * `units`, and both halves are read together.
 */
export const MAIN_UNIT_ID = '__main__';

/** Does this property track separate units? */
export const hasUnits = (item) => Array.isArray(item?.units) && item.units.length > 0;

/** True once a property has more than one tenancy to show. */
export const usesUnitsView = (item) => hasUnits(item);

/**
 * Every tenancy on a property: the one stored on the item, then the explicit
 * units. The synthetic first entry is marked so a caller knows to write it back
 * to `item.rental` rather than into the `units` array.
 */
export const allUnits = (item) => {
    const units = [];
    if (item?.rental) {
        units.push({
            id: MAIN_UNIT_ID,
            isMain: true,
            name: item.rental.unitName || item.name || 'Main unit',
            unitType: 'portion',
            selfOccupied: false,
            rental: item.rental,
            transactions: item.transactions || [],
        });
    }
    (item?.units || []).forEach((u) => units.push(u));
    return units;
};

export const blankUnit = () => ({
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    unitType: 'shop',
    selfOccupied: false,
    rental: null,
    transactions: [],
});

/**
 * How a unit stands right now.
 *
 * `status` separates three things that a rent figure alone confuses:
 *   self-occupied  you live or work there. It earns nothing by design.
 *   let            a tenant and a rent are recorded.
 *   vacant         lettable, and nobody is in it. This is the only one that
 *                  is a problem, and it is the one worth counting.
 */
export const unitStatus = (unit) => {
    if (unit?.selfOccupied) return 'self_occupied';
    if (unit?.rental && num(unit.rental.monthlyRent) > 0) return 'let';
    return 'vacant';
};

export const STATUS_META = {
    let: { label: 'Let', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    vacant: { label: 'Vacant', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
    self_occupied: { label: 'Self-occupied', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
};

/** Everything about one unit, ready to render. */
export const summariseUnit = (unit, asOf = new Date()) => {
    const entries = unit?.transactions || [];
    const status = unitStatus(unit);
    const summary = summariseRental(entries);
    // A self-occupied unit has no schedule to fall behind, so it is never in
    // arrears. Running the ledger on it would invent a debt you owe yourself.
    const ledger = status === 'let' ? rentLedger(unit.rental, entries, asOf) : [];
    const bills = billLedger(entries);
    const arrears = ledger.reduce((s, r) => s + r.shortfall, 0);

    return {
        unit,
        status,
        statusMeta: STATUS_META[status],
        typeMeta: unitTypeMeta(unit?.unitType),
        summary,
        ledger,
        bills,
        arrears: money(arrears),
        currentRent: status === 'let'
            ? money(expectedRentOn(unit.rental, asOf.toISOString().slice(0, 10)))
            : 0,
        entryCount: entries.length,
    };
};

/**
 * The whole property: every unit plus the building-level entries.
 *
 * `occupancy` counts only lettable units. Including the part you live in would
 * report a fully tenanted building as 75% occupied and make the number useless
 * as a prompt to do anything.
 */
export const summariseProperty = (item, asOf = new Date()) => {
    const units = allUnits(item).map((u) => summariseUnit(u, asOf));
    // When the item carries its own tenancy, its transactions belong to that
    // tenancy and are already counted as the main unit — counting them again
    // here as building-level entries would double every figure on the page.
    const propertyEntries = item?.rental ? [] : (item?.transactions || []);
    const propertySummary = summariseRental(propertyEntries);

    const lettable = units.filter((u) => u.status !== 'self_occupied');
    const let_ = units.filter((u) => u.status === 'let');
    const vacant = units.filter((u) => u.status === 'vacant');
    const selfOccupied = units.filter((u) => u.status === 'self_occupied');

    const add = (key) => units.reduce((s, u) => s + num(u.summary[key]), 0) + num(propertySummary[key]);

    const rentReceived = add('rentReceived');
    const billsBorne = add('billsBorne');
    const taxPaid = add('taxPaid');
    const maintenancePaid = add('maintenancePaid');
    const income = add('income');
    const expense = add('expense');

    return {
        units,
        propertySummary,
        propertyEntries,
        counts: {
            total: units.length,
            let: let_.length,
            vacant: vacant.length,
            selfOccupied: selfOccupied.length,
            lettable: lettable.length,
        },
        occupancyPct: lettable.length > 0 ? (let_.length / lettable.length) * 100 : null,
        monthlyRentRoll: money(units.reduce((s, u) => s + u.currentRent, 0)),
        rentReceived: money(rentReceived),
        billsBorne: money(billsBorne),
        taxPaid: money(taxPaid),
        maintenancePaid: money(maintenancePaid),
        depositHeld: money(add('depositHeld')),
        income: money(income),
        expense: money(expense),
        net: money(income - expense),
        arrears: money(units.reduce((s, u) => s + u.arrears, 0)),
        /**
         * Net income against what the property is worth.
         *
         * Null when no valuation is recorded rather than zero — a yield of 0%
         * and "we do not know what this is worth" are different statements.
         */
        yieldOnValue: num(item?.currentValue) > 0
            ? ((income - expense) / num(item.currentValue)) * 100
            : null,
    };
};

/**
 * Write a unit back into its property, in whichever place it actually lives.
 *
 * The main unit is `item.rental` plus `item.transactions`; everything else is
 * an entry in `units`. Nothing is ever moved between the two, so no write here
 * removes a key and the guard has nothing to object to.
 */
export const applyUnit = (item, unit) => {
    if (unit?.id === MAIN_UNIT_ID || unit?.isMain) {
        const { isMain, id, unitType, selfOccupied, name, transactions, rental, ...rest } = unit;
        return {
            ...item,
            rental: { ...(item.rental || {}), ...(rental || {}), unitName: name },
            transactions: transactions || item.transactions || [],
        };
    }
    const units = item?.units || [];
    const exists = units.some((u) => String(u.id) === String(unit.id));
    return {
        ...item,
        units: exists
            ? units.map((u) => (String(u.id) === String(unit.id) ? unit : u))
            : [...units, unit],
    };
};
