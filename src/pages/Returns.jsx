import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Gauge, Info, ArrowUpDown } from 'lucide-react';
import BackButton from '../components/BackButton';
import { rankedReturns, portfolioReturn } from '../utils/xirr';

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const pct = (n) => `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`;
const tone = (n) => (Number(n) >= 0 ? 'text-emerald-400' : 'text-rose-400');

const SORTS = [
    { id: 'xirr', label: 'Annualised return' },
    { id: 'simple', label: 'Total return' },
    { id: 'invested', label: 'Money in' },
    { id: 'profit', label: 'Profit' },
];

/**
 * How each holding has actually performed, weighted by money and time.
 *
 * The portfolio pages show a simple percentage, which cannot distinguish a
 * holding that doubled in three months from one that doubled in nine years,
 * and has no way to account for money added along the way. This page shows
 * both, side by side, because the gap between them is usually the whole story.
 */
const Returns = () => {
    const navigate = useNavigate();
    const { savings, formatCurrency } = useFinance();
    const [sort, setSort] = useState('xirr');
    const [includeArchived, setIncludeArchived] = useState(false);

    const market = useMemo(() => (savings || []).find((s) => s.type === 'stock_market'), [savings]);
    const marketId = market?.id;
    const stocks = market?.stocks || [];
    const funds = useMemo(() => (savings || []).filter((s) => s.type === 'mutual_fund'), [savings]);

    const rows = useMemo(() => {
        const all = rankedReturns(stocks, funds);
        return includeArchived ? all : all.filter((r) => !r.archived);
    }, [stocks, funds, includeArchived]);

    const portfolio = useMemo(() => portfolioReturn(stocks, funds), [stocks, funds]);

    const sorted = useMemo(() => {
        const copy = [...rows];
        const key = { xirr: 'xirrPct', simple: 'simplePct', invested: 'invested', profit: 'profit' }[sort];
        copy.sort((a, b) => {
            const av = a[key];
            const bv = b[key];
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            return bv - av;
        });
        return copy;
    }, [rows, sort]);

    const notComputable = rows.filter((r) => r.xirrPct === null);
    const tooShort = rows.filter((r) => r.tooShortToAnnualise);

    const open = (r) => {
        if (r.kind === 'stock' && marketId) navigate(`/savings/stock-market/${marketId}/stock/${r.id}`);
        else if (r.kind === 'fund') navigate(`/savings/mutual-fund/${r.id}`);
    };

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <BackButton label="Back to Investments" />

            <div className="mb-6">
                <div className="flex items-center gap-3">
                    <Gauge size={22} className="text-emerald-400" />
                    <h1 className="text-3xl font-black text-white tracking-tight">Returns</h1>
                </div>
                <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                    Annualised, money-weighted. A SIP running for four years has fifty different holding
                    periods inside it, and the simple percentage your portfolio shows is the average of
                    none of them. This is the single yearly rate that makes every one of your cash flows
                    add up.
                </p>
            </div>

            {/* The portfolio as one series */}
            <div className="card p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Portfolio XIRR</p>
                        <p className={`text-2xl font-black mt-1.5 ${tone(portfolio.xirrPct)}`}>
                            {portfolio.xirrPct === null ? '—' : pct(portfolio.xirrPct)}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">a year, since {portfolio.firstFlow}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Total return</p>
                        <p className={`text-2xl font-black mt-1.5 ${tone(portfolio.simplePct)}`}>
                            {portfolio.simplePct === null ? '—' : pct(portfolio.simplePct)}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">not annualised</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Money in</p>
                        <p className="text-2xl font-black text-white mt-1.5">{inr(portfolio.invested)}</p>
                        <p className="text-[10px] text-gray-600 mt-1">every purchase, all time</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Taken out</p>
                        <p className="text-2xl font-black text-white mt-1.5">{inr(portfolio.returned)}</p>
                        <p className="text-[10px] text-gray-600 mt-1">sales and dividends</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Still held</p>
                        <p className="text-2xl font-black text-white mt-1.5">{inr(portfolio.closing)}</p>
                        <p className="text-[10px] text-gray-600 mt-1">at today's prices</p>
                    </div>
                </div>
                <p className="text-[11px] text-gray-600 mt-5 leading-relaxed">
                    Computed by pooling every holding's cash flows into one series, not by averaging the
                    individual rates — an average would weight a ₹500 position the same as a ₹2 lakh one.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-5">
                <ArrowUpDown size={14} className="text-gray-600" />
                {SORTS.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setSort(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                            sort === s.id
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
                <button
                    onClick={() => setIncludeArchived((v) => !v)}
                    className={`ml-auto px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        includeArchived
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'
                    }`}
                >
                    {includeArchived ? 'Including closed positions' : 'Show closed positions'}
                </button>
            </div>

            <div className="card p-6">
                <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full min-w-[880px]">
                        <thead>
                            <tr className="border-b border-white/5">
                                {['Holding', 'Money in', 'Taken out', 'Still held', 'Profit', 'Total', 'Annualised', 'Held'].map((h, i) => (
                                    <th key={h} className={`py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r) => (
                                <tr
                                    key={`${r.kind}-${r.id}`}
                                    onClick={() => open(r)}
                                    className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                                >
                                    <td className="py-3 text-[12px] text-gray-200">
                                        {r.name}
                                        <span className="ml-2 text-[9px] uppercase font-black text-gray-600">
                                            {r.kind === 'fund' ? 'fund' : ''}
                                        </span>
                                        {r.archived && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-[9px] font-black uppercase">
                                                Closed
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 text-right text-[12px] text-gray-400 tabular-nums">{inr(r.invested)}</td>
                                    <td className="py-3 text-right text-[12px] text-gray-400 tabular-nums">{inr(r.returned)}</td>
                                    <td className="py-3 text-right text-[12px] text-gray-400 tabular-nums">{inr(r.closing)}</td>
                                    <td className={`py-3 text-right text-[12px] font-bold tabular-nums ${tone(r.profit)}`}>{inr(r.profit)}</td>
                                    <td className={`py-3 text-right text-[12px] tabular-nums ${tone(r.simplePct)}`}>
                                        {r.simplePct === null ? '—' : pct(r.simplePct)}
                                    </td>
                                    <td className="py-3 text-right tabular-nums">
                                        {r.xirrPct === null ? (
                                            <span className="text-[11px] text-gray-600">not computable</span>
                                        ) : r.tooShortToAnnualise ? (
                                            <span
                                                className="text-[11px] text-gray-600"
                                                title={`Held only ${r.days} day${r.days === 1 ? '' : 's'} — annualising this would report ${pct(r.xirrPct)}, which says nothing about the holding.`}
                                            >
                                                too short
                                            </span>
                                        ) : (
                                            <span className={`text-[12px] font-black ${tone(r.xirrPct)}`}>{pct(r.xirrPct)}</span>
                                        )}
                                    </td>
                                    <td className="py-3 text-right text-[11px] text-gray-600 tabular-nums">
                                        {r.days >= 365 ? `${(r.days / 365).toFixed(1)}y` : `${r.days}d`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 space-y-3">
                    {tooShort.length > 0 && (
                        <div className="flex items-start gap-2">
                            <Info size={13} className="text-gray-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                <strong className="text-gray-300">{tooShort.length} holdings show "too short".</strong>{' '}
                                Annualising a few days of movement produces a number that is arithmetically
                                correct and completely useless — a 16.5% gain over six days annualises to over
                                six million percent. Their total return is still shown; only the yearly rate is
                                withheld.
                            </p>
                        </div>
                    )}
                    {notComputable.length > 0 && (
                        <div className="flex items-start gap-2">
                            <Info size={13} className="text-gray-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                <strong className="text-gray-300">{notComputable.length} have no computable rate.</strong>{' '}
                                A rate needs money going both ways. A holding that was only ever bought, with
                                nothing sold and no current price recorded, has no rate at all — and reporting
                                zero would be a claim rather than an absence.
                                <span className="block mt-1 text-gray-600">
                                    {notComputable.map((r) => r.name).join(', ')}
                                </span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Returns;
