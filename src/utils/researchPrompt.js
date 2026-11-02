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
            price,
            gainPct: invested > 0 && price > 0 ? ((value - invested) / invested) * 100 : null,
            sector: sectorFor(s.sector, null),
            since: firstBuy(s),
            lastCall: call ? `${call.call} (${call.date})` : '',
        };
    })
    .filter((h) => h.qty > 0)
    .sort((a, b) => b.invested - a.invested);

const holdingsTable = (rows, { withLast }) => [
    `| Stock | Invested ₹ | Avg buy ₹ | Qty | Price now ₹ | Gain % | Sector | First bought |${withLast ? ' My last call |' : ''}`,
    `|---|---:|---:|---:|---:|---:|---|---|${withLast ? '---|' : ''}`,
    ...rows.map((h) => `| ${h.name} | ${inr(h.invested)} | ${inr(h.avg)} | ${inr(h.qty, 4)} | ${h.price ? inr(h.price) : '—'} | ${h.gainPct === null ? '—' : h.gainPct.toFixed(1)} | ${h.sector} | ${h.since || '—'} |${withLast ? ` ${h.lastCall || '—'} |` : ''}`),
].join('\n');

export const dailyPrompt = (rows, { today = new Date().toISOString().slice(0, 10) } = {}) => `You are researching my personal Indian stock portfolio as of ${today}. For each of the ${rows.length} holdings below, search for news from the last 30 days and check the current price and 52-week range. Do not guess: if you cannot verify a price, a date or a headline, say "not verified".

Output ONE markdown table, exactly these columns in this order, one row per holding, in the same order as my list:

| Stock | Price | 52-week position | Recommendation | Reason | Key News (Date & Source) | What Would Change My View |

Rules for the cells:
- Stock: the holding's name exactly as I wrote it. Nothing else in the cell.
- Price: today's price in ₹ only, e.g. 1,182.00
- 52-week position: Bottom, Middle or Top, then the percentage of the range, e.g. Bottom: 27.0%
- Recommendation: exactly ONE of BUY, ACCUMULATE, HOLD, REVIEW, SELL. No other words in that cell.
- Reason: 2 to 3 sentences. Use the news, the price position and my gain or loss. Do not repeat the numbers I gave you.
- Key News: each item with its date and the source's name AND URL. If there is no news in 30 days write "No recent news" (do not use older news).
- What Would Change My View: a specific event or price level.
- If my last call is shown and you now disagree, say so and say why in the Reason.

After the table, add a blank line and a short summary: the 5 holdings most exposed to bad news, the 5 best places to add money, and any holding whose news is missing or stale. Do not put another table in the summary.

This is analysis for my own decisions, not a guarantee. State your confidence (high, medium, low) in the summary.

My holdings (figures are from my own records; price now is my last stored quote and may be a day old):

${holdingsTable(rows, { withLast: true })}`;

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
