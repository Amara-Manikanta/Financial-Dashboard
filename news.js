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

/** Newest first, recent only, one copy of each story. */
export const mergeNews = (lists, now = Date.now()) => {
    const seen = new Set();
    const cutoff = now - MAX_AGE_DAYS * 86400000;
    return lists.flat()
        .filter((n) => !n.published || Date.parse(n.published) >= cutoff)
        .sort((a, b) => (Date.parse(b.published || 0) || 0) - (Date.parse(a.published || 0) || 0))
        .filter((n) => {
            const key = normalise(n.title);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, MAX_ITEMS);
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
export const newsFor = async (symbol, name, { fresh = false } = {}) => {
    const sym = String(symbol || '').trim().slice(0, 30);
    const company = String(name || '').replace(/\b(limited|ltd\.?)\b/gi, '').trim().slice(0, 80);
    if (!sym && !company) return { status: 400, body: { error: 'symbol or name is required' } };

    const key = `${sym}|${company}`.toLowerCase();
    const hit = cache.get(key);
    if (!fresh && hit && Date.now() - hit.at < NEWS_TTL_MS) return { status: 200, body: { ...hit.body, cached: true, newsApi: newsApiUsage() } };

    // Read at call time, so a key added to .env.local only needs a server restart.
    const newsApiKey = String(process.env.NEWSAPI_KEY || '').trim();
    // Over the day's allowance NewsAPI is skipped, not called: the two free
    // sources still answer, and the reason is reported like any other failure.
    const budget = newsApiUsage();
    const useNewsApi = !!(company && newsApiKey && budget.remaining > 0);
    const from = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10);
    const errors = [];
    if (company && newsApiKey && !useNewsApi) {
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
    const body = { symbol: sym, name: company, items: mergeNews(lists), errors, fetchedAt: new Date().toISOString(), newsApi: newsApiUsage() };
    // Cached whenever at least one source answered — NewsAPI's free plan allows
    // 100 requests a day, so a failing source must not be retried on every view.
    if (errors.length < tried) cache.set(key, { at: Date.now(), body });
    return { status: 200, body };
};
