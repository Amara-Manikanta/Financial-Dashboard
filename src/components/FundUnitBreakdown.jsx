import React, { useMemo, useState } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';
import { bySector, perUnitHoldings, readComposition, COMPLETE_ENOUGH } from '../utils/fundComposition';

const head = {
    padding: '0.6rem 1rem', fontSize: '9px', fontWeight: '900', color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.05em',
};
const cell = { padding: '0.6rem 1rem', fontSize: '12px' };

/**
 * What one unit of the fund actually buys, by stock and by sector.
 *
 * A fund value tells you what the holding is worth; it does not tell you what
 * the money is in. This splits the NAV by the disclosed weights, so a unit is
 * read as the basket it is — ₹11.52 of a ₹100 unit sitting in HDFC Bank.
 *
 * Per-unit is the stable figure and leads: it is what the next SIP buys, and
 * it does not move when more units are added. The column beside it scales that
 * to the units actually held.
 */
const FundUnitBreakdown = ({ fund, units, nav, fundValue, formatCurrency }) => {
    const [view, setView] = useState('stock');

    const comp = useMemo(() => readComposition(fund), [fund]);
    const stocks = useMemo(() => perUnitHoldings(fund, fundValue, nav), [fund, fundValue, nav]);
    const sectors = useMemo(() => bySector(fund, fundValue, nav), [fund, fundValue, nav]);

    if (!comp.has) return null;

    const partial = comp.coverage < COMPLETE_ENOUGH;
    const rows = view === 'stock' ? stocks : sectors;
    const tab = (id, label) => (
        <button
            type="button"
            onClick={() => setView(id)}
            style={{
                padding: '0.35rem 0.85rem', borderRadius: '0.6rem', fontSize: '10px',
                fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                cursor: 'pointer', border: '1px solid',
                borderColor: view === id ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.1)',
                backgroundColor: view === id ? 'rgba(129,140,248,0.15)' : 'transparent',
                color: view === id ? '#a5b4fc' : '#71717a',
            }}
        >{label}</button>
    );

    return (
        <div style={{
            backgroundColor: 'rgba(24, 24, 27, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '1.5rem', marginBottom: '2rem', overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center',
                justifyContent: 'space-between', padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={16} style={{ color: '#818cf8' }} /> Where each unit goes
                    </h3>
                    <p style={{ fontSize: '11px', color: '#71717a', margin: '0.35rem 0 0 0' }}>
                        One unit is worth {formatCurrency(nav)}, split by the fund's own weights.
                        {units > 0 && ` You hold ${Number(units).toFixed(3)} units.`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {tab('stock', 'By stock')}
                    {tab('sector', 'By sector')}
                </div>
            </div>

            {partial && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.5rem', fontSize: '11px', color: '#fbbf24',
                    backgroundColor: 'rgba(251,191,36,0.06)',
                }}>
                    <AlertTriangle size={13} />
                    The disclosure covers {comp.coverage.toFixed(1)}% of the fund. The rest is shown as its own row.
                </div>
            )}

            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#141416' }}>
                        <tr>
                            <th style={{ ...head, textAlign: 'left' }}>{view === 'stock' ? 'Holding' : 'Sector'}</th>
                            <th style={{ ...head, textAlign: 'right' }}>Weight</th>
                            <th style={{ ...head, textAlign: 'right' }}>Per unit</th>
                            <th style={{ ...head, textAlign: 'right' }}>Your holding</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={(r.symbol || r.sector) + i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ ...cell, color: '#e4e4e7' }}>
                                    {view === 'stock' ? (r.name || r.symbol) : r.sector}
                                    {view === 'stock' && r.sector && (
                                        <span style={{ color: '#52525b', fontSize: '10px', marginLeft: '0.5rem' }}>{r.sector}</span>
                                    )}
                                    {view === 'sector' && (
                                        <span style={{ color: '#52525b', fontSize: '10px', marginLeft: '0.5rem' }}>
                                            {r.count} holding{r.count > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </td>
                                <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#a1a1aa' }}>{r.weight.toFixed(2)}%</td>
                                <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#a5b4fc', fontWeight: 700 }}>{formatCurrency(r.perUnit)}</td>
                                <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: 'white' }}>{formatCurrency(r.value)}</td>
                            </tr>
                        ))}
                        {comp.unmapped > 0.01 && (
                            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <td style={{ ...cell, color: '#71717a', fontStyle: 'italic' }}>Not disclosed</td>
                                <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#71717a' }}>{comp.unmapped.toFixed(2)}%</td>
                                <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#71717a' }}>{formatCurrency((nav * comp.unmapped) / 100)}</td>
                                <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: '#71717a' }}>{formatCurrency((fundValue * comp.unmapped) / 100)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FundUnitBreakdown;
