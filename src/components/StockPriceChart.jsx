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
        <div className="mt-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
                <div className="flex items-center gap-2">
                    <TrendingUp size={18} className={up ? 'text-emerald-400' : 'text-rose-400'} />
                    <h3 className="m-0 text-base font-black text-white">Price history</h3>
                </div>
                <div className="flex gap-1.5">
                    {RANGES.map((r) => (
                        <button key={r.id} type="button" onClick={() => setRange(r.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer border ${range === r.id
                                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
                                : 'border-white/10 bg-white/[0.04] text-zinc-400'}`}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {stats && (
                <div className="flex gap-4 flex-wrap text-xs text-zinc-400 mb-2.5">
                    <span className={`font-black ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{stats.change >= 0 ? '+' : ''}{stats.change.toFixed(1)}% over the range</span>
                    <span>High {money(stats.high)}</span>
                    <span>Low {money(stats.low)}</span>
                    <span>Last close {money(stats.last)}</span>
                    {avgCost > 0 && <span className="text-amber-400">Your average {money(avgCost)}</span>}
                </div>
            )}

            {error ? (
                <p className="text-xs text-rose-400 my-4">Could not load the price history ({error}).</p>
            ) : !closes ? (
                <p className="text-xs text-zinc-500 my-4">Loading…</p>
            ) : series.length < 2 ? (
                <p className="text-xs text-zinc-500 my-4">Not enough price history for this stock in this range.</p>
            ) : (
                <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={series} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(d) => day(d)} minTickGap={48} />
                        <YAxis domain={['auto', 'auto']} tick={{ fill: '#71717a', fontSize: 10 }} width={56} tickFormatter={(v) => Number(v).toFixed(0)} />
                        <Tooltip {...tooltipTheme} separator=" " formatter={(v) => [money(v), 'Close']} labelFormatter={(d) => day(d)} />
                        {/* extendDomain: a purchase or an average outside the closes' range widens the axis rather than disappearing. */}
                        {avgCost > 0 && <ReferenceLine y={avgCost} stroke="#fbbf24" strokeDasharray="5 4" ifOverflow="extendDomain" />}
                        <Line type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        {buys.map((b, i) => <ReferenceDot key={i} x={b.x} y={b.y} r={4} fill="#818cf8" stroke="#0a0a0c" ifOverflow="extendDomain" />)}
                    </LineChart>
                </ResponsiveContainer>
            )}
            <p className="mt-2 mb-0 text-[10px] text-zinc-600">
                Daily closing price (Yahoo). The dashed line is your average cost; purple dots are the days you bought, at the price you paid.
            </p>
        </div>
    );
};

export default StockPriceChart;
