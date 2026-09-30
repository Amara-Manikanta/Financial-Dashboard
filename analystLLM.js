/**
 * The Stock Analyst's optional local model: LM Studio, or anything else on this
 * machine that speaks the OpenAI chat-completions API (Ollama at
 * http://127.0.0.1:11434/v1 and llama.cpp's server both do).
 *
 * The model is given the smallest job there is. It never sees the database,
 * does no arithmetic and decides nothing: the analyst (src/utils/stockAdvisor.js)
 * has already computed every finding and formatted every figure, and the model
 * only (a) puts those findings in order and says why in plain words, or
 * (b) answers a question from them. That is what a 3–4B model does reliably.
 * Asked to reason over four hundred transactions itself, it produces confident
 * numbers that are wrong.
 *
 * Two things keep it honest beyond the prompt. The brief is requested as JSON
 * whose `id` field is an enum of the real finding ids, so a constrained decoder
 * cannot even spell a finding that does not exist; and whatever comes back is
 * filtered against those ids again, for servers that ignore the schema.
 *
 * Nothing leaves the machine unless LOCAL_LLM_URL points elsewhere, and the
 * facts come from the stock pages only — no expenses, salary or balances.
 *
 * Every export resolves to `{ status, body }` and never throws; server.js owns
 * the HTTP side.
 */

const BASE_URL = String(process.env.LOCAL_LLM_URL || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
const MODEL = String(process.env.LOCAL_LLM_MODEL || '').trim();
const TIMEOUT_MS = Number(process.env.LOCAL_LLM_TIMEOUT_MS) || 180000;
/**
 * Reply budget. Reasoning ("thinking") models spend part of it before writing
 * a word of the answer, and at 800 a 4B one used all of it and returned
 * nothing. Raise it with the context length in LM Studio, not above it.
 */
const MAX_TOKENS = Number(process.env.LOCAL_LLM_MAX_TOKENS) || 2000;

/**
 * Bumped whenever the relay's behaviour changes. The page compares it with the
 * version it expects, because a server started before `git pull` keeps running
 * the old code until restarted — and looks exactly like a bug that was fixed.
 */
export const RELAY_VERSION = 6;

const MAX_FINDINGS = 12;
const MAX_HOLDINGS = 60;
const MAX_TEXT = 1500;

const clip = (value, max = MAX_TEXT) => String(value ?? '').slice(0, max);

/**
 * The request body's facts, reduced to known fields of bounded size.
 * Returns null when there is nothing usable.
 */
export const cleanFacts = (facts) => {
    if (!facts || typeof facts !== 'object' || !Array.isArray(facts.findings)) return null;
    return {
        date: clip(facts.date, 20),
        financialYear: clip(facts.financialYear, 120),
        portfolio: clip(facts.portfolio),
        tax: clip(facts.tax),
        prices: clip(facts.prices, 200),
        findings: facts.findings.slice(0, MAX_FINDINGS)
            .map((f) => ({
                id: clip(f?.id, 120),
                severity: clip(f?.severity, 10),
                title: clip(f?.title, 300),
                why: clip(f?.why),
                suggestion: clip(f?.suggestion),
                figures: clip(f?.figures),
            }))
            .filter((f) => f.id),
        holdings: (Array.isArray(facts.holdings) ? facts.holdings : []).slice(0, MAX_HOLDINGS).map((h) => clip(h, 200)),
        fundsSummary: clip(facts.fundsSummary, 300),
        funds: (Array.isArray(facts.funds) ? facts.funds : []).slice(0, MAX_HOLDINGS).map((h) => clip(h, 200)),
        dashboard: clip(facts.dashboard, 4000),
        focus: (Array.isArray(facts.focus) ? facts.focus : []).slice(0, 20).map((l) => clip(l, 400)),
    };
};

const SEVERITY_WORDS = { act: 'act now', review: 'worth a look', info: 'for information' };

/** The facts as plain text, which small models read more reliably than nested JSON. */
export const factsText = (facts, { withHoldings = false, maxFindings = MAX_FINDINGS, maxHoldings = MAX_HOLDINGS } = {}) => {
    const findings = facts.findings.slice(0, maxFindings);
    return [
        `Date: ${facts.date}`,
        `Financial year: ${facts.financialYear}`,
        `Portfolio: ${facts.portfolio}`,
        `Tax: ${facts.tax}`,
        `Prices: ${facts.prices}`,
        '',
        findings.length ? 'Findings, most urgent first:' : 'Findings: none. Nothing in the portfolio needs attention.',
        ...findings.map((f) => [
            `- id: ${f.id} (${SEVERITY_WORDS[f.severity] || f.severity})`,
            `  ${f.title}`,
            f.why ? `  Why: ${f.why}` : null,
            f.suggestion ? `  Suggestion: ${f.suggestion}` : null,
            f.figures ? `  Figures: ${f.figures}` : null,
        ].filter(Boolean).join('\n')),
        ...(withHoldings && facts.holdings.length
            ? ['', 'Holdings, largest first:', ...facts.holdings.slice(0, maxHoldings).map((h) => `- ${h}`)]
            : []),
    ].join('\n');
};

/**
 * Reasoning models wrap their working in <think> tags, and some chat templates
 * open the tag inside the prompt so only the closing one comes back.
 */
export const stripThinking = (text) => String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^[\s\S]*?<\/think>/, '')
    .trim();

