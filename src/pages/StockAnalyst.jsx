import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Sparkles, Bell, PieChart, Scale, Eye, Gauge, TrendingDown, Coins, Database,
    Clock, X, ChevronRight, Info, RefreshCw,
} from 'lucide-react';
import { useFinance, API_URL } from '../context/FinanceContext';
import BackButton from '../components/BackButton';
import RefreshAllPricesButton from '../components/RefreshAllPricesButton';
import AnalystBrief from '../components/AnalystBrief';
import AnalystPrompt, { readPrompts, writePrompts } from '../components/AnalystPrompt';
import AnalystCustom from '../components/AnalystCustom';
import { fundFacts, dashboardFacts } from '../utils/portfolioFacts';
import { spendingOverview } from '../utils/spendingAnalytics';
import { allCardProfiles, cardTotals } from '../utils/creditCards';
import { loanBalances } from '../utils/netWorthHistory';
import { totalReceivable } from '../utils/lents';
import AnalystResponses, { readResponses, writeResponses, MAX_RESPONSES } from '../components/AnalystResponses';
import { ownHoldings } from '../utils/holdingOwner';
import { analysePortfolio, llmFacts, symbolFor, RULES, averagingCase, holdingsNamedIn } from '../utils/stockAdvisor';

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const SEVERITY = {
    act: {
        label: 'Act on this', dot: 'bg-rose-400', text: 'text-rose-300',
        pill: 'bg-rose-500/10 border-rose-500/30 text-rose-300', edge: 'border-l-rose-400/70',
    },
    review: {
        label: 'Worth a look', dot: 'bg-amber-400', text: 'text-amber-300',
        pill: 'bg-amber-500/10 border-amber-500/30 text-amber-300', edge: 'border-l-amber-400/70',
    },
    info: {
        label: 'For information', dot: 'bg-sky-400', text: 'text-sky-300',
        pill: 'bg-sky-500/10 border-sky-500/30 text-sky-300', edge: 'border-l-sky-400/60',
    },
};

const KIND = {
    alert: { label: 'Price alert', icon: Bell },
    concentration: { label: 'Concentration', icon: PieChart },
    sector: { label: 'Sector limit', icon: PieChart },
    tax: { label: 'Tax', icon: Scale },
    watchlist: { label: 'Watchlist', icon: Eye },
    fundamentals: { label: 'Fundamentals', icon: Gauge },
    performance: { label: 'Against the index', icon: TrendingDown },
    income: { label: 'Dividends', icon: Coins },
    data: { label: 'Data gap', icon: Database },
};

const GROUPS = [
    { id: 'all', label: 'Everything', kinds: null },
    { id: 'tax', label: 'Tax', kinds: ['tax'] },
    { id: 'risk', label: 'Concentration', kinds: ['concentration', 'sector'] },
    { id: 'price', label: 'Alerts & watchlist', kinds: ['alert', 'watchlist'] },
    { id: 'business', label: 'Business & returns', kinds: ['fundamentals', 'performance', 'income'] },
    { id: 'data', label: 'Data gaps', kinds: ['data'] },
];

/* ------------------------------------------------------------------ *
 * Inputs the analysis needs from the network
 * ------------------------------------------------------------------ */

/**
 * Fundamentals fetched this session, kept across visits to the page. The
 * server caches them for twelve hours as well, so this only saves the round
 * trip; an ETF or REIT with no scorecard is remembered as null and not asked
 * again until the next session.
 */
const fundamentalsCache = new Map();
const cachedFundamentals = (symbols) => Object.fromEntries(
    symbols.filter((s) => fundamentalsCache.get(s)).map((s) => [s, fundamentalsCache.get(s)]),
);

