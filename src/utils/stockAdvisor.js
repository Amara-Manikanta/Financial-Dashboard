/**
 * The stock analyst.
 *
 * Reads the portfolio the way a careful adviser would and says what, if
 * anything, is worth doing about it — each suggestion carrying the figures that
 * justify it and naming the rule that raised it. The Analyst page draws these;
 * the optional local model only puts them in order and in plain words. Nothing
 * here writes.
 *
 * ## Where the judgement comes from
 *
 * The rest of the app is deliberately descriptive: a price near its 52-week low
 * is "a position in a range", and sector limits are "entered, never
 * suggested". This module is the one place that turns facts into suggestions,
 * because that is its job — so it holds itself to three rules instead:
 *
 *   1. Your rules first. Sector limits, price alerts and watchlist priority are
 *      yours, and crossing one of them is the strongest signal here.
 *   2. Outside rules are named. Where no rule of yours exists, the line is an
 *      established external one — SEBI's 10% single-company cap for a
 *      diversified fund, the Income Tax Act's rates and exemption — and every
 *      finding says which rule raised it.
 *   3. Tax comes from the Capital Gains ledger, not from here. A suggested sale
 *      is run through matchLots and gainsLedger as if it had happened, so FIFO
 *      lots, set-off, carried losses and the ₹1.25L exemption apply exactly as
 *      they do on the Capital Gains page. Nothing below re-derives a tax rule.
 *
 * Nothing here predicts prices. "Down 30% and the fundamentals check fails" is
 * a reason to re-read why you own something, not a forecast.
 *
 * Callers pass the holdings that are actually theirs (`ownHoldings`), archived
 * ones included: archived positions are left out of every suggestion, but their
 * sales are real disposals and the year's tax cannot be computed without them.
 */
import { stockSummary } from './stockAnalytics.js';
import {
    matchLots, disposalsForStocks, gainsLedger, fyFor, exemptionFor,
    isLongTerm, longTermFrom, calendarDay,
} from './capitalGains.js';
import { sectorBreaches, sectorWeights } from './sectorLimits.js';
import { sectorFor } from './sectors.js';
import { readQuote, triggeredAlerts } from './priceRange.js';
import { lapsedPayers } from './dividendAnalytics.js';
import { closeOnOrBefore } from './benchmark.js';
import { stockCashflows } from './xirr.js';
import { priorityOf, riskOf } from './watchlistRisk.js';

/**
 * Every threshold the analyst uses, in one place, so the page can show them.
 *
 * Only the first is a judgement about markets, and it is SEBI's, not ours. The
 * rest decide when a finding is big enough to be worth someone's attention.
 */
export const RULES = Object.freeze({
    /** SEBI: a diversified equity mutual fund may hold at most 10% of its assets in one company. */
    maxPositionPct: 10,
    /** Twice the fund cap: urgent rather than worth a look. */
    urgentPositionPct: 20,
    /** A trim smaller than this is noise, not a decision. */
    minTrimValue: 5000,
    /** Gains worth booking tax-free before the year ends — about ₹1,250 of future tax. */
    minHarvestGain: 10000,
    /** Below this, one holding's share of a harvest is not worth a trade. */
    minHarvestPerHolding: 1000,
    /** A loss is worth booking only if it cuts this year's tax by at least this much. */
    minTaxSaving: 1000,
    /** How far ahead a lot turning long term is worth waiting for. */
    waitWindowDays: 60,
    minWaitSaving: 500,
    /** STT (0.1% each side), stamp duty and exchange charges on a sell-and-rebuy, as % of the amount sold. */
    roundTripCostPct: 0.25,
    /** A holding this far behind the index, on the same cash flows, is worth questioning. */
    laggardGapPct: 20,
    laggardMinGap: 5000,
    laggardMinDays: 365,
    /** Tax suggestions this close to 31 March become urgent. */
    fyEndUrgentDays: 45,
    /** Prices older than this make every suggestion suspect. */
    stalePriceHours: 24,
});

export const SEVERITIES = ['act', 'review', 'info'];
const SEVERITY_RANK = { act: 0, review: 1, info: 2 };

/** Every rupee comparison allows this much for rounding inside the ledger. */
const TAX_TOLERANCE = 1;
const DAY = 86400000;

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;
const inr = (v) => `${num(v) < 0 ? '−' : ''}₹${Math.round(Math.abs(num(v))).toLocaleString('en-IN')}`;
const pct = (v, digits = 1) => `${num(v).toFixed(digits)}%`;
const signedPct = (v, digits = 1) => `${num(v) >= 0 ? '+' : '−'}${Math.abs(num(v)).toFixed(digits)}%`;
const signedInr = (v) => `${num(v) >= 0 ? '+' : ''}${inr(v)}`;
const count = (q) => (Number.isInteger(q) ? q.toLocaleString('en-IN') : q.toFixed(2));
const sharesOf = (q) => `${count(q)} share${q === 1 ? '' : 's'}`;
const sum = (rows, key) => rows.reduce((s, r) => s + num(r[key]), 0);
const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / DAY);
/** "31 Mar 2027". Dates here are calendar days stored at UTC midnight. */
const readable = (iso) => new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

/** The Yahoo symbol for a holding or watchlist entry — the same rule the price refresh uses. */
export const symbolFor = (item) => {
    const t = String(item?.ticker || item?.symbol || '').trim();
    if (!t) return null;
    return t.includes('.') ? t : `${t}.NS`;
};

/* ------------------------------------------------------------------ *
 * Tax, by asking the ledger
 * ------------------------------------------------------------------ */

const PROBE_ID = '__analyst_probe__';

/**
 * The disposals a sale would create, matched first in, first out against the
 * holding's real history — so a trim of the oldest shares is taxed as the
 * oldest shares, which is how the Act and every broker statement see it.
 *
 * `unmatched` is the part of the sale no recorded purchase covers. It is
 * reported rather than assumed away: a tax figure for shares with no known
 * cost would be invented.
 */
export const simulateSale = (stock, quantity, price, date) => {
    const probe = { id: PROBE_ID, type: 'sell', date, quantity, price };
    const { disposals, unmatched } = matchLots(
        [...(stock?.transactions || []), probe],
        { name: stock?.name || stock?.ticker, id: stock?.id },
    );
    const mine = disposals.filter((d) => d.txId === PROBE_ID);
    return {
        disposals: mine,
        gain: money(sum(mine, 'gain')),
        shortGain: money(sum(mine.filter((d) => d.term === 'short'), 'gain')),
        longGain: money(sum(mine.filter((d) => d.term === 'long'), 'gain')),
        proceeds: money(sum(mine, 'proceeds')),
        unmatched: money(sum(unmatched.filter((u) => u.txId === PROBE_ID), 'quantity')),
    };
};

