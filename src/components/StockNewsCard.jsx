import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Newspaper, RefreshCw, Sparkles, Download, ExternalLink, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';

/**
 * Aggregates all analysed stories into a sentiment digest: overall signal,
 * positive highlights, negative concerns, and whether action is needed.
 * Computed client-side from the stored key points — no extra API call.
 */
const cleanSentence = (str) => {
    if (!str) return '';
    const trimmed = str.trim().replace(/^[•\-\*]\s*/, '').replace(/\.+$/, '');
    return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
};

const formatToParagraph = (points, whys) => {
    if (!points || points.length === 0) return '';
    const sentences = points.map(cleanSentence).filter(Boolean);
    let text = sentences.join('. ');
    if (text && !text.endsWith('.')) text += '.';
    if (whys && whys[0]) {
        const why = cleanSentence(whys[0]);
        if (why) text += ` Key driver: ${why}.`;
    }
    return text;
};

const NewsSentimentSummary = ({ stories }) => {
    const digest = useMemo(() => {
        const analysed = (stories || []).filter((s) => s.keyPoints?.length > 0);
        if (analysed.length === 0) return null;

        const positive = analysed.filter((s) => s.impact === 'positive');
        const negative = analysed.filter((s) => s.impact === 'negative');
        const mixed = analysed.filter((s) => s.impact === 'mixed');

        const uniquePoints = (arr) => {
            const seen = new Set();
            return arr.filter((p) => {
                const key = p.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 45);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).slice(0, 5);
        };

        const posPoints = uniquePoints(positive.flatMap((s) => s.keyPoints || []));
        const negPoints = uniquePoints(negative.flatMap((s) => s.keyPoints || []));
        const posWhys = positive.map((s) => s.why).filter(Boolean);
        const negWhys = negative.map((s) => s.why).filter(Boolean);

        const themes = [...new Set(analysed.map((s) => s.theme).filter(Boolean))];
        const actionable = [...negative, ...mixed.filter((s) => s.why?.length > 20)];

        const total = analysed.length;
        const posRatio = positive.length / total;
        const negRatio = negative.length / total;

        let actionNeeded = false;
        let actionLabel = 'No Action Needed';
        let actionColor = 'text-emerald-300';
        let actionBg = 'bg-emerald-500/10 border-emerald-500/20';
        let ActionIcon = CheckCircle;

        if (actionable.length > 0 || negRatio >= 0.4) {
            actionNeeded = true;
            actionLabel = negRatio > 0.5 ? 'Action Needed: High Caution' : 'Action Needed: Review Concerns';
            actionColor = 'text-rose-300';
            actionBg = 'bg-rose-500/10 border-rose-500/20';
            ActionIcon = AlertTriangle;
        } else if (mixed.length > 0 && negative.length > 0) {
            actionNeeded = true;
            actionLabel = 'Action Needed: Watch Key Catalysts';
            actionColor = 'text-amber-300';
            actionBg = 'bg-amber-500/10 border-amber-500/20';
            ActionIcon = AlertTriangle;
        }

        const positiveParagraph = formatToParagraph(posPoints, posWhys);
        const negativeParagraph = formatToParagraph(negPoints, negWhys);

        // Build 1 single cohesive paragraph summarizing all points
        const unifiedSummaryParts = [];
        if (posPoints.length > 0) {
            unifiedSummaryParts.push(`Key positive catalysts include ${posPoints.slice(0, 3).map(cleanSentence).join(', ')}.`);
        }
        if (negPoints.length > 0) {
            unifiedSummaryParts.push(`On the downside, notable concerns involve ${negPoints.slice(0, 3).map(cleanSentence).join(', ')}.`);
        }
        if (actionNeeded) {
            unifiedSummaryParts.push(`Given these developments, close monitoring is advised regarding ${actionable.slice(0, 2).map((s) => s.title).join(' and ')}.`);
        } else {
            unifiedSummaryParts.push('Overall sentiment remains supportive with no immediate risk triggers.');
        }
        const singleUnifiedParagraph = unifiedSummaryParts.join(' ');

        return {
            total,
            positiveCount: positive.length,
            negativeCount: negative.length,
            mixedCount: mixed.length,
            themes,
            actionable,
            actionNeeded,
            actionLabel,
            actionColor,
            actionBg,
            ActionIcon,
            singleUnifiedParagraph,
            positiveParagraph,
            negativeParagraph,
        };
    }, [stories]);

    if (!digest) return null;

    return (
        <div className={`mt-4 rounded-xl border ${digest.actionBg} p-4 space-y-3.5`}>
            {/* Header: Action Needed status */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                    <digest.ActionIcon size={16} className={digest.actionColor} />
                    <span className={`text-[13px] font-black tracking-wide ${digest.actionColor}`}>
                        {digest.actionLabel}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${digest.actionNeeded ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {digest.actionNeeded ? 'Action Required' : 'Neutral / Positive'}
                    </span>
                </div>
                <span className="text-[10.5px] text-gray-500 font-bold">
                    {digest.total} analysed {digest.total === 1 ? 'story' : 'stories'} ({digest.positiveCount} positive, {digest.negativeCount} negative)
                </span>
            </div>

            {/* 1 Single Paragraph Summary of All Points */}
            <div>
                <h4 className="text-[11px] font-black text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-indigo-400" /> Executive Summary (All Points)
                </h4>
                <p className="text-[12.5px] text-gray-200 leading-relaxed font-normal">
                    {digest.singleUnifiedParagraph}
                </p>
            </div>

            {/* Positive Paragraph */}
            {digest.positiveParagraph && (
                <div className="border-t border-white/5 pt-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp size={12} className="text-emerald-400" />
                        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
                            Positive Developments ({digest.positiveCount} stories)
                        </span>
                    </div>
                    <p className="text-[12px] text-gray-300 leading-relaxed">
                        {digest.positiveParagraph}
                    </p>
                </div>
            )}

            {/* Negative Paragraph */}
            {digest.negativeParagraph && (
                <div className="border-t border-white/5 pt-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <TrendingDown size={12} className="text-rose-400" />
                        <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider">
                            Negative Headwinds &amp; Concerns ({digest.negativeCount} stories)
                        </span>
                    </div>
                    <p className="text-[12px] text-gray-300 leading-relaxed">
                        {digest.negativeParagraph}
                    </p>
                </div>
            )}

            {/* Action Items list if action is needed */}
            {digest.actionable.length > 0 && (
                <div className="border-t border-white/5 pt-2.5 bg-black/10 rounded-lg p-2.5 -mx-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle size={12} className="text-amber-400" />
                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
                            Key Triggers to Review
                        </span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11.5px] text-gray-300">
                        {digest.actionable.slice(0, 3).map((s, i) => (
                            <li key={i}>
                                <span className="font-bold text-gray-100">{s.title}</span>
                                {s.why && <span className="text-gray-400"> — {s.why}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

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

            <NewsSentimentSummary stories={stories} />

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
