import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Newspaper, RefreshCw, Sparkles, Download, ExternalLink, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
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

const NewsSentimentSummary = ({ stories, financials }) => {
    const digest = useMemo(() => {
        const analysed = (stories || []).filter((s) => s.keyPoints?.length > 0);
        if (analysed.length === 0 && !financials) return null;

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
        const posRatio = total > 0 ? positive.length / total : 0;
        const negRatio = total > 0 ? negative.length / total : 0;

        // Business Health (from Yahoo Finance / fundamentals cache)
        const health = financials?.healthScore || null;
        const checks = health?.checks || [];
        const weakChecks = checks.filter((c) => c.status !== 'good').map((c) => `${c.name} (${c.detail})`);
        const fundSignal = financials?.signal?.action || null;

        // Check for severe legal/fraud/investigation triggers
        const hasSevereRisk = actionable.some((s) =>
            /\b(fraud|probe|scam|penalty|sebi ban|cbi|ed probe|default|insolvency|nclt)\b/i.test(`${s.title} ${s.why || ''}`)
        );

        let stanceAction = 'HOLD';
        let stanceLabel = 'Hold & Watch';
        let stanceIcon = '🟡';
        let stanceBadge = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
        let stanceRationale = 'Balanced tailwinds and headwinds with no overriding directional catalyst. Maintain current position and watch key levels.';
        let actionNeeded = false;
        let actionColor = 'text-yellow-300';
        let actionBg = 'bg-yellow-500/10 border-yellow-500/20';
        let ActionIcon = CheckCircle;

        // 1. Critical risk override: Severe fraud/probe OR catastrophic fundamentals with heavy negative news
        if (hasSevereRisk || (health && health.total <= 1 && negRatio > 0.3) || negRatio >= 0.45 || fundSignal === 'sell') {
            actionNeeded = true;
            stanceAction = 'SELL / EXIT';
            stanceLabel = 'Review for Exit / Sell';
            stanceIcon = '🔴';
            stanceBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
            stanceRationale = hasSevereRisk
                ? 'High-severity regulatory, governance, or default risk detected. Review position closely for exit or capital protection.'
                : (health && health.total <= 1
                    ? `Adverse news headwinds combined with critical business vulnerabilities (${weakChecks.slice(0, 2).join('; ') || 'poor fundamentals'}). High exit priority to preserve capital.`
                    : (fundSignal === 'sell'
                        ? 'Business fundamentals signal review for exit (deteriorating earnings / contracting margins). News flow supports capital protection.'
                        : 'Adverse news headwinds significantly dominate recent coverage. Review holding thesis and consider exiting to protect capital.'));
            actionColor = 'text-rose-300';
            actionBg = 'bg-rose-500/10 border-rose-500/20';
            ActionIcon = AlertTriangle;

        // 2. Fundamental Buy / Strong Buy alignment (e.g. Infosys)
        } else if ((fundSignal === 'buy' || fundSignal === 'strong_buy') && negRatio < 0.35) {
            stanceAction = fundSignal === 'strong_buy' ? 'STRONG BUY' : 'BUY';
            stanceLabel = 'Buy on Dips / Accumulate';
            stanceIcon = '🟢';
            stanceBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            stanceRationale = health
                ? `Business fundamentals indicate ${financials.signal?.label || 'Buy on Dips'} (${health.total}/${health.max} — ${health.label}). Recent news flow is supportive with no structural red flags — favorable setup for accumulating on dips.`
                : 'Positive business fundamentals confirmed. News flow is supportive — favorable setup for accumulating on dips.';
            actionColor = 'text-emerald-300';
            actionBg = 'bg-emerald-500/10 border-emerald-500/20';
            ActionIcon = CheckCircle;

        // 3. News-driven Buy on Dips when fundamentals are strong or unrated
        } else if (posRatio >= 0.50 && (!health || health.total >= 4) && negRatio < 0.25) {
            stanceAction = health ? 'STRONG BUY' : 'BUY';
            stanceLabel = 'Buy on Dips / Accumulate';
            stanceIcon = '🟢';
            stanceBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            stanceRationale = health
                ? `Positive news catalysts (${positive.length} positive stories) are firmly backed by robust business health (${health.total}/${health.max} — ${health.label}). High-conviction setup for accumulating on dips.`
                : 'Positive catalysts (strong earnings, contracts, growth initiatives) strongly outweigh concerns. Favorable backdrop for accumulating on dips.';
            actionColor = 'text-emerald-300';
            actionBg = 'bg-emerald-500/10 border-emerald-500/20';
            ActionIcon = CheckCircle;

        // 4. Value trap alert: Positive news buzz but fragile fundamentals
        } else if (posRatio >= 0.5 && health && health.total <= 2) {
            actionNeeded = true;
            stanceAction = 'VALUE TRAP RISK';
            stanceLabel = 'Caution: Fragile Fundamentals';
            stanceIcon = '🟠';
            stanceBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            stanceRationale = `Positive headlines observed, but business health is fragile (${health.total}/${health.max}: ${weakChecks.join(', ') || 'high debt or contracting margins'}). High risk of a value trap — avoid aggressively chasing rallies.`;
            actionColor = 'text-amber-300';
            actionBg = 'bg-amber-500/10 border-amber-500/20';
            ActionIcon = AlertTriangle;

        // 5. Trim: Fundamental trim signal OR high news headwinds (>= 35% negative)
        } else if (fundSignal === 'trim' || negRatio >= 0.35 || (health && checks.some((c) => c.name === 'Valuation' && c.status === 'bad' && negRatio > 0.2))) {
            actionNeeded = true;
            stanceAction = 'TRIM';
            stanceLabel = 'Consider Trimming';
            stanceIcon = '🟠';
            stanceBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            stanceRationale = fundSignal === 'trim'
                ? `Business fundamentals suggest trimming profits (${financials.signal?.reasons?.slice(0, 2).join('; ') || 'valuation or margin caution'}).`
                : `Emerging margin pressure, sector headwinds, or stretched valuations (${weakChecks.slice(0, 2).join('; ') || 'valuation caution'}) indicate taking partial profits and reducing risk exposure.`;
            actionColor = 'text-amber-300';
            actionBg = 'bg-amber-500/10 border-amber-500/20';
            ActionIcon = AlertTriangle;

        // 6. Default: Hold & Watch
        } else {
            stanceAction = 'HOLD';
            stanceLabel = 'Hold & Watch';
            stanceIcon = '🟡';
            stanceBadge = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            stanceRationale = health
                ? `Business fundamentals are ${health.label.toLowerCase()} (${health.total}/${health.max}) paired with balanced news flow. Maintain current position and monitor upcoming quarterly performance.`
                : 'Balanced tailwinds and headwinds with no overriding directional catalyst. Maintain current position and watch key levels.';
        }

        const positiveParagraph = formatToParagraph(posPoints, posWhys);
        const negativeParagraph = formatToParagraph(negPoints, negWhys);

        // Build 1 single cohesive paragraph synthesizing both business health and news points
        const unifiedSummaryParts = [];
        if (health) {
            unifiedSummaryParts.push(`From a fundamental standpoint, the company exhibits ${health.label} (${health.total}/${health.max})${weakChecks.length ? `, though ${weakChecks.slice(0, 2).join(' and ')} warrant attention` : ' with clean balance sheet and profitability checks'}.`);
        }
        if (posPoints.length > 0) {
            unifiedSummaryParts.push(`Recent news catalysts include ${posPoints.slice(0, 3).map(cleanSentence).join(', ')}.`);
        }
        if (negPoints.length > 0) {
            unifiedSummaryParts.push(`Key concerns highlighted in reports involve ${negPoints.slice(0, 3).map(cleanSentence).join(', ')}.`);
        }
        if (total === 0) {
            unifiedSummaryParts.push('News coverage is currently being monitored (pending local model analysis).');
        }
        unifiedSummaryParts.push(`Overall news & business stance is ${stanceLabel}: ${stanceRationale}`);
        const singleUnifiedParagraph = unifiedSummaryParts.join(' ');

        return {
            total,
            positiveCount: positive.length,
            negativeCount: negative.length,
            mixedCount: mixed.length,
            themes,
            actionable,
            actionNeeded,
            actionColor,
            actionBg,
            ActionIcon,
            stanceAction,
            stanceLabel,
            stanceIcon,
            stanceBadge,
            stanceRationale,
            health,
            singleUnifiedParagraph,
            positiveParagraph,
            negativeParagraph,
        };
    }, [stories, financials]);

    if (!digest) return null;

    return (
        <div className={`mt-4 rounded-xl border ${digest.actionBg} p-4 space-y-3.5`}>
            {/* Header: Action Stance status + Business Health badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px]">{digest.stanceIcon}</span>
                    <span className={`text-[13px] font-black tracking-wide ${digest.actionColor}`}>
                        {digest.stanceLabel}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${digest.stanceBadge}`}>
                        {digest.stanceAction}
                    </span>
                    {digest.health && (
                        <span
                            title={digest.health.checks?.map((c) => `${c.name}: ${c.detail}`).join('\n')}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-bold border border-white/10 bg-white/5"
                            style={{ color: digest.health.color || '#34d399' }}
                        >
                            <Shield size={11} /> {digest.health.total}/{digest.health.max} {digest.health.label}
                        </span>
                    )}
                </div>
                <span className="text-[10.5px] text-gray-500 font-bold">
                    {digest.total > 0
                        ? `${digest.total} analysed ${digest.total === 1 ? 'story' : 'stories'} (${digest.positiveCount} pos, ${digest.negativeCount} neg)`
                        : 'Fundamentals active • Awaiting story analysis'}
                </span>
            </div>

            {/* 1 Single Paragraph Summary of All Points */}
            <div>
                <h4 className="text-[11px] font-black text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-indigo-400" /> Executive Summary (News &amp; Business Health)
                </h4>
                <p className="text-[12.5px] text-gray-200 leading-relaxed font-normal">
                    {digest.singleUnifiedParagraph}
                </p>
            </div>

            {/* Suggested Action Box with Health metrics */}
            <div className="border-t border-white/5 pt-2.5 bg-black/15 rounded-lg p-3 -mx-1">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <digest.ActionIcon size={14} className={digest.actionColor} />
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-200">
                            Suggested Action: <span className={digest.actionColor}>{digest.stanceLabel}</span>
                        </span>
                    </div>
                </div>
                <p className="text-[12px] text-gray-300 leading-relaxed">
                    {digest.stanceRationale}
                </p>

                {/* Fundamental Health Checks Mini-Chips */}
                {digest.health?.checks && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/5">
                        {digest.health.checks.map((c, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/5 text-gray-300 flex items-center gap-1 font-medium">
                                <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'good' ? 'bg-emerald-400' : c.status === 'caution' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                                <span className="text-gray-400">{c.name}:</span> {c.detail}
                            </span>
                        ))}
                    </div>
                )}

                {/* Key Triggers */}
                {digest.actionable.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/5">
                        <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                            Key News Triggers to Monitor:
                        </span>
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
    const [financials, setFinancials] = useState(null);
    const [busy, setBusy] = useState('');
    const [note, setNote] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 5;
    const q = `symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name || '')}`;

    // Reset pagination when symbol changes
    useEffect(() => { setPage(1); }, [symbol]);

    // Load business fundamentals & health score
    useEffect(() => {
        if (!symbol) return;
        let cancelled = false;
        fetch(`${API_URL}/api/stock-financials?symbol=${encodeURIComponent(symbol)}`)
            .then((r) => r.json())
            .then((data) => {
                if (!cancelled && data && !data.error && data.healthScore) {
                    setFinancials(data);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [symbol]);

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

    useEffect(() => {
        const onNewsUpdated = () => { load(); };
        window.addEventListener('stock-news-updated', onNewsUpdated);
        return () => window.removeEventListener('stock-news-updated', onNewsUpdated);
    }, [load]);

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
    const totalStories = stories?.length || 0;
    const totalPages = Math.max(1, Math.ceil(totalStories / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const shown = (stories || []).slice((safePage - 1) * pageSize, safePage * pageSize);

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
                        <a href={`${API_URL}/api/analyst/news/csv?symbol=${encodeURIComponent(symbol)}`} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-[11px] font-black flex items-center gap-1.5" title={`Export ${symbol} news to CSV`}>
                            <Download size={12} /> CSV
                        </a>
                    )}
                    <a href={`${API_URL}/api/analyst/news/all/csv`} download="all_stocks_news.csv" className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 text-[11px] font-black flex items-center gap-1.5" title="Export consolidated news for all portfolio stocks">
                        <Download size={12} /> Export All
                    </a>
                </div>
            </div>
            {note && <p className="text-[11.5px] text-gray-400 mt-2">{note}</p>}

            <NewsSentimentSummary stories={stories} financials={financials} />

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
            {totalStories > pageSize && (
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500 font-bold">
                        Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, totalStories)} of {totalStories} headlines
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                            <ChevronLeft size={12} /> Prev
                        </button>
                        <span className="text-[11px] text-gray-400 font-bold px-1.5">
                            Page {safePage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                            Next <ChevronRight size={12} />
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default StockNewsCard;