/**
 * A zero-value disposal dated into `fy`.
 *
 * gainsLedger only runs through years that contain a disposal, so in a year
 * with no sales yet it would stop early: no row for this year, and carried
 * losses that should have aged would not have. The anchor adds nothing to any
 * figure; it only makes the ledger reach the year being asked about.
 */
const yearAnchor = (fy) => ({
    fy, term: 'short', gain: 0, proceeds: 0, cost: 0, dividendIncome: 0, treatedAsDividend: false,
});

/** One financial year's row of the Capital Gains ledger, plus the losses still carried after it. */
export const taxYear = (disposals, fy) => {
    const ledger = gainsLedger([...(disposals || []), yearAnchor(fy)]);
    return { row: ledger.years.find((y) => y.fy === fy), carried: ledger.carried };
};

const carriedTotal = (row) => num(row?.closingCarriedShort) + num(row?.closingCarriedLong);

/** The first date in a financial year, and the last. */
const fyEndOf = (fy) => `${Number(String(fy).slice(0, 4)) + 1}-03-31`;

/* ------------------------------------------------------------------ *
 * Context shared by every analyser
 * ------------------------------------------------------------------ */

const buildContext = ({ stocks, watchlist, sectorLimits, fundamentals, indexCloses, pricesUpdatedAt, asOf }) => {
    const todayDate = calendarDay(asOf);
    const today = todayDate.toISOString().slice(0, 10);
    const fy = fyFor(today);
    const own = (stocks || []).filter(Boolean);
    const active = own.filter((s) => !s.isArchived);

    const positions = active.map((stock) => ({ stock, ...stockSummary(stock) })).filter((p) => p.held);
    const priced = positions.filter((p) => !p.priceUnknown && p.value > 0);
    const total = priced.reduce((s, p) => s + p.value, 0);

    // Archived holdings stay in: their sales happened and are this year's tax.
    const { disposals, unmatched } = disposalsForStocks(own);

    const baselines = new Map();
    const baseline = (year) => {
        if (!baselines.has(year)) baselines.set(year, taxYear(disposals, year));
        return baselines.get(year);
    };

    /** What extra disposals would do to one year's tax, against what is already on record. */
    const taxImpact = (extra, year = fy) => {
        const before = baseline(year).row;
        const after = taxYear([...disposals, ...extra], year).row;
        return {
            extraTax: money(num(after?.estimatedTax) - num(before?.estimatedTax)),
            carriedUsed: money(carriedTotal(before) - carriedTotal(after)),
            exemptionUsed: money(num(after?.exemptUsed) - num(before?.exemptUsed)),
        };
    };

    const fyEnd = fyEndOf(fy);
    return {
        today, todayDate, fy, fyEnd,
        daysToFyEnd: daysBetween(today, fyEnd),
        own, active, positions, priced, total,
        weightOf: (p) => (total > 0 ? (p.value / total) * 100 : 0),
        disposals, unmatchedSales: unmatched,
        baseline, taxImpact,
        watchlist: (watchlist || []).filter((w) => w && !w.isArchived),
        sectorLimits: sectorLimits || {},
        fundamentals: fundamentals || {},
        indexCloses: indexCloses && Object.keys(indexCloses).length > 0 ? indexCloses : null,
        pricesUpdatedAt: pricesUpdatedAt || null,
        asOf,
    };
};

/** Tax suggestions sharpen as 31 March approaches: after it, the year's exemption is gone. */
const taxSeverity = (ctx) => (ctx.daysToFyEnd <= RULES.fyEndUrgentDays ? 'act' : 'review');

/** A sentence saying what a sale does to this year's tax, from its simulated impact. */
const describeSaleTax = (sale, impact) => {
    if (sale.gain <= 0) return `That sale books a ${inr(-sale.gain)} loss, so no tax.`;
    const split = sale.longGain > 0 && sale.shortGain > 0
        ? ` (${inr(sale.longGain)} long-term, ${inr(sale.shortGain)} short-term)`
        : sale.longGain > 0 ? ' of long-term gain' : ' of short-term gain';
    if (impact.extraTax > TAX_TOLERANCE) {
        return `That sale books ${inr(sale.gain)}${split}: estimated tax ${inr(impact.extraTax)}.`;
    }
    if (impact.carriedUsed > TAX_TOLERANCE) {
        return `That sale books ${inr(sale.gain)}${split}, set against losses on record — no tax this year.`;
    }
    if (impact.exemptionUsed > TAX_TOLERANCE) {
        return `That sale books ${inr(sale.gain)}${split}, inside this year's ₹1.25L long-term exemption — no tax.`;
    }
    return `That sale books ${inr(sale.gain)}${split} and adds no tax this year.`;
};

/**
 * The same sale on the day its short-term lots turn long term, if that is soon
 * and saves enough to mention. Assumes the price holds, which the text says.
 */
const waitAlternative = (ctx, stock, quantity, price, saleNow, impactNow) => {
    const pending = saleNow.disposals.filter((d) => d.term === 'short' && d.gain > 0);
    if (pending.length === 0) return null;
    const dates = pending.map((d) => longTermFrom(d.acquiredOn)).sort();
    const date = dates[dates.length - 1];
    const days = daysBetween(ctx.today, date);
    if (days <= 0 || days > RULES.waitWindowDays) return null;

    const later = simulateSale(stock, quantity, price, date);
    const impactLater = ctx.taxImpact(later.disposals, fyFor(date));
    const saving = money(impactNow.extraTax - impactLater.extraTax);
    if (saving < RULES.minWaitSaving) return null;
    return { date, days, saving };
};

/* ------------------------------------------------------------------ *
 * Analysers — each returns a list of findings
 * ------------------------------------------------------------------ */

