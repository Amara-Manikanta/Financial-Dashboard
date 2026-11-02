/**
 * The two prompts for the outside research run (Google Antigravity).
 *
 * The daily prompt asks for one table in a fixed shape that `parseResearch`
 * can read back without guessing; the deep-dive prompt is for the few stocks
 * worth a second, slower look — a call that changed, or REVIEW / SELL. Every
 * figure about the holdings is worked out here from the database, never left
 * for the model to derive.
 */
import { effectiveStockPosition } from './investmentSync.js';
import { sectorFor } from './sectors.js';

const inr = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: d });

const firstBuy = (stock) => {
    const dates = (stock.transactions || [])
        .filter((t) => ['buy', 'ipo'].includes(t.type) && t.date)
        .map((t) => String(t.date).slice(0, 10))
        .sort();
    return dates[0] || '';
};

/** Active holdings with the figures the prompt prints, largest first. */
export const promptHoldings = (stocks, lastCalls = new Map()) => (stocks || [])
    .filter((s) => !s.isArchived)
    .map((s) => {
        const pos = effectiveStockPosition(s);
        const qty = pos.shares;
        const price = Number(s.currentPrice) || 0;
        const invested = qty * pos.avgCost;
        const value = qty * price;
        const call = lastCalls.get(String(s.id));
        return {
            id: String(s.id),
            name: String(s.name || '').trim(),
            qty,
            avg: pos.avgCost,
            invested,
            value,
            price,
            gainPct: invested > 0 && price > 0 ? ((value - invested) / invested) * 100 : null,
            sector: sectorFor(s.sector, null),
            since: firstBuy(s),
            lastCall: call ? `${call.call} (${call.date})` : '',
        };
    })
    .filter((h) => h.qty > 0)
    .sort((a, b) => b.invested - a.invested);

const holdingsTable = (rows, { withLast, withWeight = false }) => [
    `| Stock | Invested ₹ | Avg buy ₹ | Qty | Price now ₹ | Gain % |${withWeight ? ' Weight % |' : ''} Sector | First bought |${withLast ? ' My last call |' : ''}`,
    `|---|---:|---:|---:|---:|---:|${withWeight ? '---:|' : ''}---|---|${withLast ? '---|' : ''}`,
    ...rows.map((h) => `| ${h.name} | ${inr(h.invested)} | ${inr(h.avg)} | ${inr(h.qty, 4)} | ${h.price ? inr(h.price) : '—'} | ${h.gainPct === null ? '—' : h.gainPct.toFixed(1)} |${withWeight ? ` ${h.weightPct.toFixed(1)} |` : ''} ${h.sector} | ${h.since || '—'} |${withLast ? ` ${h.lastCall || '—'} |` : ''}`),
].join('\n');

/** Each holding's share of the current value, and the value by sector — worked out here, not by the model. */
export const withWeights = (rows) => {
    const total = rows.reduce((a, r) => a + r.value, 0);
    return rows.map((r) => ({ ...r, weightPct: total > 0 ? (r.value / total) * 100 : 0 }));
};

export const sectorSummary = (rows) => {
    const total = rows.reduce((a, r) => a + r.value, 0);
    const by = new Map();
    rows.forEach((r) => by.set(r.sector, (by.get(r.sector) || 0) + r.value));
    return [...by.entries()].map(([sector, value]) => ({ sector, value, pct: total > 0 ? (value / total) * 100 : 0 })).sort((a, b) => b.value - a.value);
};

const isoDaysBefore = (iso, days) => new Date(Date.parse(iso) - days * 86400000).toISOString().slice(0, 10);
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const SHARED_RULES = (today, from) => `Research and accuracy rules (these matter more than anything else):
- Use only information available as of ${longDate(today)}. News must be published between ${longDate(from)} and ${longDate(today)}; never present older news as recent.
- Never invent or estimate a price, a financial figure or a headline. If you cannot verify something, write "not verified" in that cell.
- Cite a source for every news item, price and figure. Prefer company filings, NSE/BSE announcements and investor presentations, then credible financial publications.
- Prices: use NSE as the main source or a reliable cross-check (state which), with the date and time of the quote. Allow for splits, bonuses and other corporate actions.
- Separate verified facts from your own interpretation. Say when financial data is out of date or missing.
- Do not treat a lack of bad news as a reason to BUY, and do not decide from the 52-week position alone.
- No guaranteed predictions and no unsupported price targets.`;

