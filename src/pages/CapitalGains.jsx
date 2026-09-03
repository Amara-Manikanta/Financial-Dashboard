import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
    Scale, AlertTriangle, Clock, TrendingUp, TrendingDown, Archive, Info,
} from 'lucide-react';
import BackButton from '../components/BackButton';
import {
    disposalsForStocks, gainsLedger, unrealisedSummary, matchLots, fyFor, exemptionFor,
} from '../utils/capitalGains';

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const signed = (n) => (Number(n) >= 0 ? 'text-emerald-400' : 'text-rose-400');

/**
 * Funds whose gains do not follow the equity rules.
 *
 * Since April 2023 a debt fund's gains are taxed at the slab rate however long
 * it was held, so mixing them into a section 112A total would understate the
 * tax on one and overstate the exemption available to the other. The class is
 * inferred from the scheme name, which is a guess — a hybrid fund's treatment
 * depends on its actual equity allocation, and that is not in this database.
 */
const DEBT_HINTS = ['liquid', 'debt', 'bond', 'gilt', 'money market', 'overnight', 'corporate bond'];
const HYBRID_HINTS = ['balanced', 'hybrid', 'advantage', 'asset allocat'];

const classOf = (title = '') => {
    const t = String(title).toLowerCase();
    if (DEBT_HINTS.some((h) => t.includes(h))) return 'debt';
    if (HYBRID_HINTS.some((h) => t.includes(h))) return 'hybrid';
    return 'equity';
};