/**
 * The brief out of whatever the model returned, keeping only priorities that
 * name a real finding, once each.
 */
export const parseBrief = (text, ids) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    let obj;
    try {
        obj = JSON.parse(text.slice(start, end + 1));
    } catch {
        return null;
    }
    if (!obj || typeof obj !== 'object') return null;
    const known = new Set(ids);
    const seen = new Set();
    const offered = Array.isArray(obj.priorities) ? obj.priorities : [];
    const priorities = offered
        .filter((p) => p && typeof p.id === 'string' && known.has(p.id) && !seen.has(p.id) && seen.add(p.id))
        .slice(0, 5)
        .map((p) => ({ id: p.id, why: clip(p.why, 400) }));
    return {
        summary: clip(obj.summary, 1200).trim(),
        priorities,
        discarded: offered.length - priorities.length,
    };
};

const fetchWithTimeout = async (url, init, ms) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

/** Chat models the server offers. Embedding models are listed too and cannot chat. */
const listModels = async () => {
    const r = await fetchWithTimeout(`${BASE_URL}/models`, {}, 4000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return (data?.data || []).map((m) => m?.id).filter((id) => id && !/embed/i.test(id));
};

class LlmError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

const chat = async ({ model, messages, maxTokens, schema }) => {
    const body = { model, messages, temperature: 0.2, max_tokens: maxTokens, stream: false };
    if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'analyst_brief', strict: true, schema } };
    const r = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }, TIMEOUT_MS);
    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { /* reported below */ }
    if (!r.ok) {
        const message = data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || raw.slice(0, 300) || `HTTP ${r.status}`;
        throw new LlmError(String(message), r.status);
    }
    const choice = data?.choices?.[0];
    if (!choice) throw new LlmError('The model server returned no answer.', 502);
    const rawContent = String(choice.message?.content ?? '');
    // LM Studio puts a reasoning model's thinking in its own field; others
    // leave it inline in <think> tags. Either way it is kept for the log.
    const inline = (rawContent.match(/<think>([\s\S]*?)(<\/think>|$)/) || [])[1] || '';
    const reasoning = String(choice.message?.reasoning_content ?? choice.message?.reasoning ?? inline);
    return {
        content: stripThinking(rawContent),
        finish: choice.finish_reason || null,
        raw: {
            finishReason: choice.finish_reason || null,
            content: rawContent.slice(0, 4000),
            reasoning: reasoning.slice(0, 4000),
            reasoningChars: reasoning.length,
            usage: data?.usage || null,
        },
    };
};

