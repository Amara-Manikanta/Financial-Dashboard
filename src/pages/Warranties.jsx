import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion, FileText, Wrench, Search } from 'lucide-react';
import { summariseWarranties, STATE_LABEL, receiptsOf, EXPIRING_SOON_DAYS } from '../utils/warranty';
import { formatDate } from '../utils/dateUtils';

const TILES = [
    { key: 'expiring', label: 'Expiring soon', icon: ShieldAlert, tone: 'text-amber-400 border-amber-500/25 bg-amber-500/5' },
    { key: 'active', label: 'In warranty', icon: ShieldCheck, tone: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5' },
    { key: 'expired', label: 'Out of warranty', icon: ShieldOff, tone: 'text-red-400 border-red-500/20 bg-red-500/5' },
    { key: 'unknown', label: 'Not recorded', icon: ShieldQuestion, tone: 'text-gray-400 border-white/10 bg-white/5' },
];

const STATE_DOT = {
    active: 'bg-emerald-400',
    expiring: 'bg-amber-400',
    expired: 'bg-red-400',
    unknown: 'bg-gray-600',
};

/**
 * Every owned item ranked by how soon its cover runs out.
 *
 * Sorted by expiry rather than grouped by category, because the only question
 * this page answers is "what lapses next" — a thing you cannot see when the
 * items are spread across asset categories one page at a time.
 */
const Warranties = () => {
    const { assets, formatCurrency } = useFinance();
    const [filter, setFilter] = useState(null);
    const [query, setQuery] = useState('');

    const summary = useMemo(() => summariseWarranties(assets || []), [assets]);

    const rows = useMemo(() => summary.rows.filter((r) => {
        if (filter && r.status.state !== filter) return false;
        if (!query.trim()) return true;
        const hay = `${r.item.name} ${r.item.seller || ''} ${r.item.serialNumber || ''} ${r.categoryName}`.toLowerCase();
        return hay.includes(query.toLowerCase().trim());
    }), [summary.rows, filter, query]);

    return (
        <div className="animate-fade-in pb-12">
            <div className="mb-8">
                <h1 className="text-4xl font-black tracking-tight text-white">Warranties &amp; Receipts</h1>
                <p className="mt-2 text-sm text-gray-500">
                    {summary.total} items that can carry cover, soonest to lapse first.
                    {summary.missingReceipt > 0 && (
                        <> <span className="text-amber-400">{summary.missingReceipt} have no receipt attached</span> — without the bill a claim is usually refused.</>
                    )}
                </p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {TILES.map(({ key, label, icon: Icon, tone }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(filter === key ? null : key)}
                        className={`rounded-2xl border p-4 text-left transition-all ${tone} ${filter === key ? 'ring-2 ring-white/20' : 'hover:brightness-125'}`}
                    >
                        <Icon size={18} />
                        <p className="mt-2 text-3xl font-black tracking-tight text-white">{summary[key]}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
                    </button>
                ))}
            </div>

            <div className="relative mb-4">
                <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by item, seller or serial number…"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-emerald-500/50"
                />
            </div>

            {filter && (
                <p className="mb-3 text-[11px] text-gray-500">
                    Showing {STATE_LABEL[filter].toLowerCase()} only ·{' '}
                    <button type="button" onClick={() => setFilter(null)} className="text-emerald-400 hover:underline">
                        clear
                    </button>
                </p>
            )}

            <div className="space-y-2">
                {rows.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-gray-500">
                        Nothing matches.
                    </div>
                )}

                {rows.map(({ item, categoryId, categoryName, status, services }) => {
                    const receipts = receiptsOf(item);
                    return (
                        <Link
                            key={`${categoryId}-${item.id}`}
                            to={`/assets/${categoryId}/${item.id}`}
                            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:bg-white/[0.06]"
                        >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${STATE_DOT[status.state]}`} />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-white">{item.name}</p>
                                <p className="truncate text-[11px] text-gray-500">
                                    {categoryName}
                                    {item.purchaseDate ? ` · bought ${formatDate(item.purchaseDate)}` : ''}
                                    {item.seller ? ` · ${item.seller}` : ''}
                                </p>
                            </div>

                            <div className="hidden shrink-0 items-center gap-3 sm:flex">
                                {receipts.length > 0 ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400" title={`${receipts.length} receipt(s)`}>
                                        <FileText size={12} /> {receipts.length}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-amber-500/70" title="No receipt attached">no bill</span>
                                )}
                                {services.count > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400" title={`${services.count} repair(s), ${formatCurrency(services.paid)} paid`}>
                                        <Wrench size={12} /> {services.count}
                                    </span>
                                )}
                            </div>

                            <div className="w-36 shrink-0 text-right">
                                {status.state === 'unknown' ? (
                                    <p className="text-[11px] font-bold text-gray-600">Not recorded</p>
                                ) : (
                                    <>
                                        <p className={`text-xs font-black ${
                                            status.state === 'active' ? 'text-emerald-400'
                                                : status.state === 'expiring' ? 'text-amber-400' : 'text-red-400'
                                        }`}>
                                            {status.state === 'expired'
                                                ? `${Math.abs(status.daysLeft)}d ago`
                                                : `${status.daysLeft}d left`}
                                        </p>
                                        <p className="text-[10px] text-gray-600">{formatDate(status.expiryIso)}</p>
                                    </>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>

            <p className="mt-6 text-[11px] text-gray-600">
                "Expiring soon" means cover ends within {EXPIRING_SOON_DAYS} days. Items with no
                warranty period recorded are listed last — they are a gap in the records rather
                than a fact about the item.
            </p>
        </div>
    );
};

export default Warranties;
