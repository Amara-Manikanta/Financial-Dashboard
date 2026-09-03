import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, Edit2, Trash2, Eye, Bell, Info } from 'lucide-react';
import BackButton from '../components/BackButton';
import WatchlistItemModal from '../components/WatchlistItemModal';
import RefreshAllPricesButton from '../components/RefreshAllPricesButton';
import { readQuote, triggeredAlerts, atRangeEdges, NEAR_EDGE_PCT } from '../utils/priceRange';
import { normaliseSector, sectorMeta } from '../utils/sectors';
import {
    RISK_LEVELS, RISK_META, riskOf, riskCounts,
    PRIORITY_LEVELS, PRIORITY_META, priorityOf, priorityCounts, byPriority,
} from '../utils/watchlistRisk';
import { MARKET_CAPS, capMeta, resolveMarketCap } from '../utils/nifty50Data';

const card = {
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '1.25rem',
    padding: '1.5rem',
};

const label = {
    fontSize: '10px', fontWeight: 900, color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
};

const th = (align = 'left') => ({
    padding: '0.75rem 1rem', textAlign: align, fontSize: '9px', fontWeight: 900,
    color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em',
});

const td = (align = 'left', color = '#e4e4e7') => ({
    padding: '0.8rem 1rem', textAlign: align, fontSize: '0.8rem', color,
});

/**
 * Companies being considered rather than owned.
 *
 * Everything here is descriptive. A price near its 52-week low is reported as
 * exactly that — a position in a range — and the only thresholds that raise
 * anything are ones entered by hand. Nothing on this page decides what is worth
 * buying, because a tracker cannot know that and pretending otherwise would
 * make its silence look like approval.
 */
