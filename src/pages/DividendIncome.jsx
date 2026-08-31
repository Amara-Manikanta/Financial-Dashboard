import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Coins, AlertTriangle, Info } from 'lucide-react';
import BackButton from '../components/BackButton';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
    incomeByYear, incomeByMonth, incomeSummary, dividendPayers, lapsedPayers,
} from '../utils/dividendAnalytics';

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
 * Dividends treated as income rather than as a statistic on a holding.
 *
 * Deliberately kept separate from the expenses ledger. A dividend recorded here
 * and the bank credit it produced are two records of one payment, and nothing
 * links them — folding this into the income figures would double-count exactly
 * the way payroll tax rows once did. This page reports what the holdings paid;
 * it does not touch salary or the expense totals.
 */
const DividendIncome = () => {
    const navigate = useNavigate();
    const { savings, formatCurrency } = useFinance();

    const market = useMemo(
        () => (savings || []).find((s) => s.type === 'stock_market' && !s.isArchived),
        [savings],
    );
    const stocks = market?.stocks || [];

    const summary = useMemo(() => incomeSummary(stocks), [stocks]);
    const years = useMemo(() => incomeByYear(stocks), [stocks]);
    const payers = useMemo(() => dividendPayers(stocks), [stocks]);
    const lapsed = useMemo(() => lapsedPayers(stocks), [stocks]);

    const latestYear = years.length ? years[years.length - 1].year : String(new Date().getFullYear());
    const [selectedYear, setSelectedYear] = useState(latestYear);
    const months = useMemo(() => incomeByMonth(stocks, selectedYear), [stocks, selectedYear]);

    const open = (id) => market?.id && navigate(`/savings/stock-market/${market.id}/stock/${id}`);

    const monthsWithIncome = months.filter((m) => m.amount > 0).length;

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <BackButton label="Back to Investments" />

            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                    Dividend Income
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '62ch', lineHeight: 1.6 }}>
                    Cash your holdings have actually paid you, arranged by when it arrived.
                </p>
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
                gap: '1.25rem', marginBottom: '2rem',
            }}>
                <div style={{ ...card, border: '1px solid rgba(45,212,191,0.22)', backgroundColor: 'rgba(45,212,191,0.05)' }}>
                    <p style={{ ...label, color: '#2dd4bf' }}>Received this year</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#2dd4bf', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(summary.thisYear)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        {summary.bestYear
                            ? `best full year: ${summary.bestYear.year}, ${formatCurrency(summary.bestYear.amount)}`
                            : 'no completed year yet'}
                    </p>
                </div>
                <div style={card}>
                    <p style={label}>Lifetime dividends</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(summary.lifetime)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        from {summary.payerCount} holdings that have paid
                    </p>
                </div>
                <div style={card}>
                    <p style={label}>Portfolio yield on cost</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#818cf8', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {summary.portfolioYieldOnCost.toFixed(2)}%
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        lifetime dividends against what you paid
                    </p>
                </div>
            </div>

            <div style={{ ...card, marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Coins size={16} style={{ color: '#2dd4bf' }} /> Dividend income by year
                </h3>
                <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                        <BarChart data={years} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="year" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false}
                                tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                            <Tooltip
                                formatter={(v) => formatCurrency(v)}
                                contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                            <Bar dataKey="amount" radius={[5, 5, 0, 0]} barSize={44}>
                                {years.map((y) => (
                                    <Cell key={y.year} fill={y.year === String(new Date().getFullYear()) ? '#2dd4bf' : '#14b8a6'} opacity={y.year === String(new Date().getFullYear()) ? 1 : 0.55} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.5rem 0 0' }}>
                    The current year is highlighted and still in progress, so it is not comparable
                    with the completed years beside it.
                </p>
            </div>

            <div style={{ ...card, marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0 }}>
                        Month by month
                    </h3>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {years.map((y) => (
                            <button key={y.year} onClick={() => setSelectedYear(y.year)}
                                style={{
                                    padding: '0.35rem 0.8rem', borderRadius: '0.5rem', fontSize: '11px', fontWeight: 800,
                                    cursor: 'pointer',
                                    border: selectedYear === y.year ? '1px solid #2dd4bf' : '1px solid rgba(255,255,255,0.08)',
                                    backgroundColor: selectedYear === y.year ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.02)',
                                    color: selectedYear === y.year ? '#2dd4bf' : '#a1a1aa',
                                }}>
                                {y.year}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer>
                        <BarChart data={months} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="month" stroke="#71717a" fontSize={9} tickLine={false} axisLine={false}
                                tickFormatter={(m) => m.slice(0, 3)} interval={0} />
                            <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false}
                                tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                            <Tooltip
                                formatter={(v, n, p) => [formatCurrency(v), `${p.payload.payments} payment${p.payload.payments === 1 ? '' : 's'}`]}
                                contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                            <Bar dataKey="amount" fill="#2dd4bf" radius={[4, 4, 0, 0]} barSize={26} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#a1a1aa', margin: '0.6rem 0 0', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                    <Info size={13} style={{ flexShrink: 0, marginTop: '2px', color: '#71717a' }} />
                    Paid in {monthsWithIncome} of 12 months in {selectedYear}. Empty months are kept on
                    the chart deliberately — dividend income is lumpy, and hiding the silent months
                    would make it look like a salary.
                </p>
            </div>

            {lapsed.length > 0 && (
                <div style={{ ...card, marginBottom: '2rem', border: '1px solid rgba(251,191,36,0.22)', backgroundColor: 'rgba(251,191,36,0.05)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fbbf24', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={15} /> Stopped paying
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0 0 0.75rem' }}>
                        Still held, but no dividend for two years or more.
                    </p>
                    {lapsed.map((p) => (
                        <div key={p.id} onClick={() => open(p.id)} style={{
                            display: 'flex', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer',
                            padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem',
                        }}>
                            <span style={{ color: '#e4e4e7', fontWeight: 600 }}>{p.name}</span>
                            <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>last paid {p.lastPaid}</span>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0 }}>Payers, by yield on cost</h3>
                    <p style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.3rem 0 0' }}>
                        Against what you paid, not today's price — this is what your committed money
                        returns in cash, and it rises as payouts grow while your cost stays put.
                    </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={th()}>Holding</th>
                                <th style={th('right')}>Yield on cost</th>
                                <th style={th('right')}>Received</th>
                                <th style={th('right')}>Invested</th>
                                <th style={th('right')}>Years paid</th>
                                <th style={th('right')}>Payments</th>
                                <th style={th('right')}>Last</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payers.map((p) => (
                                <tr key={p.id} onClick={() => open(p.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ ...td(), fontWeight: 600 }}>
                                        {p.name}
                                        {!p.held && <span style={{ color: '#71717a', fontSize: '0.68rem', marginLeft: '0.5rem' }}>exited</span>}
                                    </td>
                                    <td style={{ ...td('right', '#2dd4bf'), fontFamily: 'monospace', fontWeight: 700 }}>{p.pct.toFixed(1)}%</td>
                                    <td style={{ ...td('right'), fontFamily: 'monospace' }}>{formatCurrency(p.total)}</td>
                                    <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>{formatCurrency(p.invested)}</td>
                                    <td style={{ ...td('right', p.consistency >= 100 ? '#34d399' : '#a1a1aa'), fontFamily: 'monospace' }}>
                                        {p.paidYears}/{p.spanYears}
                                    </td>
                                    <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>{p.payments}</td>
                                    <td style={{ ...td('right', p.lapsed ? '#fbbf24' : '#71717a'), fontFamily: 'monospace', fontSize: '0.72rem' }}>{p.lastPaid}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {payers.length === 0 && (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
                        No dividends recorded yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default DividendIncome;
