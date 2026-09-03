import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import {
    CreditCard, AlertTriangle, CalendarClock, Gauge, Moon, Info,
} from 'lucide-react';
import BackButton from '../components/BackButton';
import { allCardProfiles, cardTotals } from '../utils/creditCards';

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/** Utilisation colouring. The thresholds are conventional, and labelled as such. */
const utilTone = (u) => {
    if (u === null || u === undefined) return 'text-gray-500';
    if (u >= 50) return 'text-rose-400';
    if (u >= 30) return 'text-amber-400';
    return 'text-emerald-400';
};

const utilBar = (u) => {
    if (u >= 50) return 'bg-rose-400';
    if (u >= 30) return 'bg-amber-400';
    return 'bg-emerald-400';
};

/**
 * What the cards are actually doing.
 *
 * The cards page answers "what do I owe". This one answers the questions that
 * decide whether a card is working for you — how much of the limit is in use,
 * what carrying a balance has cost in rupees, which card carries which kind of
 * spending, and which cards nobody has touched in months.
 */
const CardIntelligence = () => {
    const navigate = useNavigate();
    const { creditCards, expenses, formatCurrency } = useFinance();
    const [expanded, setExpanded] = useState(null);

    const profiles = useMemo(
        () => allCardProfiles(creditCards || [], expenses || {}),
        [creditCards, expenses],
    );
    const totals = useMemo(() => cardTotals(profiles), [profiles]);

    const interestCards = profiles.filter((p) => p.interestPaid > 0);
    const dormant = profiles.filter((p) => !p.isWallet && p.daysIdle !== null && p.daysIdle > 90);
    const upcoming = profiles
        .filter((p) => p.cycle)
        .sort((a, b) => a.cycle.daysToNextStatement - b.cycle.daysToNextStatement);

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <BackButton label="Back to Cards" />

            <div className="mb-6">
                <div className="flex items-center gap-3">
                    <Gauge size={22} className="text-sky-400" />
                    <h1 className="text-3xl font-black text-white tracking-tight">Card Intelligence</h1>
                </div>
                <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                    {inr(totals.lifetimeSpend)} has moved through {totals.cards} cards
                    {totals.wallets > 0 && ` and ${totals.wallets} wallets`}. What that has cost, how much
                    of the limits is in use, and which card is carrying what.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Combined utilisation</p>
                    <p className={`text-2xl font-black mt-2 ${utilTone(totals.utilisation)}`}>
                        {totals.utilisation.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">
                        {inr(totals.outstanding)} of {inr(totals.limit)}
                    </p>
                </div>
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Available credit</p>
                    <p className="text-2xl font-black text-white mt-2">{inr(totals.available)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">across {totals.cards} cards</p>
                </div>
                <div className={`card p-5 ${totals.interestPaid > 0 ? 'border-rose-500/25' : ''}`}>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Interest paid, all time</p>
                    <p className={`text-2xl font-black mt-2 ${totals.interestPaid > 0 ? 'text-rose-400' : 'text-white'}`}>
                        {inr(totals.interestPaid)}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">
                        {interestCards.length === 0 ? 'never carried a balance' : `on ${interestCards.length} of ${totals.cards} cards`}
                    </p>
                </div>
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Highest utilisation</p>
                    <p className={`text-2xl font-black mt-2 ${utilTone(totals.highestUtilisation?.utilisation)}`}>
                        {totals.highestUtilisation ? `${totals.highestUtilisation.utilisation.toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1 truncate">
                        {totals.highestUtilisation?.name || 'no card in use'}
                    </p>
                </div>
            </div>

            {/* Interest is the one hard cost, so it leads */}
            {totals.interestPaid > 0 && (
                <div className="card p-6 mb-6 border-rose-500/20 bg-rose-500/[0.03]">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="text-rose-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-black text-white">
                                {inr(totals.interestPaid)} has gone on interest and finance charges
                            </p>
                            <p className="text-[12px] text-gray-400 mt-1.5 leading-relaxed">
                                A credit card costs nothing in a month it is paid in full, so every rupee here
                                is a month it was not. This counts what the bank actually charged — rows in your
                                own ledger — rather than inferring it from whether a month's payments matched
                                its charges, which marks nearly every month as revolving simply because a bill
                                is paid in the month after it is issued.
                            </p>
                            <div className="mt-4 space-y-3">
                                {interestCards.map((p) => (
                                    <div key={p.id} className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-[13px] font-bold text-white">{p.name}</p>
                                                <p className="text-[11px] text-gray-500">
                                                    {p.interestMonths.length} months with a charge
                                                </p>
                                            </div>
                                            <p className="text-[15px] font-black text-rose-400">{inr(p.interestPaid)}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-3">
                                            {p.interestMonths.slice(-14).map((m) => (
                                                <span
                                                    key={m.month}
                                                    title={`${m.month} — ${inr(m.amount)}`}
                                                    className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-200 text-[9px] tabular-nums"
                                                >
                                                    {m.month} · {inr(m.amount)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Statement calendar */}
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarClock size={16} className="text-sky-400" />
                        <h2 className="text-sm font-black text-white">Statement dates</h2>
                    </div>
                    <div className="space-y-2">
                        {upcoming.map((p) => (
                            <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                                <div>
                                    <p className="text-[13px] text-gray-200">{p.name}</p>
                                    <p className="text-[10px] text-gray-600">
                                        bills on the {p.cycle.billingDay}
                                        {p.cycle.billingDay === 1 ? 'st' : p.cycle.billingDay === 2 ? 'nd' : p.cycle.billingDay === 3 ? 'rd' : 'th'} of the month
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[12px] text-white font-bold">{p.cycle.nextStatement}</p>
                                    <p className="text-[10px] text-gray-500">
                                        in {p.cycle.daysToNextStatement} days
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-start gap-2 mt-4">
                        <Info size={12} className="text-gray-600 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            Statement dates only. Payment due dates are not recorded anywhere in this app, and
                            assuming the usual grace period would put a wrong date in front of you — which is
                            worse than no date.
                        </p>
                    </div>
                </div>

                {/* Dormant */}
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Moon size={16} className="text-violet-400" />
                        <h2 className="text-sm font-black text-white">Card activity</h2>
                    </div>
                    <div className="space-y-2">
                        {profiles.map((p) => (
                            <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                                <div>
                                    <p className="text-[13px] text-gray-200">
                                        {p.name}
                                        {p.isWallet && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-[9px] font-black uppercase">
                                                Wallet
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-[10px] text-gray-600">
                                        {p.transactionCount} transactions · {inr(p.averageMonthlySpend)}/month recently
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-[12px] font-bold ${p.daysIdle > 90 ? 'text-amber-400' : 'text-gray-400'}`}>
                                        {p.daysIdle === null ? 'never used' : p.daysIdle === 0 ? 'today' : `${p.daysIdle}d ago`}
                                    </p>
                                    <p className="text-[10px] text-gray-600">{p.lastUsed || '—'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {dormant.length > 0 && (
                        <p className="text-[10px] text-gray-600 mt-4 leading-relaxed">
                            {dormant.length} card{dormant.length === 1 ? '' : 's'} unused for over three months.
                            Whether that matters is your call — this only reports it.
                        </p>
                    )}
                </div>
            </div>

            {/* Per-card detail */}
            <div className="space-y-3">
                {profiles.map((p) => (
                    <div key={p.id} className="card p-6">
                        <button
                            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                            className="w-full text-left"
                        >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <CreditCard size={16} className="text-gray-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">{p.name}</p>
                                        <p className="text-[11px] text-gray-600">
                                            {p.bank}{p.last4 ? ` · ····${p.last4}` : ''} · {p.transactionCount} transactions
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-wider">Lifetime spend</p>
                                        <p className="text-[15px] font-black text-white">{inr(p.lifetimeSpend)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-wider">Outstanding</p>
                                        <p className="text-[15px] font-black text-white">{inr(p.outstanding)}</p>
                                    </div>
                                    <div className="text-right min-w-[70px]">
                                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-wider">Utilisation</p>
                                        <p className={`text-[15px] font-black ${utilTone(p.utilisation)}`}>
                                            {p.utilisation === null ? '—' : `${p.utilisation.toFixed(1)}%`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {p.limit > 0 && (
                                <div className="mt-4">
                                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                        <div
                                            className={utilBar(p.utilisation)}
                                            style={{ width: `${Math.min(100, p.utilisation)}%`, height: '100%' }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1.5">
                                        <span className="text-[10px] text-gray-600">
                                            {inr(p.available)} available of {inr(p.limit)}
                                        </span>
                                        <span className="text-[10px] text-gray-600">
                                            peak {p.peakUtilisation === null ? '—' : `${p.peakUtilisation.toFixed(1)}%`} at month end
                                        </span>
                                    </div>
                                </div>
                            )}
                        </button>

                        {expanded === p.id && (
                            <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">
                                        What this card is used for
                                    </p>
                                    {p.topCategories.length === 0 && (
                                        <p className="text-[12px] text-gray-600">No spending recorded.</p>
                                    )}
                                    {p.topCategories.map((c) => {
                                        const share = p.lifetimeSpend > 0 ? (c.amount / p.lifetimeSpend) * 100 : 0;
                                        return (
                                            <div key={c.category} className="mb-2.5">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[12px] text-gray-300 capitalize">{c.category}</span>
                                                    <span className="text-[12px] text-gray-400 tabular-nums">
                                                        {inr(c.amount)}
                                                        <span className="text-gray-600 ml-2">{share.toFixed(0)}%</span>
                                                    </span>
                                                </div>
                                                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                                                    <div className="bg-sky-400/60 h-full" style={{ width: `${share}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">
                                        Last 6 months
                                    </p>
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                {['Month', 'Charged', 'Paid', 'Interest'].map((h, i) => (
                                                    <th key={h} className={`pb-2 text-[9px] font-black text-gray-600 uppercase ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {p.recentMonths.map((m) => (
                                                <tr key={m.month} className="border-t border-white/[0.03]">
                                                    <td className="py-1.5 text-[12px] text-gray-400">{m.month}</td>
                                                    <td className="py-1.5 text-right text-[12px] text-gray-300 tabular-nums">{inr(m.spend)}</td>
                                                    <td className="py-1.5 text-right text-[12px] text-gray-300 tabular-nums">{inr(m.payment)}</td>
                                                    <td className={`py-1.5 text-right text-[12px] tabular-nums ${m.interest > 0 ? 'text-rose-400 font-bold' : 'text-gray-600'}`}>
                                                        {m.interest > 0 ? inr(m.interest) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {p.recentMonths.length === 0 && (
                                        <p className="text-[12px] text-gray-600">Nothing in the last six months.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CardIntelligence;
