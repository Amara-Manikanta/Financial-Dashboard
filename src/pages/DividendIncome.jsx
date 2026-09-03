import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Coins, AlertTriangle, Info, CalendarDays, Receipt } from 'lucide-react';
import BackButton from '../components/BackButton';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
    incomeByYear, incomeByMonth, incomeSummary, dividendPayers, lapsedPayers,
    dividendCalendar, busiestMonths,
} from '../utils/dividendAnalytics';
import { dividendTaxSummary } from '../utils/dividendTax';

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
    const calendar = useMemo(() => dividendCalendar(stocks), [stocks]);
    const busiest = useMemo(() => busiestMonths(stocks), [stocks]);

    const latestYear = years.length ? years[years.length - 1].year : String(new Date().getFullYear());
    const [selectedYear, setSelectedYear] = useState(latestYear);
    const months = useMemo(() => incomeByMonth(stocks, selectedYear), [stocks, selectedYear]);

    const tax = useMemo(() => dividendTaxSummary(stocks), [stocks]);

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

            {/* Tax withheld. Placed above the income figures on purpose: if any
                of them is net of TDS, every number below it is understated. */}
            <div style={{ ...card, marginBottom: '2rem', border: '1px solid rgba(45,212,191,0.22)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <p style={{ ...label, color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Receipt size={13} /> Tax withheld on dividends
                        </p>
                        <p style={{ fontSize: '0.78rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '70ch', lineHeight: 1.6 }}>
                            Since 2020 a dividend is taxed in your hands and the payer withholds part of it
                            first, so what reaches the bank is less than what was declared. The difference is
                            claimable against your own tax.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            <p style={label}>Gross, all time</p>
                            <p style={{ fontSize: '1.35rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0' }}>
                                {formatCurrency(tax.lifetimeGross)}
                            </p>
                        </div>
                        <div>
                            <p style={label}>TDS recorded</p>
                            <p style={{ fontSize: '1.35rem', fontWeight: 900, color: tax.lifetimeTds > 0 ? '#2dd4bf' : '#52525b', fontFamily: 'monospace', margin: '0.25rem 0 0' }}>
                                {formatCurrency(tax.lifetimeTds)}
                            </p>
                        </div>
                        <div>
                            <p style={label}>Net received</p>
                            <p style={{ fontSize: '1.35rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0' }}>
                                {formatCurrency(tax.lifetimeNet)}
                            </p>
                        </div>
                    </div>
                </div>

                {tax.needsChecking.length > 0 && (
                    <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '0.85rem', border: '1px solid rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.05)' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fbbf24', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <AlertTriangle size={14} /> {tax.needsChecking.length} payout{tax.needsChecking.length === 1 ? '' : 's'} where tax was probably withheld but none is recorded
                        </p>
                        <p style={{ fontSize: '0.73rem', color: '#a1a1aa', margin: '0.5rem 0 0.75rem', lineHeight: 1.6, maxWidth: '80ch' }}>
                            A REIT or InvIT withholds 10% from the first rupee — there is no threshold, which is
                            why a small distribution can show tax while a much larger ordinary dividend shows
                            none. An ordinary company withholds only above ₹10,000 from that one company in a
                            financial year (₹5,000 before FY 2025-26). Check the payout advice and enter the
                            figure on the transaction; nothing here guesses it, because the split of a REIT
                            distribution across interest, rent and dividend is set by the trust per payout.
                        </p>
                        {tax.needsChecking.map((r) => (
                            <div key={`${r.holdingId}-${r.fy}`}
                                onClick={() => open(r.holdingId)}
                                style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                                <span style={{ fontSize: '0.76rem', color: '#e4e4e7' }}>
                                    {r.name}
                                    <span style={{
                                        marginLeft: '0.5rem', padding: '0.1rem 0.4rem', borderRadius: '0.3rem',
                                        backgroundColor: r.isTrust ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.05)',
                                        color: r.isTrust ? '#818cf8' : '#71717a', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase',
                                    }}>
                                        {r.isTrust ? 'REIT / InvIT — no threshold' : `over ${formatCurrency(r.threshold)}`}
                                    </span>
                                </span>
                                <span style={{ fontSize: '0.76rem', color: '#a1a1aa', fontFamily: 'monospace' }}>
                                    FY {r.fy} · {formatCurrency(r.gross)} across {r.payments} payment{r.payments === 1 ? '' : 's'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {tax.years.length > 0 && (
                    <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <th style={th()}>Financial year</th>
                                    <th style={th('right')}>Gross</th>
                                    <th style={th('right')}>TDS</th>
                                    <th style={th('right')}>Net</th>
                                    <th style={th('right')}>Effective rate</th>
                                    <th style={th('right')}>Payments</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tax.years.map((y) => (
                                    <tr key={y.fy} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ ...td(), fontWeight: 700 }}>
                                            {y.fy}
                                            {y.fy === tax.currentFy && (
                                                <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem', color: '#2dd4bf', fontWeight: 900, textTransform: 'uppercase' }}>current</span>
                                            )}
                                        </td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace' }}>{formatCurrency(y.gross)}</td>
                                        <td style={{ ...td('right', y.tds > 0 ? '#2dd4bf' : '#52525b'), fontFamily: 'monospace' }}>
                                            {y.tds > 0 ? formatCurrency(y.tds) : '—'}
                                        </td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace' }}>{formatCurrency(y.net)}</td>
                                        <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace', fontSize: '0.74rem' }}>
                                            {y.gross > 0 ? `${y.effectiveRate.toFixed(1)}%` : '—'}
                                        </td>
                                        <td style={{ ...td('right', '#71717a'), fontFamily: 'monospace', fontSize: '0.74rem' }}>
                                            {y.payments} from {y.companies}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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

            <div style={{ ...card, marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CalendarDays size={16} style={{ color: '#2dd4bf' }} /> When dividends arrive
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0 0 1.1rem', maxWidth: '78ch', lineHeight: 1.55 }}>
                    Which months your holdings have paid in, and the average that arrived in each.
                    A description of what has happened, not a forecast — boards declare dividends,
                    and nothing here assumes last year's will repeat.
                    {busiest.length > 0 && (
                        <> Busiest historically: <strong style={{ color: '#2dd4bf' }}>
                            {busiest.slice(0, 3).map((m) => m.name).join(', ')}
                        </strong>.</>
                    )}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem' }}>
                    {calendar.map((m) => {
                        const quiet = m.payments === 0;
                        return (
                            <div key={m.month} style={{
                                border: `1px solid ${quiet ? 'rgba(255,255,255,0.05)' : 'rgba(45,212,191,0.2)'}`,
                                backgroundColor: quiet ? 'rgba(255,255,255,0.015)' : 'rgba(45,212,191,0.05)',
                                borderRadius: '0.9rem', padding: '0.85rem 1rem', opacity: quiet ? 0.5 : 1,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: quiet ? '#52525b' : '#2dd4bf' }}>
                                        {m.name.slice(0, 3)}
                                    </span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: quiet ? '#52525b' : '#e4e4e7' }}>
                                        {quiet ? '—' : formatCurrency(m.typicalTotal)}
                                    </span>
                                </div>
                                {!quiet && (
                                    <>
                                        <p style={{ margin: '0.3rem 0 0.4rem', fontSize: '0.65rem', color: '#71717a' }}>
                                            {m.payers.length} payer{m.payers.length === 1 ? '' : 's'} · {m.payments} payment{m.payments === 1 ? '' : 's'}
                                        </p>
                                        {m.payers.slice(0, 3).map((p) => (
                                            <div key={p.id} style={{ fontSize: '0.66rem', color: p.held ? '#a1a1aa' : '#52525b', display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.name}{!p.held && ' (exited)'}
                                                </span>
                                                <span style={{ fontFamily: 'monospace', flexShrink: 0 }}>{formatCurrency(p.averagePerYear)}</span>
                                            </div>
                                        ))}
                                        {m.payers.length > 3 && (
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.62rem', color: '#52525b' }}>
                                                +{m.payers.length - 3} more
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
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