const CapitalGains = () => {
    const { savings, formatCurrency } = useFinance();
    const [tab, setTab] = useState('realised');

    const market = useMemo(
        () => (savings || []).find((s) => s.type === 'stock_market'),
        [savings],
    );
    const stocks = market?.stocks || [];

    const { disposals, unmatched } = useMemo(() => disposalsForStocks(stocks), [stocks]);
    const ledger = useMemo(() => gainsLedger(disposals), [disposals]);
    const unrealised = useMemo(() => unrealisedSummary(stocks), [stocks]);

    const funds = useMemo(() => (savings || []).filter((s) => s.type === 'mutual_fund'), [savings]);

    const fundDisposals = useMemo(() => {
        const out = [];
        funds.forEach((f) => {
            const name = f.title || f.name || 'Unnamed fund';
            const r = matchLots(f.transactions, { name, id: f.id });
            r.disposals.forEach((d) => out.push({ ...d, assetClass: classOf(name) }));
        });
        return out.sort((a, b) => String(b.soldOn).localeCompare(String(a.soldOn)));
    }, [funds]);

    const currentFy = fyFor(new Date());
    const thisYear = ledger.years.find((y) => y.fy === currentFy);

    const carriedTotal = (ledger.carried?.short || []).reduce((s, c) => s + c.amount, 0)
        + (ledger.carried?.long || []).reduce((s, c) => s + c.amount, 0);

    const TABS = [
        { id: 'realised', label: 'Realised & tax' },
        { id: 'unrealised', label: 'Still held' },
        { id: 'disposals', label: `Every disposal (${disposals.length})` },
        { id: 'funds', label: `Mutual funds (${fundDisposals.length})` },
    ];

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <BackButton label="Back to Investments" />

            <div className="mb-6">
                <div className="flex items-center gap-3">
                    <Scale size={22} className="text-sky-400" />
                    <h1 className="text-3xl font-black text-white tracking-tight">Capital Gains</h1>
                </div>
                <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                    Matched first in, first out, because that is how the gain is actually computed —
                    the average cost your portfolio pages show cannot tell a 2021 lot from a 2026 one,
                    and the difference between them decides whether a sale is short or long term.
                </p>
            </div>

            {/* Data gap first: everything below is only as good as the history */}
            {unmatched.length > 0 && (
                <div className="card p-5 mb-6 border-amber-500/30 bg-amber-500/[0.04]">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-black text-white">
                                {unmatched.reduce((s, u) => s + u.quantity, 0)} shares were sold with no
                                purchase on record
                            </p>
                            <p className="text-[12px] text-gray-400 mt-1.5 leading-relaxed">
                                These disposals have no cost to match against, so they are left out of every
                                figure on this page rather than being counted at zero cost — which would
                                invent a gain equal to the whole sale. Add the missing purchases and the
                                numbers here will complete themselves.
                            </p>
                            <div className="mt-3 space-y-1">
                                {unmatched.map((u, i) => (
                                    <p key={i} className="text-[11px] text-amber-200">
                                        {u.holding} — {u.quantity} sold on {u.soldOn}
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Headline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">This year ({currentFy})</p>
                    <p className={`text-xl font-black mt-2 ${signed((thisYear?.grossShort || 0) + (thisYear?.grossLong || 0))}`}>
                        {inr((thisYear?.grossShort || 0) + (thisYear?.grossLong || 0))}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">{thisYear?.disposalCount || 0} disposals so far</p>
                </div>
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Estimated tax this year</p>
                    <p className="text-xl font-black text-white mt-2">{inr(thisYear?.estimatedTax || 0)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">Before surcharge and cess</p>
                </div>
                <div className="card p-5 border-sky-500/20">
                    <p className="text-[10px] font-black text-sky-400 uppercase tracking-wider">Losses carried forward</p>
                    <p className="text-xl font-black text-white mt-2">{inr(carriedTotal)}</p>
                    <p className="text-[11px] text-gray-600 mt-1">Available against future gains</p>
                </div>
                <div className="card p-5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Realised, all time</p>
                    <p className={`text-xl font-black mt-2 ${signed(ledger.totals?.realised)}`}>
                        {inr(ledger.totals?.realised || 0)}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">{ledger.totals?.disposals || 0} matched disposals</p>
                </div>
            </div>

            {/* The carried-forward losses are the actionable part */}
            {carriedTotal > 0 && (
                <div className="card p-5 mb-6">
                    <div className="flex items-start gap-3">
                        <Archive size={16} className="text-sky-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-black text-white">Carried-forward losses, and when they lapse</p>
                            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                A capital loss can be carried for eight assessment years and then expires unused.
                                A short-term loss may be set against either kind of gain; a long-term loss only
                                against a long-term one.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                {[['short', 'Short-term losses'], ['long', 'Long-term losses']].map(([k, label]) => (
                                    (ledger.carried?.[k] || []).length > 0 && (
                                        <div key={k} className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">{label}</p>
                                            {ledger.carried[k].map((c) => (
                                                <div key={c.fy} className="flex items-center justify-between py-1">
                                                    <span className="text-[12px] text-gray-400">
                                                        From FY {c.fy}
                                                    </span>
                                                    <span className="text-[12px] text-white font-bold">
                                                        {inr(c.amount)}
                                                        <span className="text-gray-600 font-normal ml-2">
                                                            lapses after FY {c.expiresAfter}
                                                        </span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                            tab === t.id
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'realised' && (
                <div className="card p-6">
                    <h2 className="text-lg font-black text-white mb-1">Year by year</h2>
                    <p className="text-[11px] text-gray-500 mb-4">
                        Set-off is applied in the order the Act requires, and the {inr(exemptionFor(currentFy))} exemption
                        on long-term equity gains is applied after it.
                    </p>
                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['FY', 'Short-term', 'Long-term', 'Loss set off', 'Taxable ST', 'Taxable LT', 'Est. tax', 'Carried out'].map((h, i) => (
                                        <th key={h} className={`py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.years.map((y) => {
                                    const setOff = y.setOffShortAgainstShort + y.setOffShortAgainstLong + y.setOffLongAgainstLong;
                                    return (
                                        <tr key={y.fy} className={`border-b border-white/[0.03] ${y.fy === currentFy ? 'bg-white/[0.02]' : ''}`}>
                                            <td className="py-3 text-[13px] text-white font-bold">
                                                {y.fy}
                                                {y.fy === currentFy && <span className="ml-2 text-[9px] text-sky-400 font-black uppercase">Current</span>}
                                            </td>
                                            <td className={`py-3 text-right text-[13px] tabular-nums ${signed(y.grossShort)}`}>{inr(y.grossShort)}</td>
                                            <td className={`py-3 text-right text-[13px] tabular-nums ${signed(y.grossLong)}`}>{inr(y.grossLong)}</td>
                                            <td className="py-3 text-right text-[13px] text-sky-300 tabular-nums">{setOff > 0 ? inr(setOff) : '—'}</td>
                                            <td className="py-3 text-right text-[13px] text-gray-300 tabular-nums">{inr(y.taxableShort)}</td>
                                            <td className="py-3 text-right text-[13px] text-gray-300 tabular-nums">{inr(y.taxableLong)}</td>
                                            <td className="py-3 text-right text-[13px] text-white font-bold tabular-nums">{inr(y.estimatedTax)}</td>
                                            <td className="py-3 text-right text-[12px] text-gray-500 tabular-nums">
                                                {inr(y.closingCarriedShort + y.closingCarriedLong)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {ledger.years.some((y) => y.buybackDividend > 0) && (
                        <div className="mt-5 rounded-xl bg-white/[0.03] border border-white/5 p-4">
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                <strong className="text-white">Buybacks are not in the gains above.</strong> Since
                                1 October 2024 the whole amount a company pays you in a buyback is taxed as
                                dividend income at your slab rate, and the cost of the shares you tendered
                                becomes a capital loss instead. Both are reflected — the loss sits in the columns
                                above, the income does not, because it is not a capital gain.
                                {ledger.years.filter((y) => y.buybackDividend > 0).map((y) => (
                                    <span key={y.fy} className="block mt-1 text-gray-500">
                                        FY {y.fy}: {inr(y.buybackDividend)} of buyback proceeds taxed as dividend.
                                    </span>
                                ))}
                            </p>
                        </div>
                    )}

                    <div className="mt-4 flex items-start gap-2">
                        <Info size={13} className="text-gray-600 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                            An estimate from your own transaction history, not a tax return. It applies one pair
                            of rates per financial year, so FY 2024-25 — which straddles the 23 July 2024 change —
                            is computed at the later rates throughout. It excludes surcharge, cess, and any
                            set-off against income from outside this portfolio.
                        </p>
                    </div>
                </div>
            )}

            {tab === 'unrealised' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card p-5">
                            <div className="flex items-center gap-2">
                                <Clock size={15} className="text-amber-400" />
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Short-term lots</p>
                            </div>
                            <p className={`text-xl font-black mt-2 ${signed(unrealised.shortTerm.gain)}`}>
                                {inr(unrealised.shortTerm.gain)}
                            </p>
                            <p className="text-[11px] text-gray-600 mt-1">
                                {unrealised.shortTerm.count} lots · {inr(unrealised.shortTerm.value)} at market
                            </p>
                        </div>
                        <div className="card p-5">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={15} className="text-emerald-400" />
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Long-term lots</p>
                            </div>
                            <p className={`text-xl font-black mt-2 ${signed(unrealised.longTerm.gain)}`}>
                                {inr(unrealised.longTerm.gain)}
                            </p>
                            <p className="text-[11px] text-gray-600 mt-1">
                                {unrealised.longTerm.count} lots · {inr(unrealised.longTerm.value)} at market
                            </p>
                        </div>
                    </div>

                    {unrealised.crossingWithin90Days.length > 0 && (
                        <div className="card p-5">
                            <p className="text-sm font-black text-white">
                                {unrealised.crossingWithin90Days.length} lots cross into long term within 90 days
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1 mb-3">
                                Stated as a fact about each lot's date. What to do about it is not something this
                                page decides.
                            </p>
                            <div className="space-y-1.5">
                                {unrealised.crossingWithin90Days.map((l, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                                        <div>
                                            <p className="text-[12px] text-gray-200">{l.holding}</p>
                                            <p className="text-[10px] text-gray-600">
                                                {l.quantity} bought {l.acquiredOn}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-[12px] font-bold ${signed(l.gain)}`}>{inr(l.gain)}</p>
                                            <p className="text-[10px] text-amber-300">
                                                long term in {l.daysToLongTerm} days
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card p-6">
                        <h2 className="text-lg font-black text-white mb-4">Every open lot</h2>
                        <div className="overflow-x-auto -mx-6 px-6">
                            <table className="w-full min-w-[820px]">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        {['Holding', 'Acquired', 'Qty', 'Cost', 'Value', 'Gain', 'Term'].map((h, i) => (
                                            <th key={h} className={`py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider ${i === 0 || i === 1 ? 'text-left' : 'text-right'}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {unrealised.lots.map((l, i) => (
                                        <tr key={i} className="border-b border-white/[0.03]">
                                            <td className="py-2.5 text-[12px] text-gray-200">{l.holding}</td>
                                            <td className="py-2.5 text-[12px] text-gray-500">
                                                {l.acquiredOn}
                                                {l.acquiredAs !== 'buy' && (
                                                    <span className="ml-1.5 text-[9px] uppercase text-gray-600">{l.acquiredAs}</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">{l.quantity}</td>
                                            <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">{inr(l.cost)}</td>
                                            <td className="py-2.5 text-right text-[12px] text-gray-300 tabular-nums">{inr(l.value)}</td>
                                            <td className={`py-2.5 text-right text-[12px] font-bold tabular-nums ${signed(l.gain)}`}>{inr(l.gain)}</td>
                                            <td className="py-2.5 text-right">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                    l.term === 'long'
                                                        ? 'bg-emerald-500/10 text-emerald-300'
                                                        : 'bg-amber-500/10 text-amber-300'
                                                }`}>
                                                    {l.term}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'disposals' && (
                <div className="card p-6">
                    <h2 className="text-lg font-black text-white mb-1">Every matched disposal</h2>
                    <p className="text-[11px] text-gray-500 mb-4">
                        One sale can produce several rows: selling 10 shares that were bought across three
                        purchases matches three lots, each with its own cost and holding period.
                    </p>
                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['Holding', 'Bought', 'Sold', 'Qty', 'Cost', 'Proceeds', 'Gain', 'Term', 'FY'].map((h, i) => (
                                        <th key={h} className={`py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider ${i < 3 ? 'text-left' : 'text-right'}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {disposals.map((d, i) => (
                                    <tr key={i} className="border-b border-white/[0.03]">
                                        <td className="py-2.5 text-[12px] text-gray-200">
                                            {d.holding}
                                            {d.treatedAsDividend && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[9px] font-black uppercase">
                                                    Buyback
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 text-[12px] text-gray-500">{d.acquiredOn}</td>
                                        <td className="py-2.5 text-[12px] text-gray-500">{d.soldOn}</td>
                                        <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">{d.quantity}</td>
                                        <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">{inr(d.cost)}</td>
                                        <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">
                                            {d.treatedAsDividend ? `${inr(d.dividendIncome)} as dividend` : inr(d.proceeds)}
                                        </td>
                                        <td className={`py-2.5 text-right text-[12px] font-bold tabular-nums ${signed(d.gain)}`}>{inr(d.gain)}</td>
                                        <td className="py-2.5 text-right text-[10px] uppercase font-black text-gray-500">{d.term}</td>
                                        <td className="py-2.5 text-right text-[11px] text-gray-600">{d.fy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'funds' && (
                <div className="card p-6">
                    <h2 className="text-lg font-black text-white mb-1">Mutual fund redemptions</h2>
                    <p className="text-[11px] text-gray-500 mb-4 max-w-3xl leading-relaxed">
                        Kept separate from the equity totals above on purpose. Since April 2023 a debt fund's
                        gains are taxed at your slab rate however long you held it, and a hybrid fund follows
                        whichever set of rules its actual equity allocation puts it under — which this database
                        does not record. The class shown is inferred from the scheme name.
                    </p>
                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full min-w-[880px]">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['Fund', 'Class', 'Bought', 'Sold', 'Units', 'Cost', 'Proceeds', 'Gain', 'Held'].map((h, i) => (
                                        <th key={h} className={`py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider ${i < 4 ? 'text-left' : 'text-right'}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {fundDisposals.map((d, i) => (
                                    <tr key={i} className="border-b border-white/[0.03]">
                                        <td className="py-2.5 text-[12px] text-gray-200">{d.holding}</td>
                                        <td className="py-2.5">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                d.assetClass === 'equity' ? 'bg-emerald-500/10 text-emerald-300'
                                                    : d.assetClass === 'debt' ? 'bg-sky-500/10 text-sky-300'
                                                        : 'bg-amber-500/10 text-amber-300'
                                            }`}>
                                                {d.assetClass}
                                            </span>
                                        </td>
                                        <td className="py-2.5 text-[12px] text-gray-500">{d.acquiredOn}</td>
                                        <td className="py-2.5 text-[12px] text-gray-500">{d.soldOn}</td>
                                        <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">{d.quantity}</td>
                                        <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">{inr(d.cost)}</td>
                                        <td className="py-2.5 text-right text-[12px] text-gray-400 tabular-nums">{inr(d.proceeds)}</td>
                                        <td className={`py-2.5 text-right text-[12px] font-bold tabular-nums ${signed(d.gain)}`}>{inr(d.gain)}</td>
                                        <td className="py-2.5 text-right text-[10px] uppercase font-black text-gray-500">{d.term}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {fundDisposals.length === 0 && (
                            <p className="text-[12px] text-gray-500 py-8 text-center">No fund redemptions recorded.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CapitalGains;