const useFundamentals = (symbols) => {
    const key = symbols.join(',');
    const [data, setData] = useState(() => cachedFundamentals(symbols));
    const [pending, setPending] = useState(() => symbols.filter((s) => !fundamentalsCache.has(s)).length);

    useEffect(() => {
        let live = true;
        const queue = symbols.filter((s) => !fundamentalsCache.has(s));
        setData(cachedFundamentals(symbols));
        setPending(queue.length);
        // Three at a time: the server fans each one out to Yahoo, and a burst of
        // forty parallel requests is how the local server was once taken down.
        const worker = async () => {
            while (live && queue.length > 0) {
                const symbol = queue.shift();
                try {
                    const r = await fetch(`${API_URL}/api/stock-financials?symbol=${encodeURIComponent(symbol)}`);
                    const json = await r.json();
                    fundamentalsCache.set(symbol, json?.signal ? json : null);
                } catch {
                    // Unreachable rather than empty: left uncached, so the next
                    // visit tries again.
                }
                if (!live) return;
                setPending((n) => Math.max(0, n - 1));
                setData(cachedFundamentals(symbols));
            }
        };
        Promise.all([worker(), worker(), worker()]);
        return () => { live = false; };
        // `key` stands for `symbols`, whose identity changes every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return { data, pending, total: symbols.length };
};

/**
 * Ten years of Nifty 50 closes: long enough to cover every purchase in the
 * database, where five years already leaves the 2021 buys unmatched.
 */
const indexCache = { closes: null };
const useIndexHistory = () => {
    const [state, setState] = useState(() => (indexCache.closes
        ? { closes: indexCache.closes, status: 'ok' }
        : { closes: null, status: 'loading' }));

    useEffect(() => {
        if (indexCache.closes) return undefined;
        let live = true;
        fetch(`${API_URL}/api/history?symbol=%5ENSEI&range=10y`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((d) => {
                indexCache.closes = d.closes || {};
                if (live) setState({ closes: indexCache.closes, status: 'ok' });
            })
            .catch((err) => { if (live) setState({ closes: null, status: err.message }); });
        return () => { live = false; };
    }, []);

    return state;
};

/* ------------------------------------------------------------------ *
 * Dismissals — a per-browser convenience, not a record
 * ------------------------------------------------------------------ */

/**
 * Hidden for thirty days, then back if it still applies. Kept in localStorage,
 * not db.json: "I have seen this" is not a financial record and has no business
 * passing through the write guard and the SQLite mirror.
 */
const DISMISS_KEY = 'kubera.analyst.dismissed';
const DISMISS_DAYS = 30;

const readDismissed = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
        const now = Date.now();
        return Object.fromEntries(Object.entries(stored).filter(([, until]) => new Date(until).getTime() > now));
    } catch {
        return {};
    }
};

const writeDismissed = (map) => {
    try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
    } catch {
        // Private window or blocked storage: dismissals last until the page closes.
    }
};

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