/** Single positions above SEBI's 10% line. */
const concentrationFindings = (ctx) => ctx.priced
    .map((p) => ({ p, weight: ctx.weightOf(p) }))
    .filter(({ weight }) => weight > RULES.maxPositionPct)
    .map(({ p, weight }) => {
        const excess = p.value - (RULES.maxPositionPct / 100) * ctx.total;
        if (excess < RULES.minTrimValue) return null;
        const quantity = Math.min(p.shares, Math.ceil(excess / p.currentPrice));

        const sale = simulateSale(p.stock, quantity, p.currentPrice, ctx.today);
        const impact = ctx.taxImpact(sale.disposals);
        const wait = waitAlternative(ctx, p.stock, quantity, p.currentPrice, sale, impact);

        const action = [
            `Selling about ${sharesOf(quantity)} (≈${inr(quantity * p.currentPrice)}) brings it back to ${RULES.maxPositionPct}%.`,
            describeSaleTax(sale, impact),
            wait ? `Waiting until ${readable(wait.date)} (${wait.days} days), when those shares turn long term, would save about ${inr(wait.saving)} if the price holds.` : null,
            sale.unmatched > 0 ? `${sharesOf(sale.unmatched)} of it have no recorded purchase, so their tax is not included.` : null,
            `Or keep it and send new money elsewhere until it drifts back under ${RULES.maxPositionPct}%.`,
        ].filter(Boolean).join(' ');

        return {
            id: `concentration:${p.id}`,
            kind: 'concentration',
            severity: weight > RULES.urgentPositionPct ? 'act' : 'review',
            // Read by the harvest finding: a trim's long-term gain spends the
            // same ₹1.25L allowance a sell-and-rebuy would.
            trim: { quantity, longGain: sale.longGain },
            holdingId: p.id,
            ticker: p.ticker,
            name: p.name,
            title: `${p.name} is ${pct(weight)} of your stock portfolio`,
            detail: `SEBI caps a diversified mutual fund at ${RULES.maxPositionPct}% in any one company. Above that line, one company's bad year moves your whole portfolio.`,
            action,
            rule: `SEBI ${RULES.maxPositionPct}% single-company cap`,
            evidence: [
                { label: 'Weight', value: pct(weight) },
                { label: 'Value', value: inr(p.value) },
                { label: 'Unrealised', value: `${signedInr(p.unrealised)} (${signedPct(p.unrealisedPct)})` },
                { label: 'Suggested trim', value: `${sharesOf(quantity)} ≈ ${inr(quantity * p.currentPrice)}` },
                { label: 'Tax on trim', value: inr(Math.max(0, impact.extraTax)) },
            ],
            impact: money(excess),
        };
    })
    .filter(Boolean);

/** Sectors over a limit you set — or one nudge to set limits if there are none. */
const sectorFindings = (ctx) => {
    const { rows, breaches, limitedCount } = sectorBreaches(ctx.active, ctx.sectorLimits);
    if (rows.length === 0) return [];

    if (limitedCount === 0) {
        const largest = rows[0];
        return [{
            id: 'sector:no-limits',
            kind: 'sector',
            severity: 'info',
            title: 'Set sector limits so sector concentration can be checked',
            detail: `Your largest sector is ${largest.sector} at ${pct(largest.pct)}. No sector has a limit, so the analyst has no line of yours to hold it to — and it will not invent one.`,
            action: 'Set a cap for the sectors you care about on the stock account’s Analytics tab.',
            rule: 'Your sector limits',
            evidence: rows.slice(0, 3).map((r) => ({ label: r.sector, value: pct(r.pct) })),
            impact: 0,
        }];
    }

    return breaches.map((b) => {
        const members = ctx.priced
            .filter((p) => sectorFor(p.stock.sector, null) === b.sector)
            .sort((x, y) => y.value - x.value)
            .slice(0, 3);
        return {
            id: `sector:${b.sector}`,
            kind: 'sector',
            severity: b.overBy >= 5 ? 'act' : 'review',
            title: `${b.sector} is ${pct(b.pct)} of your portfolio — over your ${b.limit}% limit`,
            detail: `A limit you set yourself, and ${b.sector} is ${num(b.overBy).toFixed(1)} percentage points over it.`,
            action: `About ${inr(b.excessValue)} is over the line. Its largest holdings: ${members.map((m) => `${m.name} ${inr(m.value)}`).join(' · ')}. Trim those, or add to other sectors, to bring it back.`,
            rule: 'Your sector limit',
            evidence: [
                { label: 'Weight', value: pct(b.pct) },
                { label: 'Your limit', value: `${b.limit}%` },
                { label: 'Over by', value: inr(b.excessValue) },
            ],
            impact: money(b.excessValue),
        };
    });
};

/** Price levels you asked to be told about, on holdings and the watchlist. */
const alertFindings = (ctx) => {
    const describe = ({ alert, item, name, where, value }) => {
        const price = alert.currentPrice;
        const q = readQuote(item);
        const below = alert.type === 'below';
        const verb = below ? 'below' : 'above';
        const next = where === 'holding'
            ? (below ? 'Decide whether this is a chance to add or a reason to exit.' : 'Decide whether to book some profit — this is the level you chose.')
            : (below ? 'The price you were waiting for. Check the fundamentals before buying.' : 'It has run past your level — decide whether it is still worth buying.');
        return {
            id: `alert:${where}:${item.id}:${alert.id}`,
            kind: 'alert',
            severity: 'act',
            holdingId: where === 'holding' ? item.id : undefined,
            watchlistId: where === 'watchlist' ? item.id : undefined,
            ticker: item.ticker,
            name,
            title: `${name} is ${verb} your ${inr(alert.price)} alert`,
            detail: `Now ${inr(price)}.${alert.note ? ` Your note: “${alert.note}”` : ''}`,
            action: next,
            rule: 'Your price alert',
            evidence: [
                { label: 'Price', value: inr(price) },
                { label: 'Your level', value: `${verb} ${inr(alert.price)}` },
                ...(q.hasRange ? [{ label: '52-week range', value: `${inr(q.low)}–${inr(q.high)} (${pct(q.rangePct, 0)} up)` }] : []),
            ],
            impact: num(value),
        };
    };
    // Priced only. triggeredAlerts reads a missing price stored as 0 as a real
    // price of zero, which is "below" every level anyone has ever set.
    const priced = (item) => num(readQuote(item).price) > 0;
    return [
        ...ctx.positions.filter((p) => priced(p.stock)).flatMap((p) => triggeredAlerts(p.stock).map((alert) => describe({
            alert, item: p.stock, name: p.name, where: 'holding', value: p.value,
        }))),
        ...ctx.watchlist.filter(priced).flatMap((w) => triggeredAlerts(w).map((alert) => describe({
            alert, item: w, name: w.name || w.ticker, where: 'watchlist', value: 0,
        }))),
    ];
};

