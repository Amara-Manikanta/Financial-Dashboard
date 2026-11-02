/**
 * Daily research table → per-stock calls.
 *
 * The table comes from an outside research run (Google Antigravity, pasted as
 * the markdown it produces, or as tab-separated text copied from its rendered
 * view). This module only reads it; it never decides anything. Each row becomes
 * a call — BUY, ACCUMULATE, HOLD, REVIEW or SELL — with the reason and the news
 * as written, matched to the holding it is about.
 *
 * Nothing here touches db.json: a model's wording is not a financial record.
 * Snapshots are stored by the server beside the database (see strategy.js).
 */

export const CALLS = ['BUY', 'ACCUMULATE', 'HOLD', 'REVIEW', 'SELL'];

/** Most bullish first, so a move between two calls has a direction. */
const RANK = { BUY: 4, ACCUMULATE: 3, HOLD: 2, REVIEW: 1, SELL: 0 };

const CALL_WORDS = [
    ['ACCUMULATE', 'ACCUMULATE'], ['BUY', 'BUY'], ['HOLD', 'HOLD'], ['REVIEW', 'REVIEW'],
    ['SELL', 'SELL'], ['EXIT', 'SELL'], ['TRIM', 'REVIEW'], ['REDUCE', 'REVIEW'], ['AVOID', 'SELL'],
];

/** The first call word in a cell ("**STRONG BUY**", "HOLD (partial)") → one of CALLS, or null. */
export const normaliseCall = (text) => {
    const upper = String(text || '').toUpperCase();
    let best = null;
    CALL_WORDS.forEach(([word, call]) => {
        const at = upper.search(new RegExp(`\\b${word}\\b`));
        if (at >= 0 && (best === null || at < best.at)) best = { at, call };
    });
    return best ? best.call : null;
};

/** "[text](url)" → text; emphasis, code ticks and tags removed; <br> becomes a line break. */
const clean = (s) => String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)\*(?=\S)|(?<=\S)\*(\s|$)/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim();

const splitMarkdownRow = (line) => {
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split('|').map((c) => c.trim());
};

const isSeparator = (cells) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')));

const HEADERS = [
    ['name', /(stock|company|holding|name|scrip|security)/i],
    ['call', /(recommend|call|action|verdict|rating|view$)/i],
    ['confidence', /(confidence|conviction)/i],
    ['reason', /(reason|rationale|why|thesis)/i],
    ['news', /(news|headline|catalyst|source)/i],
    ['trigger', /(change|trigger|watch|invalidat)/i],
    ['price', /(price|ltp|cmp)/i],
    ['range', /(52|week|range|position)/i],
];

const mapHeader = (cells) => {
    const index = {};
    cells.forEach((c, i) => {
        const text = clean(c);
        // "What Would Change My View" contains "view" — it is the trigger column, not the call.
        const found = /change|trigger|invalidat/i.test(text) ? 'trigger' : (HEADERS.find(([, re]) => re.test(text)) || [])[0];
        if (found && index[found] === undefined) index[found] = i;
    });
    return index;
};

/** "(Bottom: 27.0%)" → { label: 'Bottom', pct: 27 } */
const rangeOf = (text) => {
    const m = /\b(bottom|middle|top)\b[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*%/i.exec(text);
    return m ? { label: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), pct: Number(m[2]) } : null;
};

const priceOf = (text) => {
    const m = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i.exec(text);
    return m ? Number(m[1].replace(/,/g, '')) : null;
};

/** A dedicated Price column may hold a bare "1,182.00". */
const bareNumber = (text) => {
    const m = /^\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*$/i.exec(String(text || ''));
    return m ? Number(m[1].replace(/,/g, '')) : null;
};

/**
 * Read pasted text into rows. Returns `{ rows, skipped }`: a row that could not
 * be read as a call is reported, never guessed at.
 */
export const parseResearch = (text) => {
    const all = String(text || '').split(/\r?\n/);
    const isPipe = (l) => l.includes('|');
    const useTabs = all.filter(isPipe).length < 2 && all.some((l) => l.includes('\t'));
    const isRowLine = (l) => (useTabs ? l.includes('\t') : isPipe(l));
    const toCells = (l) => (useTabs ? l.split('\t').map((c) => c.trim()) : splitMarkdownRow(l));

    // The header is the first line that names both a stock and a call column.
    let headerAt = -1;
    for (let i = 0; i < all.length; i += 1) {
        if (!isRowLine(all[i])) continue;
        const idx = mapHeader(toCells(all[i]));
        if (idx.name !== undefined && idx.call !== undefined) { headerAt = i; break; }
    }
    if (headerAt < 0) return { rows: [], skipped: [], error: 'No table found. Paste the whole table, including its header row (Stock | Recommendation | …).' };

    const idx = mapHeader(toCells(all[headerAt]));
    const rows = [];
    const skipped = [];
    // The table ends at the first blank or non-table line, so a second table further
    // down (a sector summary, say) is never read as calls.
    for (let i = headerAt + 1; i < all.length; i += 1) {
        if (!isRowLine(all[i])) break;
        const cells = toCells(all[i]);
        if (isSeparator(cells)) continue;
        const nameCell = clean(cells[idx.name] ?? '');
        if (!nameCell) continue;
        const [first, ...rest] = nameCell.split('\n');
        const name = first.replace(/\s*\([^)]*\)\s*$/, '').trim() || first.trim();
        const callCell = clean(cells[idx.call] ?? '');
        const call = normaliseCall(callCell);
        if (!call) { skipped.push({ name, why: `No BUY / ACCUMULATE / HOLD / REVIEW / SELL in “${callCell.slice(0, 40)}”` }); continue; }
        const extra = rest.join(' ');
        const priceCell = clean(cells[idx.price] ?? '');
        rows.push({
            name,
            call,
            confidence: (/\b(HIGH|MEDIUM|LOW)\b/i.exec(clean(cells[idx.confidence] ?? '')) || [''])[0].toUpperCase(),
            reason: clean(cells[idx.reason] ?? '').replace(/\n/g, ' '),
            news: clean(cells[idx.news] ?? '').replace(/\n/g, ' '),
            trigger: clean(cells[idx.trigger] ?? '').replace(/\n/g, ' '),
            price: bareNumber(priceCell) ?? priceOf(`${extra} ${priceCell}`),
            range: rangeOf(`${clean(cells[idx.range] ?? '')} ${extra} ${priceCell}`),
        });
    }
    return { rows, skipped, error: rows.length ? null : 'The table had no readable rows.' };
};

