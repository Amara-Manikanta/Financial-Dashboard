/**
 * A growing record of news per stock, one CSV file each, so months of
 * coverage can be read back — by the analyst's digest, by the stock page, and
 * by you in Excel or Numbers (a file per stock, like a tab per stock).
 *
 * One row per *story*, not per headline: the same event reported by several
 * outlets is one row listing all of them. Rows hold what the local model took
 * from the article — key points, impact, why it matters — never the article
 * itself, which is read, analysed and discarded.
 *
 * Files live in `<database dir>/db/news/` — gitignored with the rest of `db/`,
 * and deliberately not in db.json: news is not a financial record and must
 * never ride along on a collection write.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KEEP_DAYS = 365;
const MAX_PER_STOCK = 400;
const DAY_MS = 86400000;

let dir = null;

export const configureArchive = ({ archiveDir } = {}) => {
    dir = archiveDir || null;
    if (dir) fs.mkdirSync(dir, { recursive: true });
};

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

export const COLUMNS = [
    'id', 'date', 'first_seen', 'company', 'theme', 'title', 'outlets', 'sources',
    'impact', 'key_points', 'why_it_matters', 'analysed_by', 'analysed_at', 'analysis_basis',
    'status', 'summary', 'links',
];

/**
 * Spreadsheet apps run a cell starting with = + - or @ as a formula, and a
 * headline is text someone else wrote. Such cells get a leading apostrophe,
 * removed again on read.
 */
