import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Gift, ShieldCheck, TrendingUp } from 'lucide-react';
import BackButton from '../components/BackButton';
import {
    recoveryRanking, freePositions, nearlyFree, recoveryTotals, NEARLY_FREE_FROM,
} from '../utils/costRecovery';

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
    padding: '0.85rem 1rem', textAlign: align, fontSize: '0.8rem', color,
});

/**
 * Which holdings you no longer have any of your own money in.
 *
 * The portfolio pages answer "what is this worth" and "what did it cost". This
 * one answers a question neither can: has this position already given back
 * everything that was put into it? Average-cost accounting cannot say so — it
 * keeps every remaining share at its original price, however much has since
 * been taken off the table.
 */
const FreeHoldings = () => {
    const navigate = useNavigate();
    const { savings, formatCurrency } = useFinance();

    const stocks = useMemo(() => {
        const market = (savings || []).find((s) => s.type === 'stock_market' && !s.isArchived);
        return market?.stocks || [];
    }, [savings]);

    const marketId = useMemo(
        () => (savings || []).find((s) => s.type === 'stock_market' && !s.isArchived)?.id,
        [savings],
    );

    const free = useMemo(() => freePositions(stocks), [stocks]);
    const almost = useMemo(() => nearlyFree(stocks), [stocks]);
    const all = useMemo(() => recoveryRanking(stocks), [stocks]);
    const totals = useMemo(() => recoveryTotals(stocks), [stocks]);

    const recoveredPctOfPortfolio = totals.invested > 0
        ? (totals.recovered / totals.invested) * 100
        : 0;

    const open = (id) => marketId && navigate(`/savings/stock-market/${marketId}/stock/${id}`);

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <BackButton label="Back to Investments" />

            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                    Free Holdings
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '60ch', lineHeight: 1.6 }}>
                    Selling part of a position, plus the dividends it has paid, can return everything
                    that was put in. What is still held then costs nothing — however much the average
                    price still says it did.
                </p>
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '1.25rem', marginBottom: '2rem',
            }}>
                <div style={card}>
                    <p style={label}>Your money still at risk</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(totals.stillAtRisk)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        of {formatCurrency(totals.invested)} put into positions you still hold
                    </p>
                </div>
                <div style={{ ...card, border: '1px solid rgba(52,211,153,0.22)', backgroundColor: 'rgba(52,211,153,0.05)' }}>
                    <p style={{ ...label, color: '#34d399' }}>Held at no cost</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#34d399', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(totals.freeValue)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        across {totals.freeCount} position{totals.freeCount === 1 ? '' : 's'}
                        {totals.bonusShares > 0 ? ` · ${totals.bonusShares} bonus shares` : ''}
                    </p>
                </div>
                <div style={card}>
                    <p style={label}>Cost recovered overall</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#818cf8', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {recoveredPctOfPortfolio.toFixed(1)}%
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        {formatCurrency(totals.recovered)} back from sales and dividends
                    </p>
                </div>
            </div>

            {free.length > 0 && (
                <div style={{ ...card, padding: 0, marginBottom: '2rem', overflow: 'hidden', border: '1px solid rgba(52,211,153,0.22)' }}>
                    <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Gift size={16} style={{ color: '#34d399' }} /> Fully recovered
                        </h3>
                        <p style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.3rem 0 0' }}>
                            Every rupee back, and shares still in hand.
                        </p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <th style={th()}>Holding</th>
                                    <th style={th('right')}>Invested</th>
                                    <th style={th('right')}>Recovered</th>
                                    <th style={th('right')}>Dividends</th>
                                    <th style={th('right')}>Surplus</th>
                                    <th style={th('right')}>Shares free</th>
                                    <th style={th('right')}>Value now</th>
                                </tr>
                            </thead>
                            <tbody>
                                {free.map((r) => (
                                    <tr key={r.id} onClick={() => open(r.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ ...td(), fontWeight: 700 }}>{r.name}</td>
                                        <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>{formatCurrency(r.invested)}</td>
                                        <td style={{ ...td('right', '#34d399'), fontFamily: 'monospace' }}>
                                            {formatCurrency(r.recovered)}
                                            <span style={{ color: '#71717a', marginLeft: '0.4rem', fontSize: '0.68rem' }}>{r.rawPct.toFixed(0)}%</span>
                                        </td>
                                        <td style={{ ...td('right', '#2dd4bf'), fontFamily: 'monospace' }}>{r.dividends > 0 ? formatCurrency(r.dividends) : '—'}</td>
                                        <td style={{ ...td('right', '#34d399'), fontFamily: 'monospace' }}>{formatCurrency(r.surplus)}</td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace' }}>{r.shares}</td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace', fontWeight: 700 }}>{formatCurrency(r.value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {almost.length > 0 && (
                <div style={{ ...card, padding: 0, marginBottom: '2rem', overflow: 'hidden', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={16} style={{ color: '#fbbf24' }} /> Close to free
                        </h3>
                        <p style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.3rem 0 0' }}>
                            Past {NEARLY_FREE_FROM}% recovered — still your own money in the market.
                        </p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <th style={th()}>Holding</th>
                                    <th style={th('right')}>Recovered</th>
                                    <th style={th('right')}>Still at risk</th>
                                    <th style={th('right')}>Net cost/share</th>
                                    <th style={th('right')}>Value now</th>
                                </tr>
                            </thead>
                            <tbody>
                                {almost.map((r) => (
                                    <tr key={r.id} onClick={() => open(r.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ ...td(), fontWeight: 700 }}>{r.name}</td>
                                        <td style={{ ...td('right', '#fbbf24'), fontFamily: 'monospace' }}>{r.rawPct.toFixed(0)}%</td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace' }}>{formatCurrency(r.outstandingCost)}</td>
                                        <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>{formatCurrency(r.netCostPerShare)}</td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace', fontWeight: 700 }}>{formatCurrency(r.value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldCheck size={16} style={{ color: '#818cf8' }} /> Every holding, by cost recovered
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.3rem 0 0' }}>
                        Sales and dividends only. Nothing here is marked to market — the point is
                        what has actually come back, not what the rest might be worth.
                    </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={th()}>Holding</th>
                                <th style={th('right')}>Invested</th>
                                <th style={th('right')}>Recovered</th>
                                <th style={th()}>Progress</th>
                                <th style={th('right')}>Still at risk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {all.map((r) => (
                                <tr key={r.id} onClick={() => open(r.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ ...td(), fontWeight: 600 }}>{r.name}</td>
                                    <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>{formatCurrency(r.invested)}</td>
                                    <td style={{ ...td('right', r.isFree ? '#34d399' : '#a1a1aa'), fontFamily: 'monospace' }}>{formatCurrency(r.recovered)}</td>
                                    <td style={td()}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ flex: 1, minWidth: '80px', height: '5px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.min(100, r.rawPct)}%`, height: '100%',
                                                    backgroundColor: r.isFree ? '#34d399' : r.rawPct >= NEARLY_FREE_FROM ? '#fbbf24' : '#6366f1',
                                                }} />
                                            </div>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#71717a', minWidth: '38px', textAlign: 'right' }}>
                                                {r.rawPct.toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ ...td('right'), fontFamily: 'monospace' }}>
                                        {r.outstandingCost > 0 ? formatCurrency(r.outstandingCost) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {all.length === 0 && (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
                        No holdings with a recorded purchase yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default FreeHoldings;
