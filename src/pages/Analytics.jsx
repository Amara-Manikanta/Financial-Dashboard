import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    TrendingUp, TrendingDown, AlertTriangle, Info, Shuffle, Target, Zap, ArrowRight,
} from 'lucide-react';
import BackButton from '../components/BackButton';
import {
    spendingOverview, categoryMovers, categoryTrends, spendingOutliers, concentration,
} from '../utils/spendingAnalytics';

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
    padding: '0.7rem 1rem', textAlign: align, fontSize: '9px', fontWeight: 900,
    color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em',
});

const td = (align = 'left', color = '#e4e4e7') => ({
    padding: '0.7rem 1rem', textAlign: align, fontSize: '0.8rem', color,
});

const compact = (n) => {
    const v = Math.abs(Number(n) || 0);
    if (v >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${Math.round(n / 1000)}k`;
    return `₹${Math.round(n)}`;
};

const titleCase = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Analytics that answer a question.
 *
 * This page used to be four bar charts of the same totals sliced four ways, on
 * figures that counted credit-card settlements and SIP transfers as spending.
 * Both problems are fixed here: every number is real consumption (see
 * transactionKind.js), and the page leads with what *changed* rather than with
 * a chart of what you already know you spent.
 */
const Analytics = () => {
    const navigate = useNavigate();
    const { expenses, categoryKinds, formatCurrency } = useFinance();

    const [moverMonth, setMoverMonth] = useState(null);
    const [windowMonths, setWindowMonths] = useState(12);

    const overview = useMemo(
        () => spendingOverview(expenses || {}, categoryKinds || {}),
        [expenses, categoryKinds],
    );

    const targetMonth = moverMonth || overview?.lastComplete?.month || null;

    const movers = useMemo(
        () => categoryMovers(expenses || {}, categoryKinds || {}, { month: targetMonth, baselineMonths: 6 }),
        [expenses, categoryKinds, targetMonth],
    );

    const conc = useMemo(
        () => concentration(expenses || {}, categoryKinds || {}, windowMonths),
        [expenses, categoryKinds, windowMonths],
    );

    const trends = useMemo(
        () => categoryTrends(expenses || {}, categoryKinds || {}, windowMonths),
        [expenses, categoryKinds, windowMonths],
    );

    const outliers = useMemo(
        () => spendingOutliers(expenses || {}, categoryKinds || {}, { sinceMonths: windowMonths }),
        [expenses, categoryKinds, windowMonths],
    );

    // Every hook above runs before this return — a page that bails early on a
    // hook boundary dies with "Rendered more hooks than during the previous
    // render" the moment the data arrives.
    if (!overview) {
        return (
            <div style={{ padding: '2rem' }}>
                <BackButton label="Back to Expenses" />
                <p style={{ color: '#71717a' }}>No transactions to analyse yet.</p>
            </div>
        );
    }

    const chartData = overview.series.slice(-Math.max(windowMonths, 6)).map((m) => ({
        month: m.month,
        Spending: m.netSpend,
        Income: m.income,
        Surplus: m.surplus,
    }));

    const monthOptions = overview.complete.slice(-18).map((m) => m.month).reverse();
    const notable = movers.rows.filter((r) => Math.abs(r.change) >= 500).slice(0, 12);
    const drifting = trends.filter((t) => t.activeMonths >= 4 && Math.abs(t.change) >= 500);
    const risingCount = drifting.filter((t) => t.direction === 'up').length;

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <BackButton label="Back to Expenses" />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                        Spending Analysis
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '72ch', lineHeight: 1.6 }}>
                        Real consumption only — card bills and money moved into savings are excluded, because
                        both were already counted as the purchases and the holdings they became. Every
                        "normal" here is a median month, not an average: one ₹98,000 camera should not
                        become part of your usual electronics budget.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/money-flow')}
                    style={{
                        padding: '0.625rem 1.1rem', borderRadius: '0.875rem', border: '1px solid rgba(129,140,248,0.3)',
                        backgroundColor: 'rgba(129,140,248,0.15)', color: '#818cf8', fontSize: '12px', fontWeight: 'bold',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}
                >
                    <Shuffle size={15} /> Classify categories
                </button>
            </div>

            {/* Headline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={card}>
                    <p style={label}>Normal month</p>
                    <p style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(overview.normalSpend)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>median of the last 6 complete months</p>
                </div>
                <div style={card}>
                    <p style={label}>Last complete month</p>
                    <p style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(overview.lastComplete?.netSpend)}
                    </p>
                    {overview.lastVsNormal && (
                        <p style={{
                            fontSize: '0.7rem', margin: '0.25rem 0 0', fontWeight: 700,
                            color: overview.lastVsNormal.change > 0 ? '#f87171' : '#34d399',
                        }}>
                            {overview.lastVsNormal.change > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(overview.lastVsNormal.change))}
                            {' '}({Math.abs(overview.lastVsNormal.pct).toFixed(0)}%) vs normal
                        </p>
                    )}
                </div>
                <div style={card}>
                    <p style={label}>Normal income</p>
                    <p style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.35rem 0 0' }}>
                        {formatCurrency(overview.normalIncome)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        from months that recorded one
                    </p>
                </div>
                <div style={card}>
                    <p style={label}>Savings rate</p>
                    <p style={{
                        fontSize: '1.6rem', fontWeight: 900, fontFamily: 'monospace', margin: '0.35rem 0 0',
                        color: overview.medianSavingsRate === null ? '#52525b'
                            : overview.medianSavingsRate >= 0 ? '#34d399' : '#f87171',
                    }}>
                        {overview.medianSavingsRate === null ? '—' : `${overview.medianSavingsRate.toFixed(0)}%`}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                        median across {overview.monthsWithIncome} usable months
                    </p>
                </div>
            </div>

            {/* The data gap, stated before anything is read off the numbers above */}
            {overview.monthsMissingIncome.length > 0 && (
                <div style={{ ...card, marginBottom: '1.5rem', border: '1px solid rgba(251,191,36,0.22)', backgroundColor: 'rgba(251,191,36,0.04)' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fbbf24', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <AlertTriangle size={14} /> {overview.monthsMissingIncome.length} of the last 12 months have no salary recorded
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0.5rem 0 0', lineHeight: 1.6, maxWidth: '82ch' }}>
                        {overview.monthsMissingIncome.join(', ')}. Those months are left out of the savings
                        rate rather than counted as months you earned nothing — a rate computed against a
                        missing salary is arithmetic on a gap. Spending figures are unaffected.
                    </p>
                </div>
            )}

            {/* What changed — the centrepiece */}
            <div style={{ ...card, marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Zap size={17} style={{ color: '#fbbf24' }} /> What changed
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: '#71717a', margin: '0.4rem 0 0', maxWidth: '80ch', lineHeight: 1.6 }}>
                            Each category against its own median over {movers.baseline.length} earlier months.
                            A ranking by size would tell you rent is expensive, which you know. This tells you
                            what moved.
                        </p>
                    </div>
                    <select
                        value={targetMonth || ''}
                        onChange={(e) => setMoverMonth(e.target.value)}
                        style={{ backgroundColor: '#18181b', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.6rem', padding: '0.45rem 0.7rem', fontSize: '0.78rem' }}
                    >
                        {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {notable.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#71717a', margin: '1rem 0 0' }}>
                        Nothing moved by more than ₹500 against its normal — an unusually steady month.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <th style={th()}>Category</th>
                                    <th style={th('right')}>This month</th>
                                    <th style={th('right')}>Normal</th>
                                    <th style={th('right')}>Change</th>
                                    <th style={th()}>&nbsp;</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notable.map((r) => {
                                    const up = r.change > 0;
                                    return (
                                        <tr key={r.category} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ ...td(), fontWeight: 600 }}>
                                                {titleCase(r.category)}
                                                {r.isNew && (
                                                    <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', backgroundColor: 'rgba(129,140,248,0.15)', color: '#818cf8', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                                        New
                                                    </span>
                                                )}
                                                {r.stopped && (
                                                    <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', backgroundColor: 'rgba(255,255,255,0.06)', color: '#71717a', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                                        Stopped
                                                    </span>
                                                )}
                                                {!r.establishedBaseline && !r.isNew && (
                                                    <span
                                                        title={`Only seen in ${r.monthsSeen} of the ${r.baselineMonths} baseline months, so "normal" is a thin figure here.`}
                                                        style={{ marginLeft: '0.5rem', color: '#52525b', fontSize: '0.62rem' }}
                                                    >
                                                        thin baseline
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ ...td('right'), fontFamily: 'monospace' }}>{formatCurrency(r.current)}</td>
                                            <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>{formatCurrency(r.normal)}</td>
                                            <td style={{ ...td('right', up ? '#f87171' : '#34d399'), fontFamily: 'monospace', fontWeight: 700 }}>
                                                {up ? '+' : '−'}{formatCurrency(Math.abs(r.change))}
                                            </td>
                                            <td style={td()}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}>
                                                    <div style={{ flex: 1, height: '5px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                                                        <div style={{
                                                            position: 'absolute', top: 0, bottom: 0,
                                                            left: up ? '50%' : undefined, right: up ? undefined : '50%',
                                                            width: `${Math.min(50, (Math.abs(r.change) / Math.max(1, Math.abs(notable[0].change))) * 50)}%`,
                                                            backgroundColor: up ? '#f87171' : '#34d399',
                                                        }} />
                                                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.66rem', color: '#71717a', fontFamily: 'monospace', minWidth: '46px', textAlign: 'right' }}>
                                                        {r.changePct === null ? '—' : `${r.changePct > 0 ? '+' : ''}${Math.round(r.changePct)}%`}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Window selector */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ ...label, marginRight: '0.3rem' }}>Window</span>
                {[6, 12, 24, 36].map((w) => (
                    <button
                        key={w}
                        onClick={() => setWindowMonths(w)}
                        style={{
                            padding: '0.4rem 0.85rem', borderRadius: '0.65rem', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                            backgroundColor: windowMonths === w ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${windowMonths === w ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                            color: windowMonths === w ? 'white' : '#71717a',
                        }}
                    >
                        {w} months
                    </button>
                ))}
            </div>

            {/* Income vs spending */}
            <div style={{ ...card, marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'white', margin: '0 0 0.3rem' }}>Income against real spending</h3>
                <p style={{ fontSize: '0.74rem', color: '#71717a', margin: '0 0 1rem' }}>
                    The gap between the bars is the month's surplus. Months with no salary row show only a
                    spending bar.
                </p>
                <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 10 }} stroke="rgba(255,255,255,0.08)" minTickGap={20} />
                            <YAxis tickFormatter={compact} tick={{ fill: '#71717a', fontSize: 10 }} stroke="rgba(255,255,255,0.08)" width={58} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(24,24,27,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '12px' }}
                                formatter={(v, n) => [formatCurrency(v), n]}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="Income" fill="#34d399" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Spending" fill="#f87171" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
                            <Line type="monotone" dataKey="Surplus" stroke="#818cf8" strokeWidth={2} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                {/* Concentration */}
                <div style={card}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'white', margin: '0 0 0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Target size={16} style={{ color: '#818cf8' }} /> Where it actually goes
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: '#71717a', margin: '0 0 1rem', lineHeight: 1.6 }}>
                        Over {conc.months} months, {formatCurrency(conc.total)} across {conc.categoryCount} categories.
                        The top five are <strong style={{ color: '#d4d4d8' }}>{conc.topFiveShare.toFixed(0)}%</strong> of
                        it, and {conc.categoriesTo80} categories cover 80% — the rest is noise for the purposes
                        of changing anything.
                    </p>
                    {conc.rows.slice(0, 10).map((r) => (
                        <div key={r.category} style={{ marginBottom: '0.7rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.78rem', color: '#d4d4d8' }}>{titleCase(r.category)}</span>
                                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontFamily: 'monospace' }}>
                                    {formatCurrency(r.perMonth)}<span style={{ color: '#52525b' }}>/mo · {r.share.toFixed(1)}%</span>
                                </span>
                            </div>
                            <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${r.share}%`, backgroundColor: '#818cf8', opacity: 0.7 }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Drift */}
                <div style={card}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'white', margin: '0 0 0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={16} style={{ color: '#f87171' }} /> Drifting categories
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: '#71717a', margin: '0 0 1rem', lineHeight: 1.6 }}>
                        The median of the recent half of the window against the median of the earlier half.
                        {risingCount > 0 && ` ${risingCount} categories are running higher than they were.`}
                        {' '}A single month never shows this; a slow creep only appears against a year.
                    </p>
                    {drifting.length === 0 ? (
                        <p style={{ fontSize: '0.78rem', color: '#71717a' }}>Nothing has drifted by more than ₹500 a month.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        <th style={th()}>Category</th>
                                        <th style={th('right')}>Was</th>
                                        <th style={th('right')}>Now</th>
                                        <th style={th('right')}>Change</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drifting.slice(0, 10).map((t) => (
                                        <tr key={t.category} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ ...td(), fontWeight: 600 }}>{titleCase(t.category)}</td>
                                            <td style={{ ...td('right', '#a1a1aa'), fontFamily: 'monospace' }}>{formatCurrency(t.before)}</td>
                                            <td style={{ ...td('right'), fontFamily: 'monospace' }}>{formatCurrency(t.after)}</td>
                                            <td style={{ ...td('right', t.direction === 'up' ? '#f87171' : '#34d399'), fontFamily: 'monospace', fontWeight: 700 }}>
                                                {t.direction === 'up' ? <TrendingUp size={11} style={{ display: 'inline', marginRight: 3 }} /> : <TrendingDown size={11} style={{ display: 'inline', marginRight: 3 }} />}
                                                {t.change > 0 ? '+' : '−'}{formatCurrency(Math.abs(t.change))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Outliers */}
            <div style={card}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'white', margin: '0 0 0.3rem' }}>Unusual purchases</h3>
                <p style={{ fontSize: '0.74rem', color: '#71717a', margin: '0 0 1rem', maxWidth: '82ch', lineHeight: 1.6 }}>
                    Single transactions at least four times the median transaction in their own category, over
                    the last {windowMonths} months. Compared per category so a large flight is not flagged
                    alongside a large coffee — and categories with fewer than five transactions are skipped,
                    because with three examples everything looks exceptional.
                </p>
                {outliers.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: '#71717a' }}>Nothing stands out in this window.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <th style={th()}>Date</th>
                                    <th style={th()}>What</th>
                                    <th style={th()}>Category</th>
                                    <th style={th('right')}>Amount</th>
                                    <th style={th('right')}>Typical</th>
                                    <th style={th('right')}>Ratio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outliers.slice(0, 12).map((o) => (
                                    <tr key={`${o.id}-${o.date}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ ...td('left', '#a1a1aa'), fontFamily: 'monospace', fontSize: '0.74rem' }}>{o.date}</td>
                                        <td style={{ ...td(), fontWeight: 600 }}>{o.title}</td>
                                        <td style={td('left', '#71717a')}>{titleCase(o.category)}</td>
                                        <td style={{ ...td('right'), fontFamily: 'monospace', fontWeight: 700 }}>{formatCurrency(o.amount)}</td>
                                        <td style={{ ...td('right', '#71717a'), fontFamily: 'monospace', fontSize: '0.74rem' }}>{formatCurrency(o.typical)}</td>
                                        <td style={{ ...td('right', '#fbbf24'), fontFamily: 'monospace', fontWeight: 700 }}>{o.timesTypical.toFixed(1)}×</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p style={{ fontSize: '0.72rem', color: '#52525b', margin: '1.25rem 0 0', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', maxWidth: '86ch', lineHeight: 1.6 }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                A refund only counts against spending up to what was spent in that category that month. A
                credit larger than the debits it is supposedly reversing is money arriving for another
                reason, and netting it off erased whole months of spending before this rule existed.
                <button
                    onClick={() => navigate('/money-flow')}
                    style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                >
                    Classify categories <ArrowRight size={11} />
                </button>
            </p>
        </div>
    );
};

export default Analytics;