const CALL_DEFINITIONS = `Recommendation: exactly ONE word per stock. I already own every stock listed, so the words mean:
- BUY: add meaningfully now.
- ACCUMULATE: add gradually, on dips or in small steps.
- HOLD: keep the position as it is.
- REVIEW: I should reassess — valuation, risk, uncertainty or too little evidence.
- SELL: the fundamentals or risk justify exiting (all or most of it).
Confidence: exactly one of HIGH, MEDIUM, LOW — how sure you are, given the quality of the evidence you found.`;

export const dailyPrompt = (rows, { today = new Date().toISOString().slice(0, 10), saveTo = '' } = {}) => {
    const from = isoDaysBefore(today, 30);
    return `Act as an independent Indian equity research analyst. Research my personal stock portfolio as of ${longDate(today)}. This is research opinion for my own decisions, not a guarantee. My aim is long-term wealth creation (5 to 10 years) with sensible risk management.

THIS RUN covers only: recent news, price position, and one call per holding. Do not write fundamentals deep-dives or portfolio-level analysis now; I do those in a separate weekly run.

For each of the ${rows.length} holdings in my list below:
1. News: find news from ${longDate(from)} to ${longDate(today)} only — results, guidance, order wins, business developments, management changes, regulatory action, governance issues, and sector developments that affect it. Say whether each story is about the company or the whole sector. If there is nothing significant, write "No significant recent news found".
2. Price: the latest price, with the 52-week high and low, and how far the price is from each (in %). Classify the position as Bottom, Middle or Top of the range.
3. One call, and what you would need to see to change it.

${CALL_DEFINITIONS}

OUTPUT FORMAT — the table must come FIRST, before any other text, and there must be no other table above it. One markdown table, exactly these columns in this order, one row per holding, in the same order as my list:

| Stock | Price | 52-week position | Recommendation | Confidence | Reason | Key News (Date & Source) | What Would Change My View |

- Stock: the holding's name exactly as in my list, nothing else in the cell.
- Price: the price in ₹ only, e.g. 1,182.00
- 52-week position: Bottom, Middle or Top plus the percentage of the range, e.g. Bottom: 27.0%
- Recommendation / Confidence: only the single words described above.
- Reason: 2 to 3 sentences connecting the recent news, the company's position and the price. Do not just repeat the figures I gave you.
- Key News: each story with its publication date, headline or topic, and the source's name AND URL.
- What Would Change My View: one specific event, change in fundamentals or price level.
- If my last call is shown and you now disagree, say so and why in the Reason.

After the table leave a blank line, then a short summary (no more tables): the 5 holdings most exposed to bad news and why; the 5 best candidates for additional money and why (not simply the biggest gainers or the ones nearest their 52-week low); any holding where news or data was missing or stale; and your overall confidence.

${SHARED_RULES(today, from)}
${saveTo ? `
Saving: also save the table (ONLY the table, no other text) as a markdown file at exactly this path, creating nothing else and changing no other file in the project:
${saveTo.replace(/\/$/, '')}/research-${today}.md
My app reads that file from there. Do not edit, move or delete anything else in the project.
` : ''}
My holdings (figures come from my own records; "Price now" is my last stored quote and may be a day old; "Gain %" is against my average cost):

${holdingsTable(rows, { withLast: true })}`;
};

