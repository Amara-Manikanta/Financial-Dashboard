import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { detectRecurring } from '../utils/recurring';
import {
    Repeat, TrendingUp, AlertTriangle, CalendarClock, Ban, Search, ChevronDown, ArrowUp, ArrowDown,
} from 'lucide-react';

const KIND_STYLES = {
    'Subscription': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'Loan / EMI': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    'Transfer': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    'Insurance': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

const StatTile = ({ icon: Icon, label, value, hint, accent = '#10b981' }) => (
    <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b]">
        <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: `${accent}22`, color: accent }}>
                <Icon size={15} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
        </div>
        <div className="text-2xl font-black text-white tracking-tight">{value}</div>
        {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
);

const RecurringAnalytics = () => {
    const { expenses, formatCurrency } = useFinance();
    const [query, setQuery] = useState('');
    const [showStopped, setShowStopped] = useState(false);
    const [expanded, setExpanded] = useState(null);

    const series = useMemo(() => detectRecurring(expenses), [expenses]);

    const active = useMemo(() => series.filter((s) => s.active), [series]);
    const stopped = useMemo(() => series.filter((s) => !s.active), [series]);

    // A meaningful rise, not rounding noise: >10% and at least Rs 25.
    const roseInPrice = useMemo(
        () => active.filter((s) => s.priceChangePct > 10 && (s.lastAmount - s.firstAmount) >= 25)
                    .sort((a, b) => b.priceChangePct - a.priceChangePct),
        [active],
    );

    const annualRunRate = useMemo(
        () => active.reduce((sum, s) => sum + s.annualRunRate, 0),
        [active],
    );

    const visible = useMemo(() => {
        const pool = showStopped ? stopped : active;
        const q = query.trim().toLowerCase();
        if (!q) return pool;
        return pool.filter((s) => s.label.toLowerCase().includes(q) || s.key.includes(q));
    }, [showStopped, stopped, active, query]);

    if (!series.length) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-black text-white">Recurring &amp; Subscriptions</h1>
                <p className="text-gray-500 mt-2 text-sm">
                    No repeating charges detected yet. A series needs at least three charges at a
                    steady interval before it shows up here.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Repeat className="text-emerald-400" size={26} />
                    Recurring &amp; Subscriptions
                </h1>
                <p className="text-xs text-gray-500 mt-1.5 font-bold uppercase tracking-wider">
                    Detected from {series.length} repeating series across your history
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatTile
                    icon={Repeat} label="Active series" value={active.length}
                    hint={`${stopped.length} have stopped`}
                />
                <StatTile
                    icon={CalendarClock} label="Annual run-rate" value={formatCurrency(annualRunRate)}
                    hint="If every active series keeps billing" accent="#3b82f6"
                />
                <StatTile
                    icon={TrendingUp} label="Price rises" value={roseInPrice.length}
                    hint="Active series charging more than they used to" accent="#f59e0b"
                />
                <StatTile
                    icon={Ban} label="Stopped" value={stopped.length}
                    hint="No charge for over two intervals" accent="#ef4444"
                />
            </div>

            {roseInPrice.length > 0 && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
                    <h2 className="text-sm font-black text-amber-300 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <AlertTriangle size={16} /> Charging more than they used to
                    </h2>
                    <div className="space-y-2">
                        {roseInPrice.map((s) => (
                            <div key={s.key}
                                 className="flex flex-wrap items-center justify-between gap-3 bg-black/30 rounded-xl px-4 py-3">
                                <span className="text-sm font-bold text-white">{s.label}</span>
                                <div className="flex items-center gap-3 text-xs font-mono">
                                    <span className="text-gray-500">{formatCurrency(s.firstAmount)}</span>
                                    <span className="text-gray-600">&rarr;</span>
                                    <span className="text-white font-bold">{formatCurrency(s.lastAmount)}</span>
                                    <span className="text-amber-400 font-black">
                                        +{s.priceChangePct.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowStopped(false)}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                !showStopped ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            Active ({active.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowStopped(true)}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                showStopped ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            Stopped ({stopped.length})
                        </button>
                    </div>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter merchants..."
                            className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/5">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead>
                            <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <th className="text-left px-4 py-3">Merchant</th>
                                <th className="text-left px-4 py-3">Type</th>
                                <th className="text-left px-4 py-3">Cadence</th>
                                <th className="text-right px-4 py-3">Typical</th>
                                <th className="text-right px-4 py-3">Per year</th>
                                <th className="text-right px-4 py-3">Charges</th>
                                <th className="text-left px-4 py-3">Last</th>
                                <th className="text-left px-4 py-3">{showStopped ? 'Since' : 'Next due'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((s) => (
                                <React.Fragment key={s.key}>
                                <tr
                                    className="border-t border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                                    onClick={() => setExpanded(expanded === s.key ? null : s.key)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-white flex items-center gap-2">
                                            <ChevronDown
                                                size={13}
                                                className={`text-gray-600 transition-transform ${expanded === s.key ? 'rotate-180' : ''}`}
                                            />
                                            {s.label}
                                        </div>
                                        {s.min !== s.max && (
                                            <div className="text-[10px] text-gray-600 font-mono mt-0.5 ml-5">
                                                {formatCurrency(s.min)} &ndash; {formatCurrency(s.max)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${KIND_STYLES[s.kind] || KIND_STYLES.Subscription}`}>
                                            {s.kind}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 text-xs font-bold">{s.cadence}</td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-white">{formatCurrency(s.typical)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-400">{formatCurrency(s.annualRunRate)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{s.count}</td>
                                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{s.last}</td>
                                    <td className="px-4 py-3 text-xs font-mono">
                                        {showStopped
                                            ? <span className="text-gray-600">{s.first}</span>
                                            : <span className="text-emerald-400">{s.nextExpected}</span>}
                                    </td>
                                </tr>
                            ))}
                            {!visible.length && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-gray-600 text-xs">
                                        Nothing matches &ldquo;{query}&rdquo;.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <p className="text-[11px] text-gray-600 leading-relaxed">
                    A series is detected when a merchant is charged at least three times at a steady
                    interval, with most charges close to the same amount. &ldquo;Stopped&rdquo; means nothing has
                    been charged for more than twice the usual gap &mdash; useful for spotting a
                    subscription you cancelled, or one you thought you had.
                </p>
            </div>
        </div>
    );
};

export default RecurringAnalytics;
