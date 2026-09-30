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
 * The stored coverage of one stock, prepared for a small model: counts by
 * theme over three windows (so it never has to count), the latest stories with
 * descriptions, and the older stories by theme so a pattern can be seen.
 */
export const archiveDigest = (symbol, label, { latest = 8, perThemeEarlier = 2, now = Date.now() } = {}) => {
    const { items } = readArchive(symbol);
    if (!items.length) return { count: 0, since: null, lines: [] };
    const within = (days) => items.filter((i) => now - when(i) < days * DAY_MS);
    const window = (days) => {
        const w = within(days);
        return `last ${days} days: ${w.length}${w.length ? ` (${countThemes(w)})` : ''}`;
    };
    const oldest = items[items.length - 1];
    const recent = items.slice(0, latest);
    const earlier = items.filter((i) => now - when(i) >= 30 * DAY_MS);
    const earlierByTheme = {};
    earlier.forEach((i) => {
        const t = i.theme || themeOf(i);
        if ((earlierByTheme[t] = earlierByTheme[t] || []).length < perThemeEarlier) earlierByTheme[t].push(i);
    });

    const lines = [
        `${label}: ${items.length} headlines stored since ${day(oldest)}. ${window(7)}; ${window(30)}; ${window(90)}.`,
        `${label}, latest:`,
        ...recent.map((i) => `  ${day(i)} [${i.theme || themeOf(i)}] ${i.title} (${i.source})${i.summary ? `. ${String(i.summary).slice(0, 200)}` : ''}`),
        ...(Object.keys(earlierByTheme).length
            ? [`${label}, earlier stories by theme (older than 30 days):`,
                ...Object.entries(earlierByTheme).flatMap(([t, list]) => list.map((i) => `  ${day(i)} [${t}] ${i.title} (${i.source})`))]
            : []),
    ];
    return { count: items.length, since: oldest.published || oldest.firstSeen, lines };
};

/** Counts for the News tab: how much is stored per stock. */
export const archiveStats = (symbol) => {
    const { items } = readArchive(symbol);
    const oldest = items[items.length - 1];
    return { count: items.length, since: oldest ? (oldest.published || oldest.firstSeen) : null };
};
