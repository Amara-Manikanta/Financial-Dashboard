import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { buildForecast } from '../utils/cashflow';
import {
    CalendarClock, TrendingDown, Wallet, CreditCard, Repeat, AlertTriangle, HelpCircle,
} from 'lucide-react';

const KIND = {
    income: { icon: Wallet, color: '#10b981', label: 'Income' },
    'card-bill': { icon: CreditCard, color: '#f59e0b', label: 'Card bill' },
    emi: { icon: TrendingDown, color: '#8b5cf6', label: 'EMI' },
    recurring: { icon: Repeat, color: '#3b82f6', label: 'Recurring' },
};

const CashflowForecast = () => {
    const { expenses, creditCards, loans, salaryDetails, recurringOverrides, formatCurrency } = useFinance();
    const [horizon, setHorizon] = useState(90);

    const forecast = useMemo(() => buildForecast({
        expenses,
        creditCards: creditCards || [],
        loans: loans || [],
        salaryDetails: salaryDetails || [],
        recurringOverrides: recurringOverrides || {},
        days: horizon,
    }), [expenses, creditCards, loans, salaryDetails, recurringOverrides, horizon]);

    const { cycles, monthlyCommitted, salaryAmount } = forecast;

    if (!cycles.length) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-black text-white">Cashflow Forecast</h1>
                <p className="text-gray-500 mt-2 text-sm">
                    Nothing to project yet — this needs recurring charges, a billing day on a card,
                    or a salary history to work from.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <CalendarClock className="text-emerald-400" size={26} />
                        Cashflow Forecast
                    </h1>
                    <p className="text-xs text-gray-500 mt-1.5 font-bold uppercase tracking-wider">
                        What is already committed over the next {horizon} days
                    </p>
                </div>
                <div className="flex gap-2">
                    {[30, 60, 90].map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setHorizon(d)}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                horizon === d ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            {d} days
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Expected each month
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{formatCurrency(salaryAmount)}</div>
                    <p className="text-[11px] text-gray-500 mt-1">Average of your recent salary credits</p>
                </div>
                <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Committed each month
                    </div>
                    <div className="text-2xl font-black text-amber-400">{formatCurrency(monthlyCommitted)}</div>
                    <p className="text-[11px] text-gray-500 mt-1">Subscriptions and EMIs, before any spending</p>
                </div>
                <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Left after commitments
                    </div>
                    <div className="text-2xl font-black text-white">
                        {formatCurrency(Math.max(0, salaryAmount - monthlyCommitted))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Before card bills, which vary</p>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex gap-3">
                <HelpCircle size={15} className="text-gray-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                    This does not predict a bank balance — there is no bank balance in this app, so any
                    running total would be invented. It shows what is <strong className="text-gray-300">already
                    spoken for</strong> and when. A subscription billed to a card is shown inside that
                    card&rsquo;s bill rather than beside it, so nothing is counted twice.
                </p>
            </div>

            <div className="space-y-5">
                {cycles.map((cycle) => {
                    const net = cycle.income - cycle.committed;
                    const tight = cycle.income > 0 && net < 0;
                    return (
                        <div key={`${cycle.from}-${cycle.to}`}
                             className={`rounded-2xl border overflow-hidden ${tight ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 bg-[#18181b]'}`}>
                            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5">
                                <div>
                                    <div className="text-sm font-black text-white">
                                        {cycle.from} &rarr; {cycle.to}
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                        {cycle.income > 0 ? 'Pay cycle' : 'Before the next payday'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-6 text-right">
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">In</div>
                                        <div className="font-mono font-bold text-emerald-400">{formatCurrency(cycle.income)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Committed</div>
                                        <div className="font-mono font-bold text-amber-400">
                                            {formatCurrency(cycle.committed)}
                                            {cycle.unknown > 0 && <span className="text-gray-600"> +?</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {tight && (
                                <div className="px-5 py-3 bg-red-500/10 flex items-center gap-2 border-b border-red-500/20">
                                    <AlertTriangle size={14} className="text-red-400 shrink-0" />
                                    <span className="text-[11px] text-red-300 font-bold">
                                        Commitments exceed the income landing in this cycle by {formatCurrency(Math.abs(net))}
                                    </span>
                                </div>
                            )}

                            <div className="divide-y divide-white/5">
                                {cycle.events.map((e, i) => {
                                    const meta = KIND[e.kind] || KIND.recurring;
                                    const Icon = meta.icon;
                                    return (
                                        <div key={`${e.date}-${e.label}-${i}`} className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-[11px] text-gray-500 w-24 shrink-0">{e.date}</span>
                                                <Icon size={13} style={{ color: meta.color }} className="shrink-0" />
                                                <span className="text-sm text-white font-bold flex-1 min-w-0 truncate">{e.label}</span>
                                                <span className="font-mono font-bold text-sm shrink-0"
                                                      style={{ color: e.kind === 'income' ? '#10b981' : '#e5e7eb' }}>
                                                    {e.amount === null ? '—' : formatCurrency(e.amount)}
                                                </span>
                                            </div>
                                            {(e.detail || e.includes?.length > 0) && (
                                                <div className="pl-[7.25rem] mt-1 space-y-0.5">
                                                    {e.detail && (
                                                        <p className="text-[10px] text-gray-600">{e.detail}</p>
                                                    )}
                                                    {e.includes?.length > 0 && (
                                                        <p className="text-[10px] text-gray-500">
                                                            includes {e.includes.map((inc) => (
                                                                `${inc.label} ${formatCurrency(inc.amount)}`
                                                            )).join(' · ')}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CashflowForecast;
