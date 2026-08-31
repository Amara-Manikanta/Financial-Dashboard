/**
 * What a fund actually holds.
 *
 * Until now the only fund composition in the app lived in utils/nifty50Data.js:
 * four hardcoded tables, edited by hand, covering four of six funds and — for
 * the actively managed ones — only part of each:
 *
 *     Nifty 50        50 constituents   97.1% of the fund
 *     Nifty Next 50   33 of 50          75.2%
 *     HDFC Flexi Cap  20                69.8%
 *     SBI Small Cap   14                40.4%
 *
 * A breakdown built on that is not wrong so much as quietly incomplete: the
 * Nifty Next 50 overlap silently omits a quarter of the fund, and SBI Small Cap
 * omits three fifths, with nothing on screen saying so.
 *
 * So composition moves onto the fund record itself:
 *
 *     fund.composition = {
 *       asOf: '2026-08-31',              // the disclosure this came from
 *       source: 'AMC monthly factsheet', // free text, for provenance
 *       holdings: [
 *         { symbol, name, weight, sector, assetClass, rating }
 *       ]
 *     }
 *
 * Any fund can carry one, including the debt funds that have no equity to
 * overlap at all — a corporate bond fund's holdings are issuers and ratings,
 * not shares, and `assetClass` keeps the two from being added together.
 *
 * The static tables remain as a fallback so nothing regresses while records are
 * filled in, but a stored composition always wins: it is the one a human
 * actually checked against a disclosure.
 */
import {
    NIFTY_50_STOCKS,
    NIFTY_NEXT_50_STOCKS,
    HDFC_FLEXI_CAP_WEIGHTS,
    SBI_SMALL_CAP_WEIGHTS,
} from './nifty50Data.js';

const num = (v) => Number(v) || 0;

/** Weights are percentages; keep them to two places so they sum predictably. */
const pct = (v) => Math.round(num(v) * 100) / 100;

export const ASSET_CLASSES = ['equity', 'debt', 'cash', 'other'];

/**
 * The legacy tables, keyed by the same title substrings the exposure page
 * matches on. Kept in one place so the fallback cannot drift away from what
 * Nifty50Exposure does.
 */
const STATIC_TABLES = [
    {
        match: (t) => t.includes('nippon') && t.includes('nifty 50'),
        label: 'Nifty 50 index (built-in table)',
        rows: () => NIFTY_50_STOCKS,
    },
    {
        match: (t) => t.includes('icici') && t.includes('next 50'),
        label: 'Nifty Next 50 index (built-in table)',
        rows: () => NIFTY_NEXT_50_STOCKS,
    },
    {
        match: (t) => t.includes('hdfc flexi'),
        label: 'HDFC Flexi Cap (built-in table)',
        rows: () => HDFC_FLEXI_CAP_WEIGHTS,
    },
    {
        match: (t) => t.includes('sbi small'),
        label: 'SBI Small Cap (built-in table)',
        rows: () => SBI_SMALL_CAP_WEIGHTS,
    },
];

/** The static tables are arrays in two places and objects in two others. */
const normaliseRows = (rows) => {
    if (!rows) return [];
    const list = Array.isArray(rows)
        ? rows
        : Object.entries(rows).map(([symbol, v]) => (
            v && typeof v === 'object' ? { symbol, ...v } : { symbol, weight: v }
        ));
    return list.map((r) => ({
        symbol: String(r.symbol || '').toUpperCase(),
        name: r.name || r.symbol || '',
        weight: pct(r.weight),
        sector: r.sector || 'Other',
        assetClass: r.assetClass || 'equity',
        rating: r.rating || '',
    })).filter((r) => r.symbol);
};

const staticFor = (fund) => {
    const title = String(fund?.title || '').toLowerCase();
    const table = STATIC_TABLES.find((t) => t.match(title));
    if (!table) return null;
    return { asOf: '', source: table.label, holdings: normaliseRows(table.rows()), stored: false };
};

/**
 * A fund's composition in one shape, whichever way it is available.
 *
 * `coverage` is the point of this function. A caller that renders holdings
 * without it will present a partial list as if it were the whole fund, which is
 * the failure this module exists to end.
 */
export const readComposition = (fund) => {
    const storedHoldings = fund?.composition?.holdings;
    const base = Array.isArray(storedHoldings) && storedHoldings.length > 0
        ? {
            asOf: fund.composition.asOf || '',
            source: fund.composition.source || '',
            holdings: normaliseRows(storedHoldings),
            stored: true,
        }
        : staticFor(fund);

    if (!base) {
        return { asOf: '', source: '', holdings: [], stored: false, coverage: 0, unmapped: 100, has: false };
    }

    const holdings = [...base.holdings].sort((a, b) => b.weight - a.weight);
    const coverage = pct(holdings.reduce((sum, h) => sum + h.weight, 0));

    return {
        ...base,
        holdings,
        coverage,
        // What the disclosure does not account for. Never silently dropped —
        // callers render it as its own row.
        unmapped: pct(Math.max(0, 100 - coverage)),
        has: holdings.length > 0,
    };
};

/** Composition with each holding priced against the fund's current value. */
export const valuedComposition = (fund, fundValue) => {
    const comp = readComposition(fund);
    const value = num(fundValue);
    return {
        ...comp,
        fundValue: value,
        holdings: comp.holdings.map((h) => ({ ...h, value: (value * h.weight) / 100 })),
        unmappedValue: (value * comp.unmapped) / 100,
    };
};

/** Weight by asset class, so debt and equity are never summed into one figure. */
export const byAssetClass = (fund) => {
    const { holdings } = readComposition(fund);
    const totals = {};
    holdings.forEach((h) => {
        const k = ASSET_CLASSES.includes(h.assetClass) ? h.assetClass : 'other';
        totals[k] = pct((totals[k] || 0) + h.weight);
    });
    return totals;
};

/**
 * Is this composition trustworthy enough to build figures on?
 *
 * Deliberately strict. A table covering 40% of a fund can still be worth
 * showing, but a caller must never treat it as the fund.
 */
export const COMPLETE_ENOUGH = 90;
export const isComplete = (fund) => readComposition(fund).coverage >= COMPLETE_ENOUGH;

/** Ready to write back onto the fund record. Weights are not renormalised —
 *  a disclosure that sums to 74% is recorded as 74%, not inflated to look whole. */
export const writeComposition = ({ asOf, source, holdings }) => ({
    asOf: asOf || '',
    source: source || '',
    holdings: normaliseRows(holdings).map((h) => ({
        symbol: h.symbol,
        name: h.name,
        weight: h.weight,
        sector: h.sector,
        assetClass: h.assetClass,
        ...(h.rating ? { rating: h.rating } : {}),
    })),
});

/** How stale a composition is, in days. Fund portfolios move monthly. */
export const ageInDays = (fund, now = new Date()) => {
    const { asOf } = readComposition(fund);
    if (!asOf) return null;
    const d = new Date(asOf);
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.round((now - d) / 86400000));
};
