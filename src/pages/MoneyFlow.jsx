import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
    ArrowDownRight, PiggyBank, CreditCard, Users, Landmark, HelpCircle, Check,
} from 'lucide-react';
import BackButton from '../components/BackButton';
import {
    KINDS, KIND_LABELS, KIND_BLURBS, flowBreakdown, allTransactions, isDebit,
    kindFor, defaultKindForCategory, isVagueCategory, averageMonthlySpend,
} from '../utils/transactionKind';

const ICONS = {
    spend: ArrowDownRight,
    transfer: PiggyBank,
    settlement: CreditCard,
    lending: Users,
    payroll: Landmark,
};

const TONE = {
    spend: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
    transfer: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    settlement: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
    lending: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    payroll: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
};

const DOT = {
    spend: 'bg-rose-400',
    transfer: 'bg-emerald-400',
    settlement: 'bg-sky-400',
    lending: 'bg-amber-400',
    payroll: 'bg-violet-400',
};

const PERIODS = [
    { id: '12m', label: 'Last 12 months' },
    { id: 'year', label: 'This year' },
    { id: 'all', label: 'All time' },
];

/**
 * Where the money actually goes.
 *
 * Every other page in this app treats a debit as a debit. This one asks what
 * each debit *was* — consumption, a transfer into savings, a card bill for
 * purchases already counted, or money lent — because summing them together
 * roughly doubles the apparent cost of living and makes every budget, forecast
 * and runway figure wrong in the same direction.
 */
