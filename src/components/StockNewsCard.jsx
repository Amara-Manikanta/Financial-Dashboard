import React, { useCallback, useEffect, useState } from 'react';
import { Newspaper, RefreshCw, Sparkles, Download, ExternalLink } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';

/**
 * A stock's stored news, one story per row of its CSV file: when it came out,
 * which outlets carried it, and what the local model took from the article.
 * Read-only for db.json — the news file lives in db/news/, not the database.
 */
const IMPACT = {
    positive: 'bg-emerald-500/15 text-emerald-300',
    negative: 'bg-rose-500/15 text-rose-300',
    mixed: 'bg-amber-500/15 text-amber-300',
    neutral: 'bg-white/10 text-gray-300',
};

const dateOf = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'undated');
const agoOf = (iso) => {
    const t = Date.parse(iso);
    if (!t) return '';
    const days = Math.floor((Date.now() - t) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

const StockNewsCard = ({ symbol, name }) => {
    const [stories, setStories] = useState(null);
    const [busy, setBusy] = useState('');
    const [note, setNote] = useState('');
    const [showAll, setShowAll] = useState(false);
    const q = `symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name || '')}`;

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/analyst/news/stored?${q}`);
            if (!r.ok) throw new Error(r.status === 404 ? 'Restart npm run server to see stored news.' : `HTTP ${r.status}`);
            setStories((await r.json()).items || []);
        } catch (err) {
            setStories([]);
            setNote(err.message);
        }
    }, [q]);

    useEffect(() => { load(); }, [load]);

    const fetchLatest = async () => {
        setBusy('fetch');
        setNote('');
        try {
            const r = await fetch(`${API_URL}/api/analyst/news?${q}&fresh=1`);
            const body = await r.json();
            setNote(`${body.archive?.added || 0} new ${body.archive?.added === 1 ? 'story' : 'stories'}${body.errors?.length ? ` · ${body.errors.join('; ')}` : ''}`);
        } catch {
            setNote('Could not reach the API server.');
        }
        await load();
        setBusy('');
    };

    const analyse = async () => {
        setBusy('analyse');
        setNote('');
        try {
            const r = await fetch(`${API_URL}/api/analyst/news/analyse?${q}&count=5`, { method: 'POST' });
            const body = await r.json();
            if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
            setNote(body.modelUnavailable
                ? `No local model is running (${body.errors[0] || 'start LM Studio'}).`
                : `${body.analysed} analysed${body.skipped ? `, ${body.skipped} could not be read` : ''}${body.failed ? `, ${body.failed} failed` : ''}.`);
            setStories(body.archive?.items || []);
        } catch (err) {
            setNote(err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message);
        }
        setBusy('');
    };

    const unread = (stories || []).filter((s) => !s.keyPoints?.length && !s.status).length;
    const shown = showAll ? stories || [] : (stories || []).slice(0, 12);

    return (
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-[15px] font-black text-white flex items-center gap-2">
                    <Newspaper size={16} className="text-indigo-300" /> News &amp; analysis
                </h3>
                {stories && (
                    <span className="text-[11px] text-gray-500 font-bold">
                        {stories.length} stories · {stories.filter((s) => s.keyPoints?.length).length} analysed
                        {stories.length > 0 && ` · since ${dateOf(stories[stories.length - 1].published || stories[stories.length - 1].firstSeen)}`}
                    </span>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                    <button type="button" onClick={fetchLatest} disabled={!!busy} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50 text-[11px] font-black flex items-center gap-1.5">
                        <RefreshCw size={12} className={busy === 'fetch' ? 'animate-spin' : ''} /> Fetch latest
                    </button>
                    <button
                        type="button"
                        onClick={analyse}
                        disabled={!!busy || unread === 0}
                        title="The local model reads up to five unread articles and stores their key points (about 20 seconds each)"
                        className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-[11px] font-black flex items-center gap-1.5"
                    >
                        <Sparkles size={12} className={busy === 'analyse' ? 'animate-pulse' : ''} /> {busy === 'analyse' ? 'Reading articles…' : `Analyse ${Math.min(5, unread) || ''} unread`}
                    </button>
                    {stories?.length > 0 && (
                        <a href={`${API_URL}/api/analyst/news/csv?symbol=${encodeURIComponent(symbol)}`} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-[11px] font-black flex items-center gap-1.5">
                            <Download size={12} /> CSV
                        </a>
                    )}
                </div>
            </div>
            {note && <p className="text-[11.5px] text-gray-400 mt-2">{note}</p>}

            {stories === null && <p className="text-[12px] text-gray-500 mt-4">Loading…</p>}
            {stories?.length === 0 && !note && (
                <p className="text-[12px] text-gray-500 mt-4">No news stored yet. Fetch latest, or wait for the server's six-hourly collection.</p>
            )}

            <ul className="mt-4 space-y-3">
                {shown.map((s) => (
                    <li key={s.id} className="border-t border-white/5 pt-3 first:border-0 first:pt-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-gray-500 font-bold">
                            <span>{dateOf(s.published || s.firstSeen)}</span>
                            <span className="text-gray-600">{agoOf(s.published || s.firstSeen)}</span>
                            <span className="text-gray-400">{s.theme}</span>
                            {s.impact && <span className={`px-1.5 rounded ${IMPACT[s.impact] || IMPACT.neutral}`}>{s.impact}</span>}
                            {s.coverage > 1 && <span className="px-1.5 rounded bg-indigo-500/15 text-indigo-300">{s.coverage} outlets</span>}
                        </div>
                        <a href={s.url || s.links?.[0]?.url} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-gray-100 hover:text-indigo-200 inline-flex items-start gap-1 mt-1">
                            {s.title} <ExternalLink size={10} className="mt-1.5 shrink-0 text-gray-600" />
                        </a>
                        {s.keyPoints?.length > 0 ? (
                            <div className="mt-1.5">
                                <ul className="list-disc pl-4 space-y-0.5 text-[12px] text-gray-300 leading-relaxed">
                                    {s.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                                {s.why && <p className="text-[11.5px] text-gray-400 mt-1"><span className="text-gray-500 font-bold">Why it matters:</span> {s.why}</p>}
                                <p className="text-[10px] text-gray-600 mt-1">
                                    Read by {s.analysedBy || 'the local model'} on {dateOf(s.analysedAt)} from the {s.basis === 'description' ? 'publisher’s description (the article could not be opened)' : 'article'} — the model’s reading, not a verified summary.
                                </p>
                            </div>
                        ) : s.status ? (
                            <p className="text-[11px] text-gray-600 mt-1">{s.status}</p>
                        ) : s.summary ? (
                            <p className="text-[11.5px] text-gray-400 mt-1">{s.summary}</p>
                        ) : null}
                        <p className="text-[10.5px] text-gray-500 mt-1 flex flex-wrap gap-x-2">
                            {(s.links || []).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer" className="hover:text-indigo-200">{l.source}</a>)}
                        </p>
                    </li>
                ))}
            </ul>
            {stories?.length > 12 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-[11px] font-bold text-gray-400 hover:text-white">
                    {showAll ? 'Show fewer' : `Show all ${stories.length}`}
                </button>
            )}
        </section>
    );
};

export default StockNewsCard;
