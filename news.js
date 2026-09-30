/**
 * Recent headlines for a stock, for the analyst's local model.
 *
 * Two free sources, no API key: Yahoo Finance search (by symbol) and Google
 * News RSS (by company name, Indian edition). Headlines only — article bodies
 * sit behind paywalls and scrapers that break, and a 4B model reads twelve
 * headlines better than one long article anyway.
 *
 * Results are cached per stock for NEWS_TTL_MS so a page full of holdings does
 * not hammer either source. Nothing here is written to db.json.
 */
import fs from 'fs';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { mergeIntoArchive, archiveStats, consolidate, readArchive, attachText } from './newsArchive.js';

const NEWS_TTL_MS = 30 * 60 * 1000;
const MAX_AGE_DAYS = 30;
const MAX_ITEMS = 12;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const cache = new Map();

/* ------------------------------------------------------------------ *
 * NewsAPI's free plan: 100 requests a day
 * ------------------------------------------------------------------ */

const DAY_MS = 86400000;
let usageFile = null;
let calls = [];          // timestamps (ms) of NewsAPI requests in the last 24 hours

/** Where the request log is kept, so a restart does not reset the count. */
export const configureNews = ({ usageFile: file } = {}) => {
    usageFile = file || null;
    try {
        const saved = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
        calls = Array.isArray(saved.calls) ? saved.calls.filter(Number.isFinite) : [];
    } catch { calls = []; }
};

const dailyLimit = () => Number(process.env.NEWSAPI_DAILY_LIMIT) || 100;

/** Requests in the rolling last 24 hours, and when the oldest drops out. */
export const newsApiUsage = (now = Date.now()) => {
    calls = calls.filter((t) => now - t < DAY_MS);
    const limit = dailyLimit();
    return {
        configured: !!String(process.env.NEWSAPI_KEY || '').trim(),
        used: calls.length,
        limit,
        remaining: Math.max(0, limit - calls.length),
        nextFreeAt: calls.length >= limit ? new Date(calls[0] + DAY_MS).toISOString() : null,
    };
};

const recordCall = (now = Date.now()) => {
    calls.push(now);
    if (!usageFile) return;
    try { fs.writeFileSync(usageFile, JSON.stringify({ calls })); } catch { /* the count still holds in memory */ }
};

const decode = (s) => String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const tag = (xml, name) => {
    const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
    return m ? decode(m[1]) : '';
};

/** Yahoo's search response → headline items. */
export const parseYahooNews = (json) => (Array.isArray(json?.news) ? json.news : [])
    .filter((n) => n && n.title)
    .map((n) => ({
        title: decode(n.title),
        source: n.publisher || 'Yahoo Finance',
        url: n.link || '',
        published: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
    }));

/** Google News RSS → headline items. Google appends " - Source" to titles; that is split off. */
export const parseGoogleNews = (xml) => (String(xml || '').match(/<item>[\s\S]*?<\/item>/g) || [])
    .map((item) => {
        const source = tag(item, 'source');
        let title = tag(item, 'title');
        if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
        const date = new Date(tag(item, 'pubDate'));
        return { title, source: source || 'Google News', url: tag(item, 'link'), published: Number.isNaN(date.getTime()) ? null : date.toISOString() };
    })
    .filter((n) => n.title);

const normalise = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

/**
 * NewsAPI.org /v2/everything → items. Unlike the other two it carries each
 * article's description, which is what gives the model more than a headline.
 * Removed stories come back titled "[Removed]" and are dropped.
 */
export const parseNewsApi = (json) => (Array.isArray(json?.articles) ? json.articles : [])
    .filter((a) => a && a.title && a.title !== '[Removed]')
    .map((a) => ({
        title: decode(a.title),
        source: a.source?.name || 'NewsAPI',
        url: a.url || '',
        published: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
        summary: a.description ? decode(a.description).replace(/<[^>]+>/g, '').slice(0, 300) : '',
    }));

