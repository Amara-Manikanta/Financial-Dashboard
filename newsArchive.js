/**
 * A growing store of headlines per stock, so the model can see months of
 * coverage instead of whatever the sources return today.
 *
 * One JSON file per symbol under `<database dir>/db/news/` — gitignored with
 * the rest of `db/`, and deliberately not in db.json: headlines are not
 * financial records and must never ride along on a collection write.
 *
 * Each headline is tagged with a theme by plain keyword rules, so a digest can
 * say "results 3, ratings 2" without asking a small model to count.
 */
import fs from 'fs';
import path from 'path';

const KEEP_DAYS = 365;
const MAX_PER_STOCK = 400;
const DAY_MS = 86400000;

let dir = null;

export const configureArchive = ({ archiveDir } = {}) => {
    dir = archiveDir || null;
    if (dir) fs.mkdirSync(dir, { recursive: true });
};

/** First matching rule wins; order matters ("buyback" is corporate, not a rating). */
const THEMES = [
    ['corporate action', /\b(dividend|bonus|split|buy-?back|record date|rights issue|agm|demerger)\b/i],
    ['regulation & legal', /\b(sebi|rbi|court|penalty|fine[ds]?|probe|regulator|lawsuit|gst|tax (notice|demand)|ban(s|ned)?)\b/i],
    ['results', /\b(q[1-4]|quarter(ly)?|results?|earnings|profit|revenue|margins?|guidance|ebitda|fy\d{2})\b/i],
    ['deals & orders', /\b(deal|order|contract|wins?|bags?|signs?|partnership|acquir\w*|merger|stake|jv|joint venture)\b/i],
    ['management', /\b(ceo|cfo|md|chairman|resign\w*|appoint\w*|board|management|promoter)\b/i],
    ['analyst ratings', /\b(target price|target|rating|upgrade[sd]?|downgrade[sd]?|brokerage|outperform|underperform|overweight|underweight|buy call|sell call)\b/i],
];

const STOP = new Set('the a an and or of to in on for with at by from as is are was be its it this that after amid over into up down new shares share stock stocks says said ltd limited india indian inr rs crore cr per cent percent'.split(' '));
const wordsOf = (title, exclude) => new Set(String(title || '').toLowerCase().split(/[^a-z0-9%]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !exclude.has(w)));

/**
 * One entry per story. Outlets word the same event differently, so titles are
 * compared by their significant words (the company's own name excluded — it
 * is in every title) and grouped when at least two words and half of the
 * shorter title are shared, within three days. The group keeps every outlet;
 * how many covered it is itself a signal of how much it matters.
 */
export const consolidate = (items, companyName = '') => {
    const exclude = new Set(String(companyName).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const groups = [];
    [...(items || [])]
        .sort((a, b) => (Date.parse(b.published || b.firstSeen) || 0) - (Date.parse(a.published || a.firstSeen) || 0))
        .forEach((item) => {
            const words = wordsOf(item.title, exclude);
            const t = Date.parse(item.published || item.firstSeen) || 0;
            const match = groups.find((g) => {
                if (Math.abs(g.t - t) > 3 * DAY_MS) return false;
                const shared = [...words].filter((w) => g.words.has(w)).length;
                return shared >= 2 && shared / Math.max(1, Math.min(words.size, g.words.size)) >= 0.5;
            });
            if (match) {
                match.members.push(item);
                words.forEach((w) => match.words.add(w));
                match.t = Math.min(match.t, t || match.t);
            } else {
                groups.push({ words, t, members: [item] });
            }
        });
    return groups.map((g) => {
        const m = g.members;
        const sources = [...new Set(m.map((i) => i.source).filter(Boolean))];
        const best = m.find((i) => i.summary) || m.reduce((a, b) => (String(b.title).length > String(a.title).length ? b : a));
        const direct = m.find((i) => i.url && !/news\.google\.com/.test(i.url)) || m[0];
        return {
            title: best.title,
            summary: (m.find((i) => i.summary) || {}).summary || '',
            text: (m.find((i) => i.text) || {}).text || '',
            source: sources.join(', '),
            sources,
            coverage: sources.length,
            url: direct.url || '',
            links: m.map((i) => ({ source: i.source, url: i.url })).filter((l) => l.url),
            published: g.t ? new Date(g.t).toISOString() : null,
            theme: best.theme || themeOf(best),
            headlines: m.length,
        };
    });
};

export const themeOf = (item) => {
    const text = `${item.title || ''} ${item.summary || ''}`;
    const hit = THEMES.find(([, re]) => re.test(text));
    return hit ? hit[0] : 'other';
};

const safeName = (symbol) => String(symbol || '').toUpperCase().replace(/[^A-Z0-9._&-]/g, '_').slice(0, 40);
const fileFor = (symbol) => (dir && symbol ? path.join(dir, `${safeName(symbol)}.json`) : null);
const keyOf = (title) => String(title || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const when = (item) => Date.parse(item.published || item.firstSeen) || 0;

export const readArchive = (symbol) => {
    const file = fileFor(symbol);
    if (!file) return { symbol, name: '', items: [] };
    try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { symbol, name: saved.name || '', items: Array.isArray(saved.items) ? saved.items : [] };
    } catch {
        return { symbol, name: '', items: [] };
    }
};

/**
 * Add new headlines to what is stored. A story already stored keeps its entry,
 * but gains a description if the new copy has one. Returns the archive.
 */
export const mergeIntoArchive = (symbol, name, items, now = Date.now()) => {
    const file = fileFor(symbol);
    const archive = readArchive(symbol);
    const byKey = new Map(archive.items.map((i) => [keyOf(i.title), i]));
    let added = 0;
    (items || []).forEach((n) => {
        const key = keyOf(n.title);
        if (!key) return;
        const existing = byKey.get(key);
        if (existing) {
            if (!existing.summary && n.summary) existing.summary = n.summary;
            return;
        }
        byKey.set(key, {
            title: n.title, source: n.source, url: n.url, published: n.published || null,
            summary: n.summary || '', theme: themeOf(n), firstSeen: new Date(now).toISOString(),
        });
        added += 1;
    });
    const kept = [...byKey.values()]
        .filter((i) => now - when(i) < KEEP_DAYS * DAY_MS)
        .sort((a, b) => when(b) - when(a))
        .slice(0, MAX_PER_STOCK);
    const next = { symbol, name: name || archive.name, items: kept };
    if (file && added > 0) {
        // Write to a temp file and rename: a crash mid-write leaves the old archive, not half a file.
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ name: next.name, updatedAt: new Date(now).toISOString(), items: kept }));
        fs.renameSync(tmp, file);
    }
    return { ...next, added };
};

