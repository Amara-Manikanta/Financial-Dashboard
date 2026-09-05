import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
    Plus, Edit2, Trash2, Eye, Bell, Info, SlidersHorizontal, X,
} from 'lucide-react';
import BackButton from '../components/BackButton';
import WatchlistItemModal from '../components/WatchlistItemModal';
import RefreshAllPricesButton from '../components/RefreshAllPricesButton';
import { readQuote, triggeredAlerts, atRangeEdges, NEAR_EDGE_PCT } from '../utils/priceRange';
import { normaliseSector, sectorMeta } from '../utils/sectors';
import StockFinancialsCard from '../components/StockFinancialsCard';
import {
    RISK_LEVELS, RISK_META, riskOf, riskCounts,
    PRIORITY_LEVELS, PRIORITY_META, priorityOf, priorityCounts, byPriority,
} from '../utils/watchlistRisk';
import { MARKET_CAPS, capMeta, resolveMarketCap } from '../utils/nifty50Data';

const panel = {
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '1.25rem',
    padding: '1.5rem',
};

const label = {
    fontSize: '10px', fontWeight: 900, color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
};

/** A filter chip. One shape for every filter row, so they read as one control. */
const Chip = ({ active, color, bg, border, icon, children, onClick, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.3 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
            backgroundColor: active ? (bg || 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.025)',
            border: `1px solid ${active ? (border || 'rgba(255,255,255,0.22)') : 'rgba(255,255,255,0.06)'}`,
            color: active ? (color || 'white') : '#71717a',
        }}
    >
        {icon && <span>{icon}</span>}
        {children}
    </button>
);

/** A small badge on a card. */
const Badge = ({ color, bg, border, icon, children, title }) => (
    <span
        title={title}
        style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.28rem',
            padding: '0.16rem 0.45rem', borderRadius: '0.4rem',
            backgroundColor: bg, border: `1px solid ${border}`, color,
            fontSize: '0.63rem', fontWeight: 800, whiteSpace: 'nowrap',
        }}
    >
        {icon && <span>{icon}</span>}
        {children}
    </span>
);

/**
 * Companies being considered rather than owned.
 *
 * Everything here is descriptive. A price near its 52-week low is reported as
 * exactly that — a position in a range — and the only thresholds that raise
 * anything are ones entered by hand. Nothing on this page decides what is worth
 * buying, because a tracker cannot know that and pretending otherwise would
 * make its silence look like approval.
 *
 * ## Why cards rather than a table
 *
 * Each entry carries a variable amount of text — a note, none, or three alert
 * levels — and in a table that made every row a different height, so the grid
 * looked broken and nothing lined up across columns. A card sizes to its own
 * content without dragging its neighbours around, and the eleven columns this
 * needed had pushed the table to a 1,380px minimum width, which meant sideways
 * scrolling on any normal window.
 */