/**
 * Watchlist names you marked Ready or Interested that are near their 52-week
 * low. Your priority is the judgement; the range position is only the timing.
 */
const watchlistFindings = (ctx) => ctx.watchlist
    // The alert already says it.
    .filter((w) => !(num(readQuote(w).price) > 0 && triggeredAlerts(w).length > 0))
    .map((w) => {
        const priority = priorityOf(w);
        if (priority !== 'ready' && priority !== 'interested') return null;
        const q = readQuote(w);
        if (!q.hasRange || !q.nearLow) return null;

        const name = w.name || w.ticker;
        const f = ctx.fundamentals[symbolFor(w)];
        const weak = f?.signal?.action === 'sell';
        return {
            id: `watchlist:${w.id}`,
            kind: 'watchlist',
            severity: priority === 'ready' ? 'review' : 'info',
            watchlistId: w.id,
            ticker: w.ticker,
            name,
            title: `${name} is near its 52-week low — you marked it ${priority === 'ready' ? 'Ready' : 'Interested'}`,
            detail: `${inr(q.price)} is ${pct(q.rangePct, 0)} of the way up its ${inr(q.low)}–${inr(q.high)} range.${weak ? ` The fundamentals check says “${f.signal.label}”, so the low price may be the market’s verdict rather than an opportunity.` : ''}`,
            action: priority === 'ready'
                ? 'You decided on this in principle and were waiting on price. Re-check the business and decide on a starting amount.'
                : 'Worth the closer look you were planning before it moves.',
            rule: 'Your watchlist priority',
            evidence: [
                { label: 'Price', value: inr(q.price) },
                { label: 'Above 52-week low', value: pct(q.aboveLowPct) },
                { label: 'Your risk rating', value: riskOf(w) === 'unrated' ? 'not set' : riskOf(w) },
                ...(f?.signal ? [{ label: 'Fundamentals', value: `${f.signal.label} (${f.healthScore?.total ?? '?'}/${f.healthScore?.max ?? 5})` }] : []),
            ],
            impact: 0,
        };
    })
    .filter(Boolean);

/** Holdings the fundamentals scorecard marks "Review for Exit" or "Consider Trimming". */
const fundamentalsFindings = (ctx) => ctx.priced
    .map((p) => {
        const f = ctx.fundamentals[symbolFor(p.stock)];
        const action = f?.signal?.action;
        if (action !== 'sell' && action !== 'trim') return null;
        // The checks that pulled the score down. A 2/5 can come from nothing
        // but "caution" marks, and then those are the reason to show.
        const checks = f.healthScore?.checks || [];
        const bad = checks.filter((c) => c.status === 'bad');
        const failing = bad.length > 0 ? bad : checks.filter((c) => c.status === 'caution');
        const down = p.unrealised < 0;
        return {
            id: `fundamentals:${p.id}`,
            kind: 'fundamentals',
            severity: action === 'sell' ? 'review' : 'info',
            holdingId: p.id,
            ticker: p.ticker,
            name: p.name,
            title: `${p.name}: the fundamentals check says “${f.signal.label}” (${f.healthScore?.total ?? 0}/${f.healthScore?.max ?? 5})`,
            detail: (f.signal.reasons || []).join(' · '),
            action: down
                ? `You are ${inr(-p.unrealised)} (${pct(-p.unrealisedPct)}) below cost. Re-read why you own it; if you sell, that loss offsets other gains.`
                : `You are up ${inr(p.unrealised)} (${pct(p.unrealisedPct)}). Re-read why you own it before adding more.`,
            rule: 'Fundamentals scorecard (revenue, profit, margins, debt, valuation)',
            evidence: [
                ...failing.map((c) => ({ label: c.name, value: c.detail })),
                { label: 'Weight', value: pct(ctx.weightOf(p)) },
                { label: 'Unrealised', value: `${signedInr(p.unrealised)} (${signedPct(p.unrealisedPct)})` },
            ],
            impact: money(p.value),
        };
    })
    .filter(Boolean);

/**
 * The most gain that can be booked today without adding a rupee to this
 * year's tax — found by asking the ledger, not by re-deriving its rules.
 *
 * Holdings are sold oldest shares first, as a real sale would be. With
 * `longOnly`, a holding's run stops at its first short-term lot, because
 * selling past it would book gain the long-term exemption cannot absorb.
 *
 * The most gain per rupee sold goes first: the charges scale with what is
 * traded and the benefit with the gain booked, so a 90% winner harvests the
 * same gain as a 9% one for a tenth of the cost. A holding whose gain is too
 * thin to cover its own charges is never included.
 */
const BREAK_EVEN_GAIN_RATIO = (RULES.roundTripCostPct / 100) / 0.125;

const taxFreeHarvest = (ctx, { longOnly, cap = Infinity }) => {
    const extra = [];
    const plan = [];
    let booked = 0;

    const candidates = ctx.priced.map((p) => {
        const { openLots } = matchLots(p.stock.transactions, { name: p.name, id: p.id });
        let quantity = 0;
        let gain = 0;
        for (const lot of openLots) {
            if (longOnly && !isLongTerm(lot.date, ctx.todayDate)) break;
            quantity += lot.quantity;
            gain += lot.quantity * (p.currentPrice - lot.costPerShare);
        }
        const maxQty = Math.floor(Math.min(quantity, p.shares) + 1e-9);
        return { p, gain, maxQty, ratio: maxQty > 0 ? gain / (maxQty * p.currentPrice) : 0 };
    })
        .filter((c) => c.maxQty > 0 && c.gain > 0 && c.ratio > BREAK_EVEN_GAIN_RATIO)
        .sort((a, b) => b.ratio - a.ratio);

    for (const c of candidates) {
        if (cap - booked < RULES.minHarvestPerHolding) break;
        const trial = (q) => {
            const sale = simulateSale(c.p.stock, q, c.p.currentPrice, ctx.today);
            const impact = ctx.taxImpact([...extra, ...sale.disposals]);
            return { q, sale, ok: impact.extraTax <= TAX_TOLERANCE && sale.unmatched === 0 && booked + sale.gain <= cap + TAX_TOLERANCE };
        };
        let best = null;
        const whole = trial(c.maxQty);
        if (whole.ok) {
            best = whole;
        } else {
            // Largest quantity that still adds no tax. Gain grows with each
            // share sold, so the answer is the edge between "fits" and not.
            let lo = 0;
            let hi = c.maxQty;
            while (hi - lo > 1) {
                const mid = Math.floor((lo + hi) / 2);
                const t = trial(mid);
                if (t.ok) { lo = mid; best = t; } else { hi = mid; }
            }
        }
        if (best && best.sale.gain >= RULES.minHarvestPerHolding) {
            extra.push(...best.sale.disposals);
            booked += best.sale.gain;
            plan.push({
                holdingId: c.p.id,
                name: c.p.name,
                quantity: best.q,
                gain: best.sale.gain,
                longGain: best.sale.longGain,
                shortGain: best.sale.shortGain,
                proceeds: best.sale.proceeds,
            });
        }
    }
    return { plan, booked: money(booked), disposals: extra, impact: ctx.taxImpact(extra) };
};

