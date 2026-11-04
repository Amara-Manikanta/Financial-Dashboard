import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';
import { tooltipTheme } from '../utils/chartTheme';

const RANGES = [
    { id: '1mo', label: '1M' },
    { id: '3mo', label: '3M' },
    { id: '6mo', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: '5y', label: '5Y' },
];

const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
const money = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * A stock's daily closing price over a chosen range, with your average cost and the days you bought.
 * Closes come from Yahoo through the server's /api/history; nothing here is stored.
 */
const StockPriceChart = ({ symbol, avgCost, transactions = [] }) => {
    const [range, setRange] = useState('1y');
    const [closes, setCloses] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!symbol) return undefined;
        let live = true;
        setCloses(null); setError('');
        fetch(`${API_URL}/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`)
            .then(async (r) => {
                const body = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
                return body;
            })
            .then((body) => { if (live) setCloses(body.closes || {}); })
            .catch((e) => { if (live) setError(e.message); });
        return () => { live = false; };
    }, [symbol, range]);

    const series = useMemo(() => Object.keys(closes || {}).sort().map((d) => ({ date: d, close: closes[d] })), [closes]);

    // The days money went in that fall inside the range, placed at the price actually paid.
    const buys = useMemo(() => {
        if (!series.length) return [];
        const first = series[0].date, last = series[series.length - 1].date;
        return transactions
            .filter((t) => (t.type === 'buy' || t.type === 'ipo') && Number(t.price) > 0 && t.date >= first && t.date <= last)
            .map((t) => {
                const d = String(t.date).slice(0, 10);
                // Nearest trading day on or after the purchase, so the dot sits on the line's x-axis.
                const x = series.find((p) => p.date >= d)?.date;
                return x ? { x, y: Number(t.price), qty: Number(t.quantity) } : null;
            })
            .filter(Boolean);
    }, [series, transactions]);

    const stats = useMemo(() => {
        if (series.length < 2) return null;
        const first = series[0].close, last = series[series.length - 1].close;
        const values = series.map((p) => p.close);
        return { first, last, change: ((last - first) / first) * 100, high: Math.max(...values), low: Math.min(...values) };
    }, [series]);

    const up = stats ? stats.change >= 0 : true;
    const stroke = up ? '#34d399' : '#f87171';

    return (
        <div style={{ marginTop: '2rem', padding: '1.25rem', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} style={{ color: stroke }} />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'white' }}>Price history</h3>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {RANGES.map((r) => (
                        <button key={r.id} type="button" onClick={() => setRange(r.id)}
                            style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 900, cursor: 'pointer',
                                border: `1px solid ${range === r.id ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.1)'}`,
                                background: range === r.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                                color: range === r.id ? '#c7d2fe' : '#a1a1aa' }}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {stats && (
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: '#a1a1aa', marginBottom: 10 }}>
                    <span style={{ color: stroke, fontWeight: 900 }}>{stats.change >= 0 ? '+' : ''}{stats.change.toFixed(1)}% over the range</span>
                    <span>High {money(stats.high)}</span>
                    <span>Low {money(stats.low)}</span>
                    <span>Last close {money(stats.last)}</span>
                    {avgCost > 0 && <span style={{ color: '#fbbf24' }}>Your average {money(avgCost)}</span>}
                </div>
            )}

            {error ? (
                <p style={{ fontSize: 12, color: '#f87171', margin: '1rem 0' }}>Could not load the price history ({error}).</p>
            ) : !closes ? (
                <p style={{ fontSize: 12, color: '#71717a', margin: '1rem 0' }}>Loading…</p>
            ) : series.length < 2 ? (
                <p style={{ fontSize: 12, color: '#71717a', margin: '1rem 0' }}>Not enough price history for this stock in this range.</p>
            ) : (
                <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={series} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(d) => day(d)} minTickGap={48} />
                        <YAxis domain={['auto', 'auto']} tick={{ fill: '#71717a', fontSize: 10 }} width={56} tickFormatter={(v) => Number(v).toFixed(0)} />
                        <Tooltip {...tooltipTheme} separator=" " formatter={(v) => [money(v), 'Close']} labelFormatter={(d) => day(d)} />
                        {avgCost > 0 && <ReferenceLine y={avgCost} stroke="#fbbf24" strokeDasharray="5 4" />}
                        <Line type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        {buys.map((b, i) => <ReferenceDot key={i} x={b.x} y={b.y} r={4} fill="#818cf8" stroke="#0a0a0c" />)}
                    </LineChart>
                </ResponsiveContainer>
            )}
            <p style={{ margin: '8px 0 0', fontSize: 10, color: '#52525b' }}>
                Daily closing price (Yahoo). The dashed line is your average cost; purple dots are the days you bought, at the price you paid.
            </p>
        </div>
    );
};

export default StockPriceChart;
