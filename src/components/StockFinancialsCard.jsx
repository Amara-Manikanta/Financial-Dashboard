import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { AlertTriangle, Shield, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';
import { GLOSSARY, CHECK_HELP, debtRatio, isMissingDebtData } from '../utils/financialGlossary';

// Client-side cache to avoid refetching across pages/components within the session
const clientCache = new Map();

/**
 * A compact badge showing just the 🟢/🟡/🔴 signal on table rows or cards.
 */
export const StockHealthBadge = ({ symbol, onClick }) => {
    const [signal, setSignal] = useState(() => clientCache.get(symbol)?.signal || null);

    useEffect(() => {
        if (!symbol) return;
        if (clientCache.has(symbol)) {
            setSignal(clientCache.get(symbol).signal);
            return;
        }
        let cancelled = false;
        fetch(`${API_URL}/api/stock-financials?symbol=${encodeURIComponent(symbol)}`)
            .then(r => r.json())
            .then(json => {
                if (!cancelled && json?.signal) {
                    clientCache.set(symbol, json);
                    setSignal(json.signal);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [symbol]);

    if (!signal) return null;

    return (
        <span
            onClick={onClick}
            title={signal.reasons?.join(' · ') || signal.label}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.125rem 0.45rem',
                borderRadius: '0.375rem',
                fontSize: '9px',
                fontWeight: '800',
                letterSpacing: '0.03em',
                backgroundColor: `${signal.color}18`,
                border: `1px solid ${signal.color}38`,
                color: signal.color,
                cursor: onClick ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
            }}
        >
            <span>{signal.icon}</span>
            <span>{signal.label}</span>
        </span>
    );
};

/**
 * Quarterly business results, fundamental health scorecard, and buy/sell signal.
 *
 * Purely additive — reads from /api/stock-financials, writes nothing. The data
 * is cached server-side for 12 hours, so mounting this component 50 times in a
 * day only hits Yahoo Finance once.
 *
 * Props:
 *   symbol  — Yahoo Finance symbol, e.g. "INFY.NS" or "TATACONSUM.NS"
 *   name    — Display name, e.g. "Infosys Limited"
 *   compact — If true, renders a smaller version suitable for watchlist cards
 */
const StockFinancialsCard = ({ symbol, name, compact = false }) => {
    const [data, setData] = useState(() => clientCache.get(symbol) || null);
    const [loading, setLoading] = useState(!clientCache.has(symbol));
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(!compact);

    useEffect(() => {
        if (!symbol) return;
        if (clientCache.has(symbol)) {
            setData(clientCache.get(symbol));
            setLoading(false);
            return;
        }
        let cancelled = false;
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_URL}/api/stock-financials?symbol=${encodeURIComponent(symbol)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!cancelled) {
                    if (json.error) {
                        setError(json.error);
                    } else {
                        clientCache.set(symbol, json);
                        setData(json);
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [symbol]);

    if (loading) {
        return (
            <div style={{
                ...panelStyle,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.6rem', padding: compact ? '0.75rem' : '2rem',
            }}>
                <Activity size={14} style={{ color: '#818cf8', animation: 'spin 1.5s linear infinite' }} />
                <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Analyzing business fundamentals…</span>
            </div>
        );
    }

    if (error) {
        const isFundOrEtf = /BEES|ETF|GOLD|SILVER|REIT|NIFTY|SGB/i.test(symbol || '') || /BEES|ETF|GOLD|REIT/i.test(name || '');
        return (
            <div style={{ ...panelStyle, padding: compact ? '0.6rem 0.8rem' : '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={13} style={{ color: isFundOrEtf ? '#71717a' : '#fbbf24' }} />
                    <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>
                        {isFundOrEtf
                            ? `Quarterly results not applicable for ${name || symbol} (ETF/REIT/Fund)`
                            : `Business data unavailable for ${name || symbol}`}
                    </span>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { quarterly, fundamentals, healthScore, signal } = data;

    // Compact mode: just the signal badge + health score
    if (compact && !expanded) {
        return (
            <div
                onClick={() => setExpanded(true)}
                style={{
                    ...panelStyle,
                    padding: '0.7rem 1rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '0.5rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {signal && (
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 800, color: signal.color,
                            padding: '0.15rem 0.5rem', borderRadius: '0.4rem',
                            backgroundColor: `${signal.color}18`, border: `1px solid ${signal.color}33`,
                        }}>
                            {signal.icon} {signal.label}
                        </span>
                    )}
                    {healthScore && (
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700, color: healthScore.color,
                        }}>
                            {healthScore.total}/{healthScore.max}
                        </span>
                    )}
                </div>
                <ChevronDown size={13} style={{ color: '#71717a' }} />
            </div>
        );
    }

    // Build chart data: convert to crores for Indian stocks
    const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO');
    const chartData = (quarterly || []).map(q => ({
        name: q.date,
        revenue: isIndian ? +(q.revenue / 1e7).toFixed(0) : +(q.revenue / 1e9).toFixed(2),
        profit: isIndian ? +(q.earnings / 1e7).toFixed(0) : +(q.earnings / 1e9).toFixed(2),
        margin: +q.profitMargin.toFixed(1),
    }));

    const unit = isIndian ? '₹ Cr' : '$B';

    // 'unknown' is its own state, not a failure: a figure the source does not
    // report is a gap in the data, and colouring it red would read as a verdict
    // on the company rather than on what is known about it.
    const statusColor = (s) => (
        s === 'good' ? '#34d399'
            : s === 'caution' ? '#fbbf24'
                : s === 'unknown' ? '#71717a'
                    : '#f87171'
    );
    const statusIcon = (s) => (
        s === 'good' ? '✓'
            : s === 'caution' ? '!'
                : s === 'unknown' ? '?'
                    : '✕'
    );

    return (
        <div style={{ ...panelStyle, padding: compact ? '1rem' : '1.5rem' }}>
            {/* Header: Signal + Health Score */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                alignItems: 'center', gap: '0.75rem', marginBottom: '1rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        padding: '0.35rem', borderRadius: '0.6rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        color: '#818cf8', display: 'flex', alignItems: 'center',
                    }}>
                        <Activity size={16} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 900, color: 'white' }}>
                            Business Health
                        </p>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '0.65rem', color: '#71717a' }}>
                            Last 4 quarters · auto-refreshed every 12h
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {/* Health Score Badge */}
                    {healthScore && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.3rem 0.7rem', borderRadius: '0.6rem',
                            backgroundColor: `${healthScore.color}12`,
                            border: `1px solid ${healthScore.color}33`,
                        }}>
                            <Shield size={13} style={{ color: healthScore.color }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 900, fontFamily: 'monospace', color: healthScore.color }}>
                                {healthScore.total}/{healthScore.max}
                            </span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: healthScore.color }}>
                                {healthScore.label}
                            </span>
                        </div>
                    )}
                    {/* Signal Badge */}
                    {signal && (
                        <div style={{
                            padding: '0.3rem 0.7rem', borderRadius: '0.6rem',
                            backgroundColor: `${signal.color}15`,
                            border: `1px solid ${signal.color}40`,
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                        }}>
                            <span style={{ fontSize: '0.78rem' }}>{signal.icon}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: signal.color }}>
                                {signal.label}
                            </span>
                        </div>
                    )}
                    {compact && (
                        <button
                            onClick={() => setExpanded(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: '0.2rem', lineHeight: 0 }}
                        >
                            <ChevronUp size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Signal Reasons */}
            {signal?.reasons?.length > 0 && (
                <div style={{
                    padding: '0.7rem 0.9rem', borderRadius: '0.75rem', marginBottom: '1rem',
                    backgroundColor: `${signal.color}08`,
                    border: `1px solid ${signal.color}20`,
                }}>
                    {signal.reasons.map((r, i) => (
                        <p key={i} style={{
                            margin: i === 0 ? 0 : '0.3rem 0 0', fontSize: '0.72rem',
                            color: '#d4d4d8', lineHeight: 1.5,
                            display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                        }}>
                            <span style={{ color: signal.color, fontWeight: 800, flexShrink: 0 }}>•</span>
                            {r}
                        </p>
                    ))}
                </div>
            )}

            {/* Quarterly Chart */}
            {chartData.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <p style={{
                        margin: '0 0 0.6rem', fontSize: '0.63rem', fontWeight: 900,
                        textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a',
                    }}>
                        Quarterly Revenue vs Net Profit ({unit})
                    </p>
                    <div style={{ height: compact ? 160 : 190 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barGap={4} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#71717a', fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: '#71717a', fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={50}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 4 }}
                                    contentStyle={{
                                        backgroundColor: '#18181b',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '0.6rem',
                                        fontSize: '11px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                    }}
                                    labelStyle={{ color: '#a1a1aa', fontWeight: 800, marginBottom: '0.2rem' }}
                                    // Recharts colours a tooltip row from its
                                    // Bar's `fill`, and these Bars carry none —
                                    // the colour is on the Cells, which style
                                    // the bars but not the tooltip. With no fill
                                    // it fell back to its default black, on a
                                    // #18181b panel. Set explicitly so the text
                                    // cannot go dark again whatever the series.
                                    itemStyle={{ color: '#e4e4e7', fontWeight: 600 }}
                                    formatter={(value, name) => [
                                        `${unit === '₹ Cr' ? '₹' : '$'}${Number(value).toLocaleString()} ${unit === '₹ Cr' ? 'Cr' : 'B'}`,
                                        name === 'revenue' ? 'Revenue' : 'Net Profit'
                                    ]}
                                />
                                <Bar dataKey="revenue" name="revenue" fill="rgba(99,102,241,0.75)" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                    {chartData.map((_, i) => (
                                        <Cell key={i} fill="rgba(99,102,241,0.75)" />
                                    ))}
                                </Bar>
                                <Bar dataKey="profit" name="profit" fill="rgba(52,211,153,0.85)" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                    {chartData.map((entry, i) => (
                                        <Cell key={i} fill={entry.profit >= 0 ? 'rgba(52,211,153,0.85)' : 'rgba(248,113,113,0.85)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Margin trend pills below chart */}
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {chartData.map((q, i) => {
                            const isHealthy = q.margin >= 6;
                            const isLoss = q.margin < 0;
                            const color = isHealthy ? '#34d399' : isLoss ? '#f87171' : '#fbbf24';
                            return (
                                <span key={i} style={{
                                    fontSize: '0.62rem', fontFamily: 'monospace', fontWeight: 700,
                                    padding: '0.15rem 0.45rem', borderRadius: '0.35rem',
                                    backgroundColor: `${color}12`, border: `1px solid ${color}28`,
                                    color: color,
                                }}>
                                    {q.name}: {q.margin.toFixed(1)}% margin
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 5-Point Health Checks */}
            {healthScore?.checks?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <p style={{
                        margin: '0 0 0.5rem', fontSize: '0.63rem', fontWeight: 900,
                        textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a',
                    }}>
                        Fundamental Checks
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.4rem',
                    }}>
                        {healthScore.checks.map((c, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.45rem 0.65rem', borderRadius: '0.5rem',
                                backgroundColor: `${statusColor(c.status)}08`,
                                border: `1px solid ${statusColor(c.status)}20`,
                            }}>
                                <span style={{
                                    fontSize: '0.68rem', fontWeight: 900, color: statusColor(c.status),
                                    width: '14px', textAlign: 'center', flexShrink: 0,
                                }}>
                                    {statusIcon(c.status)}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: '#e4e4e7' }}>
                                        {c.name}
                                    </p>
                                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.6rem', color: '#a1a1aa' }}>
                                        {c.detail}
                                    </p>
                                    {/* What the check is even asking. A tick beside
                                        "Margins" tells you nothing if "margin" is
                                        not already a word you think in. */}
                                    {CHECK_HELP[c.name] && (
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.58rem', color: '#71717a', lineHeight: 1.45 }}>
                                            {CHECK_HELP[c.name]}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Ratios Grid */}
            {fundamentals && (
                <div>
                    <p style={{
                        margin: '0 0 0.5rem', fontSize: '0.63rem', fontWeight: 900,
                        textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a',
                    }}>
                        Key Ratios
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))',
                        gap: '0.4rem',
                    }}>
                        {[
                            {
                                label: 'Op. Margin', value: fundamentals.operatingMargins?.fmt,
                                help: GLOSSARY.operatingMargin.plain((fundamentals.operatingMargins?.raw ?? null) === null ? null : fundamentals.operatingMargins.raw * 100),
                            },
                            {
                                label: 'Net Margin', value: fundamentals.profitMargins?.fmt,
                                help: GLOSSARY.netMargin.plain((fundamentals.profitMargins?.raw ?? null) === null ? null : fundamentals.profitMargins.raw * 100),
                            },
                            {
                                label: 'Rev. Growth', value: fundamentals.revenueGrowth?.fmt,
                                help: GLOSSARY.revenueGrowth.plain((fundamentals.revenueGrowth?.raw ?? null) === null ? null : fundamentals.revenueGrowth.raw * 100),
                            },
                            {
                                label: 'D/E Ratio',
                                // Not reported is not zero. Yahoo omits this for
                                // banks, and showing "0.00x" claimed the most
                                // leveraged businesses there are carry no debt.
                                value: isMissingDebtData(fundamentals.debtToEquity?.raw)
                                    ? 'Not reported'
                                    : `${debtRatio(fundamentals.debtToEquity.raw).toFixed(2)}x`,
                                help: GLOSSARY.debtToEquity.plain(
                                    isMissingDebtData(fundamentals.debtToEquity?.raw) ? null : debtRatio(fundamentals.debtToEquity.raw),
                                ),
                                muted: isMissingDebtData(fundamentals.debtToEquity?.raw),
                            },
                            {
                                label: 'Fwd P/E', value: fundamentals.forwardPE?.fmt || 'N/A',
                                help: GLOSSARY.forwardPE.plain(fundamentals.forwardPE?.raw ?? null),
                            },
                            {
                                label: 'P/B Ratio', value: fundamentals.priceToBook?.fmt || 'N/A',
                                help: GLOSSARY.priceToBook.plain(fundamentals.priceToBook?.raw ?? null),
                            },
                            {
                                label: 'Beta', value: fundamentals.beta?.fmt || 'N/A',
                                help: GLOSSARY.beta.plain(fundamentals.beta?.raw ?? null),
                            },
                        ].map((m, i) => (
                            <div key={i} style={{
                                padding: '0.45rem 0.55rem', borderRadius: '0.5rem',
                                backgroundColor: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <p style={{ margin: 0, fontSize: '0.55rem', fontWeight: 800, color: '#71717a', textTransform: 'uppercase' }}>
                                    {m.label}
                                </p>
                                <p style={{
                                    margin: '0.15rem 0 0', fontSize: '0.82rem', fontWeight: 900,
                                    color: m.muted ? '#71717a' : '#e4e4e7', fontFamily: 'monospace',
                                }}>
                                    {m.value || 'N/A'}
                                </p>
                                {m.help && (
                                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.6rem', color: '#a1a1aa', lineHeight: 1.5, fontFamily: 'inherit' }}>
                                        {m.help}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const panelStyle = {
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '1.25rem',
};

export default StockFinancialsCard;
