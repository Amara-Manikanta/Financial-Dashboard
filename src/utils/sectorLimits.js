/**
 * Sector concentration against limits the user sets.
 *
 * The limits are entered, never suggested. There is no defensible "correct"
 * weight for a sector — it depends on conviction, income, and everything else
 * someone owns — so a default would be this app inventing a rule and then
 * warning you for breaking it.
 *
 * Stored on the stock market record as `sectorLimits: { "Financials": 25, ... }`,
 * a plain percentage cap per sector.
 */
import { sectorFor } from './sectors.js';

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/** Current market value per sector, across held positions only. */
export const sectorWeights = (stocks = []) => {
    const held = (stocks || []).filter((s) => s && !s.isArchived && num(s.shares) > 0);
    const byValue = {};
    let total = 0;
    held.forEach((s) => {
        const value = num(s.shares) * num(s.currentPrice);
        if (value <= 0) return;
        const key = sectorFor(s.sector, null);
        byValue[key] = (byValue[key] || 0) + value;
        total += value;
    });
    return {
        total: money(total),
        rows: Object.entries(byValue)
            .map(([sector, value]) => ({
                sector,
                value: money(value),
                pct: total > 0 ? (value / total) * 100 : 0,
            }))
            .sort((a, b) => b.value - a.value),
    };
};

/**
 * Which sectors are over the cap set for them.
 *
 * A sector with no limit is not "within limits" — it is unmeasured, and the two
 * are reported separately so an empty warning list cannot be mistaken for
 * approval of the whole portfolio.
 */
export const sectorBreaches = (stocks = [], limits = {}) => {
    const { rows, total } = sectorWeights(stocks);
    const withLimit = rows.filter((r) => num(limits[r.sector]) > 0);
    const breaches = withLimit
        .filter((r) => r.pct > num(limits[r.sector]))
        .map((r) => ({
            ...r,
            limit: num(limits[r.sector]),
            overBy: r.pct - num(limits[r.sector]),
            excessValue: money(((r.pct - num(limits[r.sector])) / 100) * total),
        }))
        .sort((a, b) => b.overBy - a.overBy);

    return {
        total,
        rows,
        breaches,
        limitedCount: withLimit.length,
        unlimitedCount: rows.length - withLimit.length,
    };
};
