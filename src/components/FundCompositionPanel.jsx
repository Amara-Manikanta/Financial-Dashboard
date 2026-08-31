import React, { useMemo } from 'react';
import { PieChart as PieChartIcon, Pencil, AlertTriangle, Clock } from 'lucide-react';
import { valuedComposition, ageInDays, COMPLETE_ENOUGH } from '../utils/fundComposition';

/** A disclosure older than this is worth flagging — funds report monthly. */
const STALE_AFTER_DAYS = 75;

const cell = { padding: '0.75rem 1rem', fontSize: '12px' };
const head = {
    padding: '0.75rem 1rem', fontSize: '9px', fontWeight: '900', color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.05em',
};

/**
 * What this fund holds, and — just as importantly — how much of it is unknown.
 *
 * The unmapped remainder is a row in the table rather than a footnote. A
 * holdings list that stops at 40% of the fund and does not say so is the exact
 * problem this panel was built to end.
 */
const FundCompositionPanel = ({ fund, fundValue, formatCurrency, onEdit }) => {
    const comp = useMemo(() => valuedComposition(fund, fundValue), [fund, fundValue]);
    const age = useMemo(() => ageInDays(fund), [fund]);
    const stale = age !== null && age > STALE_AFTER_DAYS;
    const partial = comp.has && comp.coverage < COMPLETE_ENOUGH;

    return (
        <div style={{
            backgroundColor: 'rgba(24, 24, 27, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '1.5rem',
            marginBottom: '2rem',
            overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '1rem',
                alignItems: 'center', justifyContent: 'space-between',
                padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PieChartIcon size={16} style={{ color: '#818cf8' }} /> Fund Composition
                    </h3>
                    <p style={{ fontSize: '10px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0.35rem 0 0 0' }}>
                        {comp.has
                            ? `${comp.holdings.length} holdings · covers ${comp.coverage}% of the fund`
                            : 'Not recorded'}
                    </p>
                </div>
                <button
                    onClick={onEdit}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1rem', borderRadius: '0.75rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99,102,241,0.3)',
                        color: '#818cf8', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                    }}
                >
                    <Pencil size={14} /> {comp.has ? 'Edit holdings' : 'Add holdings'}
                </button>
            </div>

            {(comp.source || comp.asOf) && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center',
                    padding: '0.65rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '11px', color: '#a1a1aa',
                }}>
                    {comp.asOf && <span>As of <strong style={{ color: '#e4e4e7' }}>{comp.asOf}</strong></span>}
                    {comp.source && <span>· {comp.source}</span>}
                    {!comp.stored && (
                        <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                            · built-in table, not from a disclosure you recorded
                        </span>
                    )}
                    {stale && (
                        <span style={{ color: '#fbbf24', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={12} /> {age} days old
                        </span>
                    )}
                </div>
            )}

            {partial && (
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    padding: '0.75rem 1.5rem', backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    borderBottom: '1px solid rgba(245,158,11,0.2)', fontSize: '11px', color: '#fcd34d',
                }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                        This list accounts for {comp.coverage}% of the fund. The remaining {comp.unmapped}% —
                        about {formatCurrency(comp.unmappedValue)} — is not attributed to any holding, so any
                        breakdown built on it is incomplete by that much.
                    </span>
                </div>
            )}

            {!comp.has ? (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                    <p style={{ color: '#71717a', fontSize: '13px', margin: 0 }}>
                        No holdings recorded for this fund.
                    </p>
                    <p style={{ color: '#52525b', fontSize: '11px', margin: '0.5rem 0 0 0' }}>
                        Add them from the AMC's monthly factsheet to see what {formatCurrency(comp.fundValue)} is
                        actually invested in.
                    </p>
                </div>
            ) : (
                <div style={{ maxHeight: '420px', overflowY: 'auto' }} className="custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#18181b', zIndex: 1 }}>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={{ ...head, textAlign: 'left' }}>Holding</th>
                                <th style={{ ...head, textAlign: 'left' }}>Sector</th>
                                <th style={{ ...head, textAlign: 'right' }}>Weight</th>
                                <th style={{ ...head, textAlign: 'right' }}>Your Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comp.holdings.map((h) => (
                                <tr key={h.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ ...cell, color: '#e4e4e7' }}>
                                        <span style={{ fontWeight: '700' }}>{h.symbol}</span>
                                        {h.name && h.name !== h.symbol && (
                                            <span style={{ color: '#71717a', marginLeft: '0.5rem', fontSize: '11px' }}>{h.name}</span>
                                        )}
                                        {h.rating && (
                                            <span style={{ marginLeft: '0.5rem', fontSize: '9px', fontWeight: '800', color: '#34d399' }}>{h.rating}</span>
                                        )}
                                    </td>
                                    <td style={{ ...cell, color: '#a1a1aa' }}>{h.sector}</td>
                                    <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#e4e4e7' }}>{h.weight.toFixed(2)}%</td>
                                    <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#34d399' }}>{formatCurrency(h.value)}</td>
                                </tr>
                            ))}
                            {comp.unmapped > 0 && (
                                <tr style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)' }}>
                                    <td style={{ ...cell, color: '#fcd34d', fontWeight: '700' }}>Unmapped</td>
                                    <td style={{ ...cell, color: '#a16207', fontSize: '11px' }}>not in this disclosure</td>
                                    <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#fcd34d' }}>{comp.unmapped.toFixed(2)}%</td>
                                    <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#fcd34d' }}>{formatCurrency(comp.unmappedValue)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default FundCompositionPanel;