const Watchlist = () => {
    const { watchlist, addItem, updateItem, deleteItem, formatCurrency } = useFinance();

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [sectorFilter, setSectorFilter] = useState('All');
    const [riskFilter, setRiskFilter] = useState('All');
    const [capFilter, setCapFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    // Priority by default: the list exists to be worked through, and the order
    // it should be worked through in is the one its owner set.
    const [sortBy, setSortBy] = useState('priority');

    const allRows = useMemo(() => (watchlist || []).map((w) => ({
        ...w,
        /**
         * The stored record, untouched.
         *
         * Everything else on this object is computed for rendering, and handing
         * the decorated row to the edit form persisted all of it: `q`, `fired`,
         * `sectorKey`, `riskKey`, `capKey` and `priorityKey` were all written
         * back into the database, where `q` in particular is a stale snapshot of
         * a price that has its own field already. The form must only ever see
         * what was actually stored.
         */
        _raw: w,
        q: readQuote(w),
        fired: triggeredAlerts(w),
        // Normalised so "Financial Services" and "Financials" cannot appear as
        // two filters for one exposure — the same collision that split the
        // sector breakdown on the holdings page.
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
        // Within one priority band, nearest its 52-week low first — that is the
        // useful tie-break for a list you are working down.
        if (sortBy === 'priority') return copy.sort((a, b) => byPriority(a, b) || byRange(a, b));
        if (sortBy === 'name') return copy.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        return copy.sort(byRange);
    }, [allRows, sortBy]);

    /** Filters are built from what is on the list, not from the full vocabulary. */
    const sectorTabs = useMemo(() => {
        const counts = {};
        allRows.forEach((r) => { counts[r.sectorKey] = (counts[r.sectorKey] || 0) + 1; });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count, ...sectorMeta(name) }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [allRows]);

    const risks = useMemo(() => riskCounts(allRows), [allRows]);
    const priorities = useMemo(() => priorityCounts(allRows), [allRows]);

    const capTabs = useMemo(() => {
        const counts = {};
        allRows.forEach((r) => { counts[r.capKey] = (counts[r.capKey] || 0) + 1; });
        return [...MARKET_CAPS, 'Unclassified']
            .filter((c) => counts[c])
            .map((name) => ({ name, count: counts[name], ...capMeta(name) }));
    }, [allRows]);

    const rows = useMemo(() => sorted.filter((r) => {
        if (sectorFilter !== 'All' && r.sectorKey !== sectorFilter) return false;
        if (riskFilter !== 'All' && r.riskKey !== riskFilter) return false;
        if (capFilter !== 'All' && r.capKey !== capFilter) return false;
        if (priorityFilter !== 'All' && r.priorityKey !== priorityFilter) return false;
        return true;
    }), [sorted, sectorFilter, riskFilter, capFilter, priorityFilter]);

    /**
     * Grouped under priority headings when sorted that way.
     *
     * A flat list sorted by priority looks identical to a list in no order at
     * all — the bands only become visible once they are labelled.
     */
    const groups = useMemo(() => {
        if (sortBy !== 'priority') return [{ key: null, meta: null, items: rows }];
        return ['ready', 'interested', 'watching', 'unset']
            .map((key) => ({ key, meta: PRIORITY_META[key], items: rows.filter((r) => r.priorityKey === key) }))
            .filter((g) => g.items.length > 0);
    }, [rows, sortBy]);

    const edges = useMemo(() => atRangeEdges(watchlist), [watchlist]);
    const firedCount = allRows.reduce((n, r) => n + r.fired.length, 0);
    const activeFilters = [sectorFilter, riskFilter, capFilter, priorityFilter].filter((f) => f !== 'All').length;
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                        Watchlist
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '68ch', lineHeight: 1.6 }}>
                        Companies you are following but do not own, in the order you said they matter.
                        Prices and 52-week ranges come from the same refresh as your holdings; the priority,
                        risk and alert levels are yours.
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

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ ...panel, padding: '1.15rem 1.35rem' }}>
                    <p style={label}>Watching</p>
                    <p style={{ fontSize: '1.65rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.3rem 0 0' }}>{allRows.length}</p>
                </div>
                <div style={{
                    ...panel, padding: '1.15rem 1.35rem',
                    ...(priorities.ready ? { border: '1px solid rgba(129,140,248,0.28)', backgroundColor: 'rgba(129,140,248,0.05)' } : {}),
                }}>
                    <p style={{ ...label, ...(priorities.ready ? { color: '#818cf8' } : {}) }}>Marked ready</p>
                    <p style={{ fontSize: '1.65rem', fontWeight: 900, color: priorities.ready ? '#818cf8' : 'white', fontFamily: 'monospace', margin: '0.3rem 0 0' }}>
                        {priorities.ready}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#71717a', margin: '0.2rem 0 0' }}>your call, not the app's</p>
                </div>
                <div style={{
                    ...panel, padding: '1.15rem 1.35rem',
                    ...(edges.nearLow.length ? { border: '1px solid rgba(96,165,250,0.25)', backgroundColor: 'rgba(96,165,250,0.05)' } : {}),
                }}>
                    <p style={{ ...label, ...(edges.nearLow.length ? { color: '#60a5fa' } : {}) }}>Lower {NEAR_EDGE_PCT}% of range</p>
                    <p style={{ fontSize: '1.65rem', fontWeight: 900, color: edges.nearLow.length ? '#60a5fa' : 'white', fontFamily: 'monospace', margin: '0.3rem 0 0' }}>
                        {edges.nearLow.length}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#71717a', margin: '0.2rem 0 0' }}>a position, not a signal</p>
                </div>
                <div style={{
                    ...panel, padding: '1.15rem 1.35rem',
                    ...(firedCount ? { border: '1px solid rgba(192,132,252,0.25)', backgroundColor: 'rgba(192,132,252,0.05)' } : {}),
                }}>
                    <p style={{ ...label, ...(firedCount ? { color: '#c084fc' } : {}) }}>Alerts triggered</p>
                    <p style={{ fontSize: '1.65rem', fontWeight: 900, color: firedCount ? '#c084fc' : 'white', fontFamily: 'monospace', margin: '0.3rem 0 0' }}>
                        {firedCount}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#71717a', margin: '0.2rem 0 0' }}>levels you set yourself</p>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginBottom: showFilters ? '1rem' : '1.5rem' }}>
                <span style={label}>Sort</span>
                {[
                    { id: 'priority', text: 'Priority' },
                    { id: 'range', text: 'Nearest 52w low' },
                    { id: 'name', text: 'Name' },
                ].map((s) => (
                    <Chip key={s.id} active={sortBy === s.id} onClick={() => setSortBy(s.id)}>{s.text}</Chip>
                ))}

                <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 0.3rem' }} />

                <Chip
                    active={showFilters || activeFilters > 0}
                    color="#38bdf8"
                    bg="rgba(56,189,248,0.12)"
                    border="rgba(56,189,248,0.3)"
                    onClick={() => setShowFilters((v) => !v)}
                    icon={<SlidersHorizontal size={12} />}
                >
                    Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
                </Chip>

                {activeFilters > 0 && (
                    <span style={{ fontSize: '0.72rem', color: '#71717a', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        showing {rows.length} of {allRows.length}
                        <button onClick={clearAll}
                            style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                            <X size={11} /> clear
                        </button>
                    </span>
                )}
            </div>

            {showFilters && (
                <div style={{ ...panel, padding: '1.25rem 1.4rem', marginBottom: '1.5rem', display: 'grid', gap: '1rem' }}>
                    <div>
                        <p style={{ ...label, marginBottom: '0.55rem' }}>Priority</p>
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <Chip active={priorityFilter === 'All'} onClick={() => setPriorityFilter('All')}>All {allRows.length}</Chip>
                            {[...PRIORITY_LEVELS].reverse().concat('unset').map((p) => {
                                const meta = PRIORITY_META[p];
                                return (
                                    <Chip key={p} active={priorityFilter === p} disabled={!priorities[p]}
                                        color={meta.color} bg={meta.bg} border={meta.border}
                                        onClick={() => setPriorityFilter(priorityFilter === p ? 'All' : p)}>
                                        {meta.label} {priorities[p]}
                                    </Chip>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p style={{ ...label, marginBottom: '0.55rem' }}>Risk, as you rated it</p>
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <Chip active={riskFilter === 'All'} onClick={() => setRiskFilter('All')}>All {allRows.length}</Chip>
                            {[...RISK_LEVELS].reverse().concat('unrated').map((r) => {
                                const meta = RISK_META[r];
                                return (
                                    <Chip key={r} active={riskFilter === r} disabled={!risks[r]}
                                        color={meta.color} bg={meta.bg} border={meta.border}
                                        onClick={() => setRiskFilter(riskFilter === r ? 'All' : r)}>
                                        {meta.label} {risks[r]}
                                    </Chip>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p style={{ ...label, marginBottom: '0.55rem' }}>Market cap</p>
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <Chip active={capFilter === 'All'} onClick={() => setCapFilter('All')}>All {allRows.length}</Chip>
                            {capTabs.map((c) => (
                                <Chip key={c.name} active={capFilter === c.name} icon={c.icon}
                                    color={c.color} bg={c.bg} border={c.border}
                                    onClick={() => setCapFilter(capFilter === c.name ? 'All' : c.name)}>
                                    {c.name} {c.count}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p style={{ ...label, marginBottom: '0.55rem' }}>Sector</p>
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <Chip active={sectorFilter === 'All'} onClick={() => setSectorFilter('All')}>All {allRows.length}</Chip>
                            {sectorTabs.map((s) => (
                                <Chip key={s.name} active={sectorFilter === s.name} icon={s.icon}
                                    color={s.color} bg={`${s.color}22`} border={s.color}
                                    onClick={() => setSectorFilter(sectorFilter === s.name ? 'All' : s.name)}>
                                    {s.name} {s.count}
                                </Chip>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Cards */}
            {rows.length === 0 ? (
                <div style={{ ...panel, padding: '3.5rem 1.5rem', textAlign: 'center' }}>
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
                            <button onClick={clearAll}
                                style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                                Clear filters
                            </button>
                        </>
                    )}
                </div>
            ) : groups.map((group) => (
                <div key={group.key || 'all'} style={{ marginBottom: '1.75rem' }}>
                    {group.meta && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.9rem' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '999px', backgroundColor: group.meta.color }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 900, color: group.meta.color, letterSpacing: '0.02em' }}>
                                {group.meta.label}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#52525b' }}>
                                {group.items.length} · {group.meta.blurb}
                            </span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }} />
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1rem', alignItems: 'stretch' }}>
                        {group.items.map((w) => {
                            const pm = PRIORITY_META[w.priorityKey];
                            const rm = RISK_META[w.riskKey];
                            const cm = capMeta(w.capKey);
                            const sm = sectorMeta(w.sectorKey);
                            const up = w.q.dayChangePct !== null && w.q.dayChangePct >= 0;

                            return (
                                <div key={w.id} style={{
                                    backgroundColor: 'rgba(24, 24, 27, 0.45)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    // The left edge carries the priority, so the
                                    // band stays readable while scanning even
                                    // once the group heading has scrolled away.
                                    borderLeft: `3px solid ${w.priorityKey === 'unset' ? 'rgba(255,255,255,0.07)' : pm.color}`,
                                    borderRadius: '1rem',
                                    padding: '1.1rem 1.2rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.8rem',
                                }}>
                                    {/* Name and actions */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{
                                                fontSize: '0.88rem', fontWeight: 800, color: 'white', margin: 0,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }} title={w.name}>
                                                {w.name}
                                            </p>
                                            <p style={{ fontSize: '0.68rem', color: '#71717a', margin: '0.15rem 0 0', fontFamily: 'monospace' }}>
                                                {w.ticker}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                                            <button onClick={() => { setEditing(w._raw); setIsOpen(true); }}
                                                title="Edit"
                                                style={{ padding: '0.3rem', borderRadius: '0.4rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => remove(w.id)}
                                                title="Remove"
                                                style={{ padding: '0.3rem', borderRadius: '0.4rem', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Badges */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                        <Badge color={sm.color} bg={`${sm.color}18`} border={`${sm.color}33`} icon={sm.icon}>
                                            {w.sectorKey}
                                        </Badge>
                                        <Badge color={cm.color} bg={cm.bg} border={cm.border} icon={cm.icon}>
                                            {w.capKey.replace(' Cap', '')}
                                        </Badge>
                                        <Badge color={rm.color} bg={rm.bg} border={rm.border} title={rm.blurb}>
                                            {rm.label} risk
                                        </Badge>
                                    </div>

                                    {/* Price */}
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
                                        <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>
                                            {w.q.price ? formatCurrency(w.q.price) : <span style={{ color: '#fbbf24', fontSize: '0.9rem' }}>no price</span>}
                                        </span>
                                        {w.q.dayChangePct !== null && (
                                            <span style={{ fontSize: '0.76rem', fontWeight: 700, fontFamily: 'monospace', color: up ? '#34d399' : '#f87171' }}>
                                                {up ? '+' : ''}{w.q.dayChangePct.toFixed(2)}%
                                            </span>
                                        )}
                                    </div>

                                    {/* 52-week range */}
                                    {w.q.hasRange ? (
                                        <div>
                                            <div style={{ position: 'relative', height: '5px', borderRadius: '3px', background: 'linear-gradient(90deg, rgba(96,165,250,0.4), rgba(255,255,255,0.07), rgba(251,191,36,0.4))' }}>
                                                <div style={{
                                                    position: 'absolute', top: '-3px',
                                                    left: `calc(${Math.min(100, Math.max(0, w.q.rangePct))}% - 5px)`,
                                                    width: '10px', height: '11px', borderRadius: '3px',
                                                    backgroundColor: w.q.nearLow ? '#60a5fa' : w.q.nearHigh ? '#fbbf24' : '#e4e4e7',
                                                    border: '2px solid #18181b',
                                                }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                                                <span style={{ fontSize: '0.63rem', color: '#71717a', fontFamily: 'monospace' }}>{formatCurrency(w.q.low)}</span>
                                                <span style={{
                                                    fontSize: '0.63rem', fontWeight: 800, fontFamily: 'monospace',
                                                    color: w.q.nearLow ? '#60a5fa' : w.q.nearHigh ? '#fbbf24' : '#71717a',
                                                }}>
                                                    {w.q.rangePct.toFixed(0)}% of range
                                                </span>
                                                <span style={{ fontSize: '0.63rem', color: '#71717a', fontFamily: 'monospace' }}>{formatCurrency(w.q.high)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.68rem', color: '#52525b', margin: 0 }}>no 52-week range yet — refresh prices</p>
                                    )}

                                    {/* Alerts */}
                                    {(w.alerts || []).length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                            {(w.alerts || []).map((a) => {
                                                const hit = w.fired.some((f) => f.id === a.id);
                                                return (
                                                    <span key={a.id} title={a.note || ''} style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                        padding: '0.16rem 0.45rem', borderRadius: '0.4rem',
                                                        backgroundColor: hit ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.04)',
                                                        border: `1px solid ${hit ? 'rgba(192,132,252,0.35)' : 'rgba(255,255,255,0.07)'}`,
                                                        color: hit ? '#c084fc' : '#71717a',
                                                        fontSize: '0.63rem', fontWeight: 700,
                                                    }}>
                                                        {hit && <Bell size={9} />}
                                                        {a.type} {formatCurrency(a.price)}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Notes last, and allowed to be the flexible part —
                                        the card grows downwards rather than pushing
                                        anything sideways. */}
                                    {w.notes && (
                                        <p style={{
                                            fontSize: '0.68rem', color: '#71717a', margin: 'auto 0 0',
                                            paddingTop: '0.15rem', lineHeight: 1.5, fontStyle: 'italic',
                                        }}>
                                            {w.notes}
                                        </p>
                                    )}

                                    {/* Business Health — compact scorecard, loads on demand, writes nothing */}
                                    {w.ticker && (
                                        <StockFinancialsCard
                                            symbol={w.ticker.includes('.') ? w.ticker : `${w.ticker}.NS`}
                                            name={w.name}
                                            compact
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <p style={{ fontSize: '0.72rem', color: '#52525b', margin: '0.5rem 0 0', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', maxWidth: '82ch', lineHeight: 1.6 }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                Range position describes where a price sits between its own 52-week low and high. It is not
                a recommendation: a price can sit at its low for reasons this app has no way of knowing, and
                being near a high does not make something expensive. Priority and risk are yours — nothing
                here computes either.
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