const domId = (id) => `finding-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;

/** Where a finding's details live elsewhere in the app. */
const linkFor = (f, marketId) => {
    if (f.holdingId !== undefined && marketId) return { to: `/savings/stock-market/${marketId}/stock/${f.holdingId}`, label: 'Open holding' };
    if (f.watchlistId !== undefined) return { to: '/investments/watchlist', label: 'Open watchlist' };
    if (f.kind === 'tax' || f.id === 'data:unmatched-sales') return { to: '/investments/capital-gains', label: 'Capital Gains' };
    if (f.id === 'data:watchlist-no-price') return { to: '/investments/watchlist', label: 'Open watchlist' };
    if (marketId) return { to: `/savings/stock-market/${marketId}`, label: 'Stock account' };
    return null;
};

const FindingCard = ({ finding: f, marketId, dismissed, highlighted, onDismiss, onRestore }) => {
    const sev = SEVERITY[f.severity];
    const kind = KIND[f.kind] || KIND.data;
    const Icon = kind.icon;
    const link = linkFor(f, marketId);
    return (
        <article
            id={domId(f.id)}
            className={`rounded-2xl border border-white/[0.07] border-l-4 ${sev.edge} bg-white/[0.025] p-5 transition-shadow ${highlighted ? 'ring-2 ring-indigo-400/60' : ''} ${dismissed ? 'opacity-50' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-gray-400"><Icon size={12} /> {kind.label}</span>
                    <span className={`px-2 py-0.5 rounded-md border ${sev.pill}`}>{sev.label}</span>
                </div>
                {dismissed ? (
                    <button type="button" onClick={() => onRestore(f.id)} className="text-[11px] font-bold text-gray-400 hover:text-white">Restore</button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onDismiss(f.id)}
                        title={`Hide for ${DISMISS_DAYS} days`}
                        className="p-1 -m-1 rounded-md text-gray-600 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            <h3 className="text-[15px] font-black text-white mt-3 leading-snug">{f.title}</h3>
            {f.detail && <p className="text-[12.5px] text-gray-400 mt-1.5 leading-relaxed">{f.detail}</p>}

            {f.action && (
                <div className="mt-3 rounded-xl bg-black/25 border border-white/[0.05] p-3">
                    <p className={`text-[9px] font-black uppercase tracking-wider ${sev.text}`}>Suggested</p>
                    <p className="text-[12.5px] text-gray-200 mt-1 leading-relaxed">{f.action}</p>
                </div>
            )}

            {f.evidence?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {f.evidence.map((e) => (
                        <div key={e.label} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{e.label}</p>
                            <p className="text-[12px] font-bold text-white tabular-nums mt-0.5">{e.value}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-gray-600">Rule: {f.rule}</p>
                {link && (
                    <Link to={link.to} className="text-[11px] font-bold text-gray-300 hover:text-white flex items-center gap-0.5">
                        {link.label} <ChevronRight size={13} />
                    </Link>
                )}
            </div>
        </article>
    );
};

const Stat = ({ label, value, note, tone = 'text-white', dot }) => (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
            {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
            {label}
        </p>
        <p className={`text-2xl font-black mt-2 tabular-nums ${tone}`}>{value}</p>
        {note && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{note}</p>}
    </div>
);

const ageText = (hours) => {
    if (hours === null || hours === undefined) return 'of unknown age';
    if (hours < 1) return 'under an hour old';
    if (hours < 48) return `${Math.round(hours)} hours old`;
    return `${Math.round(hours / 24)} days old`;
};

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

/**
 * What the analyst makes of the stock portfolio.
 *
 * Everything shown is computed by utils/stockAdvisor.js from the holdings, the
 * Capital Gains ledger, the sector limits, alerts and watchlist you set, and
 * the fundamentals and index history the server fetches. The optional local
 * model on the right only rewords and orders it. Nothing on this page writes.
 */
const StockAnalyst = () => {
    const {
        savings, watchlist, isLoading, calculateItemCurrentValue, calculateItemInvestedValue,
        metals, assets, loans, creditCards, expenses, categoryKinds, lents, taxes,
    } = useFinance();
    const [group, setGroup] = useState('all');
    const [dismissed, setDismissed] = useState(readDismissed);
    const [showDismissed, setShowDismissed] = useState(false);
    const [highlighted, setHighlighted] = useState(null);
    const [view, setView] = useState('findings');
    const [responses, setResponses] = useState(readResponses);
    const [prompts, setPrompts] = useState(readPrompts);
    const changePrompts = (next) => { setPrompts(next); writePrompts(next); };

    const recordResponse = useCallback((entry) => setResponses((prev) => {
        const next = [{ id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), ...entry }, ...prev]
            .slice(0, MAX_RESPONSES);
        writeResponses(next);
        return next;
    }), []);
    const clearResponses = () => { writeResponses([]); setResponses([]); };
    // The logged prompt, word for word, to whatever model is loaded now.
    const resendResponse = async (entry) => {
        const keep = { kind: entry.kind, question: entry.question, withDashboard: entry.withDashboard, findingsSent: entry.findingsSent, prompt: entry.prompt };
        try {
            let r;
            try {
                r = await fetch(`${API_URL}/api/analyst/llm/resend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: entry.kind, messages: entry.prompt }),
                });
            } catch {
                throw new Error(`Could not reach the API server at ${API_URL}. Check that npm run server is running.`);
            }
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw Object.assign(new Error(r.status === 404 ? 'Restart npm run server to use Resend.' : body.error || `HTTP ${r.status}`), { raw: body.raw });
            recordResponse({ ...keep, ok: true, ...body });
        } catch (err) {
            recordResponse({ ...keep, ok: false, resent: true, error: err.message, raw: err.raw });
        }
    };
    const deleteResponse = (id) => setResponses((prev) => {
        const next = prev.filter((r) => r.id !== id);
        writeResponses(next);
        return next;
    });

    const market = useMemo(
        () => (savings || []).find((s) => s.type === 'stock_market' && !s.isArchived),
        [savings],
    );
    // Yours only: family and paper holdings are tracked, not your portfolio.
    // Archived ones stay in, because their sales are this year's tax.
    const stocks = useMemo(() => ownHoldings(market?.stocks), [market]);

    const symbols = useMemo(() => [...new Set([
        ...stocks.filter((s) => !s.isArchived && Number(s.shares) > 0 && Number(s.currentPrice) > 0).map(symbolFor),
        ...(watchlist || []).filter((w) => ['ready', 'interested'].includes(String(w?.priority || '').toLowerCase())).map(symbolFor),
    ].filter(Boolean))].sort(), [stocks, watchlist]);

    const fundamentals = useFundamentals(symbols);
    const index = useIndexHistory();

    const analysis = useMemo(() => analysePortfolio({
        stocks,
        watchlist: watchlist || [],
        sectorLimits: market?.sectorLimits || {},
        fundamentals: fundamentals.data,
        indexCloses: index.closes,
        pricesUpdatedAt: market?.pricesUpdatedAt || null,
        asOf: new Date(),
    }), [stocks, watchlist, market, fundamentals.data, index.closes]);

    const visible = useMemo(() => analysis.findings.filter((f) => !dismissed[f.id]), [analysis, dismissed]);
    const hidden = analysis.findings.length - visible.length;
    const counts = useMemo(() => {
        const c = { act: 0, review: 0, info: 0 };
        visible.forEach((f) => { c[f.severity] += 1; });
        return c;
    }, [visible]);

    const shown = useMemo(() => {
        const kinds = GROUPS.find((g) => g.id === group)?.kinds;
        const pool = showDismissed ? analysis.findings : visible;
        return kinds ? pool.filter((f) => kinds.includes(f.kind)) : pool;
    }, [analysis, visible, group, showDismissed]);

    const facts = useMemo(() => llmFacts({ ...analysis, findings: visible }, { stocks }), [analysis, visible, stocks]);

    // Your own prompt gets every holding, the mutual funds, and — only if you
    // switch it on — the rest of the dashboard.
    const customFacts = useMemo(() => {
        const funds = fundFacts(ownHoldings((savings || []).filter((s) => s.type === 'mutual_fund')), {
            valueOf: calculateItemCurrentValue, investedOf: calculateItemInvestedValue, stockValue: analysis.snapshot.value,
        });
        return { ...llmFacts({ ...analysis, findings: visible }, { stocks, maxHoldings: 60 }), funds: funds.lines, fundsSummary: funds.summary };
    }, [analysis, visible, stocks, savings, calculateItemCurrentValue, calculateItemInvestedValue]);

    const dashboard = useMemo(() => {
        const isMarket = (s) => market && s.id === market.id;
        let cards = null;
        try { cards = cardTotals(allCardProfiles(creditCards || [], expenses || {})); } catch { /* left out */ }
        return dashboardFacts({
            savings: ownHoldings(savings),
            // The stock line uses the analyst's own figures, which leave out family and paper holdings.
            valueOf: (s) => (isMarket(s) ? analysis.snapshot.value : calculateItemCurrentValue(s)),
            investedOf: (s) => (isMarket(s) ? analysis.snapshot.invested : calculateItemInvestedValue(s)),
            metalsValue: [...(metals?.gold || []), ...(metals?.silver || [])].reduce((t, m) => t + (Number(m.currentValue) || 0), 0),
            assetsValue: (assets || []).reduce((t, c) => t + (c.items || []).reduce((u, i) => u + (Number(i.currentValue) || 0), 0), 0),
            loans: loans || [],
            loanOutstanding: (l) => Object.values(loanBalances(l)).pop() || 0,
            cards,
            spending: spendingOverview(expenses || {}, categoryKinds || {}),
            receivable: totalReceivable(lents || []),
            taxes: taxes || [],
        });
    }, [savings, market, analysis, metals, assets, loans, creditCards, expenses, categoryKinds, lents, taxes, calculateItemCurrentValue, calculateItemInvestedValue]);

    // A question naming a holding gets its averaging figures worked out here.
    const focusFor = useCallback((question) => holdingsNamedIn(question, stocks)
        .flatMap((st) => averagingCase(st, { portfolioValue: analysis.snapshot.value, fundamentals: fundamentals.data, asOf: analysis.asOf }) || []),
    [stocks, analysis, fundamentals.data]);

    const titles = useMemo(() => Object.fromEntries(analysis.findings.map((f) => [f.id, f.title])), [analysis]);

    const dismiss = (id) => setDismissed((prev) => {
        const next = { ...prev, [id]: new Date(Date.now() + DISMISS_DAYS * 86400000).toISOString() };
        writeDismissed(next);
        return next;
    });
    const restore = (id) => setDismissed((prev) => {
        const next = { ...prev };
        delete next[id];
        writeDismissed(next);
        return next;
    });

    const showFinding = useCallback((id) => {
        setView('findings');
        setGroup('all');
        setHighlighted(id);
        requestAnimationFrame(() => {
            document.getElementById(domId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        setTimeout(() => setHighlighted((h) => (h === id ? null : h)), 2500);
    }, []);

    const s = analysis.snapshot;

    if (isLoading) {
        return (
            <div className="p-8 max-w-[1400px] mx-auto text-gray-500 text-sm flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> Loading your holdings…
            </div>
        );
    }

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <BackButton label="Back to Investments" to="/investments" />

            <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <Sparkles size={22} className="text-amber-400" />
                        <h1 className="text-3xl font-black text-white tracking-tight">Stock Analyst</h1>
                    </div>
                    <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                        Reads your holdings, tax lots, sector limits, alerts and watchlist, and says what is
                        worth doing — each suggestion with the figures behind it and the rule that raised it.
                        It predicts no prices, and it trades and saves nothing.
                    </p>
                </div>
                <RefreshAllPricesButton />
            </div>

            {s.heldCount === 0 ? (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-10 text-center">
                    <Info size={32} className="mx-auto text-gray-600" />
                    <p className="text-white font-bold mt-3">No stock holdings to analyse yet</p>
                    <p className="text-[12px] text-gray-500 mt-1">Add holdings to your stock account and the analyst will read them here.</p>
                </div>
            ) : (
                <>
                    {s.pricesStale && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-4 mb-6 flex items-start gap-3">
                            <Clock size={16} className="text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-[12.5px] text-amber-100/90 leading-relaxed">
                                Prices are {ageText(s.pricesAgeHours)}. Every weight, trim and tax figure below is
                                worked out from them, so refresh before acting on any of it.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <Stat label={SEVERITY.act.label} dot={SEVERITY.act.dot} value={counts.act} tone={SEVERITY.act.text} note="Your own rules crossed, or a deadline close" />
                        <Stat label={SEVERITY.review.label} dot={SEVERITY.review.dot} value={counts.review} tone={SEVERITY.review.text} note="Worth deciding on this month" />
                        <Stat label={SEVERITY.info.label} dot={SEVERITY.info.dot} value={counts.info} tone={SEVERITY.info.text} note="Context, no action needed" />
                        <Stat
                            label={`Tax this year (${s.fy})`}
                            value={inr(s.estimatedTax)}
                            note={`Exemption used ${inr(s.exemptionUsed)} of ${inr(s.exemption)} · ${s.daysToFyEnd} days to 31 March`}
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
                        <div className="min-w-0">
                            <div role="tablist" className="flex items-center gap-6 border-b border-white/[0.07] mb-5">
                                {[
                                    { id: 'findings', label: 'Findings', count: visible.length },
                                    { id: 'responses', label: 'AI responses', count: responses.length },
                                    { id: 'custom', label: 'Your prompt', count: '' },
                                    { id: 'prompt', label: 'Prompt', count: prompts.brief || prompts.ask ? 'edited' : '' },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={view === t.id}
                                        onClick={() => setView(t.id)}
                                        className={`-mb-px pb-2.5 text-[13px] font-black border-b-2 transition-colors ${view === t.id ? 'text-white border-orange-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                                    >
                                        {t.label} <span className="text-gray-500 font-bold ml-0.5">{t.count}</span>
                                    </button>
                                ))}
                            </div>

                            {view === 'custom' ? (
                                <AnalystCustom facts={customFacts} dashboard={dashboard} onResponse={recordResponse} focusFor={focusFor} />
                            ) : view === 'prompt' ? (
                                <AnalystPrompt facts={facts} prompts={prompts} onChange={changePrompts} />
                            ) : view === 'responses' ? (
                                <AnalystResponses
                                    responses={responses}
                                    titles={titles}
                                    onShowFinding={showFinding}
                                    onClear={clearResponses}
                                    onDelete={deleteResponse}
                                    onResend={resendResponse}
                                />
                            ) : (<>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                {GROUPS.map((g) => {
                                    const n = g.kinds ? visible.filter((f) => g.kinds.includes(f.kind)).length : visible.length;
                                    if (g.kinds && n === 0) return null;
                                    const active = group === g.id;
                                    return (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => setGroup(g.id)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${active ? 'bg-white/10 border-white/20 text-white' : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:text-white'}`}
                                        >
                                            {g.label} <span className="text-gray-500 ml-0.5">{n}</span>
                                        </button>
                                    );
                                })}
                                {hidden > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDismissed((v) => !v)}
                                        className="ml-auto text-[11px] font-bold text-gray-500 hover:text-white"
                                    >
                                        {showDismissed ? 'Hide dismissed' : `Show ${hidden} dismissed`}
                                    </button>
                                )}
                            </div>

                            {(fundamentals.pending > 0 || index.status === 'loading') && (
                                <p className="text-[11px] text-gray-500 mb-3 flex items-center gap-2">
                                    <RefreshCw size={11} className="animate-spin" />
                                    {fundamentals.pending > 0 && `Checking fundamentals — ${fundamentals.total - fundamentals.pending} of ${fundamentals.total}. `}
                                    {index.status === 'loading' && 'Loading index history. '}
                                    Findings that need them appear as they arrive.
                                </p>
                            )}
                            {index.status !== 'loading' && index.status !== 'ok' && (
                                <p className="text-[11px] text-amber-300/80 mb-3">
                                    Nifty history could not be loaded ({index.status}), so holdings are not compared with the index.
                                </p>
                            )}

                            {shown.length === 0 ? (
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-8 text-center">
                                    <p className="text-emerald-300 font-bold">Nothing here needs attention.</p>
                                    <p className="text-[12px] text-gray-500 mt-1">No rule of yours is crossed and no tax deadline is close.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {shown.map((f) => (
                                        <FindingCard
                                            key={f.id}
                                            finding={f}
                                            marketId={market?.id}
                                            dismissed={!!dismissed[f.id]}
                                            highlighted={highlighted === f.id}
                                            onDismiss={dismiss}
                                            onRestore={restore}
                                        />
                                    ))}
                                </div>
                            )}
                            </>)}
                        </div>

                        <aside className="space-y-4 xl:sticky xl:top-20">
                            <AnalystBrief facts={facts} titles={titles} onShowFinding={showFinding} onResponse={recordResponse} prompts={prompts} focusFor={focusFor} />

                            <details className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 group">
                                <summary className="text-[12px] font-black text-white cursor-pointer list-none flex items-center justify-between">
                                    How the analyst decides
                                    <ChevronRight size={14} className="text-gray-500 transition-transform group-open:rotate-90" />
                                </summary>
                                <ul className="mt-3 space-y-2 text-[11.5px] text-gray-400 leading-relaxed list-disc pl-4">
                                    <li><span className="text-gray-200">Your rules first.</span> Sector limits, price alerts and watchlist priority are yours; crossing one is the strongest signal here.</li>
                                    <li><span className="text-gray-200">One outside line.</span> SEBI caps a diversified fund at {RULES.maxPositionPct}% in one company, so a holding above that is worth a look, and above {RULES.urgentPositionPct}% is urgent.</li>
                                    <li><span className="text-gray-200">Tax from the ledger.</span> Every suggested sale runs through the Capital Gains ledger — first in, first out, with set-off, carried losses and the {inr(s.exemption)} exemption. Sell-and-rebuy charges are taken as {RULES.roundTripCostPct}% of the amount sold.</li>
                                    <li><span className="text-gray-200">Fundamentals</span> are the app’s five-point scorecard; <span className="text-gray-200">the index</span> is the Nifty 50 on your own cash flows.</li>
                                    <li>Holdings of family members and paper certificates are left out, as on every portfolio page.</li>
                                </ul>
                                <p className="text-[10.5px] text-gray-600 mt-3 leading-relaxed">
                                    Not investment advice: a reading of your own records. Tax figures are estimates before surcharge and cess.
                                </p>
                            </details>
                        </aside>
                    </div>
                </>
            )}
        </div>
    );
};

export default StockAnalyst;