/** Newest first, recent only, one entry per story with every outlet that covered it. */
export const mergeNews = (lists, now = Date.now(), companyName = '') => {
    const cutoff = now - MAX_AGE_DAYS * 86400000;
    const recent = lists.flat().filter((n) => n && n.title && (!n.published || Date.parse(n.published) >= cutoff));
    return consolidate(recent, companyName).slice(0, MAX_ITEMS);
};

const get = async (url, as, headers = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*', ...headers }, signal: controller.signal });
        if (!r.ok) {
            // NewsAPI explains itself in JSON (rateLimited, apiKeyInvalid…); say that, not just the status.
            const detail = await r.json().then((j) => j?.message || j?.code).catch(() => '');
            throw new Error(`HTTP ${r.status}${detail ? ` — ${detail}` : ''}`);
        }
        return as === 'json' ? await r.json() : await r.text();
    } finally {
        clearTimeout(timer);
    }
};

/** Headlines for one stock. Each source may fail on its own; its error is reported, not thrown. */
export const newsFor = async (symbol, name, { fresh = false, reserveNewsApi = 0 } = {}) => {
    const sym = String(symbol || '').trim().slice(0, 30);
    const company = String(name || '').replace(/\b(limited|ltd\.?)\b/gi, '').trim().slice(0, 80);
    if (!sym && !company) return { status: 400, body: { error: 'symbol or name is required' } };

    const key = `${sym}|${company}`.toLowerCase();
    const hit = cache.get(key);
    if (!fresh && hit && Date.now() - hit.at < NEWS_TTL_MS) return { status: 200, body: { ...hit.body, cached: true, newsApi: newsApiUsage(), archive: archiveStats(sym || company) } };

    // Read at call time, so a key added to .env.local only needs a server restart.
    const newsApiKey = String(process.env.NEWSAPI_KEY || '').trim();
    // Over the day's allowance NewsAPI is skipped, not called: the two free
    // sources still answer, and the reason is reported like any other failure.
    const budget = newsApiUsage();
    // reserveNewsApi: the background collector leaves this many for you.
    const useNewsApi = !!(company && newsApiKey && budget.remaining > reserveNewsApi);
    const from = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10);
    const errors = [];
    if (company && newsApiKey && !useNewsApi && budget.remaining === 0) {
        errors.push(`NewsAPI: daily limit reached (${budget.used}/${budget.limit}); next request free ${budget.nextFreeAt}`);
    }
    const tried = (sym ? 1 : 0) + (company ? 1 : 0) + (useNewsApi ? 1 : 0);
    const lists = await Promise.all([
        sym
            ? get(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&quotesCount=0&newsCount=10`, 'json')
                .then(parseYahooNews)
                .catch((err) => { errors.push(`Yahoo: ${err.message}`); return []; })
            : [],
        company
            ? get(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${company}" share OR stock`)}&hl=en-IN&gl=IN&ceid=IN:en`, 'text')
                .then(parseGoogleNews)
                .catch((err) => { errors.push(`Google News: ${err.message}`); return []; })
            : [],
        useNewsApi
            ? (recordCall(), get(`https://newsapi.org/v2/everything?q=${encodeURIComponent(`"${company}"`)}&language=en&sortBy=publishedAt&pageSize=10&from=${from}`, 'json', { 'X-Api-Key': newsApiKey })
                .then(parseNewsApi)
                .catch((err) => { errors.push(`NewsAPI: ${err.message}`); return []; }))
            : [],
    ]);
    const items = mergeNews(lists, Date.now(), company);
    // Everything fetched is kept, so coverage builds up beyond the sources' own window.
    let archive = archiveStats(sym || company);
    try { archive = mergeIntoArchive(sym || company, company, lists.flat()); archive = { count: archive.items.length, added: archive.added, since: archiveStats(sym || company).since }; } catch (err) { errors.push(`Archive: ${err.message}`); }
    const body = { symbol: sym, name: company, items, errors, fetchedAt: new Date().toISOString(), newsApi: newsApiUsage(), archive };
    // Cached whenever at least one source answered — NewsAPI's free plan allows
    // 100 requests a day, so a failing source must not be retried on every view.
    if (errors.length < tried) cache.set(key, { at: Date.now(), body });
    return { status: 200, body };
};