const planText = (plan) => plan.map((s) => `${s.name} ${sharesOf(s.quantity)} (gain ${inr(s.gain)})`).join(' · ');

/**
 * Tax: the unused part of this year's ₹1.25L long-term exemption, or — when
 * losses are being carried forward — those losses, especially any about to
 * lapse. The two are exclusive: carried losses absorb gains before the
 * exemption does, so while they last there is no exemption left to harvest.
 */
const harvestFindings = (ctx, trims = []) => {
    const { row, carried } = ctx.baseline(ctx.fy);
    const pool = [...(carried.short || []).map((c) => ({ ...c, term: 'short' })), ...(carried.long || []).map((c) => ({ ...c, term: 'long' }))];
    const poolTotal = money(sum(pool, 'amount'));

    if (poolTotal > TAX_TOLERANCE) {
        const lapsing = pool.filter((c) => c.expiresAfter === ctx.fy);
        const lapsingTotal = money(sum(lapsing, 'amount'));
        const oldest = [...pool].sort((a, b) => String(a.expiresAfter).localeCompare(String(b.expiresAfter)))[0];

        if (lapsingTotal > TAX_TOLERANCE) {
            // The ledger sets carried short-term losses against long-term gain
            // before carried long-term ones, so reaching a lapsing long-term
            // loss means booking enough long-term gain to get past the whole
            // short-term pool first. How much of the lapsing loss the plan
            // really uses is then read back from the ledger, not assumed.
            const lapsingLong = sum(lapsing.filter((c) => c.term === 'long'), 'amount');
            const shortPool = sum(pool.filter((c) => c.term === 'short'), 'amount');
            const { plan, booked, disposals: planned } = taxFreeHarvest(ctx, lapsingLong > 0
                ? { longOnly: true, cap: shortPool + lapsingLong }
                : { longOnly: false, cap: lapsingTotal });
            const after = taxYear([...ctx.disposals, ...planned], ctx.fy).carried;
            const stillLapsing = sum([...after.short, ...after.long].filter((c) => c.expiresAfter === ctx.fy), 'amount');
            const rescued = money(lapsingTotal - stillLapsing);
            return [{
                id: `tax:carried-lapsing:${ctx.fy}`,
                kind: 'tax',
                severity: 'act',
                title: `${inr(lapsingTotal)} of carried-forward losses lapse after 31 March`,
                detail: `Losses can be carried forward for eight years, and these reach the end of theirs this financial year. Gains booked before then are set against them tax-free; after 31 March they are simply gone.`,
                action: plan.length > 0
                    ? `Sell and rebuy ${planText(plan)} before ${readable(ctx.fyEnd)}: ${inr(booked)} of gain, tax-free, using ${inr(rescued)} of the losses that would otherwise lapse. Buying back resets the cost to today’s price, so they become a permanently higher cost basis.`
                    : 'There are no unrealised gains in the portfolio to set against them at today’s prices.',
                rule: 'Income Tax Act s.74: capital losses carry forward 8 years',
                evidence: [
                    { label: 'Lapsing', value: inr(lapsingTotal) },
                    { label: 'Used by this plan', value: inr(rescued) },
                    { label: 'All losses on record', value: inr(poolTotal) },
                    { label: 'Deadline', value: `${readable(ctx.fyEnd)} (${ctx.daysToFyEnd} days)` },
                ],
                deadline: ctx.fyEnd,
                impact: money(lapsingTotal),
            }];
        }

        return [{
            id: `tax:carried:${ctx.fy}`,
            kind: 'tax',
            severity: 'info',
            title: `${inr(poolTotal)} of capital losses on record shelter your next gains from tax`,
            detail: `Losses are set against gains before any tax is due, for up to eight years after the year they arose. The oldest (${inr(oldest.amount)}, from FY ${oldest.fy}) can be used until FY ${oldest.expiresAfter}.`,
            action: 'While they last, gains you book are tax-free — so selling and rebuying winners raises your cost basis for nothing. Worth doing only for losses nothing else will use in time: they also shelter other capital gains, such as a property or gold sale.',
            rule: 'Income Tax Act: capital losses carry forward 8 years',
            evidence: [
                { label: 'Short-term losses', value: inr(sum(pool.filter((c) => c.term === 'short'), 'amount')) },
                { label: 'Long-term losses', value: inr(sum(pool.filter((c) => c.term === 'long'), 'amount')) },
                { label: 'First expiry', value: `after FY ${oldest.expiresAfter}` },
            ],
            impact: 0,
        }];
    }

    const exemption = exemptionFor(ctx.fy);
    const exemptionLeft = money(Math.max(0, exemption - num(row?.exemptUsed)));
    if (exemptionLeft < RULES.minHarvestGain) return [];

    const { plan, booked, impact } = taxFreeHarvest(ctx, { longOnly: true });
    if (booked < RULES.minHarvestGain) return [];

    const proceeds = sum(plan, 'proceeds');
    const futureTax = money(booked * 0.125);
    const charges = money((proceeds * RULES.roundTripCostPct) / 100);
    const trimmedLong = trims.filter((t) => t.trim?.longGain > 0);
    const trimNote = trimmedLong.length > 0
        ? ` The trims suggested for ${trimmedLong.map((t) => t.name).join(' and ')} would use ${inr(sum(trimmedLong.map((t) => t.trim), 'longGain'))} of the same allowance — make those first and harvest what is left.`
        : '';
    return [{
        id: `tax:harvest-exemption:${ctx.fy}`,
        kind: 'tax',
        severity: taxSeverity(ctx),
        title: `Book up to ${inr(booked)} of long-term gains tax-free before 31 March`,
        detail: `This year's ${inr(exemption)} long-term exemption has ${inr(exemptionLeft)} unused${num(row?.exemptUsed) > 0 ? ` (${inr(row.exemptUsed)} already used by sales since April)` : ''}. It does not carry over — unused, it is gone on 1 April.`,
        action: `Sell and buy back: ${planText(plan)}. The gain is taxed at 0% now instead of 12.5% whenever you eventually sell. The repurchased shares restart the 12-month clock, so sell them within a year and the gain on them is short term.${trimNote}`,
        rule: 'Income Tax Act s.112A: ₹1.25L long-term exemption a year',
        evidence: [
            { label: 'Exemption left', value: inr(exemptionLeft) },
            { label: 'Gain booked', value: inr(booked) },
            { label: 'Future tax avoided', value: `up to ${inr(futureTax)}` },
            { label: 'Charges (approx.)', value: inr(charges) },
            { label: 'Tax now', value: inr(Math.max(0, impact.extraTax)) },
            { label: 'Deadline', value: `${readable(ctx.fyEnd)} (${ctx.daysToFyEnd} days)` },
        ],
        deadline: ctx.fyEnd,
        impact: money(futureTax - charges),
    }];
};

