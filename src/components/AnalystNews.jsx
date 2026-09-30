import React, { useCallback, useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Sparkles, RefreshCw } from 'lucide-react';

/**
 * Recent headlines for your largest holdings, read straight from the server's
 * news relay (Yahoo Finance + Google News, cached 30 minutes). "Analyse" hands
 * the same headlines to the local model on the Your prompt tab.
 */
const ago = (iso) => {
    if (!iso) return '';
    const h = (Date.now() - Date.parse(iso)) / 3600000;
    if (h < 1 / 60) return 'just now';
    if (h < 1) return `${Math.round(h * 60)}m ago`;
    if (h < 24) return `${Math.round(h)}h ago`;
    return `${Math.round(h / 24)}d ago`;
};

const AnalystNews = ({ holdings, loadNews, onAnalyse }) => {
    const [news, setNews] = useState({});
    const [usage, setUsage] = useState(null);
    const [busy, setBusy] = useState({});

    // fresh: skip both caches and ask the sources again.
    const load = useCallback(async (st, fresh = false) => {
        setBusy((b) => ({ ...b, [st.id]: true }));
        const result = await loadNews(st, { fresh });
        setNews((prev) => ({ ...prev, [st.id]: result }));
        if (result.newsApi) setUsage(result.newsApi);
        setBusy((b) => ({ ...b, [st.id]: false }));
    }, [loadNews]);

    useEffect(() => { holdings.forEach((st) => load(st)); }, [holdings, load]);

    const refreshAll = () => holdings.forEach((st) => load(st, true));
    const anyBusy = Object.values(busy).some(Boolean);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500 max-w-xl leading-relaxed">
                    Latest headlines for your ten largest holdings. Everything fetched is also stored (a year per stock), and the server collects news for all your holdings every six hours, so a question about a stock sends the model months of coverage, grouped by theme.
                    The model sees the same titles, so treat its reading of them as a starting point, not a verdict.
                </p>
                <div className="flex gap-2">
                {usage && (
                    <span
                        className={`self-center text-[11px] font-bold ${!usage.configured ? 'text-gray-500' : usage.remaining < 15 ? 'text-amber-300' : 'text-gray-400'}`}
                        title={usage.configured ? 'NewsAPI free plan: 100 requests in any 24 hours. Each stock refreshed uses one; results are cached for 30 minutes.' : 'Add NEWSAPI_KEY=… to .env.local and restart npm run server'}
                    >
                        {usage.configured
                            ? `NewsAPI ${usage.used}/${usage.limit} today${usage.nextFreeAt ? ' — limit reached' : ''}`
                            : 'NewsAPI not set up'}
                    </span>
                )}
                <button
                    type="button"
                    onClick={refreshAll}
                    disabled={anyBusy}
                    title={`Fetches all ${holdings.length} again — uses up to ${holdings.length} NewsAPI requests`}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50 text-xs font-black flex items-center gap-2"
                >
                    <RefreshCw size={13} className={anyBusy ? 'animate-spin' : ''} /> {anyBusy ? 'Refreshing…' : 'Refresh news'}
                </button>
                <button
                    type="button"
                    onClick={onAnalyse}
                    className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black flex items-center gap-2"
                >
                    <Sparkles size={13} /> Analyse this news with the model
                </button>
                </div>
            </div>
            {holdings.map((st) => {
                const n = news[st.id];
                return (
                    <section key={st.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                        <h3 className="text-[13px] font-black text-white flex items-center gap-2">
                            <Newspaper size={14} className="text-indigo-300" /> {st.name} <span className="text-[11px] text-gray-500 font-bold">{st.ticker}</span>
                            {n?.fetchedAt && (
                                <span className="ml-auto text-[10.5px] text-gray-500 font-bold">
                                    {n.archive?.count > 0 && <span title="Stories kept for this stock (up to a year, in its CSV file). Open the stock's page to read the model's key points.">{n.archive.count} stories · {n.archive.analysed || 0} analysed · since {new Date(n.archive.since).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · </span>}
                                    updated {ago(n.fetchedAt)}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => load(st, true)}
                                disabled={busy[st.id]}
                                title={`Fetch ${st.name}'s headlines again`}
                                aria-label={`Refresh ${st.name} news`}
                                className={`${n?.fetchedAt ? '' : 'ml-auto '}p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 disabled:opacity-50`}
                            >
                                <RefreshCw size={12} className={busy[st.id] ? 'animate-spin' : ''} />
                            </button>
                        </h3>
                        {!n && <p className="text-[12px] text-gray-500 mt-2">Loading…</p>}
                        {n?.error && <p className="text-[12px] text-rose-300 mt-2">{n.error}</p>}
                        {n && !n.error && n.items.length === 0 && (
                            <p className="text-[12px] text-gray-500 mt-2">No recent headlines{n.errors?.length ? ` (${n.errors.join('; ')})` : ''}.</p>
                        )}
                        {n?.items?.length > 0 && (
                            <ul className="mt-2 space-y-1.5">
                                {n.items.map((item, i) => (
                                    <li key={i} className="text-[12px] leading-snug">
                                        <a href={item.url} target="_blank" rel="noreferrer" className="text-gray-200 hover:text-indigo-200 inline-flex items-start gap-1">
                                            {item.title} <ExternalLink size={10} className="mt-1 shrink-0 text-gray-600" />
                                        </a>
                                        {item.summary && <span className="block text-[11.5px] text-gray-400 mt-0.5 leading-snug">{item.summary}</span>}
                                        <span className="flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-gray-500">
                                            {item.coverage > 1 && (
                                                <span className="px-1.5 rounded bg-indigo-500/15 text-indigo-300 font-bold" title="Outlets that reported this story — wider coverage usually means it matters more">
                                                    {item.coverage} outlets
                                                </span>
                                            )}
                                            {item.theme && item.theme !== 'other' && <span className="text-gray-400">{item.theme}</span>}
                                            {(item.links?.length > 1 ? item.links : [{ source: item.source, url: item.url }]).map((l, k) => (
                                                <a key={k} href={l.url} target="_blank" rel="noreferrer" className="hover:text-indigo-200">{l.source}</a>
                                            ))}
                                            <span>· {ago(item.published)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
        </div>
    );
};

export default AnalystNews;