const Watchlist = () => {
    const { watchlist, addItem, updateItem, deleteItem, formatCurrency } = useFinance();

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [sectorFilter, setSectorFilter] = useState('All');
    const [riskFilter, setRiskFilter] = useState('All');
    const [capFilter, setCapFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [sortBy, setSortBy] = useState('range');

    const allRows = useMemo(() => (watchlist || []).map((w) => ({
        ...w,
        q: readQuote(w),
        fired: triggeredAlerts(w),
        // Normalised so "Financial Services" and "Financials" cannot appear as
        // two tabs for one exposure — the same collision that split the sector
        // breakdown on the holdings page.
        sectorKey: normaliseSector(w.sector),
        riskKey: riskOf(w),
        // Same resolver the holdings page uses: an explicit marketCap wins,
        // otherwise it is looked up from the benchmark lists by name.
        capKey: resolveMarketCap(w),
        priorityKey: priorityOf(w),
    })), [watchlist]);

    const sorted = useMemo(() => {
        const byRange = (a, b) => {
            const ar = a.q.rangePct, br = b.q.rangePct;
            if (ar === null && br === null) return 0;
            if (ar === null) return 1;
            if (br === null) return -1;
            return ar - br;
        };
        const copy = [...allRows];
        // Priority first, then position in range as the tie-break — within one
        // priority band the interesting name is the one nearest its low.
        if (sortBy === 'priority') return copy.sort((a, b) => byPriority(a, b) || byRange(a, b));
        if (sortBy === 'name') return copy.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        return copy.sort(byRange);
    }, [allRows, sortBy]);

    /** Tabs are built from what is actually on the list, not the full sector table. */
    const sectorTabs = useMemo(() => {
        const counts = {};
        allRows.forEach((r) => { counts[r.sectorKey] = (counts[r.sectorKey] || 0) + 1; });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count, ...sectorMeta(name) }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [allRows]);

    const risks = useMemo(() => riskCounts(allRows), [allRows]);

    const capTabs = useMemo(() => {
        const counts = {};
        allRows.forEach((r) => { counts[r.capKey] = (counts[r.capKey] || 0) + 1; });
        return [...MARKET_CAPS, 'Unclassified']
            .filter((c) => counts[c])
            .map((name) => ({ name, count: counts[name], ...capMeta(name) }));
    }, [allRows]);

    const priorities = useMemo(() => priorityCounts(allRows), [allRows]);

    const rows = useMemo(() => sorted.filter((r) => {
        if (sectorFilter !== 'All' && r.sectorKey !== sectorFilter) return false;
        if (riskFilter !== 'All' && r.riskKey !== riskFilter) return false;
        if (capFilter !== 'All' && r.capKey !== capFilter) return false;
        if (priorityFilter !== 'All' && r.priorityKey !== priorityFilter) return false;
        return true;
    }), [sorted, sectorFilter, riskFilter, capFilter, priorityFilter]);

    const edges = useMemo(() => atRangeEdges(watchlist), [watchlist]);
    const firedCount = allRows.reduce((n, r) => n + r.fired.length, 0);
    const filtered = sectorFilter !== 'All' || riskFilter !== 'All' || capFilter !== 'All' || priorityFilter !== 'All';
    const clearAll = () => {
        setSectorFilter('All'); setRiskFilter('All'); setCapFilter('All'); setPriorityFilter('All');
    };

    const save = async (item) => {
        if (editing) await updateItem('watchlist', item);
        else await addItem('watchlist', item);
        setIsOpen(false);
        setEditing(null);
    };

    const remove = async (id) => {
        if (window.confirm('Remove from watchlist?')) await deleteItem('watchlist', id);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <BackButton label="Back to Investments" />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                        Watchlist
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '66ch', lineHeight: 1.6 }}>
                        Companies you are following but do not own. Prices and 52-week ranges come
                        from the same refresh as your holdings; the alert levels and risk ratings are yours.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <RefreshAllPricesButton />
                    <button onClick={() => { setEditing(null); setIsOpen(true); }}
                        style={{
                            padding: '0.625rem 1.25rem', borderRadius: '0.875rem', backgroundColor: '#6366f1',
                            color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                        }}>
                        <Plus size={16} /> Add to Watchlist
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={card}>
                    <p style={label}>Watching</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>{rows.length}</p>
                </div>
                <div style={{ ...card, ...(edges.nearLow.length ? { border: '1px solid rgba(96,165,250,0.25)', backgroundColor: 'rgba(96,165,250,0.05)' } : {}) }}>
                    <p style={{ ...label, ...(edges.nearLow.length ? { color: '#60a5fa' } : {}) }}>In the lower {NEAR_EDGE_PCT}% of range</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: edges.nearLow.length ? '#60a5fa' : 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {edges.nearLow.length}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>a position, not a signal</p>
                </div>
                <div style={{ ...card, ...(firedCount ? { border: '1px solid rgba(192,132,252,0.25)', backgroundColor: 'rgba(192,132,252,0.05)' } : {}) }}>
                    <p style={{ ...label, ...(firedCount ? { color: '#c084fc' } : {}) }}>Your alerts triggered</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: firedCount ? '#c084fc' : 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {firedCount}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>levels you set yourself</p>
                </div>
            </div>

            {/* Risk tabs. Unrated is a tab of its own rather than folded into
                "low", so a list that has never been rated cannot read as safe. */}
            {allRows.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <p style={{ ...label, marginBottom: '0.6rem' }}>Risk, as you rated it</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setRiskFilter('All')}
                            style={{
                                padding: '0.45rem 0.9rem', borderRadius: '0.7rem', fontSize: '11px', fontWeight: 800,
                                cursor: 'pointer',
                                backgroundColor: riskFilter === 'All' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${riskFilter === 'All' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                color: riskFilter === 'All' ? 'white' : '#71717a',
                            }}
                        >
                            All {allRows.length}
                        </button>
                        {[...RISK_LEVELS].reverse().concat('unrated').map((level) => {
                            const meta = RISK_META[level];
                            const count = risks[level];
                            const active = riskFilter === level;
                            return (
                                <button
                                    key={level}
                                    onClick={() => setRiskFilter(active ? 'All' : level)}
                                    disabled={count === 0}
                                    title={meta.blurb}
                                    style={{
                                        padding: '0.45rem 0.9rem', borderRadius: '0.7rem', fontSize: '11px', fontWeight: 800,
                                        cursor: count === 0 ? 'default' : 'pointer',
                                        opacity: count === 0 ? 0.35 : 1,
                                        backgroundColor: active ? meta.bg : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${active ? meta.border : 'rgba(255,255,255,0.06)'}`,
                                        color: active ? meta.color : '#71717a',
                                    }}
                                >
                                    {meta.label} {count}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Market cap tabs. */}
            {capTabs.length > 1 && (
                <div style={{ marginBottom: '1rem' }}>
                    <p style={{ ...label, marginBottom: '0.6rem' }}>Market cap</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setCapFilter('All')}
                            style={{
                                padding: '0.45rem 0.9rem', borderRadius: '0.7rem', fontSize: '11px', fontWeight: 800,
                                cursor: 'pointer',
                                backgroundColor: capFilter === 'All' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${capFilter === 'All' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                color: capFilter === 'All' ? 'white' : '#71717a',
                            }}
                        >
                            All caps {allRows.length}
                        </button>
                        {capTabs.map((c) => {
                            const active = capFilter === c.name;
                            return (
                                <button
                                    key={c.name}
                                    onClick={() => setCapFilter(active ? 'All' : c.name)}
                                    style={{
                                        padding: '0.45rem 0.9rem', borderRadius: '0.7rem', fontSize: '11px', fontWeight: 800,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        backgroundColor: active ? c.bg : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${active ? c.border : 'rgba(255,255,255,0.06)'}`,
                                        color: active ? c.color : '#71717a',
                                    }}
                                >
                                    <span>{c.icon}</span> {c.name} {c.count}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sector tabs, drawn with the same icons and colours as the holdings
                page so one company reads the same in both places. */}
            {sectorTabs.length > 1 && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ ...label, marginBottom: '0.6rem' }}>Sector</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setSectorFilter('All')}
                            style={{
                                padding: '0.45rem 0.9rem', borderRadius: '0.7rem', fontSize: '11px', fontWeight: 800,
                                cursor: 'pointer',
                                backgroundColor: sectorFilter === 'All' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${sectorFilter === 'All' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                color: sectorFilter === 'All' ? 'white' : '#71717a',
                            }}
                        >
                            All sectors {allRows.length}
                        </button>
                        {sectorTabs.map((s) => {
                            const active = sectorFilter === s.name;
                            return (
                                <button
                                    key={s.name}
                                    onClick={() => setSectorFilter(active ? 'All' : s.name)}
                                    style={{
                                        padding: '0.45rem 0.9rem', borderRadius: '0.7rem', fontSize: '11px', fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        backgroundColor: active ? `${s.color}22` : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${active ? s.color : 'rgba(255,255,255,0.06)'}`,
                                        color: active ? s.color : '#71717a',
                                        boxShadow: active ? `0 0 16px ${s.color}22` : 'none',
                                    }}
                                >
                                    <span>{s.icon}</span> {s.name} {s.count}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {filtered && (
                <p style={{ fontSize: '0.72rem', color: '#71717a', margin: '0 0 0.85rem' }}>
                    Showing {rows.length} of {allRows.length}
                    {sectorFilter !== 'All' && ` · ${sectorFilter}`}
                    {capFilter !== 'All' && ` · ${capFilter}`}
                    {riskFilter !== 'All' && ` · ${RISK_META[riskFilter].label} risk`}
                    <button
                        onClick={clearAll}
                        style={{ marginLeft: '0.6rem', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: 0 }}
                    >
                        clear
                    </button>
                </p>
            )}

            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1380px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={th()}>Company</th>
                                <th style={th()}>Sector</th>
                                <th style={th('center')}>Cap</th>
                                <th style={th('center')}>Risk</th>
                                <th style={th('right')}>Price</th>
                                <th style={th('right')}>Day</th>
                                <th style={th()}>52-week position</th>
                                <th style={th('right')}>52W low</th>
                                <th style={th('right')}>52W high</th>
                                <th style={th()}>Your alerts</th>
                                <th style={th('center')}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((w) => (
                                <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ ...td(), fontWeight: 700 }}>
                                        {w.name}
                                        {w.ticker && <span style={{ color: '#71717a', marginLeft: '0.45rem', fontSize: '0.7rem' }}>{w.ticker}</span>}
                                        {w.notes && <div style={{ fontSize: '0.68rem', color: '#71717a', marginTop: '2px' }}>{w.notes}</div>}
                                    </td>
                                    <td style={td()}>
                                        {(() => {
                                            const m = sectorMeta(w.sectorKey);
                                            return (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                                    padding: '0.2rem 0.5rem', borderRadius: '0.4rem',
                                                    backgroundColor: `${m.color}18`, border: `1px solid ${m.color}33`,
                                                    color: m.color, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
                                                }}>
                                                    <span>{m.icon}</span> {w.sectorKey}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td style={td('center')}>
                                        {(() => {
                                            const m = capMeta(w.capKey);
                                            return (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                    padding: '0.2rem 0.5rem', borderRadius: '0.4rem',
                                                    backgroundColor: m.bg, border: `1px solid ${m.border}`,
                                                    color: m.color, fontSize: '0.65rem', fontWeight: 800, whiteSpace: 'nowrap',
                                                }}>
                                                    <span>{m.icon}</span> {w.capKey.replace(' Cap', '')}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td style={td('center')}>
                                        {(() => {
                                            const m = RISK_META[w.riskKey];
                                            return (
                                                <span style={{
                                                    padding: '0.2rem 0.55rem', borderRadius: '0.4rem',
                                                    backgroundColor: m.bg, border: `1px solid ${m.border}`,
                                                    color: m.color, fontSize: '0.65rem', fontWeight: 900,
                                                    textTransform: 'uppercase', letterSpacing: '0.04em',
                                                }}>
                                                    {m.label}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td style={{ ...td('right'), fontFamily: 'monospace', fontWeight: 700 }}>
                                        {w.q.price ? formatCurrency(w.q.price) : <span style={{ color: '#fbbf24' }}>—</span>}
                                    </td>
                                    <td style={{ ...td('right', w.q.dayChangePct >= 0 ? '#34d399' : '#f87171'), fontFamily: 'monospace', fontSize: '0.74rem' }}>
                                        {w.q.dayChangePct === null ? '—' : `${w.q.dayChangePct >= 0 ? '+' : ''}${w.q.dayChangePct.toFixed(2)}%`}
                                    </td>
                                    <td style={td()}>
                                        {w.q.hasRange ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '160px' }}>
                                                <div style={{ position: 'relative', flex: 1, height: '5px', borderRadius: '3px', background: 'linear-gradient(90deg, rgba(96,165,250,0.35), rgba(255,255,255,0.08), rgba(251,191,36,0.35))' }}>
                                                    <div style={{
                                                        position: 'absolute', top: '-3px',
                                                        left: `calc(${Math.min(100, Math.max(0, w.q.rangePct))}% - 5px)`,
                                                        width: '10px', height: '11px', borderRadius: '3px',
                                                        backgroundColor: w.q.nearLow ? '#60a5fa' : w.q.nearHigh ? '#fbbf24' : '#e4e4e7',
                                                        border: '2px solid #18181b',
                                                    }} />
                                                </div>
                                                <span style={{
                                                    fontFamily: 'monospace', fontSize: '0.7rem', minWidth: '34px', textAlign: 'right',
                                                    color: w.q.nearLow ? '#60a5fa' : w.q.nearHigh ? '#fbbf24' : '#71717a',
                                                }}>
                                                    {w.q.rangePct.toFixed(0)}%
                                                </span>
                                            </div>
                                        ) : <span style={{ color: '#52525b', fontSize: '0.72rem' }}>no range yet</span>}
                                    </td>
                                    <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace', fontSize: '0.74rem' }}>{w.q.low ? formatCurrency(w.q.low) : '—'}</td>
                                    <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace', fontSize: '0.74rem' }}>{w.q.high ? formatCurrency(w.q.high) : '—'}</td>
                                    <td style={td()}>
                                        {(w.alerts || []).length === 0 ? (
                                            <span style={{ color: '#52525b', fontSize: '0.72rem' }}>none set</span>
                                        ) : (
                                            (w.alerts || []).map((a) => {
                                                const hit = w.fired.some((f) => f.id === a.id);
                                                return (
                                                    <div key={a.id} style={{ fontSize: '0.7rem', color: hit ? '#c084fc' : '#71717a', fontWeight: hit ? 700 : 500 }}>
                                                        {hit && <Bell size={10} style={{ display: 'inline', marginRight: '3px' }} />}
                                                        {a.type} {formatCurrency(a.price)}{a.note ? ` · ${a.note}` : ''}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </td>
                                    <td style={td('center')}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                                            <button onClick={() => { setEditing(w); setIsOpen(true); }}
                                                style={{ padding: '0.35rem', borderRadius: '0.4rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'none', cursor: 'pointer' }}>
                                                <Edit2 size={13} />
                                            </button>
                                            <button onClick={() => remove(w.id)}
                                                style={{ padding: '0.35rem', borderRadius: '0.4rem', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'none', cursor: 'pointer' }}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {rows.length === 0 && (
                    <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                        <Eye size={28} style={{ color: '#3f3f46', marginBottom: '0.75rem' }} />
                        {/* An empty list and a filter that matched nothing look
                            identical otherwise, and the fix for each is different. */}
                        {allRows.length === 0 ? (
                            <>
                                <p style={{ color: '#71717a', fontSize: '0.9rem', margin: 0 }}>Nothing on the watchlist yet.</p>
                                <p style={{ color: '#52525b', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                                    Add a ticker to follow its price and 52-week range without owning it.
                                </p>
                            </>
                        ) : (
                            <>
                                <p style={{ color: '#71717a', fontSize: '0.9rem', margin: 0 }}>
                                    None of your {allRows.length} entries match this filter.
                                </p>
                                <button
                                    onClick={clearAll}
                                    style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                                >
                                    Clear filters
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <p style={{ fontSize: '0.72rem', color: '#52525b', margin: '1.25rem 0 0', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', maxWidth: '80ch', lineHeight: 1.6 }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                Range position describes where a price sits between its own 52-week low and high.
                It is not a recommendation: a price can sit at its low for reasons this app has no
                way of knowing, and being near a high does not make something expensive.
            </p>

            <WatchlistItemModal
                isOpen={isOpen}
                onClose={() => { setIsOpen(false); setEditing(null); }}
                onSave={save}
                initialData={editing}
            />
        </div>
    );
};

export default Watchlist;