/**
 * Tax: losses that would cut tax already due this year.
 *
 * Only the run of losing shares at the front of the queue is sold — a real
 * sale takes the oldest shares first, so losses behind a profitable lot
 * cannot be reached without booking the profit too.
 */
const lossHarvestFindings = (ctx) => {
    const base = ctx.baseline(ctx.fy).row;
    const taxDue = num(base?.estimatedTax);
    if (taxDue <= TAX_TOLERANCE) return [];

    return ctx.priced.map((p) => {
        const { openLots } = matchLots(p.stock.transactions, { name: p.name, id: p.id });
        let quantity = 0;
        for (const lot of openLots) {
            if (p.currentPrice >= lot.costPerShare) break;
            quantity += lot.quantity;
        }
        quantity = Math.floor(Math.min(quantity, p.shares) + 1e-9);
        if (quantity <= 0) return null;

        const sale = simulateSale(p.stock, quantity, p.currentPrice, ctx.today);
        if (sale.unmatched > 0 || sale.gain >= 0) return null;
        const saving = money(-ctx.taxImpact(sale.disposals).extraTax);
        if (saving < RULES.minTaxSaving) return null;

        const term = sale.shortGain < 0 && sale.longGain < 0 ? 'short- and long-term'
            : sale.shortGain < 0 ? 'short-term' : 'long-term';
        return {
            id: `tax:loss:${p.id}:${ctx.fy}`,
            kind: 'tax',
            severity: taxSeverity(ctx),
            holdingId: p.id,
            ticker: p.ticker,
            name: p.name,
            title: `Booking the ${inr(-sale.gain)} loss on ${p.name} cuts this year's tax by ${inr(saving)}`,
            detail: `You owe an estimated ${inr(taxDue)} on gains booked since April. Selling ${sharesOf(quantity)} books a ${term} loss that is set against them.`,
            action: `Sell ${sharesOf(quantity)} of ${p.name} (≈${inr(sale.proceeds)}). Buy back only if you still want to own it — India has no wash-sale rule, but the new shares restart the 12-month clock. Savings from several holdings do not add up: together they cannot exceed the ${inr(taxDue)} due.`,
            rule: 'Income Tax Act: set-off of capital losses',
            evidence: [
                { label: 'Loss booked', value: inr(-sale.gain) },
                { label: 'Tax saved', value: inr(saving) },
                { label: 'Tax due this year', value: inr(taxDue) },
                { label: 'Deadline', value: `${readable(ctx.fyEnd)} (${ctx.daysToFyEnd} days)` },
            ],
            deadline: ctx.fyEnd,
            impact: saving,
        };
    }).filter(Boolean).sort((a, b) => b.impact - a.impact).slice(0, 5);
};

/**
 * Tax: profitable short-term lots that turn long term soon.
 *
 * Only useful to someone about to sell, so it is information, not an action.
 * The shares ahead of them in the queue are included, because selling these
 * means selling those first.
 */
const waitFindings = (ctx, skip) => ctx.priced.map((p) => {
    if (skip.has(p.id)) return null;
    const { openLots } = matchLots(p.stock.transactions, { name: p.name, id: p.id });
    let quantity = 0;
    let through = -1;
    for (let i = 0; i < openLots.length; i += 1) {
        const lot = openLots[i];
        if (isLongTerm(lot.date, ctx.todayDate)) continue;
        const days = daysBetween(ctx.today, longTermFrom(lot.date));
        if (days > RULES.waitWindowDays) break;
        if (p.currentPrice > lot.costPerShare) through = i;
    }
    if (through < 0) return null;
    for (let i = 0; i <= through; i += 1) quantity += openLots[i].quantity;
    quantity = Math.floor(Math.min(quantity, p.shares) + 1e-9);
    if (quantity <= 0) return null;

    const now = simulateSale(p.stock, quantity, p.currentPrice, ctx.today);
    const impactNow = ctx.taxImpact(now.disposals);
    const wait = waitAlternative(ctx, p.stock, quantity, p.currentPrice, now, impactNow);
    if (!wait) return null;
    return {
        id: `tax:wait:${p.id}:${wait.date}`,
        kind: 'tax',
        severity: 'info',
        holdingId: p.id,
        ticker: p.ticker,
        name: p.name,
        title: `${p.name}: selling after ${readable(wait.date)} saves about ${inr(wait.saving)} in tax`,
        detail: `Selling the first ${sharesOf(quantity)} now books ${inr(now.shortGain)} of short-term gain, taxed at 20%. From ${readable(wait.date)} it is long term — 12.5%, and inside the ₹1.25L exemption while that lasts.`,
        action: `If you were planning to sell, waiting ${wait.days} days saves about ${inr(wait.saving)}, as long as the price holds.`,
        rule: 'Income Tax Act: 12-month holding period for listed shares',
        evidence: [
            { label: 'Short-term gain', value: inr(now.shortGain) },
            { label: 'Turns long term', value: readable(wait.date) },
            { label: 'Tax if sold now', value: inr(Math.max(0, impactNow.extraTax)) },
            { label: 'Saving', value: inr(wait.saving) },
        ],
        deadline: wait.date,
        impact: wait.saving,
    };
}).filter(Boolean);

