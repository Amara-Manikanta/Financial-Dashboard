import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { runHealthChecks, flattenTransactions } from '../utils/dataHealth';
import {
    Stethoscope, AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronDown,
} from 'lucide-react';

const SEVERITY = {
    high: { label: 'Needs attention', icon: AlertTriangle, color: '#ef4444', ring: 'border-red-500/30 bg-red-500/5' },
    medium: { label: 'Worth cleaning', icon: AlertCircle, color: '#f59e0b', ring: 'border-amber-500/25 bg-amber-500/5' },
    low: { label: 'Minor', icon: Info, color: '#6366f1', ring: 'border-indigo-500/25 bg-indigo-500/5' },
    ok: { label: 'Clean', icon: CheckCircle2, color: '#10b981', ring: 'border-emerald-500/25 bg-emerald-500/5' },
};

const CheckCard = ({ check, formatCurrency }) => {
    const [open, setOpen] = useState(check.severity === 'high');
    const meta = SEVERITY[check.severity] || SEVERITY.low;
    const Icon = meta.icon;

    return (
        <div className={`rounded-2xl border ${meta.ring} overflow-hidden`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.03] transition-colors"
            >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                     style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
                    <Icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm">{check.title}</div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{check.detail}</p>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-2xl font-black" style={{ color: meta.color }}>
                        {check.severity === 'ok' ? '✓' : check.count}
                    </div>
                    {check.total > 0 && (
                        <div className="text-[10px] text-gray-500 font-mono">{formatCurrency(check.total)}</div>
                    )}
                </div>
                <ChevronDown
                    size={16}
                    className={`text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (check.sample?.length > 0 || check.fix) && (
                <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
                    {check.sample?.length > 0 && (
                        <div className="space-y-1.5">
                            {check.sample.map((s, i) => (
                                <div key={i}
                                     className="flex items-center justify-between gap-4 bg-black/30 rounded-lg px-3 py-2 text-xs">
                                    <span className="text-gray-300 truncate">
                                        {s.date ? <span className="font-mono text-gray-500 mr-2">{s.date}</span> : null}
                                        {s.label}
                                    </span>
                                    {(s.amount !== undefined) && (
                                        <span className="font-mono text-gray-400 shrink-0">
                                            {formatCurrency(Math.abs(Number(s.amount) || 0))}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {check.count > check.sample.length && (
                                <p className="text-[10px] text-gray-600 pl-1">
                                    &hellip; and {check.count - check.sample.length} more
                                </p>
                            )}
                        </div>
                    )}
                    {check.fix && check.severity !== 'ok' && (
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            <span className="font-black uppercase tracking-widest text-gray-600 mr-2">Fix</span>
                            {check.fix}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

const DataHealth = () => {
    const { expenses, salaryDetails, creditCards, formatCurrency } = useFinance();

    const checks = useMemo(
        () => runHealthChecks(expenses, salaryDetails || [], creditCards || []),
        [expenses, salaryDetails, creditCards],
    );
    const totalTx = useMemo(() => flattenTransactions(expenses).length, [expenses]);

    const problems = checks.filter((c) => c.severity !== 'ok');
    const clean = checks.filter((c) => c.severity === 'ok');

    // Share of transactions with both a real category and a description.
    const wellFormed = useMemo(() => {
        const vague = checks.find((c) => c.id === 'vague-category')?.count || 0;
        const untitled = checks.find((c) => c.id === 'no-title')?.count || 0;
        if (!totalTx) return 100;
        return Math.max(0, Math.round(((totalTx - vague - untitled) / totalTx) * 100));
    }, [checks, totalTx]);

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Stethoscope className="text-emerald-400" size={26} />
                    Data Health
                </h1>
                <p className="text-xs text-gray-500 mt-1.5 font-bold uppercase tracking-wider">
                    {totalTx.toLocaleString('en-IN')} transactions checked &middot; nothing is changed automatically
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Fully described
                    </div>
                    <div className="text-3xl font-black text-white">{wellFormed}%</div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all"
                             style={{ width: `${wellFormed}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">Have both a real category and a description</p>
                </div>
                <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Issues found
                    </div>
                    <div className="text-3xl font-black text-white">{problems.length}</div>
                    <p className="text-[11px] text-gray-500 mt-2">
                        {problems.filter((p) => p.severity === 'high').length} need attention
                    </p>
                </div>
                <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Checks passing
                    </div>
                    <div className="text-3xl font-black text-emerald-400">{clean.length}/{checks.length}</div>
                    <p className="text-[11px] text-gray-500 mt-2">No problem detected</p>
                </div>
            </div>

            <div className="space-y-3">
                {checks.map((c) => (
                    <CheckCard key={c.id} check={c} formatCurrency={formatCurrency} />
                ))}
            </div>

            <p className="text-[11px] text-gray-600 leading-relaxed max-w-3xl">
                This page only reports. It never edits, merges or deletes anything &mdash; every fix is
                something you apply yourself from the relevant page, so a wrong diagnosis here can
                never cost you data.
            </p>
        </div>
    );
};

export default DataHealth;