// ── Matching a row to a holding ──────────────────────────────────────────────

const DROP = new Set(['limited', 'ltd', 'the', 'company', 'co', 'corporation', 'corp', 'and', 'of', 'inc']);
const SYNONYMS = { corp: 'corporation', bees: 'bees', etf: 'etf' };

const tokens = (s) => new Set(String(s || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .map((t) => SYNONYMS[t] || t)
    .filter((t) => t && !DROP.has(t)));

/**
 * Pair each row with the holding it names.
 *
 * Names never match exactly ("Adani Ports & SEZ" for "Adani Ports and Special
 * Economic Zone Limited"), so rows are scored by how much of the shorter name
 * the longer one contains. A row is matched only when one holding clearly wins;
 * otherwise it is left for a person to pick — a call filed under the wrong
 * company is worse than a question. `aliases` maps a pasted name the user has
 * already resolved to a holding id.
 *
 * @param rows      from parseResearch
 * @param holdings  [{ id, name }]
 * @param aliases   { [lowercased pasted name]: holdingId }
 */
export const matchHoldings = (rows, holdings, aliases = {}) => {
    const held = (holdings || []).map((h) => ({ id: String(h.id), name: h.name, tokens: tokens(h.name) }));
    return rows.map((row) => {
        const alias = aliases[String(row.name).toLowerCase()];
        if (alias && held.some((h) => h.id === String(alias))) return { ...row, holdingId: String(alias), matchedBy: 'alias' };

        const mine = tokens(row.name);
        const scored = held.map((h) => {
            if (!mine.size || !h.tokens.size) return { h, score: 0 };
            let shared = 0;
            mine.forEach((t) => { if (h.tokens.has(t)) shared += 1; });
            const score = shared / Math.min(mine.size, h.tokens.size);
            // A one-word row ("IRCTC") must be that word, not merely contained by a long name.
            const covered = shared / Math.max(mine.size, h.tokens.size);
            return { h, score: score >= 0.66 ? score + covered / 10 : 0 };
        }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

        if (scored.length === 0) return { ...row, holdingId: null, matchedBy: null };
        if (scored.length > 1 && scored[0].score - scored[1].score < 0.05) {
            return { ...row, holdingId: null, matchedBy: null, ambiguous: scored.slice(0, 3).map((x) => x.h.name) };
        }
        return { ...row, holdingId: scored[0].h.id, matchedBy: 'name' };
    });
};

// ── Comparing with the previous paste ────────────────────────────────────────

/**
 * What moved since the last snapshot. `previous` and `current` are lists of
 * rows with `holdingId` and `call`. Direction is by RANK: BUY > ACCUMULATE >
 * HOLD > REVIEW > SELL.
 */
export const compareCalls = (previous, current) => {
    const before = new Map((previous || []).filter((r) => r.holdingId).map((r) => [String(r.holdingId), r]));
    return (current || []).map((row) => {
        const prev = row.holdingId ? before.get(String(row.holdingId)) : null;
        if (!prev) return { ...row, previousCall: null, change: row.holdingId ? 'new' : 'unmatched' };
        if (prev.call === row.call) return { ...row, previousCall: prev.call, change: 'same' };
        return { ...row, previousCall: prev.call, change: RANK[row.call] > RANK[prev.call] ? 'upgrade' : 'downgrade' };
    });
};

/**
 * The newest call for every holding across all snapshots (oldest first), with
 * how many days old it is. A holding missing from today's paste keeps its last
 * call but shows its age, so a stale call cannot pass for a fresh one.
 */
export const latestCalls = (snapshots, today = new Date().toISOString().slice(0, 10)) => {
    const out = new Map();
    [...(snapshots || [])].sort((a, b) => a.date.localeCompare(b.date)).forEach((snap) => {
        (snap.rows || []).forEach((r) => {
            if (!r.holdingId) return;
            out.set(String(r.holdingId), { ...r, date: snap.date, ageDays: Math.round((Date.parse(today) - Date.parse(snap.date)) / 86400000) });
        });
    });
    return out;
};

/** A holding's calls over time, oldest first, collapsed to the days the call changed. */
export const callHistory = (snapshots, holdingId) => {
    const rows = [];
    [...(snapshots || [])].sort((a, b) => a.date.localeCompare(b.date)).forEach((snap) => {
        const r = (snap.rows || []).find((x) => String(x.holdingId) === String(holdingId));
        if (!r) return;
        const last = rows[rows.length - 1];
        rows.push({ date: snap.date, call: r.call, reason: r.reason, changed: !last || last.call !== r.call });
    });
    return rows;
};

export const callRank = (call) => RANK[call] ?? -1;