/**
 * What each holding's actual cash flows would be worth had they gone into the
 * index instead — every purchase buying index units on its date, every sale and
 * dividend selling them. A public-market-equivalent comparison, so partial
 * sales and dividends are counted as the money they were.
 *
 * The index is the Nifty 50 price index, which leaves out the index's own
 * dividends. That understates the index by roughly its yield, so a holding
 * flagged here is behind by at least as much as it says.
 */
export const indexMirror = (stock, closes, asOf) => {
    const flows = stockCashflows(stock, asOf).filter((f) => !f.closing);
    if (flows.length === 0) return null;
    const dates = Object.keys(closes).sort();
    const earliest = dates[0];
    const latestClose = closes[dates[dates.length - 1]];

    let units = 0;
    let invested = 0;
    let returned = 0;
    for (const f of [...flows].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
        const day = String(f.date).slice(0, 10);
        const close = closeOnOrBefore(closes, day);
        // A purchase before the index history begins cannot be mirrored, and
        // leaving it out would compare a whole holding against part of one.
        if (day < earliest || close === null) return null;
        if (f.amount < 0) { units += -f.amount / close; invested += -f.amount; } else { units -= f.amount / close; returned += f.amount; }
    }
    if (units < 0 || invested <= 0) return null;
    return { invested: money(invested), returned: money(returned), mirrorValue: money(units * latestClose), firstFlow: String(flows[0].date).slice(0, 10) };
};

const laggardFindings = (ctx) => {
    if (!ctx.indexCloses) return [];
    return ctx.priced.map((p) => {
        const m = indexMirror(p.stock, ctx.indexCloses, ctx.asOf);
        if (!m || daysBetween(m.firstFlow, ctx.today) < RULES.laggardMinDays) return null;
        const holdingPct = ((m.returned + p.value - m.invested) / m.invested) * 100;
        const indexPct = ((m.returned + m.mirrorValue - m.invested) / m.invested) * 100;
        const gap = money(m.mirrorValue - p.value);
        if (indexPct - holdingPct < RULES.laggardGapPct || gap < RULES.laggardMinGap) return null;
        return {
            id: `laggard:${p.id}`,
            kind: 'performance',
            severity: 'info',
            holdingId: p.id,
            ticker: p.ticker,
            name: p.name,
            title: `${p.name} has returned ${signedPct(holdingPct, 0)} on your money; the Nifty 50 would have returned ${signedPct(indexPct, 0)}`,
            detail: `The same rupees on the same dates — every purchase, sale and dividend — mirrored in the index would be worth ${inr(gap)} more today. The index figure leaves out its own dividends, so the real gap is a little wider.`,
            action: 'If the reason you bought it still holds, keep it — but the index is the bar each holding has to clear.',
            rule: 'Same cash flows in the Nifty 50',
            evidence: [
                { label: 'You put in', value: inr(m.invested) },
                { label: 'Holding return', value: signedPct(holdingPct) },
                { label: 'Index return', value: signedPct(indexPct) },
                { label: 'Behind by', value: inr(gap) },
            ],
            impact: gap,
        };
    }).filter(Boolean).sort((a, b) => b.impact - a.impact).slice(0, 3);
};

/** Dividend payers that have gone quiet for two years or more. */
const incomeFindings = (ctx) => lapsedPayers(ctx.active).map((d) => ({
    id: `income:lapsed:${d.id}`,
    kind: 'income',
    severity: 'info',
    holdingId: d.id,
    name: d.name,
    title: `${d.name} last paid a dividend in ${new Date(d.lastPaid).getFullYear()}`,
    detail: `It paid in ${d.paidYears} of the ${d.spanYears} years since its first payout, and nothing for ${d.yearsSinceLast} years. A payer going quiet usually means something changed at the company.`,
    action: 'Check the latest results before counting on it for income.',
    rule: 'Your dividend history',
    evidence: [
        { label: 'Last paid', value: readable(String(d.lastPaid).slice(0, 10)) },
        { label: 'Received in total', value: inr(d.total) },
        { label: 'Yield on cost', value: pct(d.pct, 2) },
    ],
    impact: 0,
}));

/** Gaps that make the figures above incomplete. */
const dataFindings = (ctx) => {
    const out = [];
    const noPrice = ctx.positions.filter((p) => p.priceUnknown);
    if (noPrice.length > 0) {
        out.push({
            id: 'data:no-price',
            kind: 'data',
            severity: 'review',
            title: `${noPrice.length} holding${noPrice.length === 1 ? ' has' : 's have'} no current price`,
            detail: `${noPrice.map((p) => p.name).join(', ')} ${noPrice.length === 1 ? 'is' : 'are'} left out of every figure here — weights, trims and tax — rather than counted as worth nothing.`,
            action: 'Refresh prices. If one still fails, its ticker has probably changed.',
            rule: 'Data completeness',
            evidence: [{ label: 'Cost left out', value: inr(sum(noPrice, 'invested')) }],
            impact: 0,
        });
    }
    const noSector = ctx.priced.filter((p) => sectorFor(p.stock.sector, null) === 'Other' && !String(p.stock.sector || '').trim());
    if (noSector.length > 0) {
        out.push({
            id: 'data:no-sector',
            kind: 'data',
            severity: 'info',
            title: `${noSector.length} holding${noSector.length === 1 ? ' has' : 's have'} no sector`,
            detail: `${noSector.map((p) => p.name).join(', ')} ${noSector.length === 1 ? 'counts' : 'count'} as “Other”, so sector limits cannot see ${inr(sum(noSector, 'value'))}.`,
            action: 'Set a sector on each holding.',
            rule: 'Data completeness',
            evidence: noSector.slice(0, 4).map((p) => ({ label: p.name, value: inr(p.value) })),
            impact: 0,
        });
    }
    if (ctx.unmatchedSales.length > 0) {
        out.push({
            id: 'data:unmatched-sales',
            kind: 'data',
            severity: 'info',
            title: 'Tax figures leave out sales with no purchase on record',
            detail: `${ctx.unmatchedSales.map((u) => `${u.holding} (${count(u.quantity)} on ${u.soldOn})`).join(', ')}. With no cost to match, they are left out rather than taxed as pure profit.`,
            action: 'Add the missing purchases and every tax figure here completes itself.',
            rule: 'Data completeness',
            evidence: [],
            impact: 0,
        });
    }
    const unpriced = ctx.watchlist.filter((w) => w.ticker && readQuote(w).price === null);
    if (unpriced.length > 0) {
        out.push({
            id: 'data:watchlist-no-price',
            kind: 'data',
            severity: 'info',
            title: `${unpriced.length} watchlist ${unpriced.length === 1 ? 'entry has' : 'entries have'} no price`,
            detail: `${unpriced.map((w) => w.name || w.ticker).join(', ')} cannot be checked against their range or alerts.`,
            action: 'Refresh prices, or correct the ticker.',
            rule: 'Data completeness',
            evidence: [],
            impact: 0,
        });
    }
    return out;
};

