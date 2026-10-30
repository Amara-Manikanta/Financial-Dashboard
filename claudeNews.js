/**
 * News read by Claude (the Anthropic API) instead of the local model.
 *
 * Two jobs, both off unless switched on and ANTHROPIC_API_KEY is set:
 *
 *  1. Read one story (article text, or the publisher's description) into the
 *     same key points / impact / why columns the local model fills, so the
 *     archive does not care who read it.
 *  2. Keep a rolling brief per stock: at most eight items, each open or
 *     resolved, each citing the stored stories it came from. Updated daily
 *     from yesterday's brief plus new stories; rebuilt weekly from the stored
 *     per-story readings alone, so a wording that drifted cannot compound.
 *
 * What is sent: company names, headlines, article text and stored key points.
 * Never quantities, values, cost or tax — those stay on this machine and the
 * page sets them beside the brief itself.
 *
 * Every figure Claude writes is checked against the text it was given. One
 * that does not appear there is flagged, not trusted.
 *
 * Spend is logged per call from response.usage and capped per day (in rupees)
 * in a file beside the database, like the NewsAPI log, so a restart does not
 * reset it and a sandbox counts separately. Nothing here writes db.json.
 */
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { readArchive, fileFor } from './newsArchive.js';

export const CLAUDE_MODEL = process.env.CLAUDE_NEWS_MODEL || 'claude-haiku-5-5';
// Haiku 5.5, prompts up to 100K tokens. Briefs stay far below that.
const USD_PER_MTOK = { input: 0.10, output: 0.50 };
const USD_INR = Number(process.env.USD_INR) || 90;
const dailyCapInr = () => Number(process.env.CLAUDE_NEWS_DAILY_INR) || 150;

const DAY_MS = 86400000;
const MAX_ITEMS = 8;
const REBUILD_DAYS = 7;
const ARTICLE_CHARS = 12000;
const IMPACTS = ['positive', 'negative', 'mixed', 'neutral'];

let stateFile = null;
let envFile = null;
let briefDir = null;
let state = { enabled: false, spend: [], lastDailyRun: null };
let client = null;

const saveState = () => {
    if (!stateFile) return;
    try { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)); } catch { /* still held in memory */ }
};

export const configureClaudeNews = ({ stateFile: file, briefDir: dir, envFile: env } = {}) => {
    stateFile = file || null;
    envFile = env || null;
    briefDir = dir || null;
    try {
        const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        state = {
            enabled: saved.enabled === true,
            spend: Array.isArray(saved.spend) ? saved.spend.filter((s) => Number.isFinite(s?.t) && Number.isFinite(s?.inr)) : [],
            lastDailyRun: saved.lastDailyRun || null,
        };
    } catch {
        // First run here: off, nothing spent. Never inherit another database's log.
        state = { enabled: false, spend: [], lastDailyRun: null };
    }
};

const keyInFile = () => {
    try { return /^ANTHROPIC_API_KEY=./m.test(fs.readFileSync(envFile, 'utf8')); } catch { return false; }
};

/**
 * Save (or, with an empty key, remove) the API key in .env.local and apply it
 * at once. The key is never returned or logged; the page only gets the last
 * four characters.
 */
export const setApiKey = (raw) => {
    const key = String(raw || '').trim();
    if (key && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) return { ok: false, error: 'That does not look like an Anthropic key (it starts with sk-ant-).' };
    if (!envFile) return { ok: false, error: 'No key file is configured on this server' };
    let lines = [];
    try { lines = fs.readFileSync(envFile, 'utf8').split('\n'); } catch { /* new file */ }
    lines = lines.filter((l) => !/^\s*ANTHROPIC_API_KEY=/.test(l));
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    if (key) lines.push(`ANTHROPIC_API_KEY=${key}`);
    try {
        const tmp = `${envFile}.tmp`;
        fs.writeFileSync(tmp, `${lines.join('\n')}${lines.length ? '\n' : ''}`, { mode: 0o600 });
        fs.renameSync(tmp, envFile);
    } catch (err) {
        return { ok: false, error: `Could not save the key: ${err.message}` };
    }
    if (key) process.env.ANTHROPIC_API_KEY = key; else delete process.env.ANTHROPIC_API_KEY;
    client = null;
    if (!key) { state.enabled = false; saveState(); }
    return { ok: true };
};

const keyConfigured = () => !!String(process.env.ANTHROPIC_API_KEY || '').trim();

