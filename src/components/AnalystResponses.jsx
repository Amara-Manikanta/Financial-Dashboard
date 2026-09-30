import React, { useState } from 'react';
import { Bot, MessageSquare, AlertTriangle, ChevronRight, Trash2 } from 'lucide-react';

/**
 * Everything the local model has said on the Stock Analyst page, newest first.
 *
 * Kept in localStorage, not db.json: a model's wording is a derived opinion,
 * not a financial record, and it has no business travelling through the write
 * guard and the SQLite mirror. It lives only in this browser and survives a
 * reload; clearing it loses nothing the analyst cannot recompute.
 */
export const RESPONSES_KEY = 'kubera.analyst.responses';
export const MAX_RESPONSES = 50;

export const readResponses = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(RESPONSES_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
};

export const writeResponses = (list) => {
    try {
        localStorage.setItem(RESPONSES_KEY, JSON.stringify(list));
    } catch {
        // Private window or full storage: the log lasts until the page closes.
    }
};

const when = (iso) => new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const seconds = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s` : null);

const Entry = ({ entry: e, titles, onShowFinding }) => {
    const [raw, setRaw] = useState(false);
    const Icon = e.kind === 'brief' ? Bot : MessageSquare;
    const flags = [
        e.ok && e.kind === 'brief' && !e.structured && 'not structured — shown as written',
        e.ok && e.kind === 'brief' && e.constrained === false && 'server ignored the JSON schema',
        e.discarded > 0 && `${e.discarded} invented finding${e.discarded === 1 ? '' : 's'} dropped`,
        e.truncated && 'cut off at its length limit',
    ].filter(Boolean);

    return (
        <article className={`rounded-2xl border bg-white/[0.025] p-5 ${e.ok ? 'border-white/[0.07]' : 'border-rose-500/30'}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                <span className="flex items-center gap-1.5 text-indigo-300"><Icon size={12} /> {e.kind === 'brief' ? 'Brief' : e.kind === 'custom' ? `Your prompt${e.withDashboard ? ' · whole dashboard' : ''}` : 'Answer'}</span>
                <span>{when(e.at)}</span>
                {e.model && <span className="normal-case tracking-normal font-bold text-gray-500">{e.model}</span>}
                {seconds(e.ms) && <span className="normal-case tracking-normal font-bold text-gray-500">{seconds(e.ms)}</span>}
                {e.findingsSent > 0 && <span className="normal-case tracking-normal font-bold text-gray-500">{e.findingsSent} findings sent</span>}
            </div>

            {e.question && <p className="text-[13px] font-bold text-white mt-3">{e.question}</p>}

            {!e.ok && (
                <p className="text-[12.5px] text-rose-300 mt-3 flex items-start gap-2 leading-relaxed">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {e.error}
                </p>
            )}

            {e.ok && e.summary && <p className="text-[13px] text-gray-200 mt-3 leading-relaxed">{e.summary}</p>}
            {e.ok && e.answer && <p className="text-[13px] text-gray-200 mt-2 leading-relaxed whitespace-pre-wrap">{e.answer}</p>}

            {e.ok && e.priorities?.length > 0 && (
                <ol className="mt-3 space-y-2">
                    {e.priorities.map((p, i) => (
                        <li key={p.id}>
                            <button
                                type="button"
                                onClick={() => onShowFinding(p.id)}
                                className="w-full text-left rounded-xl bg-black/20 border border-white/5 p-3 flex items-start gap-2 group"
                            >
                                <span className="text-[11px] font-black text-indigo-300 mt-px">{i + 1}.</span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[12px] font-bold text-white group-hover:text-indigo-200">
                                        {titles[p.id] || `${p.id} (no longer a current finding)`}
                                    </span>
                                    <span className="block text-[12px] text-gray-400 mt-1 leading-relaxed">{p.why}</span>
                                </span>
                                <ChevronRight size={14} className="text-gray-600 group-hover:text-indigo-300 mt-0.5 shrink-0" />
                            </button>
                        </li>
                    ))}
                </ol>
            )}

            {flags.length > 0 && <p className="text-[10.5px] text-amber-300/80 mt-3">{flags.join(' · ')}</p>}

            <button
                type="button"
                onClick={() => setRaw((v) => !v)}
                className="mt-3 text-[11px] font-bold text-gray-500 hover:text-white"
            >
                {raw ? 'Hide raw response' : 'Show raw response'}
            </button>
            {raw && (
                <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-black/40 border border-white/5 p-3 text-[11px] text-gray-400 whitespace-pre-wrap break-words">
                    {JSON.stringify(e, null, 2)}
                </pre>
            )}
        </article>
    );
};

const AnalystResponses = ({ responses, titles, onShowFinding, onClear }) => {
    if (responses.length === 0) {
        return (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-10 text-center">
                <Bot size={32} className="mx-auto text-gray-600" />
                <p className="text-white font-bold mt-3">No AI responses yet</p>
                <p className="text-[12px] text-gray-500 mt-1 max-w-md mx-auto leading-relaxed">
                    Write a brief or ask a question in the Local AI panel. Every reply — and every failure —
                    is kept here so you can compare runs and see exactly what the model returned.
                </p>
            </div>
        );
    }
    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-[11px] text-gray-500">
                    The last {MAX_RESPONSES} replies, kept in this browser only. Figures quoted in them are the analyst’s; the wording is the model’s.
                </p>
                <button
                    type="button"
                    onClick={() => { if (window.confirm('Clear the AI response history from this browser?')) onClear(); }}
                    className="shrink-0 text-[11px] font-bold text-gray-500 hover:text-rose-300 flex items-center gap-1"
                >
                    <Trash2 size={12} /> Clear
                </button>
            </div>
            <div className="space-y-3">
                {responses.map((e) => <Entry key={e.id} entry={e} titles={titles} onShowFinding={onShowFinding} />)}
            </div>
        </div>
    );
};

export default AnalystResponses;
