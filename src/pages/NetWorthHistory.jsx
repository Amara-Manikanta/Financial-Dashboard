import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { LineChart as LineIcon, Info, CalendarRange } from 'lucide-react';
import BackButton from '../components/BackButton';
import { netWorthSeries, contributionByYear } from '../utils/netWorthHistory';

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const compact = (n) => {
    const v = Math.abs(Number(n) || 0);
    if (v >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${Math.round(n / 1000)}k`;
    return `₹${Math.round(n)}`;
};

const COMPONENTS = [
    { key: 'gold', label: 'Gold & silver', colour: '#fbbf24' },
    { key: 'deposits', label: 'Deposits', colour: '#38bdf8' },
    { key: 'retirement', label: 'PF, PPF & NPS', colour: '#a78bfa' },
    { key: 'property', label: 'Property', colour: '#f472b6' },
    { key: 'equities', label: 'Equities', colour: '#34d399' },
    { key: 'cash', label: 'Cash', colour: '#94a3b8' },
];

const RANGES = [
    { id: 'all', label: 'All time', months: null },
    { id: '5y', label: '5 years', months: 60 },
    { id: '3y', label: '3 years', months: 36 },
    { id: '1y', label: '1 year', months: 12 },
];

/**
 * Net worth over time, rebuilt month by month from the dated records.
 *
 * The two stored snapshots could not be used: they are five months apart and
 * differ tenfold, and almost all of that difference is property and metals
 * being entered into the app rather than acquired.
 */
const NetWorthHistory = () => {
    const { savings, metals, assets, loans, formatCurrency } = useFinance();
    const [range, setRange] = useState('all');

    const series = useMemo(
        () => netWorthSeries({ savings, metals, assets, loans }),
        [savings, metals, assets, loans],
    );

    const points = useMemo(() => {
        const months = RANGES.find((r) => r.id === range)?.months;
        return months ? series.points.slice(-months) : series.points;
    }, [series, range]);

    const byYear = useMemo(() => contributionByYear(series.points), [series]);

    const latest = series.points[series.points.length - 1] || null;
    const first = points[0] || null;
    const growth = latest && first ? latest.net - first.net : 0;

    /**
     * Months where the line jumps by more than a quarter of what came before.
     *
     * A step that large is usually the day a batch of older holdings was
     * entered into the app, not the month they were acquired — and a chart that
     * does not say so invites the reader to see a windfall.
     */
    const bigSteps = useMemo(() => {
        const out = [];
        for (let i = 1; i < series.points.length; i += 1) {
            const prev = series.points[i - 1];
            const cur = series.points[i];
            const jump = cur.net - prev.net;
            if (prev.net > 0 && jump > prev.net * 0.25 && jump > 200000) {
                out.push({ month: cur.month, jump, from: prev.net, to: cur.net });
            }
        }
        return out.sort((a, b) => b.jump - a.jump).slice(0, 4);
    }, [series]);

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <BackButton label="Back to Dashboard" />

            <div className="mb-6">
                <div className="flex items-center gap-3">
                    <LineIcon size={22} className="text-emerald-400" />
                    <h1 className="text-3xl font-black text-white tracking-tight">Net Worth Over Time</h1>
                </div>
                <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                    {series.points.length} months rebuilt from the dated records, back to{' '}
                    {series.points[0]?.month}. This is <strong className="text-gray-200">money contributed</strong>,
                    not market value: purchases at what you paid, deposits at face value, less debt still owed.
                    Nothing here stores yesterday's prices, so a historical valuation would have to be invented —
                    and the contributed line is the more useful one anyway, because its slope is your savings
                    rate rather than the market's mood.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Contributed to date</p>
                    <p className="text-2xl font-black text-white mt-2">{inr(latest?.net)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">net of {inr(latest?.debt)} still owed</p>
                </div>
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        Added over {RANGES.find((r) => r.id === range)?.label.toLowerCase()}
                    </p>
                    <p className={`text-2xl font-black mt-2 ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {inr(growth)}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">
                        {points.length > 1 ? `${inr(growth / points.length)} a month` : '—'}
                    </p>
                </div>
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Debt outstanding</p>
                    <p className="text-2xl font-black text-white mt-2">{inr(latest?.debt)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">amortised from recorded EMI payments</p>
                </div>
                <div className={`card p-5 ${series.undated.total > 0 ? 'border-amber-500/25' : ''}`}>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Not on the timeline</p>
                    <p className="text-2xl font-black text-amber-400 mt-2">{inr(series.undated.total)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">{series.undated.items.length} holdings with no purchase date</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
                {RANGES.map((r) => (
                    <button
                        key={r.id}
                        onClick={() => setRange(r.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                            range === r.id
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="card p-6 mb-6">
                <div style={{ width: '100%', height: 420 }}>
                    <ResponsiveContainer>
                        <AreaChart data={points} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: '#71717a', fontSize: 10 }}
                                stroke="rgba(255,255,255,0.08)"
                                minTickGap={40}
                            />
                            <YAxis
                                tickFormatter={compact}
                                tick={{ fill: '#71717a', fontSize: 10 }}
                                stroke="rgba(255,255,255,0.08)"
                                width={60}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(24,24,27,0.96)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '0.75rem',
                                    fontSize: '12px',
                                }}
                                formatter={(value, name) => [inr(value), name]}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            {COMPONENTS.map((c) => (
                                <Area
                                    key={c.key}
                                    type="monotone"
                                    dataKey={c.key}
                                    name={c.label}
                                    stackId="1"
                                    stroke={c.colour}
                                    fill={c.colour}
                                    fillOpacity={0.22}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Honest caveats, before the year table invites conclusions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {bigSteps.length > 0 && (
                    <div className="card p-6 border-amber-500/20 bg-amber-500/[0.03]">
                        <div className="flex items-start gap-3">
                            <CalendarRange size={16} className="text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-black text-white">Steps worth checking</p>
                                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                                    These months jump by more than a quarter in one step. That is usually the
                                    date a batch of older holdings was entered into the app rather than the month
                                    they were bought — worth confirming before reading any of them as a windfall.
                                </p>
                                <div className="mt-3 space-y-1.5">
                                    {bigSteps.map((s) => (
                                        <div key={s.month} className="flex justify-between">
                                            <span className="text-[12px] text-gray-300">{s.month}</span>
                                            <span className="text-[12px] text-amber-200 tabular-nums">
                                                +{inr(s.jump)}
                                                <span className="text-gray-600 ml-2">
                                                    {inr(s.from)} → {inr(s.to)}
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {series.undated.total > 0 && (
                    <div className="card p-6">
                        <div className="flex items-start gap-3">
                            <Info size={16} className="text-gray-500 mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-black text-white">
                                    {inr(series.undated.total)} could not be placed in time
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                                    {series.undated.items.length} holdings carry no purchase date, so they appear
                                    nowhere on the chart. They are excluded rather than dumped at the start,
                                    which would put a step on a date nobody chose. Adding purchase dates puts
                                    them on the line.
                                </p>
                                <div className="mt-3 space-y-1">
                                    {series.undated.items.slice(0, 6).map((i, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span className="text-[12px] text-gray-400">
                                                {i.name} <span className="text-gray-600">· {i.kind}</span>
                                            </span>
                                            <span className="text-[12px] text-gray-300 tabular-nums">{inr(i.amount)}</span>
                                        </div>
                                    ))}
                                    {series.undated.items.length > 6 && (
                                        <p className="text-[11px] text-gray-600 pt-1">
                                            +{series.undated.items.length - 6} more
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="card p-6">
                <h2 className="text-lg font-black text-white mb-1">Added each year</h2>
                <p className="text-[11px] text-gray-500 mb-4">
                    The change between year ends. On a market-value chart a good year of saving and a good year
                    in the market look the same; here only saving moves the line.
                </p>
                <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full min-w-[560px]">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="py-3 text-left text-[9px] font-black text-gray-500 uppercase tracking-wider">Year</th>
                                <th className="py-3 text-right text-[9px] font-black text-gray-500 uppercase tracking-wider">Added</th>
                                <th className="py-3 text-right text-[9px] font-black text-gray-500 uppercase tracking-wider">Per month</th>
                                <th className="py-3 text-right text-[9px] font-black text-gray-500 uppercase tracking-wider">Total by year end</th>
                            </tr>
                        </thead>
                        <tbody>
                            {byYear.map((y) => (
                                <tr key={y.year} className="border-b border-white/[0.03]">
                                    <td className="py-3 text-[13px] text-white font-bold">{y.year}</td>
                                    <td className={`py-3 text-right text-[13px] font-bold tabular-nums ${y.added >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {inr(y.added)}
                                    </td>
                                    <td className="py-3 text-right text-[12px] text-gray-500 tabular-nums">{inr(y.added / 12)}</td>
                                    <td className="py-3 text-right text-[13px] text-gray-300 tabular-nums">{inr(y.net)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default NetWorthHistory;