const spentToday = (now = Date.now()) => {
    state.spend = state.spend.filter((s) => now - s.t < 31 * DAY_MS);
    const today = istDate(now);
    return state.spend.filter((s) => istDate(s.t) === today).reduce((sum, s) => sum + s.inr, 0);
};

/** Whether a Claude call may be made right now, and if not, why. */
export const claudeReady = () => {
    if (!keyConfigured()) return { ok: false, reason: 'ANTHROPIC_API_KEY is not set in .env.local' };
    if (!state.enabled) return { ok: false, reason: 'Claude news reading is switched off' };
    const spent = spentToday();
    if (spent >= dailyCapInr()) return { ok: false, capReached: true, reason: `Today's limit of ₹${dailyCapInr()} is used (₹${spent.toFixed(2)})` };
    return { ok: true };
};

export const claudeStatus = () => {
    const now = Date.now();
    const month = state.spend.filter((s) => now - s.t < 30 * DAY_MS);
    return {
        configured: keyConfigured(),
        keyHint: keyConfigured() ? `…${String(process.env.ANTHROPIC_API_KEY).trim().slice(-4)}` : null,
        keyStored: keyInFile(),
        enabled: state.enabled,
        model: CLAUDE_MODEL,
        spentTodayInr: round2(spentToday(now)),
        spent30DaysInr: round2(month.reduce((sum, s) => sum + s.inr, 0)),
        calls30Days: month.length,
        dailyCapInr: dailyCapInr(),
        usdInr: USD_INR,
        lastDailyRun: state.lastDailyRun,
        running: !!running,
    };
};

/** Tests swap in a stub so nothing reaches the API. */
export const setClaudeClient = (c) => { client = c; };

export const setClaudeEnabled = (enabled) => {
    state.enabled = !!enabled;
    saveState();
    return claudeStatus();
};

const round2 = (n) => Math.round(n * 100) / 100;
const istDate = (t) => new Date(t + 5.5 * 3600000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * One call
 * ------------------------------------------------------------------ */

const costOf = (usage) => {
    const input = (usage?.input_tokens || 0) + (usage?.cache_creation_input_tokens || 0) * 1.25 + (usage?.cache_read_input_tokens || 0) * 0.1;
    const usd = (input * USD_PER_MTOK.input + (usage?.output_tokens || 0) * USD_PER_MTOK.output) / 1e6;
    return { usd, inr: usd * USD_INR };
};

/**
 * One structured request. Returns { ok, data, usage, inr } or { ok: false, error }.
 * Every outcome that cost money is logged, including a refusal.
 */
const ask = async ({ kind, symbol, system, content, schema, maxTokens }) => {
    const ready = claudeReady();
    if (!ready.ok) return { ok: false, error: ready.reason, capReached: !!ready.capReached, unavailable: true };
    client ||= new Anthropic();
    let response;
    try {
        response = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content }],
            output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        });
    } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) return { ok: false, unavailable: true, error: 'The Anthropic API key was rejected' };
        if (err instanceof Anthropic.RateLimitError) return { ok: false, unavailable: true, error: 'Anthropic rate limit — try again later' };
        if (err instanceof Anthropic.BadRequestError) return { ok: false, error: `Request refused: ${err.message}` };
        if (err instanceof Anthropic.APIError) return { ok: false, unavailable: true, error: `Anthropic API error ${err.status ?? ''}: ${err.message}` };
        return { ok: false, unavailable: true, error: err.message };
    }
    const { usd, inr } = costOf(response.usage);
    state.spend.push({ t: Date.now(), kind, symbol, inr: round2(inr * 1e4) / 1e4, in: response.usage?.input_tokens || 0, out: response.usage?.output_tokens || 0 });
    saveState();
    if (response.stop_reason === 'refusal') return { ok: false, error: `Claude declined (${response.stop_details?.category || 'no category'})`, inr };
    if (response.stop_reason === 'max_tokens') return { ok: false, error: 'Reply was cut off at the token limit', inr };
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    try {
        return { ok: true, data: JSON.parse(text), usage: response.usage, usd, inr };
    } catch {
        return { ok: false, error: 'Reply was not valid JSON', inr };
    }
};

/* ------------------------------------------------------------------ *
 * Figures must come from the source
 * ------------------------------------------------------------------ */

