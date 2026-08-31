import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Coins, TrendingUp, TrendingDown, AlertTriangle, PieChart as PieIcon, Info, Gift } from 'lucide-react';
import {
    portfolioTotals, dividendsByYear, topDividendPayers,
    winnersAndLosers, concentration, unclassified, realisedOutliers
} from '../utils/stockAnalytics';
import { freePositions, nearlyFree, recoveryTotals, NEARLY_FREE_FROM } from '../utils/costRecovery';

const panel = {
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '1.25rem',
    padding: '1.5rem',
};

const label = {
    fontSize: '10px', fontWeight: 900, color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
};

const Row = ({ name, right, sub, tone }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', padding: '0.55rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
        <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
            {sub && <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#71717a' }}>{sub}</p>}
        </div>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: tone, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
);

/**
 * The analytics the holdings table cannot show: what the portfolio has actually
 * returned, where that return comes from, and where it is concentrated.
 *
 * Every figure is derived from the transaction history rather than the summary
 * fields stored on each stock, which are only rewritten when a holding is next
 * edited and can sit stale for months.
 */
const StockAnalyticsPanels = ({ stocks = [], formatCurrency, onSelectStock }) => {
    const totals = useMemo(() => portfolioTotals(stocks), [stocks]);
    const divYears = useMemo(() => dividendsByYear(stocks), [stocks]);
    const payers = useMemo(() => topDividendPayers(stocks, 5), [stocks]);
    const { winners, losers } = useMemo(() => winnersAndLosers(stocks, 5), [stocks]);
    const conc = useMemo(() => concentration(stocks, 5), [stocks]);
    const gaps = useMemo(() => unclassified(stocks), [stocks]);
    const outliers = useMemo(() => realisedOutliers(stocks), [stocks]);
    const free = useMemo(() => freePositions(stocks), [stocks]);
    const almost = useMemo(() => nearlyFree(stocks), [stocks]);
    const recovery = useMemo(() => recoveryTotals(stocks), [stocks]);

    const money = (n) => (formatCurrency ? formatCurrency(n) : `₹${Math.round(n).toLocaleString('en-IN')}`);
    const signed = (n) => `${n >= 0 ? '+' : ''}${money(n)}`;
    const tone = (n) => (n >= 0 ? '#34d399' : '#f87171');

    const divGrowth = divYears.length >= 2
        ? divYears[divYears.length - 1].amount - divYears[divYears.length - 2].amount
        : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* 1. Where the money actually came from */}
            <div style={panel}>
                <p style={{ ...label, marginBottom: '1rem' }}>Where your return comes from</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                    {[
                        { k: 'Unrealised', v: totals.unrealised, note: `${totals.heldCount} held · ${totals.unrealisedPct.toFixed(1)}%` },
                        { k: 'Realised', v: totals.realised, note: `${totals.exitedCount} positions closed` },
                        { k: 'Dividends', v: totals.dividends, note: `${totals.yieldOnCost.toFixed(1)}% yield on cost` },
                    ].map(({ k, v, note }) => (
                        <div key={k}>
                            <p style={label}>{k}</p>
                            <p style={{ margin: '0.35rem 0 0', fontSize: '1.6rem', fontWeight: 900, color: tone(v), fontFamily: 'monospace' }}>
                                {signed(v)}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#71717a' }}>{note}</p>
                        </div>
                    ))}
                </div>

                {/* A single imported position can be larger than the whole
                    portfolio, so the lifetime figure is shown with its cause
                    rather than as a bare headline. */}
                {outliers.length > 0 ? (
                    <div style={{
                        marginTop: '1.25rem', padding: '0.85rem 1rem', borderRadius: '0.85rem',
                        border: '1px solid rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.06)',
                        display: 'flex', gap: '0.65rem', alignItems: 'flex-start',
                    }}>
                        <AlertTriangle size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '1px' }} />
                        <div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#fbbf24', fontWeight: 700 }}>
                                Lifetime {signed(totals.lifetime)} — dominated by one position
                            </p>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                                {outliers.map(o => `${o.name} (${signed(o.realised)})`).join(', ')} — larger than the
                                entire current portfolio. Worth checking against your broker statement before reading
                                anything into the lifetime total.
                            </p>
                        </div>
                    </div>
                ) : (
                    <p style={{ margin: '1.25rem 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
                        Lifetime return: <strong style={{ color: tone(totals.lifetime), fontFamily: 'monospace' }}>{signed(totals.lifetime)}</strong>
                    </p>
                )}
            </div>

            {/* 2. Dividends */}
            {divYears.length > 0 && (
                <div style={panel}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <p style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Coins size={13} style={{ color: '#fbbf24' }} /> Dividend income
                        </p>
                        <span style={{ fontSize: '0.72rem', color: divGrowth >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            {divGrowth >= 0 ? '▲' : '▼'} {money(Math.abs(divGrowth))} vs last year
                        </span>
                    </div>

                    <div style={{ height: 170, marginBottom: '1rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={divYears} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                <XAxis dataKey="year" stroke="#52525b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis stroke="#52525b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55}
                                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '0.8rem' }}
                                    formatter={(v) => [money(v), 'Received']}
                                />
                                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                    {divYears.map((d, i) => (
                                        <Cell key={d.year} fill={i === divYears.length - 1 ? '#fbbf24' : 'rgba(251,191,36,0.35)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <p style={{ ...label, marginBottom: '0.35rem' }}>Who pays it</p>
                    {payers.map((s) => (
                        <Row key={s.id} name={s.name} sub={s.ticker} right={money(s.dividends)} tone="#fbbf24" />
                    ))}
                </div>
            )}

            {/* 3. Winners and losers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div style={panel}>
                    <p style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        <TrendingUp size={13} style={{ color: '#34d399' }} /> Driving the gains
                    </p>
                    {winners.length === 0
                        ? <p style={{ fontSize: '0.78rem', color: '#71717a', margin: 0 }}>No holdings are up.</p>
                        : winners.map((s) => (
                            <Row key={s.id} name={s.name} sub={`${s.shares} sh · ${s.unrealisedPct.toFixed(0)}%`}
                                right={signed(s.unrealised)} tone="#34d399" />
                        ))}
                </div>
                <div style={panel}>
                    <p style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        <TrendingDown size={13} style={{ color: '#f87171' }} /> Weighing it down
                    </p>
                    {losers.length === 0
                        ? <p style={{ fontSize: '0.78rem', color: '#71717a', margin: 0 }}>No holdings are down.</p>
                        : losers.map((s) => (
                            <Row key={s.id} name={s.name} sub={`${s.shares} sh · ${s.unrealisedPct.toFixed(0)}%`}
                                right={signed(s.unrealised)} tone="#f87171" />
                        ))}
                </div>
            </div>

            {/* 4. Concentration */}
            <div style={panel}>
                <p style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                    <PieIcon size={13} style={{ color: '#818cf8' }} /> Concentration
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <p style={label}>Top 5 holdings</p>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: conc.topShare > 50 ? '#fbbf24' : '#e4e4e7' }}>
                            {conc.topShare.toFixed(1)}%
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#71717a' }}>of {conc.count} holdings</p>
                    </div>
                    <div>
                        <p style={label}>Largest single</p>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: conc.largestHoldingShare > 20 ? '#fbbf24' : '#e4e4e7' }}>
                            {conc.largestHoldingShare.toFixed(1)}%
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#71717a' }}>{conc.largestHolding?.name || '—'}</p>
                    </div>
                    <div>
                        <p style={label}>Largest sector</p>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: conc.largestSectorShare > 35 ? '#fbbf24' : '#e4e4e7' }}>
                            {conc.largestSectorShare.toFixed(1)}%
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#71717a' }}>{conc.largestSector || '—'}</p>
                    </div>
                </div>
                {conc.top.map((s) => (
                    <Row key={s.id} name={s.name}
                        sub={`${s.sector} · ${((s.value / conc.total) * 100).toFixed(1)}%`}
                        right={money(s.value)} tone="#e4e4e7" />
                ))}
            </div>

            {/* 5. Cost already taken back off the table */}
            {(free.length > 0 || almost.length > 0) && (
                <div style={{ ...panel, border: '1px solid rgba(52,211,153,0.22)', backgroundColor: 'rgba(52,211,153,0.04)' }}>
                    <p style={{ ...label, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <Gift size={13} /> Cost recovered
                    </p>
                    <p style={{ margin: '0 0 0.85rem', fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                        Selling part of a position, plus the dividends it has paid, can return
                        everything that was put in. What is still held then costs nothing —
                        a fact average-cost accounting cannot express, because it keeps those
                        shares at their original price.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '0.85rem' }}>
                        <div>
                            <p style={label}>Your money still at risk</p>
                            <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: '#e4e4e7' }}>
                                {money(recovery.stillAtRisk)}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.68rem', color: '#71717a' }}>
                                of {money(recovery.invested)} invested
                            </p>
                        </div>
                        <div>
                            <p style={label}>Held at no cost</p>
                            <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: '#34d399' }}>
                                {money(recovery.freeValue)}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.68rem', color: '#71717a' }}>
                                across {recovery.freeCount} position{recovery.freeCount === 1 ? '' : 's'}
                                {recovery.bonusShares > 0 ? ` · ${recovery.bonusShares} bonus shares` : ''}
                            </p>
                        </div>
                    </div>

                    {free.map((r) => (
                        <Row key={r.id} name={r.name}
                            sub={`${money(r.invested)} in, ${money(r.recovered)} back${r.dividends > 0 ? ` (incl. ${money(r.dividends)} dividends)` : ''} · ${r.shares} shares free${r.surplus > 0 ? ` · ${money(r.surplus)} surplus` : ''}`}
                            right={money(r.value)} tone="#34d399" />
                    ))}

                    {almost.map((r) => (
                        <Row key={r.id} name={r.name}
                            sub={`${r.rawPct.toFixed(0)}% recovered · ${money(r.outstandingCost)} still at risk · net ${money(r.netCostPerShare)}/share`}
                            right={money(r.value)} tone="#a1a1aa" />
                    ))}

                    {almost.length > 0 && (
                        <p style={{ margin: '0.75rem 0 0', fontSize: '0.68rem', color: '#71717a' }}>
                            Rows below the first group are past {NEARLY_FREE_FROM}% recovered but not
                            yet free — still your own money in the market.
                        </p>
                    )}
                </div>
            )}

            {/* 6. Gaps that distort everything above */}
            {gaps.any && (
                <div style={{ ...panel, border: '1px solid rgba(251,191,36,0.2)', backgroundColor: 'rgba(251,191,36,0.04)' }}>
                    <p style={{ ...label, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <Info size={13} /> Gaps in the numbers above
                    </p>
                    <p style={{ margin: '0 0 0.85rem', fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                        These holdings are missing something the charts rely on, so the percentages
                        are off by exactly this much.
                    </p>
                    {gaps.noPrice.length > 0 && (
                        <Row name={`${gaps.noPrice.length} holding${gaps.noPrice.length > 1 ? 's' : ''} with no current price`}
                            sub={`${gaps.noPrice.map(s => s.name).join(', ')} — excluded from gains, not counted as losses`}
                            right={`${money(gaps.noPriceCost)} at cost`} tone="#fbbf24" />
                    )}
                    {gaps.noCap.length > 0 && (
                        <Row name={`${gaps.noCap.length} with no market cap`}
                            sub={gaps.noCap.map(s => s.name).join(', ')}
                            right={money(gaps.noCapValue)} tone="#fbbf24" />
                    )}
                    {gaps.noSector.length > 0 && (
                        <Row name={`${gaps.noSector.length} with no sector`}
                            sub={gaps.noSector.map(s => s.name).join(', ')}
                            right={money(gaps.noSectorValue)} tone="#fbbf24" />
                    )}
                </div>
            )}
        </div>
    );
};

export default StockAnalyticsPanels;