const day = (item) => {
    const t = when(item);
    return t ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'undated';
};

const countThemes = (items) => {
    const counts = {};
    items.forEach((i) => { counts[i.theme || themeOf(i)] = (counts[i.theme || themeOf(i)] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ');
};

/**
 * The stored coverage of one stock, prepared for a small model. Headlines are
 * first consolidated into stories, then: counts by theme over three windows
 * (so the model never counts), the latest stories with every outlet that
 * covered them and — for the newest few — the article text itself, and older
 * stories by theme so a pattern can be seen.
 */
export const archiveDigest = (symbol, label, { latest = 8, withText = 3, textChars = 1500, perThemeEarlier = 2, now = Date.now() } = {}) => {
    const { items } = readArchive(symbol);
    if (!items.length) return { count: 0, stories: 0, since: null, lines: [] };
    const stories = consolidate(items, label);
    const age = (s) => now - (Date.parse(s.published) || 0);
    const window = (days) => {
        const w = stories.filter((s) => age(s) < days * DAY_MS);
        return `last ${days} days: ${w.length} ${w.length === 1 ? 'story' : 'stories'}${w.length ? ` (${countThemes(w)})` : ''}`;
    };
    const outlets = (s) => (s.coverage > 1 ? `${s.source} — ${s.coverage} outlets` : s.source);
    const oldest = items[items.length - 1];
    const earlierByTheme = {};
    stories.filter((s) => age(s) >= 30 * DAY_MS).forEach((s) => {
        if ((earlierByTheme[s.theme] = earlierByTheme[s.theme] || []).length < perThemeEarlier) earlierByTheme[s.theme].push(s);
    });

    const lines = [
        `${label}: ${items.length} headlines stored since ${day(oldest)}, which are ${stories.length} distinct stories. ${window(7)}; ${window(30)}; ${window(90)}.`,
        `${label}, latest stories (outlets that covered each in brackets):`,
        ...stories.slice(0, latest).flatMap((s, n) => [
            `  ${day(s)} [${s.theme}] ${s.title} (${outlets(s)})${s.summary ? `. ${String(s.summary).slice(0, 200)}` : ''}`,
            ...(n < withText && s.text ? [`    Article text (first part): ${String(s.text).slice(0, textChars).replace(/\n+/g, ' / ')}`] : []),
        ]),
        ...(Object.keys(earlierByTheme).length
            ? [`${label}, earlier stories by theme (older than 30 days):`,
                ...Object.entries(earlierByTheme).flatMap(([t, list]) => list.map((s) => `  ${day(s)} [${t}] ${s.title} (${outlets(s)})`))]
            : []),
    ];
    return { count: items.length, stories: stories.length, since: oldest.published || oldest.firstSeen, lines };
};

/** Save an article's extracted text (or that it could not be read) on every stored copy with that URL. */
export const attachText = (symbol, url, text, error = '') => {
    const file = fileFor(symbol);
    if (!file || !url) return;
    const saved = readArchive(symbol);
    let changed = false;
    saved.items.forEach((i) => {
        if (i.url === url) { i.text = text || ''; i.textError = error || ''; i.textTried = true; changed = true; }
    });
    if (!changed) return;
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ name: saved.name, updatedAt: new Date().toISOString(), items: saved.items }));
    fs.renameSync(tmp, file);
};

/** Counts for the News tab: how much is stored per stock. */
export const archiveStats = (symbol) => {
    const { items } = readArchive(symbol);
    const oldest = items[items.length - 1];
    return { count: items.length, since: oldest ? (oldest.published || oldest.firstSeen) : null };
};