const numbersIn = (text) => (String(text || '').match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map((n) => n.replace(/,/g, '').replace(/\.0+$/, ''));

/** Figures in `claim` that never appear in `source`. */
export const unverifiedFigures = (claim, source) => {
    const known = new Set(numbersIn(source));
    return [...new Set(numbersIn(claim))].filter((n) => !known.has(n));
};

/* ------------------------------------------------------------------ *
 * Reading one story
 * ------------------------------------------------------------------ */

const STORY_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['key_points', 'impact', 'why_it_matters'],
    properties: {
        key_points: { type: 'array', items: { type: 'string' } },
        impact: { type: 'string', enum: IMPACTS },
        why_it_matters: { type: 'string' },
    },
};

const STORY_SYSTEM = `You read one news article about an Indian listed company and record what a shareholder needs to remember from it.

Return:
- key_points: one to three short sentences, each a fact the article states — what happened, figures exactly as written, who said it. No opinion.
- impact: positive, negative, mixed or neutral for the business, judged only from the article.
- why_it_matters: one sentence on what this means for the business.

Copy every figure exactly as the article writes it; a figure that is not in the text must not appear in your answer. Do not predict the share price and do not suggest buying or selling. If the article is not really about this company, say so in why_it_matters and use neutral.`;

/**
 * Same contract as analyseArticle in analystLLM.js, so news.js can use either.
 * Points carrying a figure the article does not contain are marked, not kept as fact.
 */
export const readStoryWithClaude = async ({ symbol, company, title, date, sources, text, basis = 'article' }) => {
    const source = String(text || '').slice(0, ARTICLE_CHARS);
    const result = await ask({
        kind: 'story',
        symbol,
        system: STORY_SYSTEM,
        maxTokens: 2000,
        schema: STORY_SCHEMA,
        content: `Company: ${company}\nHeadline: ${title}\nDate: ${date || 'unknown'}\nReported by: ${sources || 'unknown'}\n${basis === 'article' ? 'Article text' : 'Only the publisher\'s description was available'}:\n${source}`,
    });
    if (!result.ok) return result;
    const against = `${title}\n${source}`;
    const points = (Array.isArray(result.data.key_points) ? result.data.key_points : [])
        .map((p) => String(p).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 3)
        .map((p) => {
            const missing = unverifiedFigures(p, against);
            return missing.length ? `[unverified figure ${missing.join(', ')}] ${p}` : p;
        });
    if (!points.length) return { ok: false, error: 'Claude returned no key points' };
    return {
        ok: true,
        model: CLAUDE_MODEL,
        inr: result.inr,
        analysis: {
            keyPoints: points,
            impact: IMPACTS.includes(result.data.impact) ? result.data.impact : 'neutral',
            why: String(result.data.why_it_matters || '').replace(/\s+/g, ' ').trim().slice(0, 300),
        },
    };
};

/* ------------------------------------------------------------------ *
 * The rolling brief
 * ------------------------------------------------------------------ */

const briefFile = (symbol) => {
    const csv = fileFor(symbol);
    if (!csv) return null;
    const dir = briefDir || path.join(path.dirname(csv), 'briefs');
    return path.join(dir, path.basename(csv).replace(/\.csv$/, '.json'));
};

export const readBrief = (symbol) => {
    const file = briefFile(symbol);
    if (!file) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

const writeBrief = (symbol, brief) => {
    const file = briefFile(symbol);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(brief, null, 2));
    fs.renameSync(tmp, file);
};

const BRIEF_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['overview', 'items'],
    properties: {
        overview: { type: 'string' },
        items: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['status', 'what_changed', 'why_it_matters', 'check_before_acting', 'refs', 'carries'],
                properties: {
                    status: { type: 'string', enum: ['open', 'resolved'] },
                    what_changed: { type: 'string' },
                    why_it_matters: { type: 'string' },
                    check_before_acting: { type: 'string' },
                    refs: { type: 'array', items: { type: 'string' } },
                    carries: { type: 'string' },
                },
            },
        },
    },
};

const BRIEF_SYSTEM = `You keep a short running brief on one Indian listed company for someone who holds its shares.

You are given stored news, each story labelled S1, S2, … with its date, impact and what was taken from it (or the headline alone where the article was never read). In an update you are also given the previous brief's items, labelled P1, P2, ….

Return at most ${MAX_ITEMS} items, most important first. Each item:
- status: open while the matter is still live; resolved once a later story closes it (deal completed, case settled, guidance met or missed).
- what_changed: what happened, in one or two sentences.
- why_it_matters: what it means for the business.
- check_before_acting: the specific thing worth confirming before any decision — a filing, the next results, a date, an outcome.
- refs: the S labels the item rests on. Every item must cite at least one S or carry a P.
- carries: the P label this item continues from the previous brief, or "" if new.

overview: two sentences on where things stand overall.

Rules: use only what the stories say; copy figures exactly and use no figure that is not in them; merge stories about the same matter into one item; drop items that no longer matter. Do not predict the share price and do not say whether to buy, sell or hold.`;