const MoneyFlow = () => {
    const { expenses, categoryKinds, saveCategoryKinds, formatCurrency, isGuest } = useFinance();
    const [period, setPeriod] = useState('12m');
    const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);

    const now = new Date();

    const scoped = useMemo(() => {
        const all = allTransactions(expenses);
        if (period === 'all') return all;
        const cutoff = period === 'year'
            ? `${now.getFullYear()}-01-01`
            : new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
        return all.filter((t) => String(t.date || '') >= cutoff);
    }, [expenses, period]);

    const breakdown = useMemo(
        () => flowBreakdown(scoped, categoryKinds),
        [scoped, categoryKinds],
    );

    // The naive figure, for the comparison that makes the point.
    const naive = useMemo(
        () => scoped.filter(isDebit).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0),
        [scoped],
    );

    const avg = useMemo(
        () => averageMonthlySpend(expenses, categoryKinds, 6, now),
        [expenses, categoryKinds],
    );

    /** Every debit category in the scoped window, with its total and current kind. */
    const categoryRows = useMemo(() => {
        const totals = {};
        scoped.forEach((t) => {
            if (!isDebit(t)) return;
            const cat = String(t.category || '').trim().toLowerCase() || 'uncategorised';
            totals[cat] = totals[cat] || { category: cat, amount: 0, count: 0 };
            totals[cat].amount += Math.abs(Number(t.amount) || 0);
            totals[cat].count += 1;
        });
        return Object.values(totals)
            .map((r) => {
                const assigned = categoryKinds?.[r.category];
                return {
                    ...r,
                    amount: Math.round(r.amount * 100) / 100,
                    kind: kindFor({ category: r.category }, categoryKinds),
                    assigned: KINDS.includes(assigned) ? assigned : null,
                    suggested: defaultKindForCategory(r.category),
                    vague: isVagueCategory(r.category),
                };
            })
            .sort((a, b) => b.amount - a.amount);
    }, [scoped, categoryKinds]);

    const visibleCategories = onlyUnreviewed
        ? categoryRows.filter((r) => r.vague && !r.assigned)
        : categoryRows;

    const setKind = (category, kind) => {
        const next = { ...(categoryKinds || {}) };
        if (!kind) delete next[category];
        else next[category] = kind;
        saveCategoryKinds(next);
    };

    const spendPct = breakdown.gross > 0 ? (breakdown.spend / breakdown.gross) * 100 : 0;

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <BackButton label="Back to Analytics" />

            <div className="mb-8">
                <h1 className="text-3xl font-black text-white tracking-tight">Money Flow</h1>
                <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                    A debit is not the same as an expense. Moving cash into a fixed deposit, paying
                    off a card whose purchases were already logged, or lending to a cousin all leave
                    the account without costing you anything. Splitting them apart is the difference
                    between {formatCurrency(naive)} and {formatCurrency(breakdown.spend)} over this
                    period.
                </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
                {PERIODS.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => setPeriod(p.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                            period === p.id
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Headline comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">All money out</p>
                    <p className="text-2xl font-black text-gray-300 mt-2">{formatCurrency(breakdown.gross)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">Every debit, however it was used</p>
                </div>
                <div className="card p-6 border-rose-500/20">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Actually spent</p>
                    <p className="text-2xl font-black text-white mt-2">{formatCurrency(breakdown.spend)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{spendPct.toFixed(0)}% of money out was consumption</p>
                </div>
                <div className="card p-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Real monthly spend</p>
                    <p className="text-2xl font-black text-white mt-2">{formatCurrency(avg.average)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">
                        Average of the last {avg.months} complete month{avg.months === 1 ? '' : 's'}
                    </p>
                </div>
            </div>

            {/* Proportional bar */}
            {breakdown.gross > 0 && (
                <div className="card p-6 mb-6">
                    <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
                        {breakdown.rows.filter((r) => r.total > 0).map((r) => (
                            <div
                                key={r.kind}
                                className={DOT[r.kind]}
                                style={{ width: `${r.pct}%` }}
                                title={`${r.label} — ${formatCurrency(r.total)}`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
                        {breakdown.rows.filter((r) => r.total > 0).map((r) => (
                            <div key={r.kind} className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${DOT[r.kind]}`} />
                                <span className="text-[11px] font-bold text-gray-300">{r.label}</span>
                                <span className="text-[11px] text-gray-600">{r.pct.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Per-kind detail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                {breakdown.rows.filter((r) => r.count > 0).map((r) => {
                    const Icon = ICONS[r.kind] || ArrowDownRight;
                    return (
                        <div key={r.kind} className="card p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${TONE[r.kind]}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">{r.label}</p>
                                        <p className="text-[11px] text-gray-600">{r.count} transactions</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-white">{formatCurrency(r.total)}</p>
                                    <p className="text-[11px] text-gray-600">{r.pct.toFixed(1)}% of money out</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{r.blurb}</p>
                            <div className="flex flex-wrap gap-1.5 mt-4">
                                {r.categories.slice(0, 6).map((c) => (
                                    <span
                                        key={c.category}
                                        className="px-2 py-1 rounded-lg bg-white/5 text-[10px] text-gray-400 capitalize"
                                    >
                                        {c.category} · {formatCurrency(c.amount)}
                                    </span>
                                ))}
                                {r.categories.length > 6 && (
                                    <span className="px-2 py-1 text-[10px] text-gray-600">
                                        +{r.categories.length - 6} more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* The honest caveat */}
            {breakdown.unreviewed.count > 0 && (
                <div className="card p-6 mb-8 border-amber-500/20 bg-amber-500/[0.03]">
                    <div className="flex items-start gap-3">
                        <HelpCircle size={18} className="text-amber-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-black text-white">
                                {formatCurrency(breakdown.unreviewed.total)} is counted as spending only because
                                nothing says otherwise
                            </p>
                            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
                                {breakdown.unreviewed.count} transactions sit in categories too vague to
                                classify — that is {breakdown.unreviewed.pctOfSpend.toFixed(0)}% of the spending
                                figure above. They have not been guessed at, because a rule that moved this much
                                money on the strength of a word would be wrong quietly. Set a kind for these
                                categories below and every figure in the app follows.
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {breakdown.unreviewed.categories.map((c) => (
                                    <span
                                        key={c.category}
                                        className="px-2 py-1 rounded-lg bg-amber-500/10 text-[10px] text-amber-200 capitalize"
                                    >
                                        {c.category} · {formatCurrency(c.amount)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Classifier */}
            <div className="card p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                    <div>
                        <h2 className="text-lg font-black text-white">Classify categories</h2>
                        <p className="text-[11px] text-gray-500 mt-1">
                            A rule per category, not per row — {categoryRows.reduce((s, r) => s + r.count, 0)} debits
                            across {categoryRows.length} categories. Nothing rewrites your transactions; the rule is
                            stored and applied when figures are read.
                        </p>
                    </div>
                    <button
                        onClick={() => setOnlyUnreviewed((v) => !v)}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                            onlyUnreviewed
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {onlyUnreviewed ? 'Showing needs-review only' : 'Show needs-review only'}
                    </button>
                </div>

                {isGuest && (
                    <p className="text-[11px] text-amber-300 mb-3">
                        Guest mode — changes here are not saved.
                    </p>
                )}

                <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full min-w-[720px]">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="py-3 text-left text-[9px] font-black text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="py-3 text-right text-[9px] font-black text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="py-3 text-right text-[9px] font-black text-gray-500 uppercase tracking-wider">Rows</th>
                                <th className="py-3 text-left text-[9px] font-black text-gray-500 uppercase tracking-wider pl-6">Treated as</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleCategories.map((r) => (
                                <tr key={r.category} className="border-b border-white/[0.03]">
                                    <td className="py-3 text-[13px] text-gray-200 capitalize">
                                        <span className="flex items-center gap-2">
                                            {r.category}
                                            {r.vague && !r.assigned && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-black uppercase">
                                                    Needs review
                                                </span>
                                            )}
                                            {r.assigned && (
                                                <Check size={12} className="text-emerald-400" />
                                            )}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right text-[13px] text-white font-bold tabular-nums">
                                        {formatCurrency(r.amount)}
                                    </td>
                                    <td className="py-3 text-right text-[12px] text-gray-500 tabular-nums">{r.count}</td>
                                    <td className="py-3 pl-6">
                                        <div className="flex flex-wrap gap-1">
                                            {KINDS.filter((k) => k !== 'payroll').map((k) => (
                                                <button
                                                    key={k}
                                                    onClick={() => setKind(r.category, r.assigned === k ? null : k)}
                                                    title={KIND_BLURBS[k]}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                        r.kind === k
                                                            ? TONE[k]
                                                            : 'bg-white/2 border-white/5 text-gray-600 hover:text-gray-300'
                                                    }`}
                                                >
                                                    {KIND_LABELS[k]}
                                                </button>
                                            ))}
                                        </div>
                                        {!r.assigned && r.suggested !== 'spend' && (
                                            <p className="text-[10px] text-gray-600 mt-1">
                                                Built-in default. Click to override.
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {visibleCategories.length === 0 && (
                        <p className="text-[12px] text-gray-500 py-8 text-center">
                            Nothing left to review — every vague category has a kind set.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MoneyFlow;