/* ------------------------------------------------------------------ *
 * The analysis
 * ------------------------------------------------------------------ */

const bySeverityThenImpact = (a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (num(b.impact) - num(a.impact));

/**
 * Everything the analyst has to say about a portfolio.
 *
 * @param stocks        the user's own holdings (ownHoldings), archived included
 * @param watchlist     watchlist entries
 * @param sectorLimits  `{ sector: pct }` from the stock account
 * @param fundamentals  `{ [yahooSymbol]: /api/stock-financials payload }`, as many as have loaded
 * @param indexCloses   `{ date: close }` for ^NSEI, or null
 */
export const analysePortfolio = ({
    stocks = [], watchlist = [], sectorLimits = {}, fundamentals = {}, indexCloses = null,
    pricesUpdatedAt = null, asOf = new Date(),
} = {}) => {
    const ctx = buildContext({ stocks, watchlist, sectorLimits, fundamentals, indexCloses, pricesUpdatedAt, asOf });

    const concentration = concentrationFindings(ctx);
    // A trim finding already carries its own "wait until" note.
    const trimmed = new Set(concentration.map((f) => f.holdingId));

    const findings = [
        ...alertFindings(ctx),
        ...concentration,
        ...sectorFindings(ctx),
        ...harvestFindings(ctx, concentration),
        ...lossHarvestFindings(ctx),
        ...waitFindings(ctx, trimmed),
        ...fundamentalsFindings(ctx),
        ...watchlistFindings(ctx),
        ...laggardFindings(ctx),
        ...incomeFindings(ctx),
        ...dataFindings(ctx),
    ].sort(bySeverityThenImpact);

    const { row } = ctx.baseline(ctx.fy);
    const invested = sum(ctx.priced, 'invested');
    const ranked = [...ctx.priced].sort((a, b) => b.value - a.value);
    const pricesAgeHours = ctx.pricesUpdatedAt
        ? Math.max(0, (new Date(asOf).getTime() - new Date(ctx.pricesUpdatedAt).getTime()) / 3600000)
        : null;
    const counts = { act: 0, review: 0, info: 0 };
    findings.forEach((f) => { counts[f.severity] += 1; });

    return {
        asOf: ctx.today,
        findings,
        counts,
        snapshot: {
            fy: ctx.fy,
            fyEnd: ctx.fyEnd,
            daysToFyEnd: ctx.daysToFyEnd,
            value: money(ctx.total),
            invested: money(invested),
            unrealised: money(ctx.total - invested),
            unrealisedPct: invested > 0 ? ((ctx.total - invested) / invested) * 100 : 0,
            heldCount: ctx.positions.length,
            largest: ranked[0] ? { name: ranked[0].name, weight: ctx.weightOf(ranked[0]) } : null,
            topFiveShare: ctx.total > 0 ? (sum(ranked.slice(0, 5), 'value') / ctx.total) * 100 : 0,
            sectors: sectorWeights(ctx.active).rows.slice(0, 5),
            realisedShort: money(row?.grossShort),
            realisedLong: money(row?.grossLong),
            estimatedTax: money(row?.estimatedTax),
            exemption: exemptionFor(ctx.fy),
            exemptionUsed: money(row?.exemptUsed),
            carriedLosses: money(carriedTotal(row)),
            pricesUpdatedAt: ctx.pricesUpdatedAt,
            pricesAgeHours,
            pricesStale: pricesAgeHours === null || pricesAgeHours > RULES.stalePriceHours,
            fundamentalsLoaded: ctx.priced.filter((p) => ctx.fundamentals[symbolFor(p.stock)]).length,
            indexLoaded: !!ctx.indexCloses,
        },
    };
};

/**
 * The analysis, reduced to what a small local model needs to write a brief or
 * answer a question — and nothing it could mistake for something to compute.
 *
 * Every number is already a formatted string. A 3–4B model reliably rewords
 * "₹80,890" and unreliably adds two of them, so it is never asked to.
 */
export const llmFacts = (analysis, { maxFindings = 10, maxHoldings = 40, stocks = [] } = {}) => {
    const s = analysis.snapshot;
    const holdings = (stocks || [])
        .filter((st) => st && !st.isArchived)
        .map((st) => stockSummary(st))
        .filter((p) => p.held && !p.priceUnknown && p.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, maxHoldings)
        .map((p) => `${p.name} (${p.ticker}): ${pct(s.value > 0 ? (p.value / s.value) * 100 : 0)} of portfolio, ${inr(p.value)}, ${signedPct(p.unrealisedPct)} vs cost, ${sectorFor(p.sector === 'Unclassified' ? '' : p.sector, null)}`);

    return {
        date: analysis.asOf,
        financialYear: `${s.fy} (ends ${readable(s.fyEnd)}, ${s.daysToFyEnd} days away)`,
        portfolio: `${inr(s.value)} across ${s.heldCount} holdings, ${signedPct(s.unrealisedPct)} vs cost. Largest: ${s.largest ? `${s.largest.name} at ${pct(s.largest.weight)}` : 'none'}. Top five holdings: ${pct(s.topFiveShare)} of the total.`,
        tax: `This year so far: short-term gains ${inr(s.realisedShort)}, long-term gains ${inr(s.realisedLong)}, estimated tax ${inr(s.estimatedTax)}. Long-term exemption used ${inr(s.exemptionUsed)} of ${inr(s.exemption)}. Losses carried forward: ${inr(s.carriedLosses)}.`,
        prices: s.pricesAgeHours === null ? 'Price age unknown.' : `Prices are ${Math.round(s.pricesAgeHours)} hours old${s.pricesStale ? ' — stale, refresh before acting' : ''}.`,
        findings: analysis.findings.slice(0, maxFindings).map((f) => ({
            id: f.id,
            severity: f.severity,
            title: f.title,
            why: f.detail,
            suggestion: f.action,
            figures: (f.evidence || []).map((e) => `${e.label}: ${e.value}`).join('; '),
        })),
        holdings,
    };
};