/* ------------------------------------------------------------------ *
 * Background collection, so the archive grows while nobody is looking
 * ------------------------------------------------------------------ */

/** Your own held stocks, read (never written) from the database file. */
export const heldStocksIn = (db) => (db?.savings || [])
    .filter((s) => s && s.type === 'stock_market' && !s.isArchived)
    .flatMap((m) => m.stocks || [])
    .filter((st) => st && !st.isArchived && Number(st.shares) > 0 && (!st.owner || st.owner === 'self') && (st.ticker || st.symbol))
    .map((st) => {
        const t = String(st.ticker || st.symbol).trim();
        return { symbol: t.includes('.') ? t : `${t}.NS`, name: st.name || t };
    });

let collector = null;

/**
 * Every `hours`, fetch each held stock once, a few seconds apart. NewsAPI is
 * used only while more than `reserve` requests remain, so questions you ask
 * still get it. hours = 0 turns collection off.
 */
export const startNewsCollector = ({ dbFile, hours = 6, reserve = 40, spacingMs = 3000, log = console.log } = {}) => {
    if (collector || !(hours > 0)) return;
    const run = async () => {
        let stocks = [];
        try { stocks = heldStocksIn(JSON.parse(fs.readFileSync(dbFile, 'utf8'))); } catch (err) { log(`[news] collector could not read the database: ${err.message}`); return; }
        let added = 0;
        for (const st of stocks) {
            const { body } = await newsFor(st.symbol, st.name, { fresh: true, reserveNewsApi: reserve });
            added += body?.archive?.added || 0;
            await new Promise((r) => setTimeout(r, spacingMs));
        }
        log(`[news] collected ${stocks.length} holdings, ${added} new headlines stored`);
    };
    collector = setInterval(run, hours * 3600000);
    collector.unref?.();
    setTimeout(run, 60000).unref?.();
};

/* ------------------------------------------------------------------ *
 * Full article text, for the newest stories about a stock
 * ------------------------------------------------------------------ */

const MAX_TEXT = 4000;

/**
 * Download one article and keep only its body, the way Firefox's Reader View
 * does. Paywalled and script-rendered pages come back short or empty; that is
 * reported, not treated as an article. Google News links are redirects that
 * need a browser to follow, so they are skipped.
 */
export const articleText = async (url) => {
    if (!/^https?:\/\//.test(url || '') || /news\.google\.com/.test(url)) throw new Error('no direct link');
    const html = await get(url, 'text');
    const { document } = parseHTML(html.slice(0, 2_000_000));
    const article = new Readability(document).parse();
    // Block ends become breaks, so a heading does not run into its first paragraph.
    const text = decode(String(article?.content || '')
        .replace(/<\/(p|h[1-6]|li|blockquote|div|tr)>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' '))
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
    if (text.length < 300) throw new Error('page had no readable article (paywall or script-only)');
    return text.slice(0, MAX_TEXT);
};

/**
 * Fetch the text of the newest `count` stories that do not have it yet, once
 * each: a failure is remembered on the item so it is not retried every question.
 */
export const fillArticleText = async (symbol, name, { count = 3 } = {}) => {
    const stories = consolidate(readArchive(symbol).items, name).slice(0, count);
    await Promise.all(stories.map(async (s) => {
        if (s.text) return;
        const stored = readArchive(symbol).items;
        const candidates = s.links.filter((l) => !/news\.google\.com/.test(l.url) && !stored.find((i) => i.url === l.url)?.textTried);
        for (const link of candidates) {
            try {
                attachText(symbol, link.url, await articleText(link.url));
                return;
            } catch (err) {
                attachText(symbol, link.url, '', err.message);
            }
        }
    }));
};
