/**
 * IPOs applied for — including the ones that came to nothing.
 *
 * The app only ever knew about IPOs that were allotted, because an allotment
 * becomes an `ipo` transaction on a stock and an application that failed leaves
 * no trace anywhere: not in the holdings, not in the bank import, not in
 * expenses. Two allotments were on record and no way to tell whether they came
 * from three applications or thirty.
 *
 * That missing denominator is the point of this module. An allotment rate, the
 * capital an application ties up, and how long it stays tied up are all
 * invisible without the failures.
 *
 * An allotment is NOT re-recorded here. `linkedStockId` points at the holding
 * the allotment created, so the shares live in exactly one place — recording
 * them twice is how the dividend and payroll-tax totals went wrong before.
 */

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

export const IPO_STATUSES = ['applied', 'allotted', 'partial', 'not-allotted', 'withdrawn'];
export const IPO_CATEGORIES = ['retail', 'shareholder', 'employee', 'hni', 'sme'];

/** Still waiting on a result — money is blocked and the outcome is unknown. */
export const isPending = (app) => app?.status === 'applied';

/** Any allotment at all, full or partial. */
export const wasAllotted = (app) => app?.status === 'allotted' || app?.status === 'partial';

/**
 * Decided applications only — the ones that can fairly be scored.
 *
 * A pending application is not a failure, and counting it as one would drag the
 * allotment rate down for no reason other than the registrar being slow.
 */
export const isDecided = (app) => wasAllotted(app) || app?.status === 'not-allotted';

/**
 * One application, with what it cost and what it returned.
 *
 * Listing gain is measured against the price actually paid rather than the
 * upper band: a cut-off application is filled at the issue price, and comparing
 * to anything else invents a gain that never existed.
 */
export const applicationResult = (app = {}) => {
    const lots = num(app.lots);
    const perLot = num(app.sharesPerLot);
    const price = num(app.cutOffPrice);
    const sharesApplied = lots * perLot;

    // Stored if entered, otherwise the obvious product — ASBA blocks the full
    // application value regardless of what is later allotted.
    const blocked = num(app.amountBlocked) || sharesApplied * price;

    const allotted = wasAllotted(app) ? num(app.sharesAllotted) : 0;
    const investedAtAllotment = allotted * price;
    const refunded = Math.max(0, blocked - investedAtAllotment);

    const listingPrice = num(app.listingPrice);
    const hasListing = wasAllotted(app) && listingPrice > 0 && price > 0;
    const listingGain = hasListing ? allotted * (listingPrice - price) : 0;

    // How long the money was unavailable. Refund and allotment dates are the
    // same event from the two sides, so either will do.
    const start = app.appliedDate ? new Date(app.appliedDate) : null;
    const endRaw = app.refundDate || app.allotmentDate || null;
    const end = endRaw ? new Date(endRaw) : null;
    const daysBlocked = start && end && !Number.isNaN(start) && !Number.isNaN(end)
        ? Math.max(0, Math.round((end - start) / 86400000))
        : null;

    return {
        id: app.id,
        company: app.company || 'Unnamed IPO',
        symbol: app.symbol || '',
        category: app.category || 'retail',
        status: app.status || 'applied',
        appliedDate: app.appliedDate || '',
        listingDate: app.listingDate || '',
        lots,
        sharesApplied,
        sharesAllotted: allotted,
        cutOffPrice: price,
        listingPrice,
        amountBlocked: money(blocked),
        investedAtAllotment: money(investedAtAllotment),
        refunded: money(refunded),
        listingGain: money(listingGain),
        listingGainPct: hasListing && price > 0 ? ((listingPrice - price) / price) * 100 : null,
        hasListing,
        daysBlocked,
        pending: isPending(app),
        allotted: wasAllotted(app),
        decided: isDecided(app),
        linkedStockId: app.linkedStockId || null,
        notes: app.notes || '',
    };
};

/** Newest application first. */
export const rankedApplications = (apps = []) => (apps || [])
    .map(applicationResult)
    .sort((a, b) => String(b.appliedDate).localeCompare(String(a.appliedDate)));

/**
 * Portfolio-level view of an IPO habit.
 *
 * `allotmentRate` is measured over decided applications only, and `coverage`
 * says how much of the picture is actually recorded — a rate computed from
 * three remembered applications is not a fact about ten years of applying, and
 * the page has to be able to say so.
 */
export const ipoSummary = (apps = [], stocks = []) => {
    const rows = rankedApplications(apps);
    const decided = rows.filter((r) => r.decided);
    const allotted = rows.filter((r) => r.allotted);
    const pending = rows.filter((r) => r.pending);
    const withListing = allotted.filter((r) => r.hasListing);

    // Allotments already recorded as `ipo` transactions on a holding. Any that
    // no application points at is a gap in this record, not a missing holding.
    const ipoStocks = (stocks || []).filter((s) => s
        && (s.transactions || []).some((t) => t.type === 'ipo'));
    const linked = new Set(rows.map((r) => String(r.linkedStockId)).filter(Boolean));
    const unlinkedAllotments = ipoStocks.filter((s) => !linked.has(String(s.id)));

    return {
        total: rows.length,
        decidedCount: decided.length,
        allottedCount: allotted.length,
        pendingCount: pending.length,
        allotmentRate: decided.length > 0 ? (allotted.length / decided.length) * 100 : null,
        capitalBlockedNow: money(pending.reduce((s, r) => s + r.amountBlocked, 0)),
        totalApplied: money(rows.reduce((s, r) => s + r.amountBlocked, 0)),
        totalInvested: money(allotted.reduce((s, r) => s + r.investedAtAllotment, 0)),
        totalRefunded: money(rows.reduce((s, r) => s + r.refunded, 0)),
        listingGain: money(withListing.reduce((s, r) => s + r.listingGain, 0)),
        listingGainCount: withListing.length,
        missingListingPrice: allotted.length - withListing.length,
        // An allotment on a holding with no application recorded against it.
        unlinkedAllotments: unlinkedAllotments.map((s) => ({ id: s.id, name: s.name || s.ticker })),
    };
};

/** Ready to store. Blank optional fields are dropped rather than saved empty. */
export const writeApplication = (form) => {
    const out = {
        id: form.id || `ipo_${Date.now()}`,
        company: String(form.company || '').trim(),
        symbol: String(form.symbol || '').trim().toUpperCase(),
        category: IPO_CATEGORIES.includes(form.category) ? form.category : 'retail',
        status: IPO_STATUSES.includes(form.status) ? form.status : 'applied',
        appliedDate: form.appliedDate || '',
        lots: num(form.lots),
        sharesPerLot: num(form.sharesPerLot),
        cutOffPrice: num(form.cutOffPrice),
    };
    const optional = {
        amountBlocked: num(form.amountBlocked),
        sharesAllotted: num(form.sharesAllotted),
        listingPrice: num(form.listingPrice),
        allotmentDate: form.allotmentDate,
        refundDate: form.refundDate,
        listingDate: form.listingDate,
        linkedStockId: form.linkedStockId,
        notes: String(form.notes || '').trim(),
    };
    Object.entries(optional).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== 0) out[k] = v;
    });
    return out;
};