const cell = (value) => {
    let v = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@]/.test(v)) v = `'${v}`;
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export const toCsv = (rows) => [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';

export const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const s = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        if (quoted) {
            if (ch === '"' && s[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false; else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && s[i + 1] === '\n') i += 1;
            row.push(field); rows.push(row); row = []; field = '';
        } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const [header, ...body] = rows.filter((r) => r.length > 1 || r[0]);
    if (!header) return [];
    return body.map((r) => Object.fromEntries(header.map((h, i) => {
        const v = r[i] ?? '';
        return [h, /^'[=+\-@]/.test(v) ? v.slice(1) : v];
    })));
};

/* ------------------------------------------------------------------ *
 * Themes and stories
 * ------------------------------------------------------------------ */

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

const STOP = new Set('the a an and or of to in on for with at by from as is are was be its it this that after amid over into up down new shares share stock stocks says said ltd limited india indian inr rs crore cr per cent percent'.split(' '));
const wordsOf = (title, exclude) => new Set(String(title || '').toLowerCase().split(/[^a-z0-9%]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !exclude.has(w)));
const keyOf = (title) => String(title || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const timeOf = (item) => Date.parse(item.published || item.firstSeen) || 0;
const newId = (title, t) => crypto.createHash('sha1').update(`${keyOf(title)}|${new Date(t || 0).toISOString().slice(0, 10)}`).digest('hex').slice(0, 12);

/**
 * One entry per story. Outlets word the same event differently, so titles are
 * compared by their significant words (the company's own name excluded — it
 * is in every title) and grouped when at least two words and half of the
 * shorter title are shared, within three days. Members may be fresh headlines
 * or stories already stored; a stored story keeps its id and its analysis.
 */
export const consolidate = (items, companyName = '') => {
    const exclude = new Set(String(companyName).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const groups = [];
    [...(items || [])]
        .filter((i) => i && i.title)
        .sort((a, b) => timeOf(b) - timeOf(a))
        .forEach((item) => {
            const words = wordsOf(item.title, exclude);
            const t = timeOf(item);
            const match = groups.find((g) => {
                if (Math.abs(g.t - t) > 3 * DAY_MS) return false;
                const shared = [...words].filter((w) => g.words.has(w)).length;
                return shared >= 2 && shared / Math.max(1, Math.min(words.size, g.words.size)) >= 0.5;
            });
            if (match) {
                match.members.push(item);
                words.forEach((w) => match.words.add(w));
                if (t) match.t = Math.min(match.t || t, t);
            } else {
                groups.push({ words, t, members: [item] });
            }
        });
    return groups.map((g) => {
        const m = g.members;
        const links = [];
        m.forEach((i) => (i.links || [{ source: i.source, url: i.url }]).forEach((l) => {
            if (l.url && !links.some((x) => x.url === l.url)) links.push({ source: l.source || '', url: l.url });
        }));
        const sources = [...new Set(m.flatMap((i) => i.sources || [i.source]).filter(Boolean))];
        const stored = m.find((i) => i.id) || null;
        const analysed = m.find((i) => i.keyPoints?.length) || null;
        const best = stored || m.find((i) => i.summary) || m.reduce((a, b) => (String(b.title).length > String(a.title).length ? b : a));
        const direct = links.find((l) => !/news\.google\.com/.test(l.url)) || links[0] || {};
        const firstSeen = m.map((i) => i.firstSeen).filter(Boolean).sort()[0] || null;
        return {
            id: stored?.id || newId(best.title, g.t),
            title: best.title,
            summary: (m.find((i) => i.summary) || {}).summary || '',
            source: sources.join(', '),
            sources,
            coverage: sources.length,
            url: direct.url || '',
            links,
            published: g.t ? new Date(g.t).toISOString() : null,
            firstSeen,
            theme: best.theme || themeOf(best),
            headlines: m.reduce((n, i) => n + (i.headlines || 1), 0),
            keyPoints: analysed?.keyPoints || [],
            impact: analysed?.impact || '',
            why: analysed?.why || '',
            analysedBy: analysed?.analysedBy || '',
            analysedAt: analysed?.analysedAt || '',
            basis: analysed?.basis || '',
            status: (m.find((i) => i.status) || {}).status || '',
        };
    });
};

/* ------------------------------------------------------------------ *
 * Files
 * ------------------------------------------------------------------ */

const safeName = (symbol) => String(symbol || '').toUpperCase().replace(/[^A-Z0-9._&-]/g, '_').slice(0, 40);
export const fileFor = (symbol) => (dir && symbol ? path.join(dir, `${safeName(symbol)}.csv`) : null);

const fromRow = (r) => ({
    id: r.id,
    published: r.date || null,
    firstSeen: r.first_seen || null,
    theme: r.theme || 'other',
    title: r.title,
    sources: String(r.sources || '').split(';').map((x) => x.trim()).filter(Boolean),
    impact: r.impact || '',
    keyPoints: String(r.key_points || '').split('\n').map((x) => x.trim()).filter(Boolean),
    why: r.why_it_matters || '',
    analysedBy: r.analysed_by || '',
    analysedAt: r.analysed_at || '',
    basis: r.analysis_basis || '',
    status: r.status || '',
    summary: r.summary || '',
    links: String(r.links || '').split('\n').map((line) => {
        const at = line.search(/https?:\/\//);
        return at < 0 ? null : { source: line.slice(0, at).replace(/:\s*$/, '').trim(), url: line.slice(at).trim() };
    }).filter(Boolean),
    headlines: Number(r.outlets) || 1,
});
const withCoverage = (s) => ({ ...s, coverage: s.sources.length, source: s.sources.join(', ') });

const toRow = (s, company) => ({
    id: s.id,
    date: s.published || '',
    first_seen: s.firstSeen || '',
    company,
    theme: s.theme,
    title: s.title,
    outlets: s.coverage || (s.sources || []).length || 1,
    sources: (s.sources || []).join('; '),
    impact: s.impact || '',
    key_points: (s.keyPoints || []).join('\n'),
    why_it_matters: s.why || '',
    analysed_by: s.analysedBy || '',
    analysed_at: s.analysedAt || '',
    analysis_basis: s.basis || '',
    status: s.status || '',
    summary: s.summary || '',
    links: (s.links || []).map((l) => `${l.source}: ${l.url}`).join('\n'),
});

export const readArchive = (symbol) => {
    const file = fileFor(symbol);
    if (!file) return { symbol, name: '', items: [] };
    try {
        const rows = parseCsv(fs.readFileSync(file, 'utf8'));
        return { symbol, name: rows[0]?.company || '', items: rows.map((r) => withCoverage(fromRow(r))) };
    } catch {
        return { symbol, name: '', items: [] };
    }
};

const writeArchive = (symbol, name, stories) => {
    const file = fileFor(symbol);
    if (!file) return;
    const csv = toCsv(stories.map((s) => toRow(s, name)));
    try { if (fs.readFileSync(file, 'utf8') === csv) return; } catch { /* new file */ }
    // Temp file and rename: a crash mid-write leaves the old file, not half of one.
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, csv);
    fs.renameSync(tmp, file);
};

/**
 * Add fresh headlines. Each joins the story it belongs to (adding its outlet)
 * or starts a new one. Stories older than a year drop off. Returns the stories
 * and how many are new.
 */
export const mergeIntoArchive = (symbol, name, headlines, now = Date.now()) => {
    const archive = readArchive(symbol);
    const company = name || archive.name;
    const stamped = (headlines || []).filter((h) => h && h.title).map((h) => ({ ...h, firstSeen: new Date(now).toISOString() }));
    const stories = consolidate([...archive.items, ...stamped], company)
        .filter((s) => now - timeOf(s) < KEEP_DAYS * DAY_MS)
        .sort((a, b) => timeOf(b) - timeOf(a))
        .slice(0, MAX_PER_STOCK);
    writeArchive(symbol, company, stories);
    return { symbol, name: company, items: stories, added: Math.max(0, stories.length - archive.items.length) };
};

/** Store the model's reading of one story (or why it could not be read). */
export const attachAnalysis = (symbol, id, fields) => {
    const archive = readArchive(symbol);
    const story = archive.items.find((s) => s.id === id);
    if (!story) return false;
    Object.assign(story, fields);
    story.coverage = story.sources.length;
    writeArchive(symbol, archive.name, archive.items);
    return true;
};

/* ------------------------------------------------------------------ *
 * What the model and the pages read
 * ------------------------------------------------------------------ */

const dateText = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const day = (item) => {
    const t = timeOf(item);
    return t ? dateText(t) : 'undated';
};

/**
 * When a story came out, how long ago, and — when later — when it was
 * collected, so the model can tell today's news from last quarter's without
 * working out a date difference.
 */
const dated = (s, now) => {
    const t = timeOf(s);
    if (!t) return 'undated';
    const days = Math.floor((now - t) / DAY_MS);
    const ago = days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
    const seen = Date.parse(s.firstSeen) || 0;
    const late = seen && Math.floor((seen - t) / DAY_MS) >= 1 ? `, collected ${dateText(seen)}` : '';
    return `${dateText(t)} (${ago}${late})`;
};

const countBy = (items, key) => {
    const counts = {};
    items.forEach((i) => { if (i[key]) counts[i[key]] = (counts[i[key]] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ');
};

/**
 * The stored coverage of one stock, prepared for a small model: counts by
 * theme and by impact over three windows (so the model never counts), the
 * latest stories with every outlet that covered them and the key points
 * already taken from each article, and older stories by theme.
 */
export const archiveDigest = (symbol, label, { latest = 8, perThemeEarlier = 2, now = Date.now() } = {}) => {
    const stories = readArchive(symbol).items;
    if (!stories.length) return { count: 0, analysed: 0, since: null, lines: [] };
    const age = (s) => now - timeOf(s);
    const window = (days) => {
        const w = stories.filter((s) => age(s) < days * DAY_MS);
        const impacts = countBy(w, 'impact');
        return `last ${days} days: ${w.length} ${w.length === 1 ? 'story' : 'stories'}${w.length ? ` (${countBy(w, 'theme')}${impacts ? `; read as ${impacts}` : ''})` : ''}`;
    };
    const outlets = (s) => (s.coverage > 1 ? `${s.sources.join(', ')} — ${s.coverage} outlets` : s.sources.join(', '));
    const oldest = stories[stories.length - 1];
    const earlierByTheme = {};
    // Only stories not already listed above.
    stories.slice(latest).filter((s) => age(s) >= 30 * DAY_MS).forEach((s) => {
        if ((earlierByTheme[s.theme] = earlierByTheme[s.theme] || []).length < perThemeEarlier) earlierByTheme[s.theme].push(s);
    });

    const lines = [
        `Today is ${dateText(now)}. Dates below are publication dates; "days ago" is counted from today.`,
        `${label}: ${stories.length} stories stored since ${day(oldest)}. ${window(7)}; ${window(30)}; ${window(90)}.`,
        `${label}, latest stories (outlets in brackets; key points were taken from each article earlier by a local model):`,
        ...stories.slice(0, latest).flatMap((s) => [
            `  ${dated(s, now)} [${s.theme}] ${s.title} (${outlets(s)})`,
            ...(s.keyPoints.length
                ? [`    Key points (${s.impact || 'unrated'}; read ${s.analysedAt ? dateText(Date.parse(s.analysedAt)) : 'earlier'} from the ${s.basis === 'description' ? 'publisher\'s description' : 'article'}): ${s.keyPoints.join(' ')}${s.why ? ` Why it matters: ${s.why}` : ''}`]
                : s.summary ? [`    Description: ${String(s.summary).slice(0, 200)}`] : []),
        ]),
        ...(Object.keys(earlierByTheme).length
            ? [`${label}, earlier stories by theme (older than 30 days):`,
                ...Object.entries(earlierByTheme).flatMap(([t, list]) => list.map((s) => `  ${dated(s, now)} [${t}${s.impact ? `, ${s.impact}` : ''}] ${s.title}${s.keyPoints[0] ? ` — ${s.keyPoints[0]}` : ''}`))]
            : []),
    ];
    return { count: stories.length, analysed: stories.filter((s) => s.keyPoints.length).length, since: oldest.published || oldest.firstSeen, lines };
};

/** Counts for the pages: how much is stored and read per stock. */
export const archiveStats = (symbol) => {
    const { items } = readArchive(symbol);
    const oldest = items[items.length - 1];
    return {
        count: items.length,
        analysed: items.filter((s) => s.keyPoints.length).length,
        since: oldest ? (oldest.published || oldest.firstSeen) : null,
    };
};

/* ------------------------------------------------------------------ *
 * Consolidated all-stocks archive
 * ------------------------------------------------------------------ */

export const CONSOLIDATED_COLUMNS = [
    'symbol', 'company', 'date', 'impact', 'theme', 'title',
    'key_points', 'why_it_matters', 'outlets', 'sources',
    'first_seen', 'analysis_basis', 'status', 'summary', 'links', 'id',
];

export const toConsolidatedCsv = (rows) => [
    CONSOLIDATED_COLUMNS.join(','),
    ...rows.map((r) => CONSOLIDATED_COLUMNS.map((c) => cell(r[c])).join(',')),
].join('\r\n') + '\r\n';

/** Read all news archives across all stocks and return a consolidated list of stories. */
export const readAllArchives = () => {
    if (!dir || !fs.existsSync(dir)) return [];
    let files = [];
    try {
        files = fs.readdirSync(dir)
            .filter((f) => f.endsWith('.csv') && !f.startsWith('all_') && !f.startsWith('.'));
    } catch { return []; }

    const allStories = [];
    for (const filename of files) {
        const symbol = filename.replace(/\.csv$/, '');
        const filePath = path.join(dir, filename);
        try {
            const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
            const company = rows[0]?.company || symbol;
            for (const r of rows) {
                allStories.push({
                    symbol,
                    company: r.company || company,
                    date: r.date || '',
                    impact: r.impact || '',
                    theme: r.theme || 'other',
                    title: r.title || '',
                    key_points: r.key_points || '',
                    why_it_matters: r.why_it_matters || '',
                    outlets: r.outlets || '1',
                    sources: r.sources || '',
                    first_seen: r.first_seen || '',
                    analysis_basis: r.analysis_basis || '',
                    status: r.status || '',
                    summary: r.summary || '',
                    links: r.links || '',
                    id: r.id || '',
                    _time: Date.parse(r.date || r.first_seen) || 0,
                });
            }
        } catch { /* skip unreadable files */ }
    }

    allStories.sort((a, b) => b._time - a._time);
    return allStories;
};

/** Generate the full consolidated CSV string of all stocks' news. */
export const consolidatedCsv = () => {
    const stories = readAllArchives();
    return toConsolidatedCsv(stories);
};

/** Write out the consolidated CSV to db/news/all_stocks_news.csv */
export const syncConsolidatedCsv = () => {
    if (!dir) return null;
    const targetFile = path.join(dir, 'all_stocks_news.csv');
    const content = consolidatedCsv();
    const tmp = `${targetFile}.tmp`;
    try {
        fs.writeFileSync(tmp, content, 'utf8');
        fs.renameSync(tmp, targetFile);
        return targetFile;
    } catch {
        return null;
    }
};