const storyLine = (label, s) => {
    const d = (s.published || s.firstSeen || '').slice(0, 10) || 'undated';
    const read = s.keyPoints.length
        ? ` | ${s.impact || 'unrated'} | ${s.keyPoints.join(' ')}${s.why ? ` Why: ${s.why}` : ''}`
        : ' | headline only';
    return `${label} | ${d} | ${s.title}${read}`;
};

const timeOf = (s) => Date.parse(s.published || s.firstSeen) || 0;

/**
 * Build or update one stock's brief. A rebuild reads every stored story (read
 * ones in full, the rest as headlines); an update reads the previous brief and
 * only stories that arrived since.
 */
export const refreshBrief = async (symbol, name, { rebuild = false, now = Date.now() } = {}) => {
    const archive = readArchive(symbol);
    const company = name || archive.name || symbol;
    const previous = readBrief(symbol);
    const due = !previous || !previous.rebuiltAt || now - Date.parse(previous.rebuiltAt) >= REBUILD_DAYS * DAY_MS;
    const mode = rebuild || due ? 'rebuild' : 'update';

    const stories = [...archive.items].sort((a, b) => timeOf(b) - timeOf(a));
    let chosen;
    if (mode === 'rebuild') {
        const read = stories.filter((s) => s.keyPoints.length);
        const unread = stories.filter((s) => !s.keyPoints.length).slice(0, 150);
        chosen = [...read, ...unread].sort((a, b) => timeOf(b) - timeOf(a));
    } else {
        const since = Date.parse(previous.builtAt) || 0;
        // Arrival, not publication: a story published last week but collected today is new to the brief.
        chosen = stories.filter((s) => (Date.parse(s.firstSeen) || timeOf(s)) > since || (Date.parse(s.analysedAt) || 0) > since);
        if (!chosen.length) return { ok: true, skipped: 'no new stories since the last brief', brief: previous };
    }
    if (!chosen.length) return { ok: false, error: 'No stored news for this stock yet' };

    const labels = new Map(chosen.map((s, i) => [`S${i + 1}`, s]));
    const prevItems = mode === 'update' ? (previous.items || []).slice(0, MAX_ITEMS) : [];
    const prevText = prevItems.map((it, i) => `P${i + 1} | ${it.status} | ${it.whatChanged} Why: ${it.whyItMatters} Check: ${it.check}`).join('\n');
    const storiesText = [...labels].map(([label, s]) => storyLine(label, s)).join('\n');
    const content = [
        `Company: ${company}`,
        `Today: ${istDate(now)}`,
        mode === 'update' ? `Previous brief (as of ${previous.asOf}):\n${prevText || '(no items)'}` : '',
        `${mode === 'update' ? 'New stories' : 'Stored stories'}:\n${storiesText}`,
    ].filter(Boolean).join('\n\n');

    const result = await ask({ kind: `brief-${mode}`, symbol, system: BRIEF_SYSTEM, content, schema: BRIEF_SCHEMA, maxTokens: 6000 });
    if (!result.ok) return result;

    // A figure must appear in the stories an item cites — never merely in the
    // previous brief, or one invented figure would be laundered by every update.
    const byId = new Map(archive.items.map((s) => [s.id, s]));
    const storySource = (ids) => ids.map((id) => byId.get(id)).filter(Boolean)
        .map((s) => `${s.title}\n${s.keyPoints.join('\n')}\n${s.why}\n${s.summary}`).join('\n');
    const items = (Array.isArray(result.data.items) ? result.data.items : []).slice(0, MAX_ITEMS).map((it) => {
        const carried = /^P(\d+)$/.exec(String(it.carries || '').trim());
        const prev = carried ? prevItems[Number(carried[1]) - 1] : null;
        const cited = (Array.isArray(it.refs) ? it.refs : []).map((r) => labels.get(String(r).trim())).filter(Boolean);
        const storyIds = [...new Set([...(prev?.storyIds || []), ...cited.map((s) => s.id)])];
        // Dates come from the stories, never from the model.
        const times = [...cited.map(timeOf), ...(prev ? [Date.parse(prev.firstDate) || 0, Date.parse(prev.lastDate) || 0] : [])].filter(Boolean);
        const text = [it.what_changed, it.why_it_matters, it.check_before_acting].join(' ');
        return {
            status: it.status === 'resolved' ? 'resolved' : 'open',
            whatChanged: String(it.what_changed || '').trim(),
            whyItMatters: String(it.why_it_matters || '').trim(),
            check: String(it.check_before_acting || '').trim(),
            storyIds,
            firstDate: times.length ? new Date(Math.min(...times)).toISOString().slice(0, 10) : null,
            lastDate: times.length ? new Date(Math.max(...times)).toISOString().slice(0, 10) : null,
            unverified: unverifiedFigures(text, storySource(storyIds)),
            isNew: !prev,
        };
    }).filter((it) => it.storyIds.length && it.whatChanged);

    const latest = chosen.reduce((m, s) => Math.max(m, timeOf(s)), 0);
    const brief = {
        symbol,
        company,
        asOf: istDate(now),
        latestStory: latest ? new Date(latest).toISOString().slice(0, 10) : previous?.latestStory || null,
        builtAt: new Date(now).toISOString(),
        rebuiltAt: mode === 'rebuild' ? new Date(now).toISOString() : previous.rebuiltAt,
        mode,
        storiesRead: chosen.length,
        overview: String(result.data.overview || '').trim(),
        overviewUnverified: unverifiedFigures(result.data.overview, storySource([...new Set(items.flatMap((it) => it.storyIds))])),
        items,
        model: CLAUDE_MODEL,
        costInr: round2(result.inr * 100) / 100,
    };
    writeBrief(symbol, brief);
    return { ok: true, brief };
};