export const weeklyPrompt = (rows, { today = new Date().toISOString().slice(0, 10), saveTo = '' } = {}) => {
    const from = isoDaysBefore(today, 30);
    const weighted = withWeights(rows);
    const sectors = sectorSummary(weighted);
    return `Act as an independent Indian equity research analyst and portfolio risk analyst. Do my weekly review of my personal stock portfolio as of ${longDate(today)}. This is research opinion for my own decisions, not a guarantee. My aim is long-term wealth creation (5 to 10 years) with sensible risk management and disciplined capital allocation.

PART 1 — Fundamentals, holding by holding. Use the latest available results and say plainly when data is out of date or unavailable. For each holding assess: revenue and profit growth and how the latest results compare with earlier periods; earnings quality and cash flow; debt and balance-sheet strength; valuation (P/E, P/B, EV/EBITDA, whichever fits); industry outlook and competitive position; management quality and governance. Also use news from ${longDate(from)} to ${longDate(today)} (company or sector, with date and source).

${CALL_DEFINITIONS}

OUTPUT FORMAT — the table must come FIRST, before any other text, and no other table above it. One markdown table, exactly these columns, one row per holding, in my order:

| Stock | Price | 52-week position | Recommendation | Confidence | Reason | Key News (Date & Source) | What Would Change My View |

In Reason put the fundamentals-based case in 2 to 3 sentences (growth, margins, debt, valuation) and how the recent news and the price fit it. Price and 52-week position as in a daily run (₹ number only; Bottom / Middle / Top plus the % of the range). Key News: date, topic and source name AND URL for each story. Never decide from the 52-week position alone.

PART 2 — Portfolio level (after the table; use my figures below, do not recompute them):
A. Sector concentration: which sectors are overexposed, which are underrepresented, and which holdings share the same risk (for example rate-sensitive, commodity-linked, regulation-linked).
B. The five holdings most exposed to negative developments, and why (fundamentals, valuation, news, debt, size in the portfolio).
C. Five existing holdings that deserve more money, considering fundamentals, valuation, earnings growth, recent developments, long-term prospects and what I already hold in them. Do not simply pick the biggest gainers or the ones nearest their 52-week low.
D. Portfolio risk: diversification, single-company exposure, growth versus defensive mix, and the main downside risks.
E. Action plan — put every holding in exactly one of: Continue holding / Accumulate gradually / Monitor closely / Consider partial profit booking / Consider exiting. For anything touching profit booking, note that my gain % and first-bought date are given, and say that tax treatment (short or long term) is for me to check with my own records.

PART 3 — Final assessment: overall portfolio rating (Excellent / Good / Average / High Risk); overall confidence; the five most important actions; the biggest risks; and whether this portfolio suits a 5 to 10 year horizon.

${SHARED_RULES(today, from)}
${saveTo ? `
Saving: save your whole answer as a markdown file at exactly this path, creating nothing else and changing no other file in the project:
${saveTo.replace(/\/$/, '')}/research-${today}-weekly.md
The table must be the first thing in the file; keep the Part 2 and 3 write-up after it. My app imports the table and keeps the file. Do not edit, move or delete anything else in the project.
` : ''}
My holdings (figures come from my own records; "Weight %" is the share of today's value; "Price now" is my last stored quote and may be a day old):

${holdingsTable(weighted, { withLast: true, withWeight: true })}

Value by sector (from the same records):
${sectors.map((x) => `- ${x.sector}: ${x.pct.toFixed(1)}%`).join('\n')}`;
};

export const deepDivePrompt = (rows, reasons = {}, { today = new Date().toISOString().slice(0, 10) } = {}) => `Go deeper on the ${rows.length} Indian stock${rows.length === 1 ? '' : 's'} below, as of ${today}. A first pass flagged each one. For every stock:

1. Read the latest quarterly results and the company's own announcements (exchange filings, not only news sites). Give the figures that matter: revenue, profit, margins, debt, and any change in guidance, with the source URL.
2. Compare it with 2 direct competitors on valuation (P/E, P/B or EV/EBITDA, whichever fits) and on the last four quarters' growth.
3. List the 3 biggest risks and the 3 strongest points in its favour. Separate facts from your opinion.
4. Say what the first pass concluded and whether you agree. Then give one recommendation: BUY, ACCUMULATE, HOLD, REVIEW or SELL, your confidence (high, medium, low), and the price or event that would change it.
5. Say clearly what you could not verify.

Be specific and cite every figure. This is analysis for my own decisions, not a guarantee.

${holdingsTable(rows, { withLast: true })}

Why each was flagged:
${rows.map((h) => `- ${h.name}: ${reasons[h.id] || 'selected by me'}`).join('\n')}`;
