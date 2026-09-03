import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, Edit2, Trash2, Eye, RefreshCw, Bell, Info } from 'lucide-react';
import BackButton from '../components/BackButton';
import WatchlistItemModal from '../components/WatchlistItemModal';
import { readQuote, triggeredAlerts, atRangeEdges, NEAR_EDGE_PCT } from '../utils/priceRange';

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
    const { watchlist, refreshWatchlistPrices, addItem, updateItem, deleteItem, formatCurrency } = useFinance();

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState(null);

    const rows = useMemo(() => (watchlist || []).map((w) => ({
        ...w,
        q: readQuote(w),
        fired: triggeredAlerts(w),
    })).sort((a, b) => {
        const ar = a.q.rangePct, br = b.q.rangePct;
        if (ar === null) return 1;
        if (br === null) return -1;
        return ar - br;
    }), [watchlist]);

    const edges = useMemo(() => atRangeEdges(watchlist), [watchlist]);
    const firedCount = rows.reduce((n, r) => n + r.fired.length, 0);

    const save = async (item) => {
        if (editing) await updateItem('watchlist', item);
        else await addItem('watchlist', item);
        setIsOpen(false);
        setEditing(null);
    };

    const remove = async (id) => {
        if (window.confirm('Remove from watchlist?')) await deleteItem('watchlist', id);
    };

    const refresh = async () => {
        setBusy(true);
        setNote(null);
        const r = await refreshWatchlistPrices();
        setBusy(false);
        setNote(r.success ? `Updated ${r.updated} of ${r.total}` : (r.message || 'Refresh failed'));
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
                        from the same refresh as your holdings; the alert levels are yours.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {note && <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>{note}</span>}
                    <button onClick={refresh} disabled={busy}
                        style={{
                            padding: '0.625rem 1.1rem', borderRadius: '0.875rem', border: '1px solid rgba(45,212,191,0.3)',
                            backgroundColor: 'rgba(45,212,191,0.15)', color: '#2dd4bf', fontSize: '12px', fontWeight: 'bold',
                            cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: busy ? 0.6 : 1,
                        }}>
                        <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? 'Fetching…' : 'Refresh'}
                    </button>
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

            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={th()}>Company</th>
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
                        <p style={{ color: '#71717a', fontSize: '0.9rem', margin: 0 }}>Nothing on the watchlist yet.</p>
                        <p style={{ color: '#52525b', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                            Add a ticker to follow its price and 52-week range without owning it.
                        </p>
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