/**
 * A reply with no answer in it is a failure, not an empty success. The usual
 * cause is a reasoning model thinking until the budget ran out.
 */
const emptyReply = (reply) => {
    const thought = reply.raw.reasoningChars > 0;
    const cutOff = reply.finish === 'length';
    const why = thought && cutOff
        ? `The model spent its whole ${MAX_TOKENS}-token reply budget thinking and never wrote an answer.`
        : cutOff ? `The reply was cut off at ${MAX_TOKENS} tokens before any answer.`
            : 'The model returned an empty reply.';
    return {
        status: 502,
        body: {
            error: `${why} Use an instruct (non-thinking) model, turn thinking off for this model in LM Studio, or raise the context length and LOCAL_LLM_MAX_TOKENS.`,
            raw: reply.raw,
        },
    };
};

/** A failure, worded for the person reading it. */
const failure = (err) => {
    if (err?.name === 'AbortError') {
        return { status: 504, body: { error: `The local model took longer than ${Math.round(TIMEOUT_MS / 1000)}s. A smaller model, or a shorter context, answers faster.` } };
    }
    if (err instanceof LlmError) return { status: 502, body: { error: `LM Studio: ${err.message}` } };
    return { status: 502, body: { error: `Could not reach the local model at ${BASE_URL}: ${err?.message || err}` } };
};

/**
 * Whether a local model is available, and which one would answer.
 * Always 200: "no model running" is a state the page shows, not an error.
 */
export const llmStatus = async () => {
    try {
        const models = await listModels();
        if (models.length === 0) {
            return { status: 200, body: { available: false, baseUrl: BASE_URL, reason: 'The server is running but offers no chat model. Load one in LM Studio.' } };
        }
        // A configured model wins even when unlisted: LM Studio loads models
        // on demand by name.
        const model = MODEL || models[0];
        return { status: 200, body: { available: true, baseUrl: BASE_URL, model, models: models.slice(0, 20), relayVersion: RELAY_VERSION } };
    } catch (err) {
        const why = err?.name === 'AbortError' ? 'no answer' : err?.message || String(err);
        return { status: 200, body: { available: false, baseUrl: BASE_URL, reason: `Nothing answered at ${BASE_URL} (${why}).` } };
    }
};

const BRIEF_SYSTEM = [
    'You write a short brief for the owner of an Indian stock portfolio, from an analysis their finance app has already computed.',
    'Rules:',
    '- Use only the findings you are given. Never invent a holding, a figure or a rule.',
    '- Do no arithmetic. Any figure you mention must be copied exactly as written.',
    '- Do not suggest buying or selling anything that is not already a suggestion in a finding.',
    '- "priorities": the findings to deal with first, most important first, at most 5, each with a one-sentence reason in plain words.',
    '- "summary": two or three sentences on the state of the portfolio and what matters most this month.',
    '- No greetings, no disclaimers, no markdown.',
].join('\n');

/** An ordered, plain-words brief over the analyst's findings. */
/** The instructions you can override from the page; facts are never editable. */
const MAX_SYSTEM_PROMPT = 6000;
const systemFor = (kind, override) => {
    const custom = typeof override === 'string' ? override.trim().slice(0, MAX_SYSTEM_PROMPT) : '';
    return custom || (kind === 'brief' ? BRIEF_SYSTEM : kind === 'custom' ? CUSTOM_SYSTEM : ASK_SYSTEM);
};

const KINDS = ['brief', 'ask', 'custom'];
const kindOf = (kind) => (KINDS.includes(kind) ? kind : 'brief');

/** The worked figures for a stock the question names (averaging, break-even, weight, sale). */
const focusText = (facts) => (facts.focus.length ? ['', 'Detail for the stock you asked about:', ...facts.focus.map((l) => `- ${l}`)] : []);

