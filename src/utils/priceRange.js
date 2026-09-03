/**
 * Where a price sits, and the thresholds someone asked to be told about.
 *
 * Deliberately descriptive. Nothing here decides whether a stock is worth
 * buying — it reports where the price is in its own recent range and whether a
 * level the user set has been crossed. A holding sitting at its 52-week low is
 * a fact; whether that is an opportunity or a warning is not something a
 * portfolio tracker can know, and dressing one up as the other would be worse
 * than showing nothing.
 *
 * Shared by holdings and the watchlist, which need exactly the same reading of
 * exactly the same quote.
 */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const money = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** Within this much of an extreme counts as "at" it, for flagging purposes. */
export const NEAR_EDGE_PCT = 15;

/**
 * A stock's quote, read into the numbers a person actually looks at.
 *
 * `rangePct` is the position between the 52-week low and high: 0 means sitting
 * on the low, 100 on the high. It is null when either bound is missing, rather
 * than defaulting to something that would render as a confident 0%.
 */
export const readQuote = (holding = {}) => {
    const q = holding.quote || {};
    const price = num(q.price) ?? num(holding.currentPrice);
    const low = num(q.fiftyTwoWeekLow);
    const high = num(q.fiftyTwoWeekHigh);
    const prev = num(q.previousClose);

    const hasRange = low !== null && high !== null && high > low && price !== null;
    const rangePct = hasRange ? ((price - low) / (high - low)) * 100 : null;

    const dayChange = prev !== null && price !== null ? price - prev : null;
    const dayChangePct = prev !== null && prev > 0 && price !== null
        ? ((price - prev) / prev) * 100
        : null;

    return {
        price,
        previousClose: prev,
        low,
        high,
        hasRange,
        rangePct,
        dayChange: dayChange === null ? null : money(dayChange),
        dayChangePct,
        /** How far above the 52-week low, as a share of the low. */
        aboveLowPct: hasRange && low > 0 ? ((price - low) / low) * 100 : null,
        /** How far below the 52-week high. */
        belowHighPct: hasRange && high > 0 ? ((high - price) / high) * 100 : null,
        nearLow: rangePct !== null && rangePct <= NEAR_EDGE_PCT,
        nearHigh: rangePct !== null && rangePct >= 100 - NEAR_EDGE_PCT,
        tradedAt: q.tradedAt || null,
        volume: num(q.volume),
    };
};

export const ALERT_TYPES = ['below', 'above'];

/**
 * Which of a holding's alerts the current price has crossed.
 *
 * The thresholds belong to the user; this only reports whether the price is on
 * the far side of one. No alert is ever created automatically, because a level
 * nobody chose is a recommendation wearing a number.
 */
export const triggeredAlerts = (holding = {}) => {
    const price = num(holding.quote?.price) ?? num(holding.currentPrice);
    if (price === null) return [];
    return (holding.alerts || []).filter((a) => {
        const target = num(a?.price);
        if (target === null) return false;
        return a.type === 'below' ? price <= target : price >= target;
    }).map((a) => ({ ...a, currentPrice: price }));
};

/** Every alert across a set of holdings that is currently crossed. */
export const allTriggered = (holdings = []) => (holdings || [])
    .filter((h) => h && !h.isArchived)
    .flatMap((h) => triggeredAlerts(h).map((a) => ({
        ...a,
        holdingId: h.id,
        holdingName: h.name || h.ticker,
        ticker: h.ticker,
    })));

/** Holdings sitting at either end of their 52-week range. */
export const atRangeEdges = (holdings = []) => {
    const rows = (holdings || [])
        .filter((h) => h && !h.isArchived)
        .map((h) => ({ ...readQuote(h), id: h.id, name: h.name || h.ticker, ticker: h.ticker }))
        .filter((r) => r.hasRange);
    return {
        nearLow: rows.filter((r) => r.nearLow).sort((a, b) => a.rangePct - b.rangePct),
        nearHigh: rows.filter((r) => r.nearHigh).sort((a, b) => b.rangePct - a.rangePct),
    };
};

/** Ready to store on a holding. */
export const writeAlert = (form) => ({
    id: form.id || `al_${Date.now()}`,
    type: ALERT_TYPES.includes(form.type) ? form.type : 'below',
    price: Number(form.price) || 0,
    note: String(form.note || '').trim(),
});
