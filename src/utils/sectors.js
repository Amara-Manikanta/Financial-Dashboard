/**
 * One sector vocabulary.
 *
 * The app had two, and they never met:
 *
 *   the stock picker   Financials, Health Care, Consumer Discretionary, ...
 *                      (GICS, in StockMarketDetails.OFFICIAL_SECTORS)
 *
 *   nifty50Data        Financial Services, Healthcare, Automobile, Oil & Gas, ...
 *                      (an NSE-flavoured list)
 *
 * The consolidated exposure page reads only the second, so a stock outside the
 * benchmark tables was labelled `Other` even when the user had classified it —
 * KFin Technologies sat in "Other" while its own record said "Financials". Nine
 * of thirty-four held stocks were affected, every one of them with a sector
 * already set.
 *
 * Simply falling back to the stock's own value would have been worse: the page
 * would then show "Financials" and "Financial Services" as two separate
 * sectors, splitting one exposure across two rows.
 *
 * So both vocabularies normalise here, onto the GICS names the picker offers —
 * that is the list the user actually chooses from, and the one a reader is
 * likely to recognise.
 */

/** The canonical set. Matches OFFICIAL_SECTORS in StockMarketDetails. */
export const CANONICAL_SECTORS = [
    'Information Technology',
    'Financials',
    'Health Care',
    'Consumer Discretionary',
    'Consumer Staples',
    'Industrials',
    'Communication Services',
    'Energy',
    'Utilities',
    'Materials',
    'Real Estate',
];

export const UNCLASSIFIED_SECTOR = 'Other';

/**
 * Aliases onto the canonical names, keyed lowercase.
 *
 * Several NSE sectors have no exact GICS twin and are mapped to the closest
 * one: Capital Goods and Construction both sit under Industrials, Chemicals and
 * Construction Materials under Materials. That is a judgement, but a consistent
 * one — and far better than the same company appearing twice.
 */
const ALIASES = {
    // NSE-flavoured -> GICS
    'financial services': 'Financials',
    'finance': 'Financials',
    'banking': 'Financials',
    'healthcare': 'Health Care',
    'pharma': 'Health Care',
    'pharmaceuticals': 'Health Care',
    'automobile': 'Consumer Discretionary',
    'auto': 'Consumer Discretionary',
    'consumer durables': 'Consumer Discretionary',
    'consumer goods (fmcg)': 'Consumer Staples',
    'fmcg': 'Consumer Staples',
    'consumer goods': 'Consumer Staples',
    'capital goods': 'Industrials',
    'construction': 'Industrials',
    'services': 'Industrials',
    'infrastructure': 'Industrials',
    'chemicals': 'Materials',
    'construction materials': 'Materials',
    'metals & mining': 'Materials',
    'metals': 'Materials',
    'cement': 'Materials',
    'oil & gas': 'Energy',
    'oil and gas': 'Energy',
    'power': 'Utilities',
    'telecommunication': 'Communication Services',
    'telecom': 'Communication Services',
    'media': 'Communication Services',
    'realty': 'Real Estate',
    'it': 'Information Technology',
    'technology': 'Information Technology',
};

/**
 * A sector name in the canonical vocabulary.
 *
 * Anything unrecognised is returned as `Other` rather than passed through, so a
 * typo cannot quietly create an eighteenth sector that looks legitimate.
 */
export const normaliseSector = (sector) => {
    const raw = String(sector || '').trim();
    if (!raw) return UNCLASSIFIED_SECTOR;

    const exact = CANONICAL_SECTORS.find((s) => s.toLowerCase() === raw.toLowerCase());
    if (exact) return exact;

    return ALIASES[raw.toLowerCase()] || UNCLASSIFIED_SECTOR;
};

/**
 * The sector to use for a holding, in priority order.
 *
 * The stock's own value wins: it is what a person deliberately chose on that
 * record. The benchmark table is the fallback for anything never classified.
 */
export const sectorFor = (stockSector, benchmarkSector) => {
    const own = normaliseSector(stockSector);
    if (own !== UNCLASSIFIED_SECTOR) return own;
    return normaliseSector(benchmarkSector);
};

/** Market-cap band, same priority: the record's own value before a guess. */
export const capFor = (stockCap, benchmarkCap, fallback = 'Mid Cap') =>
    (stockCap && String(stockCap).trim()) || benchmarkCap || fallback;
