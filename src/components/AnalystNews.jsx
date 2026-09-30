import React, { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Sparkles } from 'lucide-react';

/**
 * Recent headlines for your largest holdings, read straight from the server's
 * news relay (Yahoo Finance + Google News, cached 30 minutes). "Analyse" hands
 * the same headlines to the local model on the Your prompt tab.
 */
const ago = (iso) => {
    if (!iso) return '';
    const h = (Date.now() - Date.parse(iso)) / 3600000;
    if (h < 1) return 'just now';
    if (h < 24) return `${Math.round(h)}h ago`;
    return `${Math.round(h / 24)}d ago`;
};

const AnalystNews = ({ holdings, loadNews, onAnalyse }) => {
    const [news, setNews] = useState({});

    useEffect(() => {
        let live = true;
        holdings.forEach(async (st) => {
            const result = await loadNews(st);
            if (live) setNews((prev) => ({ ...prev, [st.id]: result }));
        });
        return () => { live = false; };
    }, [holdings, loadNews]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500 max-w-xl leading-relaxed">
                    Headlines from the last 30 days for your ten largest holdings. Titles only — open a story to read it.
                    The model sees the same titles, so treat its reading of them as a starting point, not a verdict.
                </p>
                <button
                    type="button"
                    onClick={onAnalyse}
                    className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black flex items-center gap-2"
                >
                    <Sparkles size={13} /> Analyse this news with the model
                </button>
            </div>
            {holdings.map((st) => {
                const n = news[st.id];
                return (
                    <section key={st.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                        <h3 className="text-[13px] font-black text-white flex items-center gap-2">
                            <Newspaper size={14} className="text-indigo-300" /> {st.name} <span className="text-[11px] text-gray-500 font-bold">{st.ticker}</span>
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
                                        <span className="block text-[10.5px] text-gray-500">{item.source} · {ago(item.published)}</span>
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
