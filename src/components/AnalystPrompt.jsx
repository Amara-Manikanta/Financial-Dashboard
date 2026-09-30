import React, { useEffect, useState } from 'react';
import { RotateCcw, Copy, Check } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';

/**
 * What the local model is actually sent, and the part of it you can change.
 *
 * The preview comes from the server's own promptMessages(), the same function
 * the relay sends requests with, so what is shown is what goes out. Only the
 * instructions are editable. The facts underneath are always generated from
 * the analysis, so the model is never handed a figure that could be wrong.
 *
 * Edits live in localStorage: they are settings for this browser, not records.
 */
export const PROMPTS_KEY = 'kubera.analyst.prompts';

export const readPrompts = () => {
    try {
        const p = JSON.parse(localStorage.getItem(PROMPTS_KEY) || '{}');
        return { brief: typeof p.brief === 'string' ? p.brief : '', ask: typeof p.ask === 'string' ? p.ask : '' };
    } catch {
        return { brief: '', ask: '' };
    }
};

export const writePrompts = (p) => {
    try { localStorage.setItem(PROMPTS_KEY, JSON.stringify(p)); } catch { /* lasts this visit */ }
};

const KINDS = [
    { id: 'brief', label: 'Brief', blurb: 'Orders the findings and explains each in plain words.' },
    { id: 'ask', label: 'Questions', blurb: 'Answers a question from the facts alone.' },
];

const AnalystPrompt = ({ facts, prompts, onChange }) => {
    const [kind, setKind] = useState('brief');
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const custom = prompts[kind] || '';

    useEffect(() => {
        let live = true;
        // Debounced: the preview follows the edit without a request per keystroke.
        const timer = setTimeout(async () => {
            try {
                const r = await fetch(`${API_URL}/api/analyst/llm/prompt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind, facts, systemPrompt: custom }),
                });
                const body = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(r.status === 404 ? 'Restart npm run server to see the prompt.' : body.error || `HTTP ${r.status}`);
                if (live) { setPreview(body); setError(null); }
            } catch (err) {
                if (live) setError(err.message);
            }
        }, 300);
        return () => { live = false; clearTimeout(timer); };
    }, [kind, facts, custom]);

    const system = custom || preview?.defaultSystem || '';
    const user = preview?.messages?.find((m) => m.role === 'user')?.content || '';
    const chars = system.length + user.length;
    const edited = !!custom && custom.trim() !== (preview?.defaultSystem || '').trim();

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(`### System\n${system}\n\n### User\n${user}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked: the text is on screen to select */ }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                {KINDS.map((k) => (
                    <button
                        key={k.id}
                        type="button"
                        onClick={() => setKind(k.id)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${kind === k.id ? 'bg-white/10 border-white/20 text-white' : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:text-white'}`}
                    >
                        {k.label}
                    </button>
                ))}
                <span className="text-[11px] text-gray-500">{KINDS.find((k) => k.id === kind).blurb}</span>
                <button type="button" onClick={copy} className="ml-auto text-[11px] font-bold text-gray-400 hover:text-white flex items-center gap-1">
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy full prompt'}
                </button>
            </div>

            {error && <p className="text-[12px] text-rose-300">{error}</p>}

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-[13px] font-black text-white">Instructions {edited && <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-amber-300">edited</span>}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Sent as the system message. Saved in this browser as you type and used for every brief or answer.</p>
                    </div>
                    <button
                        type="button"
                        disabled={!custom}
                        onClick={() => onChange({ ...prompts, [kind]: '' })}
                        className="shrink-0 text-[11px] font-bold text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
                    >
                        <RotateCcw size={12} /> Reset to default
                    </button>
                </div>
                <textarea
                    value={system}
                    onChange={(e) => onChange({ ...prompts, [kind]: e.target.value })}
                    rows={12}
                    maxLength={6000}
                    spellCheck={false}
                    className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 p-3 text-[12px] leading-relaxed text-gray-200 font-mono focus:outline-none focus:border-indigo-400/50"
                />
                <p className="text-[10.5px] text-gray-600 mt-2">
                    Keep the rule against arithmetic: a small model copies figures reliably and adds them unreliably.
                    {kind === 'brief' && ' The reply must stay JSON with "summary" and "priorities" for the page to lay it out.'}
                </p>
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="text-[13px] font-black text-white">Facts <span className="text-[10px] font-bold text-gray-500 ml-1">generated from the analysis · read-only</span></h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                    Sent as the user message, exactly as below. About {Math.round(chars / 4).toLocaleString('en-IN')} tokens with the instructions — keep it under your model's context length.
                </p>
                <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl bg-black/40 border border-white/5 p-3 text-[11.5px] leading-relaxed text-gray-400 whitespace-pre-wrap break-words">
                    {user || 'Loading…'}
                </pre>
            </section>
        </div>
    );
};

export default AnalystPrompt;
