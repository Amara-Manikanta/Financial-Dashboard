/**
 * Warranty, receipt and service tracking for owned items.
 *
 * Everything here is derived from fields stored on an asset item; nothing is
 * duplicated into a separate collection. An item gains:
 *
 *   serialNumber, seller            — what a manufacturer asks for on a claim
 *   warrantyMonths | warrantyExpiry — cover from the manufacturer
 *   extendedMonths | extendedExpiry — a second period bought on top
 *   extendedCost                    — what that cover cost
 *   receipts[]                      — { url, name, mimeType, kind }
 *   services[]                      — { id, date, description, cost, underWarranty, provider }
 *
 * A period in months is preferred over a stored date: "2 years from purchase"
 * stays correct if the purchase date is later corrected, whereas a hard-coded
 * expiry silently keeps the old answer. An explicit date is still allowed,
 * because plans that do not start on the purchase date do exist.
 */

/** Cover lapsing within this many days is worth acting on now. */
export const EXPIRING_SOON_DAYS = 60;

const toDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);

/** Add whole months, clamping so 31 Jan + 1 month is 28/29 Feb, not 3 March. */
export const addMonths = (date, months) => {
    const d = new Date(date);
    const targetMonth = d.getMonth() + Number(months);
    const result = new Date(d);
    result.setDate(1);
    result.setMonth(targetMonth);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(d.getDate(), lastDay));
    return result;
};

export const daysBetween = (from, to) => Math.round((to - from) / 86400000);

/**
 * Expiry of one cover period. An explicit date wins; otherwise it is computed
 * from the purchase date, which is why an item with neither returns null
 * rather than pretending to be out of warranty.
 */
const periodExpiry = (item, explicitField, monthsField) => {
    const explicit = toDate(item?.[explicitField]);
    if (explicit) return explicit;
    const months = Number(item?.[monthsField]);
    const purchased = toDate(item?.purchaseDate);
    if (!months || months <= 0 || !purchased) return null;
    return addMonths(purchased, months);
};

export const manufacturerExpiry = (item) => periodExpiry(item, 'warrantyExpiry', 'warrantyMonths');
export const extendedExpiry = (item) => periodExpiry(item, 'extendedExpiry', 'extendedMonths');

/**
 * The date cover actually ends — the later of the two periods.
 * Extended cover usually starts when the manufacturer's ends, but not always,
 * so taking the maximum is the only answer that is right either way.
 */
export const coverExpiry = (item) => {
    const base = manufacturerExpiry(item);
    const ext = extendedExpiry(item);
    if (!base && !ext) return null;
    if (!base) return ext;
    if (!ext) return base;
    return ext > base ? ext : base;
};

/**
 * Warranty state of an item.
 * `unknown` is deliberately distinct from `expired`: an item nobody recorded a
 * warranty for is a gap in the records, while an expired one is a fact. Showing
 * both as "expired" would hide the items actually worth filling in.
 */
export const warrantyStatus = (item, today = new Date()) => {
    const expiry = coverExpiry(item);
    if (!expiry) {
        return { state: 'unknown', expiry: null, daysLeft: null, extended: false };
    }
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysLeft = daysBetween(now, expiry);
    const ext = extendedExpiry(item);
    const extended = Boolean(ext && ext.getTime() === expiry.getTime() && ext > (manufacturerExpiry(item) || 0));

    let state = 'active';
    if (daysLeft < 0) state = 'expired';
    else if (daysLeft <= EXPIRING_SOON_DAYS) state = 'expiring';

    return { state, expiry, expiryIso: iso(expiry), daysLeft, extended };
};

export const STATE_LABEL = {
    active: 'In warranty',
    expiring: 'Expiring soon',
    expired: 'Out of warranty',
    unknown: 'Not recorded',
};

/** Receipts attached to an item, tolerating the older single-field shapes. */
export const receiptsOf = (item) => {
    if (Array.isArray(item?.receipts)) return item.receipts.filter(Boolean);
    if (item?.receiptUrl) return [{ url: item.receiptUrl, name: 'Receipt' }];
    return [];
};

export const servicesOf = (item) => (Array.isArray(item?.services) ? item.services.filter(Boolean) : []);

/**
 * Repair spend on an item, split by whether the warranty actually paid off.
 * `covered` is the money the warranty saved — the number that answers whether
 * an extended plan was worth buying.
 */
export const serviceTotals = (item) => {
    const services = servicesOf(item);
    let paid = 0;
    let covered = 0;
    services.forEach((s) => {
        const cost = Number(s.cost) || 0;
        if (s.underWarranty) covered += cost;
        else paid += cost;
    });
    return { count: services.length, paid, covered, total: paid + covered };
};

/**
 * Did the extended cover pay for itself?
 * Only meaningful once something has actually been claimed under it.
 */
export const extendedWorthIt = (item) => {
    const cost = Number(item?.extendedCost) || 0;
    if (!cost) return null;
    const { covered } = serviceTotals(item);
    return { cost, covered, net: covered - cost };
};

/** Every item across every asset category, tagged with where it lives. */
export const allAssetItems = (assets = []) => {
    const rows = [];
    assets.forEach((category) => {
        (category.items || []).forEach((item) => {
            rows.push({
                item,
                categoryId: category.id,
                categoryName: category.title || category.category || category.name || 'Assets',
            });
        });
    });
    return rows;
};

/**
 * Items that can sensibly hold a warranty.
 *
 * Land and flats cannot, so including them would bury 16 real gadgets among
 * rows that will never have cover and make "not recorded" meaningless as a
 * worklist.
 */
export const warrantable = (assets = []) => allAssetItems(assets)
    .filter(({ categoryId, categoryName, item }) => {
        const category = assets.find((c) => String(c.id) === String(categoryId));
        if (category?.type === 'real_estate') return false;
        if (/plot|apartment|land/i.test(categoryName)) return false;
        return Boolean(item);
    });

/**
 * Warranty rows for every eligible item, soonest expiry first.
 * Items with no warranty recorded sort last: they need attention, but not
 * ahead of cover that is about to lapse.
 */
export const warrantyRows = (assets = [], today = new Date()) => warrantable(assets)
    .map((row) => ({ ...row, status: warrantyStatus(row.item, today), services: serviceTotals(row.item) }))
    .sort((a, b) => {
        if (a.status.state === 'unknown' && b.status.state !== 'unknown') return 1;
        if (b.status.state === 'unknown' && a.status.state !== 'unknown') return -1;
        if (a.status.state === 'unknown') return String(a.item.name).localeCompare(String(b.item.name));
        return a.status.daysLeft - b.status.daysLeft;
    });

/** Headline counts for the Assets page and the warranties list. */
export const summariseWarranties = (assets = [], today = new Date()) => {
    const rows = warrantyRows(assets, today);
    const by = { active: 0, expiring: 0, expired: 0, unknown: 0 };
    let missingReceipt = 0;
    rows.forEach((r) => {
        by[r.status.state] += 1;
        if (receiptsOf(r.item).length === 0) missingReceipt += 1;
    });
    return { total: rows.length, ...by, missingReceipt, rows };
};
