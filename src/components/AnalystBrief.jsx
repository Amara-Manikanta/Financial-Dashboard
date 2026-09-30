import React, { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, Send, ChevronRight, Cpu } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';

/**
 * A small local model's read of the analyst's findings — optional, and never
 * the source of a number.
 *
 * The model runs in LM Studio (or any OpenAI-compatible local server) on this
 * machine, reached through server.js, and is handed the findings the page
 * already shows, pre-formatted. It orders them and explains them in plain
 * words, or answers a question from them. If no model is running, the page
 * loses nothing: every finding and figure comes from the analyst itself.
 */
/**
 * The exact messages a request sends, from the relay's own promptMessages(),
 * so each logged response can show what the model was given. Null if the
 * server cannot say; the request itself still goes ahead.
 */
export const promptSent = async (kind, facts, question, systemPrompt) => {
    try {
        const r = await fetch(`${API_URL}/api/analyst/llm/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, facts, question, systemPrompt }),
        });
        return r.ok ? (await r.json()).messages || null : null;
    } catch {
        return null;
    }
};

/** The relay behaviour this page was written against (analystLLM.js RELAY_VERSION). */
const EXPECTED_RELAY = 8;

const AnalystBrief = ({ facts, titles, onShowFinding, onResponse, prompts = {}, focusFor, newsFor, attachedFor }) => {
    const [status, setStatus] = useState({ state: 'checking' });
    const [brief, setBrief] = useState(null);
    const [briefBusy, setBriefBusy] = useState(false);
    const [briefError, setBriefError] = useState(null);
    const [question, setQuestion] = useState('');
    const [answers, setAnswers] = useState([]);
    const [askBusy, setAskBusy] = useState(false);
    const [askError, setAskError] = useState(null);

    const check = useCallback(async () => {
        setStatus({ state: 'checking' });
        try {
            const r = await fetch(`${API_URL}/api/analyst/llm/status`);
            if (!r.ok) throw new Error(`the server answered ${r.status} — restart it after updating`);
            const s = await r.json();
            setStatus(s.available ? { state: 'ready', ...s } : { state: 'off', ...s });
        } catch (err) {
            setStatus({ state: 'off', reason: `Could not ask the server: ${err.message}` });
        }
    }, []);

    useEffect(() => { check(); }, [check]);

    /** POST to the relay; a refusal comes back as an error with the reason in it. */
    const post = async (path, payload) => {
        let r;
        try {
            r = await fetch(`${API_URL}/api/analyst/llm/${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch {
            // The browser's own wording ("Failed to fetch") hides that this is
            // the API server, not the model: nothing answered at all.
            throw new Error(`Could not reach the API server at ${API_URL}. Check that npm run server is running and look at its terminal for an error — the request never got as far as the model.`);
        }
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
            // Keep what the model sent back: a failed run is the one most worth reading.
            const err = new Error(body.error || `HTTP ${r.status}`);
            err.raw = body.raw;
            throw err;
        }
        return body;
    };

    const writeBrief = async () => {
        setBriefBusy(true);
        setBriefError(null);
        const sent = facts?.findings?.length || 0;
        const prompt = promptSent('brief', facts, '', prompts.brief || '');
        try {
            const reply = await post('brief', { facts, systemPrompt: prompts.brief || '' });
            setBrief(reply);
            onResponse?.({ kind: 'brief', ok: true, findingsSent: sent, ...reply, prompt: await prompt });
        } catch (err) {
            setBriefError(err.message);
            onResponse?.({ kind: 'brief', ok: false, findingsSent: sent, error: err.message, model: status.model, raw: err.raw, prompt: await prompt });
        } finally {
            setBriefBusy(false);
        }
    };

    const ask = async (e) => {
        e.preventDefault();
        const q = question.trim();
        if (!q || askBusy) return;
        setAskBusy(true);
        setAskError(null);
        const asked = { ...facts, focus: focusFor?.(q) || [], news: (await newsFor?.(q)) || [] };
        const prompt = promptSent('ask', asked, q, prompts.ask || '');
        try {
            const reply = await post('ask', { question: q, facts: asked, systemPrompt: prompts.ask || '' });
            setAnswers((prev) => [{ q, ...reply }, ...prev].slice(0, 5));
            setQuestion('');
            onResponse?.({ kind: 'ask', ok: true, question: q, findingsSent: facts?.findings?.length || 0, ...reply, prompt: await prompt });
        } catch (err) {
            setAskError(err.message);
            onResponse?.({ kind: 'ask', ok: false, question: q, error: err.message, model: status.model, raw: err.raw, prompt: await prompt });
        } finally {
            setAskBusy(false);
        }
    };

    const seconds = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;

    return (
        <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                        <Bot size={17} className="text-indigo-300" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white leading-tight">Local AI brief</h2>
                        <p className="text-[10px] text-indigo-300/80 font-bold uppercase tracking-wider">LM Studio · stays on this machine</p>
                    </div>
                </div>
                {status.state !== 'checking' && (
                    <button
                        type="button"
                        onClick={check}
                        title="Check for a running model again"
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                )}
            </div>

            {status.state === 'checking' && (
                <p className="text-[12px] text-gray-500 mt-4">Looking for a local model…</p>
            )}

            {status.state === 'off' && (
                <div className="mt-4 space-y-3">
                    <p className="text-[12px] text-gray-400 leading-relaxed">
                        No model is running, and nothing below needs one — every suggestion and figure comes
                        from the analyst. A model only adds a plain-words brief and answers questions about them.
                    </p>
                    <ol className="text-[12px] text-gray-300 leading-relaxed list-decimal pl-4 space-y-1">
                        <li>In LM Studio, download a small instruct model — 3–4B is plenty, e.g. Qwen3 4B Instruct or Llama 3.2 3B Instruct.</li>
                        <li>Load it with a context length of 8,192 if you can spare the memory.</li>
                        <li>Developer tab → Start Server (port 1234), then press refresh above.</li>
                    </ol>
                    {status.reason && <p className="text-[11px] text-amber-300/90">{status.reason}</p>}
                </div>
            )}

            {status.state === 'ready' && (
                <div className="mt-4 space-y-4">
                    {(status.relayVersion || 0) < EXPECTED_RELAY && (
                        <p className="text-[11px] text-amber-300 leading-relaxed">
                            The API server is running older code than this page. Restart <code>npm run server</code> so the latest fixes take effect.
                        </p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <Cpu size={12} className="text-emerald-400" />
                        <span className="truncate" title={status.baseUrl}>{status.model}</span>
                    </div>

                    <button
                        type="button"
                        onClick={writeBrief}
                        disabled={briefBusy || !facts}
                        className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white text-xs font-black transition-colors flex items-center justify-center gap-2"
                    >
                        {briefBusy
                            ? <><RefreshCw size={13} className="animate-spin" /> Writing — a small model can take a minute</>
                            : brief ? 'Write it again' : 'Write my brief'}
                    </button>

                    {briefError && <p className="text-[12px] text-rose-300 leading-relaxed">{briefError}</p>}

                    {brief && !briefBusy && (
                        <div className="space-y-3">
                            {brief.summary && <p className="text-[13px] text-gray-200 leading-relaxed">{brief.summary}</p>}
                            {brief.priorities?.length > 0 && (
                                <ol className="space-y-2">
                                    {brief.priorities.map((p, i) => (
                                        <li key={p.id} className="rounded-xl bg-black/20 border border-white/5 p-3">
                                            <button
                                                type="button"
                                                onClick={() => onShowFinding?.(p.id)}
                                                className="w-full text-left flex items-start gap-2 group"
                                            >
                                                <span className="text-[11px] font-black text-indigo-300 mt-px">{i + 1}.</span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[12px] font-bold text-white group-hover:text-indigo-200">{titles[p.id] || p.id}</span>
                                                    <span className="block text-[12px] text-gray-400 mt-1 leading-relaxed">{p.why}</span>
                                                </span>
                                                <ChevronRight size={14} className="text-gray-600 group-hover:text-indigo-300 mt-0.5 shrink-0" />
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            )}
                            <p className="text-[10px] text-gray-600 leading-relaxed">
                                Written by {brief.model} in {seconds(brief.ms)} from the findings on this page.
                                The figures are the analyst’s; the wording is the model’s.
                                {!brief.structured && ' It did not return a structured brief, so its reply is shown as written.'}
                                {brief.discarded > 0 && ` ${brief.discarded} suggestion${brief.discarded === 1 ? '' : 's'} naming no real finding ${brief.discarded === 1 ? 'was' : 'were'} dropped.`}
                                {brief.truncated && ' The reply was cut off at its length limit.'}
                            </p>
                        </div>
                    )}

                    <form onSubmit={ask} className="pt-3 border-t border-white/5">
                        <label htmlFor="analyst-question" className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Ask about your stocks</label>
                        <div className="mt-2 flex gap-2">
                            <input
                                id="analyst-question"
                                type="text"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Why trim HDFC Bank before ITC?"
                                maxLength={500}
                                className="flex-1 min-w-0 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[12px] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-400/50"
                            />
                            <button
                                type="submit"
                                disabled={!question.trim() || askBusy}
                                className="px-3 rounded-xl bg-white/5 border border-white/10 text-indigo-200 hover:bg-white/10 disabled:opacity-40 transition-colors"
                                title="Ask"
                            >
                                {askBusy ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                            </button>
                        </div>
                        {(() => {
                            const a = attachedFor?.(question);
                            if (!a || (!a.held.length && !a.news.length)) return null;
                            return (
                                <p className="text-[10.5px] text-indigo-300/80 mt-1.5 leading-relaxed">
                                    Will also send{a.held.length ? ` averaging figures for ${a.held.join(' and ')}` : ''}
                                    {a.held.length && a.news.length ? ', and' : ''}
                                    {a.news.length ? ` the latest headlines for ${a.news.join(' and ')}` : ''}.
                                </p>
                            );
                        })()}
                        {askError && <p className="text-[12px] text-rose-300 mt-2 leading-relaxed">{askError}</p>}
                        {answers.map((a, i) => (
                            <div key={`${i}-${a.q}`} className="mt-3 rounded-xl bg-black/20 border border-white/5 p-3">
                                <p className="text-[11px] font-bold text-indigo-200">{a.q}</p>
                                <p className="text-[12px] text-gray-300 mt-1.5 leading-relaxed whitespace-pre-wrap">{a.answer}</p>
                                <p className="text-[10px] text-gray-600 mt-1.5">{a.model} · {seconds(a.ms)}{a.truncated ? ' · cut off at its length limit' : ''}</p>
                            </div>
                        ))}
                    </form>
                </div>
            )}
        </section>
    );
};

export default AnalystBrief;
