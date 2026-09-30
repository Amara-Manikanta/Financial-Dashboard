import React, { useEffect, useState } from 'react';
import { RefreshCw, Send, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';

/**
 * Your own prompt, sent with every stock and mutual fund you hold — and, if
 * you switch it on, a summary of the rest of the dashboard.
 *
 * Unlike the brief, this asks the model for its opinion, so the answer is
 * labelled as one. The figures it is handed are still computed by the app and
 * shown below exactly as sent; the model is told to copy them, not work them out.
 *
 * The instructions, question and switch are kept in localStorage alongside the
 * other prompt edits (see AnalystPrompt): settings for this browser, not records.
 */
const CUSTOM_KEY = 'kubera.analyst.custom';

const readSaved = () => {
    try {
        const p = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}');
        return {
            system: typeof p.system === 'string' ? p.system : '',
            question: typeof p.question === 'string' ? p.question : '',
            withDashboard: p.withDashboard === true,
        };
    } catch {
        return { system: '', question: '', withDashboard: false };
    }
};

const AnalystCustom = ({ facts, dashboard, model, onResponse }) => {
    const [saved, setSaved] = useState(readSaved);
    const [preview, setPreview] = useState(null);
    const [showFacts, setShowFacts] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [answer, setAnswer] = useState(null);

    const update = (patch) => setSaved((prev) => {
        const next = { ...prev, ...patch };
        try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch { /* lasts this visit */ }
        return next;
    });

    const sent = { ...facts, dashboard: saved.withDashboard ? dashboard : '' };

    useEffect(() => {
        let live = true;
        const timer = setTimeout(async () => {
            try {
                const r = await fetch(`${API_URL}/api/analyst/llm/prompt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: 'custom', facts: sent, question: saved.question, systemPrompt: saved.system }),
                });
                const body = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
                if (live) { setPreview(body.kind === 'custom' ? body : null); setError(body.kind === 'custom' ? null : 'Restart npm run server to use your own prompt.'); }
            } catch (err) {
                if (live) setError(err.message);
            }
        }, 300);
        return () => { live = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facts, dashboard, saved]);

    const system = saved.system || preview?.defaultSystem || '';
    const user = preview?.messages?.find((m) => m.role === 'user')?.content || '';

    const send = async () => {
        const q = saved.question.trim();
        if (!q || busy) return;
        setBusy(true);
        setError(null);
        try {
            let r;
            try {
                r = await fetch(`${API_URL}/api/analyst/llm/ask`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: 'custom', question: q, facts: sent, systemPrompt: saved.system }),
                });
            } catch {
                throw new Error(`Could not reach the API server at ${API_URL}. Check that npm run server is running.`);
            }
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                const err = new Error(body.error || `HTTP ${r.status}`);
                err.raw = body.raw;
                throw err;
            }
            setAnswer({ q, ...body });
            onResponse?.({ kind: 'custom', ok: true, question: q, withDashboard: saved.withDashboard, ...body });
        } catch (err) {
            setError(err.message);
            onResponse?.({ kind: 'custom', ok: false, question: q, withDashboard: saved.withDashboard, error: err.message, model, raw: err.raw });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 space-y-3">
                <label htmlFor="custom-question" className="block text-[13px] font-black text-white">Your question</label>
                <textarea
                    id="custom-question"
                    value={saved.question}
                    onChange={(e) => update({ question: e.target.value })}
                    rows={4}
                    maxLength={2000}
                    placeholder="Looking at all my stocks and funds, what should I do this month? Where am I overexposed, and what would you add to with ₹20,000?"
                    className="w-full rounded-xl bg-black/30 border border-white/10 p-3 text-[12.5px] leading-relaxed text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-400/50"
                />
                <label className="flex items-start gap-2 text-[12px] text-gray-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={saved.withDashboard}
                        onChange={(e) => update({ withDashboard: e.target.checked })}
                        className="mt-0.5 accent-indigo-500"
                    />
                    <span>
                        Include the whole dashboard — net worth, savings, PPF/NPS/FDs, gold, loans, credit cards, monthly income and spending, and income tax.
                        <span className="block text-[11px] text-gray-500">Stays on this machine: it goes only to the model in LM Studio.</span>
                    </span>
                </label>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={send}
                        disabled={busy || !saved.question.trim()}
                        className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2"
                    >
                        {busy ? <><RefreshCw size={13} className="animate-spin" /> Thinking — can take a minute</> : <><Send size={13} /> Ask {model || 'the model'}</>}
                    </button>
                    <span className="text-[11px] text-gray-500">About {Math.round((system.length + user.length) / 4).toLocaleString('en-IN')} tokens — keep under your model's context length.</span>
                </div>
                {error && <p className="text-[12px] text-rose-300 leading-relaxed">{error}</p>}
            </section>

            {answer && !busy && (
                <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-5">
                    <p className="text-[11px] font-bold text-indigo-200">{answer.q}</p>
                    <p className="text-[13px] text-gray-200 mt-2 leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                    <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
                        {answer.model} · {(answer.ms / 1000).toFixed(0)}s{answer.truncated ? ' · cut off at its length limit' : ''}.
                        This is the model’s opinion, not a calculation. Check any figure it quotes against the list below, and anything it suggests against the Findings tab.
                    </p>
                </section>
            )}

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-[13px] font-black text-white">Instructions {saved.system && <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-amber-300">edited</span>}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">How the model should behave. Sent as the system message.</p>
                    </div>
                    <button
                        type="button"
                        disabled={!saved.system}
                        onClick={() => update({ system: '' })}
                        className="shrink-0 text-[11px] font-bold text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
                    >
                        <RotateCcw size={12} /> Reset to default
                    </button>
                </div>
                <textarea
                    value={system}
                    onChange={(e) => update({ system: e.target.value })}
                    rows={8}
                    maxLength={6000}
                    spellCheck={false}
                    className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 p-3 text-[12px] leading-relaxed text-gray-200 font-mono focus:outline-none focus:border-indigo-400/50"
                />
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <button type="button" onClick={() => setShowFacts((v) => !v)} className="flex items-center gap-1.5 text-[13px] font-black text-white">
                    {showFacts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    What is sent with it <span className="text-[10px] font-bold text-gray-500 ml-1">generated from your data · read-only</span>
                </button>
                {showFacts && (
                    <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-black/40 border border-white/5 p-3 text-[11.5px] leading-relaxed text-gray-400 whitespace-pre-wrap break-words">
                        {user || 'Loading…'}
                    </pre>
                )}
            </section>
        </div>
    );
};

export default AnalystCustom;
