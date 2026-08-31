/**
 * NPS holdings are stored under one set of names and were read under another.
 *
 * The records on disk carry `issueName`, `currentPrice` and `purchasePrice`;
 * the modals read `scheme` and `nav`. Nothing mapped between them, so the
 * scheme dropdown in the statement modal rendered three blank options and the
 * Edit form opened empty — and saving that empty form would have written
 * `scheme: ""` and `nav: NaN` alongside the real fields, splitting one holding
 * into two half-records.
 *
 * NPSDetails already worked around it inline (`h.scheme || h.name ||
 * h.issueName`), spelled out in four separate places. This is that fallback,
 * written once.
 *
 * The stored names win, because the data is the part that cannot be
 * regenerated. Reads accept either. Same contract as utils/sgb.js.
 */

const firstDefined = (...values) => values.find(v => v !== undefined && v !== null && v !== '');

/** A holding in the shape the UI works with, whichever way it was stored. */
export const readHolding = (holding = {}) => ({
    id: holding.id,
    scheme: firstDefined(holding.issueName, holding.scheme, holding.name) || '',
    nav: Number(firstDefined(holding.currentPrice, holding.nav, 0)) || 0,
    units: Number(firstDefined(holding.units, 0)) || 0,
    purchasePrice: Number(firstDefined(holding.purchasePrice, 0)) || 0,
    transactions: holding.transactions || [],
});

/**
 * The scheme's display name, with a label rather than an empty string.
 *
 * A blank <option> is indistinguishable from a broken dropdown, which is
 * exactly how this bug presented, so an unnamed holding still gets something
 * selectable.
 */
export const schemeName = (holding) => readHolding(holding).scheme || 'NPS Scheme';

/** Just the fund family — "ICICI Prudential Pension Fund Scheme C - Tier 1" → "…Scheme C". */
export const shortSchemeName = (holding) => schemeName(holding).split('-')[0].trim();

/**
 * Back to the stored shape.
 * `existing` is spread first so transactions, units and anything else the form
 * does not edit survive the round trip — the form knows two fields, the
 * holding has six.
 */
export const writeHolding = (form, existing = {}) => ({
    ...existing,
    id: existing.id ?? form.id ?? Date.now(),
    issueName: form.scheme,
    currentPrice: Number(form.nav) || 0,
});