/* ------------------------------------------------------------------ *
 * Once a day
 * ------------------------------------------------------------------ */

let running = null;

/**
 * Every held stock: read up to `perStock` unread stories from the last 30 days,
 * then update its brief (rebuilt once a week). Stops when the day's limit is
 * reached. `analyse` and `held` are passed in by the server so this module
 * does not import news.js, which imports it.
 */
export const runClaudeDaily = ({ dbFile, analyse, held, perStock = 30, log = console.log } = {}) => {
    if (running) return running;
    running = (async () => {
        const summary = { stocks: 0, read: 0, briefs: 0, errors: [], stopped: null };
        let stocks = [];
        try { stocks = held(JSON.parse(fs.readFileSync(dbFile, 'utf8'))); } catch (err) { summary.errors.push(`Could not read holdings: ${err.message}`); }
        for (const st of stocks) {
            const ready = claudeReady();
            if (!ready.ok) { summary.stopped = ready.reason; break; }
            summary.stocks += 1;
            const done = await analyse(st.symbol, st.name, { count: perStock, maxAgeDays: 30 });
            summary.read += done.analysed || 0;
            if (done.modelUnavailable) { summary.stopped = done.errors?.[0] || 'Claude unavailable'; break; }
            const b = await refreshBrief(st.symbol, st.name);
            if (b.ok && !b.skipped) summary.briefs += 1;
            if (!b.ok) summary.errors.push(`${st.symbol}: ${b.error}`);
        }
        state.lastDailyRun = { at: new Date().toISOString(), ...summary, errors: summary.errors.slice(0, 10) };
        saveState();
        log(`[claude-news] daily run: ${summary.stocks} stocks, ${summary.read} stories read, ${summary.briefs} briefs${summary.stopped ? `, stopped: ${summary.stopped}` : ''}`);
        return summary;
    })().finally(() => { running = null; });
    return running;
};

/** Checks hourly; runs once per IST day, after 7 am, while switched on. */
export const startClaudeDaily = (opts) => {
    const tick = () => {
        if (!claudeReady().ok) return;
        const now = Date.now();
        const last = state.lastDailyRun?.at ? istDate(Date.parse(state.lastDailyRun.at)) : null;
        const hourIst = new Date(now + 5.5 * 3600000).getUTCHours();
        if (last === istDate(now) || hourIst < 7) return;
        runClaudeDaily(opts).catch((err) => (opts.log || console.log)(`[claude-news] daily run failed: ${err.message}`));
    };
    setTimeout(tick, 60000).unref?.();
    setInterval(tick, 3600000).unref?.();
};