/** Every stock and fund held, for a question written by the owner. */
const customFacts = (facts) => [
    factsText(facts, { withHoldings: true, maxFindings: 8, maxHoldings: MAX_HOLDINGS }),
    '',
    `Mutual funds: ${facts.fundsSummary || 'not included.'}`,
    ...(facts.funds.length ? ['Funds, largest first:', ...facts.funds.map((f) => `- ${f}`)] : []),
    ...(facts.dashboard ? ['', 'The rest of my finances:', facts.dashboard] : []),
    ...focusText(facts),
].join('\n');

/**
 * Exactly what the model is sent. The page shows this on its Prompt tab, and
 * the relay builds its requests from the same function, so the preview cannot
 * drift from what actually goes out. Only the instructions can be edited: the
 * facts are always generated here, so the model is never handed figures it
 * could have been told wrongly.
 */
export const promptMessages = (kind, facts, question = '', systemOverride = '') => [
    { role: 'system', content: systemFor(kind, systemOverride) },
    {
        role: 'user',
        content: kind === 'brief'
            ? `${factsText(facts, { maxFindings: 10 })}\n\nWrite the brief as JSON with "summary" and "priorities".`
            : kind === 'custom'
                ? `My portfolio, computed by my finance app:\n${customFacts(facts)}\n\n${question || '(your question goes here)'}`
                : `Facts:\n${[factsText(facts, { withHoldings: true, maxFindings: 8, maxHoldings: 30 }), ...focusText(facts)].join('\n')}\n\nQuestion: ${question || '(your question goes here)'}`,
    },
];

/** The default instructions and the messages that would be sent, for the Prompt tab. */
export const promptPreview = (kind, rawFacts, question, systemOverride) => {
    const facts = cleanFacts(rawFacts);
    if (!facts) return { status: 400, body: { error: 'facts with a findings list are required' } };
    const k = kindOf(kind);
    const messages = promptMessages(k, facts, clip(question, MAX_QUESTION), systemOverride);
    return { status: 200, body: { kind: k, defaultSystem: systemFor(k, ''), messages } };
};

export const writeBrief = async (rawFacts, systemOverride) => {
    const facts = cleanFacts(rawFacts);
    if (!facts) return { status: 400, body: { error: 'facts with a findings list are required' } };

    const { body: status } = await llmStatus();
    if (!status.available) return { status: 503, body: { error: status.reason, baseUrl: BASE_URL } };

    const ids = facts.findings.map((f) => f.id);
    const schema = {
        type: 'object',
        properties: {
            summary: { type: 'string' },
            priorities: {
                type: 'array',
                maxItems: 5,
                items: {
                    type: 'object',
                    properties: {
                        id: ids.length > 0 ? { type: 'string', enum: ids } : { type: 'string' },
                        why: { type: 'string' },
                    },
                    required: ['id', 'why'],
                    additionalProperties: false,
                },
            },
        },
        required: ['summary', 'priorities'],
        additionalProperties: false,
    };
    const messages = promptMessages('brief', facts, '', systemOverride);

    const started = Date.now();
    let reply;
    let constrained = true;
    try {
        reply = await chat({ model: status.model, messages, maxTokens: MAX_TOKENS, schema });
    } catch (err) {
        // A server without structured output rejects response_format outright;
        // the same request without it still works, filtered on the way back.
        if (!(err instanceof LlmError) || ![400, 404, 422, 501].includes(err.status)) return failure(err);
        constrained = false;
        try {
            reply = await chat({ model: status.model, messages, maxTokens: MAX_TOKENS });
        } catch (retryErr) {
            return failure(retryErr);
        }
    }

    // Constrained decoding can itself be the failure: some models, under a JSON
    // grammar, emit whitespace until the budget runs out (google/gemma-4-12b-qat
    // ran 90s and returned nothing). If the constrained reply is empty or not a
    // brief, ask once more without the grammar — the prompt still asks for
    // JSON, and ids are still filtered on the way back.
    let firstAttempt = null;
    if (constrained && (!reply.content || !parseBrief(reply.content, ids))) {
        firstAttempt = reply.raw;
        try {
            reply = await chat({ model: status.model, messages, maxTokens: MAX_TOKENS });
            constrained = false;
        } catch (retryErr) {
            return failure(retryErr);
        }
    }

    if (!reply.content) {
        const empty = emptyReply(reply);
        if (firstAttempt) empty.body.firstAttempt = firstAttempt;
        return empty;
    }
    const parsed = parseBrief(reply.content, ids);
    return {
        status: 200,
        body: {
            summary: parsed ? parsed.summary : reply.content.slice(0, 1200),
            priorities: parsed ? parsed.priorities : [],
            discarded: parsed ? parsed.discarded : 0,
            structured: !!parsed,
            constrained,
            truncated: reply.finish === 'length',
            model: status.model,
            ms: Date.now() - started,
            raw: reply.raw,
            ...(firstAttempt ? { firstAttempt } : {}),
        },
    };
};

