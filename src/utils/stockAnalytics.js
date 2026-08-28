/**
 * Portfolio analytics derived from the stock history.
 *
 * Everything here is computed from the transactions rather than from the
 * summary fields stored on each stock, because those are only rewritten when a
 * holding is next edited and can sit stale for months. The one replay lives in
 * recomputeStockMetrics; nothing in this file re-implements it.
 */
import { recomputeStockMetrics } from './investmentSync';

/** Sector and market cap are optional on a stock, and missing ones must be visible. */
export const UNCLASSIFIED = 'Unclassified';

const num = (v) => Number(v) || 0;

/** Money, to the paisa. Shares times a price routinely lands on a long float. */
const money = (v) => Math.round(num(v) * 100) / 100;

/**
 * Archiving a stock is the user saying "stop showing me this", so it is dropped
 * from every figure here — including its realised profit and dividends, which
 * would otherwise keep moving totals for a holding deliberately put away.
 *
 * Applied inside each exported function rather than left to callers, so a new
 * view cannot quietly reintroduce archived rows. A position that was simply
 * sold out is NOT archived: shares of zero means closed, and closed positions
 * are exactly what the realised figure exists to report.
 */
const visible = (stocks = []) => stocks.filter((s) => s && !s.isArchived);

/**
 * One stock, reduced to the figures the analytics views need.
 *
 * `shares` is taken from the stored field rather than the replay: a holding
 * deliberately zeroed after a delisting (Coffeeday, INOX) is not held any more,
 * whatever its history says. Money figures still come from the replay.
 */
export const stockSummary = (stock = {}) => {
    const replay = recomputeStockMetrics(stock.transactions || []);
    const shares = num(stock.shares);
    const avgCost = num(stock.avgCost) || replay.avgCost;
    const currentPrice = num(stock.currentPrice);

    const invested = shares * avgCost;
    const value = shares * currentPrice;
    const dividends = Object.values(replay.dividends || {}).reduce((a, b) => a + num(b), 0);

    return {
        id: stock.id,
        name: stock.name || stock.ticker || 'Unnamed',
        ticker: stock.ticker || '',
        sector: stock.sector || UNCLASSIFIED,
        marketCap: stock.marketCap || UNCLASSIFIED,
        shares,
        avgCost,
        currentPrice,
        invested: money(invested),
        value: money(value),
        unrealised: money(value - invested),
        unrealisedPct: invested > 0 ? ((value - invested) / invested) * 100 : 0,
        realised: money(replay.realised),
        dividends: money(dividends),
        dividendsByYear: replay.dividends || {},
        held: shares > 0,
        // A held stock with no current price is a price nobody has updated, not
        // a holding worth nothing. Left in the totals as zero it would read as a
        // 100% loss and top every "biggest loser" list on a false premise.
        priceUnknown: shares > 0 && !(currentPrice > 0),
    };
};

