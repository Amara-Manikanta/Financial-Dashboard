import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Plus, Edit2, Trash2, Ticket, Info, Clock } from 'lucide-react';
import BackButton from '../components/BackButton';
import IpoApplicationModal from '../components/IpoApplicationModal';
import { rankedApplications, ipoSummary } from '../utils/ipoApplications';

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

const STATUS_TONE = {
    allotted: { bg: 'rgba(52,211,153,0.12)', fg: '#34d399' },
    partial: { bg: 'rgba(45,212,191,0.12)', fg: '#2dd4bf' },
    'not-allotted': { bg: 'rgba(239,68,68,0.10)', fg: '#f87171' },
    applied: { bg: 'rgba(251,191,36,0.12)', fg: '#fbbf24' },
    withdrawn: { bg: 'rgba(113,113,122,0.15)', fg: '#a1a1aa' },
};

/**
 * Every IPO applied for, not only the ones that came through.
 *
 * An allotment already exists as a transaction on the holding it created; this
 * page adds the applications around it — including the failures, without which
 * an allotment rate has no denominator and blocked capital is invisible.
 */
const IpoTracker = () => {
    const navigate = useNavigate();
    const { savings, ipoApplications, formatCurrency, addItem, updateItem, deleteItem } = useFinance();

    const market = useMemo(
        () => (savings || []).find((s) => s.type === 'stock_market' && !s.isArchived),
        [savings],
    );
    const stocks = market?.stocks || [];

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const rows = useMemo(() => rankedApplications(ipoApplications), [ipoApplications]);
    const summary = useMemo(() => ipoSummary(ipoApplications, stocks), [ipoApplications, stocks]);

    const save = async (app) => {
        if (editing) await updateItem('ipoApplications', app);
        else await addItem('ipoApplications', app);
        setIsOpen(false);
        setEditing(null);
    };

    const remove = async (id) => {
        if (window.confirm('Delete this IPO application?')) await deleteItem('ipoApplications', id);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <BackButton label="Back to Investments" />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                        IPO Applications
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '64ch', lineHeight: 1.6 }}>
                        What you applied for, what came through, and what the rest cost you in
                        blocked capital.
                    </p>
                </div>
                <button
                    onClick={() => { setEditing(null); setIsOpen(true); }}
                    style={{
                        padding: '0.625rem 1.25rem', borderRadius: '0.875rem', backgroundColor: '#6366f1',
                        color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none',
                    }}
                >
                    <Plus size={16} /> Record Application
                </button>
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
                gap: '1.25rem', marginBottom: '2rem',
            }}>
                <div style={card}>
                    <p style={label}>Allotment rate</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#818cf8', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {summary.allotmentRate === null ? '—' : `${summary.allotmentRate.toFixed(0)}%`}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        {summary.allottedCount} of {summary.decidedCount} decided
                        {summary.pendingCount > 0 ? ` · ${summary.pendingCount} pending` : ''}
                    </p>
                </div>
                <div style={{ ...card, ...(summary.capitalBlockedNow > 0 ? { border: '1px solid rgba(251,191,36,0.22)', backgroundColor: 'rgba(251,191,36,0.05)' } : {}) }}>
                    <p style={{ ...label, ...(summary.capitalBlockedNow > 0 ? { color: '#fbbf24' } : {}) }}>Blocked right now</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: summary.capitalBlockedNow > 0 ? '#fbbf24' : 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(summary.capitalBlockedNow)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        across {summary.pendingCount} application{summary.pendingCount === 1 ? '' : 's'} awaiting a result
                    </p>
                </div>
                <div style={{ ...card, border: '1px solid rgba(52,211,153,0.2)', backgroundColor: 'rgba(52,211,153,0.04)' }}>
                    <p style={{ ...label, color: '#34d399' }}>Listing gain</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#34d399', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {summary.listingGainCount > 0 ? formatCurrency(summary.listingGain) : '—'}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        {summary.listingGainCount > 0
                            ? `on ${summary.listingGainCount} listing${summary.listingGainCount === 1 ? '' : 's'}`
                            : 'no listing prices recorded yet'}
                        {summary.missingListingPrice > 0 ? ` · ${summary.missingListingPrice} missing a price` : ''}
                    </p>
                </div>
                <div style={card}>
                    <p style={label}>Applied, lifetime</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(summary.totalApplied)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        {formatCurrency(summary.totalInvested)} allotted · {formatCurrency(summary.totalRefunded)} returned
                    </p>
                </div>
            </div>

            {summary.unlinkedAllotments.length > 0 && (
                <div style={{ ...card, marginBottom: '2rem', border: '1px solid rgba(251,191,36,0.22)', backgroundColor: 'rgba(251,191,36,0.05)' }}>
                    <p style={{ ...label, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Info size={13} /> Allotments with no application recorded
                    </p>
                    <p style={{ fontSize: '0.78rem', color: '#a1a1aa', margin: '0.5rem 0 0', lineHeight: 1.55 }}>
                        These holdings carry an IPO transaction, so they were allotted — but nothing
                        here records applying for them. Until every application is entered, the
                        allotment rate above is measured over what has been recorded, not over
                        everything you actually applied for.
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#fcd34d', margin: '0.6rem 0 0', fontWeight: 600 }}>
                        {summary.unlinkedAllotments.map((s) => s.name).join(' · ')}
                    </p>
                </div>
            )}

            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Ticket size={16} style={{ color: '#818cf8' }} /> Every application
                    </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={th()}>Company</th>
                                <th style={th()}>Applied</th>
                                <th style={th('right')}>Blocked</th>
                                <th style={th('center')}>Result</th>
                                <th style={th('right')}>Allotted</th>
                                <th style={th('right')}>Listing gain</th>
                                <th style={th('right')}>Days blocked</th>
                                <th style={th('center')}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const tone = STATUS_TONE[r.status] || STATUS_TONE.applied;
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ ...td(), fontWeight: 700 }}>
                                            {r.company}
                                            {r.symbol && <span style={{ color: '#71717a', marginLeft: '0.45rem', fontSize: '0.7rem' }}>{r.symbol}</span>}
                                        </td>
                                        <td style={{ ...td('left', '#a1a1aa'), fontSize: '0.74rem' }}>{r.appliedDate || '—'}</td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace' }}>{formatCurrency(r.amountBlocked)}</td>
                                        <td style={td('center')}>
                                            <span style={{
                                                fontSize: '9px', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase',
                                                padding: '0.25rem 0.55rem', borderRadius: '0.375rem',
                                                backgroundColor: tone.bg, color: tone.fg,
                                            }}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>
                                            {r.allotted ? `${r.sharesAllotted}/${r.sharesApplied}` : `0/${r.sharesApplied}`}
                                        </td>
                                        <td style={{ ...td('right', r.listingGain >= 0 ? '#34d399' : '#f87171'), fontFamily: 'monospace' }}>
                                            {r.hasListing
                                                ? `${r.listingGain >= 0 ? '+' : ''}${formatCurrency(r.listingGain)}`
                                                : <span style={{ color: '#52525b' }}>—</span>}
                                            {r.hasListing && r.listingGainPct !== null && (
                                                <div style={{ fontSize: '9px', color: '#71717a' }}>{r.listingGainPct.toFixed(1)}%</div>
                                            )}
                                        </td>
                                        <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace', fontSize: '0.74rem' }}>
                                            {r.daysBlocked === null
                                                ? (r.pending ? <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={11} /> open</span> : '—')
                                                : `${r.daysBlocked}d`}
                                        </td>
                                        <td style={td('center')}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                                                {r.linkedStockId && market && (
                                                    <button
                                                        onClick={() => navigate(`/savings/stock-market/${market.id}/stock/${r.linkedStockId}`)}
                                                        title="Open the holding this created"
                                                        style={{ padding: '0.35rem', borderRadius: '0.4rem', background: 'rgba(52,211,153,0.12)', color: '#34d399', border: 'none', cursor: 'pointer' }}
                                                    >
                                                        <Ticket size={13} />
                                                    </button>
                                                )}
                                                <button onClick={() => { setEditing(r.id ? ipoApplications.find((a) => String(a.id) === String(r.id)) : null); setIsOpen(true); }}
                                                    style={{ padding: '0.35rem', borderRadius: '0.4rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'none', cursor: 'pointer' }}>
                                                    <Edit2 size={13} />
                                                </button>
                                                <button onClick={() => remove(r.id)}
                                                    style={{ padding: '0.35rem', borderRadius: '0.4rem', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'none', cursor: 'pointer' }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {rows.length === 0 && (
                    <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                        <p style={{ color: '#71717a', fontSize: '0.9rem', margin: 0 }}>No IPO applications recorded yet.</p>
                        <p style={{ color: '#52525b', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                            Record the ones that were not allotted too — without them there is no
                            allotment rate, only a list of wins.
                        </p>
                    </div>
                )}
            </div>

            <IpoApplicationModal
                isOpen={isOpen}
                onClose={() => { setIsOpen(false); setEditing(null); }}
                onSave={save}
                initialData={editing}
                stocks={stocks}
            />
        </div>
    );
};

export default IpoTracker;