const ASK_SYSTEM = [
    'You answer questions about the owner\'s Indian stock portfolio, using only the facts in the message, which their finance app has already computed.',
    'Rules:',
    '- If the facts do not answer the question, say so plainly and say what is missing. Do not guess.',
    '- Do no arithmetic and estimate nothing. Copy any figure exactly as written.',
    '- You may explain a general idea, such as what the long-term capital gains exemption is.',
    '- Do not tell the owner to buy or sell anything the findings do not already suggest, unless the facts include detail for the stock asked about: then weigh that detail (cost after buying more, weight against the limit, fundamentals, the sale alternative) and give a reasoned view, saying it is a judgement.',
    '- Never predict prices.',
    '- Answer in under 150 words, in plain text. No markdown tables.',
].join('\n');

const CUSTOM_SYSTEM = [
    'You are a careful adviser looking at an Indian investor\'s finances: their stocks and mutual funds, and sometimes the rest of their money too. Every figure in the message was already computed by their finance app.',
    'Rules:',
    '- Base everything on the holdings listed. If something you need is missing, say what.',
    '- Copy figures exactly as written. Do not add, subtract or estimate new ones.',
    '- Give your reasoning for each suggestion, and say plainly when something is a judgement rather than a fact.',
    '- Never predict prices.',
    '- Answer in plain text, under 300 words.',
].join('\n');

/** A question, or a whole prompt, written by the owner. */
const MAX_QUESTION = 2000;

/** One question, answered from the facts alone ('ask'), or with every holding ('custom'). */
export const answerQuestion = async (question, rawFacts, systemOverride, kind = 'ask') => {
    const q = clip(question, kind === 'custom' ? MAX_QUESTION : 500).trim();
    if (!q) return { status: 400, body: { error: 'A question is required' } };
    const facts = cleanFacts(rawFacts);
    if (!facts) return { status: 400, body: { error: 'facts with a findings list are required' } };

    const { body: status } = await llmStatus();
    if (!status.available) return { status: 503, body: { error: status.reason, baseUrl: BASE_URL } };

    // Sized for LM Studio's default 4,096-token context: the facts, the answer
    // and the template all have to fit in it.
    const messages = promptMessages(kind === 'custom' ? 'custom' : 'ask', facts, q, systemOverride);
    const started = Date.now();
    try {
        const reply = await chat({ model: status.model, messages, maxTokens: MAX_TOKENS });
        if (!reply.content) return emptyReply(reply);
        return {
            status: 200,
            body: { answer: reply.content, truncated: reply.finish === 'length', model: status.model, ms: Date.now() - started, raw: reply.raw },
        };
    } catch (err) {
        return failure(err);
    }
};

export const LOCAL_LLM = { baseUrl: BASE_URL, model: MODEL || null, timeoutMs: TIMEOUT_MS, maxTokens: MAX_TOKENS };
