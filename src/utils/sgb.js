/**
 * Sovereign Gold Bond holdings are stored under one set of names and were read
 * under another.
 *
 * The record on disk uses `issueName`, `issueDate` and `purchasePrice`; the page
 * and its modal both read `series`, `date` and `issuePrice`. Nothing mapped
 * between them, so the holdings table rendered a blank series, a blank date, a
 * blank issue price and NaN for gain — and opening Edit showed an empty form,
 * which on save would have written the second shape and lost the first.
 *
 * The stored names win, because the data is the part that cannot be
 * regenerated. Reads accept either.
 */

const firstDefined = (...values) => values.find(v => v !== undefined && v !== null && v !== '');

/** A holding in the shape the UI works with, whichever way it was stored. */
export const readHolding = (holding = {}) => ({
    id: holding.id,
    series: firstDefined(holding.issueName, holding.series) || '',
    date: firstDefined(holding.issueDate, holding.date) || '',
    units: Number(firstDefined(holding.units, 0)) || 0,
    issuePrice: Number(firstDefined(holding.purchasePrice, holding.issuePrice, 0)) || 0,
    currentPrice: Number(firstDefined(holding.currentPrice, 0)) || 0,
    maturityDate: holding.maturityDate || '',
});

/**
 * Back to the stored shape.
 * `existing` is spread first so anything the form does not edit — and the
 * holding's own id — survives the round trip.
 */
export const writeHolding = (form, existing = {}) => ({
    ...existing,
    id: existing.id || `sgb_${Date.now()}`,
    issueName: form.series,
    issueDate: form.date,
    units: Number(form.units) || 0,
    purchasePrice: Number(form.issuePrice) || 0,
    currentPrice: Number(form.currentPrice) || 0,
    maturityDate: form.maturityDate || '',
});

/** Current value of one holding. */
export const holdingValue = (holding) => {
    const h = readHolding(holding);
    return h.units * h.currentPrice;
};

/** Unrealised gain on one holding. */
export const holdingGain = (holding) => {
    const h = readHolding(holding);
    return (h.currentPrice - h.issuePrice) * h.units;
};

/** Total current value across every holding — what the savings row stores. */
export const totalValue = (holdings = []) =>
    holdings.reduce((sum, h) => sum + holdingValue(h), 0);