/** Dividend income per calendar year across the whole portfolio. */
export const dividendsByYear = (stocks = []) => {
    const years = {};
    visible(stocks).forEach((s) => {
        const { dividendsByYear: byYear } = stockSummary(s);
        Object.entries(byYear).forEach(([year, amount]) => {
            years[year] = (years[year] || 0) + num(amount);
        });
    });
    return Object.entries(years)
        .map(([year, amount]) => ({ year, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => a.year.localeCompare(b.year));
};

/** Which holdings actually pay you, biggest first. */
export const topDividendPayers = (stocks = [], limit = 6) => visible(stocks)
    .map(stockSummary)
    .filter((s) => s.dividends > 0)
    .sort((a, b) => b.dividends - a.dividends)
    .slice(0, limit);

/**
 * How much of the portfolio sits in its largest positions.
 *
 * Concentration is the risk that does not show up in a total: a portfolio can
 * look diversified across 35 names while a third of it rides on five.
 */
export const concentration = (stocks = [], topN = 5) => {
    const held = visible(stocks).map(stockSummary).filter((s) => s.held && s.value > 0);
    const total = held.reduce((sum, s) => sum + s.value, 0);
    const ranked = [...held].sort((a, b) => b.value - a.value);
    const top = ranked.slice(0, topN);
    const topValue = top.reduce((sum, s) => sum + s.value, 0);

    const bySector = {};
    held.forEach((s) => { bySector[s.sector] = (bySector[s.sector] || 0) + s.value; });
    const largestSector = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0] || [null, 0];

    return {
        total,
        top,
        topShare: total > 0 ? (topValue / total) * 100 : 0,
        largestHolding: ranked[0] || null,
        largestHoldingShare: total > 0 && ranked[0] ? (ranked[0].value / total) * 100 : 0,
        largestSector: largestSector[0],
        largestSectorShare: total > 0 ? (largestSector[1] / total) * 100 : 0,
        count: held.length,
    };
};

/** Holdings ranked by unrealised gain — what is actually driving the total. */
export const winnersAndLosers = (stocks = [], limit = 5) => {
    const held = visible(stocks).map(stockSummary)
        .filter((s) => s.held && s.invested > 0 && !s.priceUnknown);
    const ranked = [...held].sort((a, b) => b.unrealised - a.unrealised);
    return {
        winners: ranked.filter((s) => s.unrealised > 0).slice(0, limit),
        losers: ranked.filter((s) => s.unrealised < 0).reverse().slice(0, limit),
    };
};

/**
 * Holdings with no sector or no market cap.
 *
 * These are not merely untidy: an allocation chart silently drops or lumps
 * them, so the percentages already on screen are wrong by exactly this much.
 */
export const unclassified = (stocks = []) => {
    const held = visible(stocks).map(stockSummary).filter((s) => s.held);
    const priced = held.filter((s) => s.value > 0);
    const noSector = priced.filter((s) => s.sector === UNCLASSIFIED);
    const noCap = priced.filter((s) => s.marketCap === UNCLASSIFIED);
    // Reported alongside the classification gaps because it has the same effect:
    // the holding is missing from figures that claim to cover the portfolio.
    const noPrice = held.filter((s) => s.priceUnknown);
    return {
        noSector,
        noCap,
        noPrice,
        noSectorValue: noSector.reduce((sum, s) => sum + s.value, 0),
        noCapValue: noCap.reduce((sum, s) => sum + s.value, 0),
        noPriceCost: noPrice.reduce((sum, s) => sum + s.invested, 0),
        any: noSector.length > 0 || noCap.length > 0 || noPrice.length > 0,
    };
};

/**
 * The three ways a portfolio makes money, which the page previously reduced to
 * one. Unrealised is what the holdings are worth now; realised is what closed
 * positions actually banked; dividends are cash that arrived regardless of price.
 */
export const portfolioTotals = (stocks = []) => {
    const all = visible(stocks).map(stockSummary);
    const held = all.filter((s) => s.held);

    const invested = held.reduce((sum, s) => sum + s.invested, 0);
    const value = held.reduce((sum, s) => sum + s.value, 0);
    const realised = all.reduce((sum, s) => sum + s.realised, 0);
    const dividends = all.reduce((sum, s) => sum + s.dividends, 0);

    return {
        invested: money(invested),
        value: money(value),
        unrealised: money(value - invested),
        unrealisedPct: invested > 0 ? ((value - invested) / invested) * 100 : 0,
        realised: money(realised),
        dividends: money(dividends),
        // Yield measured against what was paid, not today's price — it answers
        // "what is this portfolio returning me in cash", which market value moves
        // around for reasons that have nothing to do with the dividend.
        yieldOnCost: invested > 0 ? (dividends / invested) * 100 : 0,
        lifetime: money((value - invested) + realised + dividends),
        heldCount: held.length,
        exitedCount: all.length - held.length,
    };
};

/**
 * Positions whose realised figure is large enough to dominate every total.
 *
 * Surfaced deliberately: one imported position here carries a realised loss
 * several times the size of the whole current portfolio, and a lifetime-return
 * headline that quietly includes it would be misleading rather than wrong.
 */
export const realisedOutliers = (stocks = [], multipleOfPortfolio = 1) => {
    const all = visible(stocks).map(stockSummary);
    const value = all.filter((s) => s.held).reduce((sum, s) => sum + s.value, 0);
    if (value <= 0) return [];
    return all
        .filter((s) => Math.abs(s.realised) > value * multipleOfPortfolio)
        .sort((a, b) => Math.abs(b.realised) - Math.abs(a.realised));
};
