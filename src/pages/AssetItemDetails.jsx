import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Edit2, Trash2, Plus, TrendingUp, TrendingDown, MapPin, Calendar, Briefcase, Info, Home, User, TrendingUp as Arrow } from 'lucide-react';
import AssetTransactionModal from '../components/AssetTransactionModal';
import AssetItemModal from '../components/AssetItemModal';
import BackButton from '../components/BackButton';
import { formatDate } from '../utils/dateUtils';
import { ENTRY_KINDS, kindOf, summariseRental, rentLedger, expectedRentOn, formatPeriod } from '../utils/rental';
import WarrantyPanel from '../components/WarrantyPanel';

const AssetItemDetails = () => {
    const { categoryId, itemId } = useParams();
    const navigate = useNavigate();
    const { assets, formatCurrency, updateItem } = useFinance();
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    // Ids may be stored as numbers (Date.now()) but URL params are always
    // strings, so these must be compared loosely or the item never resolves.
    const category = assets.find(a => String(a.id) === String(categoryId));
    if (!category) {
        return <div className="p-8 text-center bg-modal m-10 rounded-3xl">Category not found</div>;
    }

    const item = category.items.find(i => String(i.id) === String(itemId));
    if (!item) {
        return <div className="p-8 text-center bg-modal m-10 rounded-3xl">Asset item not found</div>;
    }

    const transactions = item.transactions || [];

    const isRealEstate = category.type === 'real_estate';
    const rental = item.rental;
    const summary = summariseRental(transactions);

    // Yield deliberately excludes a refundable deposit: it is money held on the
    // tenant's behalf, not a return on the asset.
    const totalIncome = summary.income;
    const totalExpenses = summary.expense;

    const categoryTitle = category.title || category.category || category.name
        || category.type?.replace('_', ' ') || 'Assets';
    const ledger = rental ? rentLedger(rental, transactions) : [];
    const arrears = ledger.reduce((sum, r) => sum + r.shortfall, 0);
    const currentRent = rental ? expectedRentOn(rental, new Date().toISOString().slice(0, 10)) : 0;

    const handleSaveAsset = async (updatedData) => {
        const updatedItems = category.items.map(i => i.id === itemId ? updatedData : i);
        await updateItem('asset', { ...category, items: updatedItems });
    };

    const handleDeleteAsset = async () => {
        if (window.confirm('Delete this entire asset and all its transaction history?')) {
            const updatedItems = category.items.filter(i => i.id !== itemId);
            await updateItem('asset', { ...category, items: updatedItems });
            navigate(`/assets/${categoryId}`);
        }
    };

    const handleSaveTx = async (txData) => {
        let updatedTransactions;
        if (editingTx) {
            updatedTransactions = transactions.map(t => t.id === txData.id ? txData : t);
        } else {
            updatedTransactions = [...transactions, txData];
        }

        const updatedItem = { ...item, transactions: updatedTransactions };
        const updatedItems = category.items.map(i => i.id === itemId ? updatedItem : i);
        await updateItem('asset', { ...category, items: updatedItems });
        setIsTxModalOpen(false);
        setEditingTx(null);
    };

    const handleDeleteTx = async (txId) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedTransactions = transactions.filter(t => t.id !== txId);
            const updatedItem = { ...item, transactions: updatedTransactions };
            const updatedItems = category.items.map(i => i.id === itemId ? updatedItem : i);
            await updateItem('asset', { ...category, items: updatedItems });
        }
    };

    return (
        <div className="animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
                <div>
                    <BackButton label={`Back to ${categoryTitle}`} to={`/assets/${categoryId}`} />
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                            <Briefcase className="text-indigo-400" size={32} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight">{item.name}</h2>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    <Calendar size={12} className="text-gray-600" />
                                    {formatDate(item.purchaseDate)}
                                </span>
                                {item.place && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <MapPin size={12} className="text-gray-600" />
                                        {item.place}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsAssetModalOpen(true)}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all group"
                        title="Edit Asset Details"
                    >
                        <Edit2 size={20} className="group-hover:text-blue-400 transition-colors" />
                    </button>
                    <button
                        onClick={handleDeleteAsset}
                        className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                        title="Delete Asset"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">Current Valuation</p>
                    <p className="text-3xl font-black text-emerald-400 tracking-tight relative z-10">{formatCurrency(item.currentValue || 0)}</p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-emerald-500" />
                </div>
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">
                        Total Yield (Income){summary.depositHeld > 0 ? ' · excl. deposit' : ''}
                    </p>
                    <p className="text-3xl font-black text-blue-400 tracking-tight relative z-10 flex items-center gap-2">
                        {formatCurrency(totalIncome)}
                        <TrendingUp size={24} className="opacity-20" />
                    </p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-blue-500" />
                </div>
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">Maintenance (Expenses)</p>
                    <p className="text-3xl font-black text-red-400 tracking-tight relative z-10 flex items-center gap-2">
                        {formatCurrency(totalExpenses)}
                        <TrendingDown size={24} className="opacity-20" />
                    </p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-red-500" />
                </div>
            </div>

            {/* Land has no warranty; goods do. */}
            {!isRealEstate && (
                <div className="mb-10">
                    <WarrantyPanel item={item} onSave={handleSaveAsset} formatCurrency={formatCurrency} />
                </div>
            )}

            {rental && (
                <div className="mb-10 space-y-6">
                    <div className="card border border-emerald-500/20 bg-emerald-500/[0.03]">
                        <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                    <Home className="text-emerald-400" size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white tracking-tight">
                                        {rental.unitName || item.name}
                                    </h3>
                                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                        <User size={11} />
                                        {rental.tenantName || 'No tenant recorded'}
                                        {rental.rentDueDay ? ` · due on the ${rental.rentDueDay}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Rent now</p>
                                <p className="text-3xl font-black text-emerald-400 tracking-tight">
                                    {formatCurrency(currentRent)}
                                </p>
                                {currentRent > (Number(rental.monthlyRent) || 0) && (
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                        started at {formatCurrency(rental.monthlyRent)}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            {[
                                { label: 'Rent received', value: summary.rentReceived, color: '#10b981' },
                                { label: 'Advance held', value: summary.depositHeld, color: '#6366f1', note: 'Refundable' },
                                { label: 'Current bills', value: summary.billsPaid, color: '#f59e0b' },
                                { label: 'Property tax', value: summary.taxPaid, color: '#ef4444' },
                                { label: 'Arrears', value: arrears, color: arrears > 0 ? '#ef4444' : '#10b981' },
                            ].map((tile) => (
                                <div key={tile.label} className="bg-black/30 rounded-2xl p-4 border border-white/5">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1.5">
                                        {tile.label}
                                    </p>
                                    <p className="text-lg font-black tracking-tight" style={{ color: tile.color }}>
                                        {formatCurrency(tile.value)}
                                    </p>
                                    {tile.note && <p className="text-[9px] text-gray-600 mt-0.5">{tile.note}</p>}
                                </div>
                            ))}
                        </div>

                        {(rental.escalationValue > 0 || rental.leaseStart || rental.rules) && (
                            <div className="mt-6 pt-5 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                                {rental.escalationValue > 0 && (
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Increment</p>
                                        <p className="text-gray-300 font-bold flex items-center gap-1.5">
                                            <Arrow size={12} className="text-emerald-400" />
                                            {rental.escalationType === 'fixed'
                                                ? `${formatCurrency(rental.escalationValue)}`
                                                : `${rental.escalationValue}%`} every {rental.escalationEveryMonths} months
                                        </p>
                                    </div>
                                )}
                                {rental.leaseStart && (
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Lease</p>
                                        <p className="text-gray-300 font-bold">
                                            {formatDate(rental.leaseStart)}
                                            {rental.leaseEnd ? ` → ${formatDate(rental.leaseEnd)}` : ''}
                                        </p>
                                    </div>
                                )}
                                {rental.rules && (
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Rules</p>
                                        <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{rental.rules}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {ledger.length > 0 && (
                        <div className="card p-0 overflow-hidden border border-white/5">
                            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                    Rent due vs received
                                </h4>
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                                    Most recent first
                                </span>
                            </div>
                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <tbody className="divide-y divide-white/5">
                                        {ledger.map((row) => (
                                            <tr key={row.month} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="py-3 px-6 font-mono text-gray-400">{formatPeriod(row.month)}</td>
                                                <td className="py-3 px-6 text-right font-mono text-gray-500">
                                                    {formatCurrency(row.due)}
                                                </td>
                                                <td className="py-3 px-6 text-right font-mono font-bold text-white">
                                                    {formatCurrency(row.received)}
                                                </td>
                                                <td className="py-3 px-6 text-right w-32">
                                                    {row.shortfall > 0 ? (
                                                        <span className="text-red-400 font-black">
                                                            short {formatCurrency(row.shortfall)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-400 font-black">paid</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* A payment whose month could not be read is named
                                rather than dropped. Dropping it is what made a
                                month that had been paid show as short. */}
                            {(ledger.unplaced || []).length > 0 && (
                                <div className="px-6 py-4 border-t border-amber-500/20 bg-amber-500/[0.04]">
                                    <p className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
                                        {ledger.unplaced.length} rent payment{ledger.unplaced.length === 1 ? '' : 's'} not counted above
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                        The month each covers could not be read, so it is not matched to any row.
                                        Edit the entry and set the month as <span className="font-mono">2026-08</span>.
                                    </p>
                                    {ledger.unplaced.map((e) => (
                                        <p key={e.id} className="text-[11px] text-gray-500 mt-1 font-mono">
                                            {e.date} · {formatCurrency(e.amount)} · period “{String(e.period || '').trim() || 'blank'}”
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">
                    {rental ? 'Rent, Bills & Tax Entries' : 'Transaction History'}
                </h3>
                <button
                    onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={16} /> Add Transaction
                </button>
            </div>

            <div className="card p-0 overflow-hidden border border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/2">
                                <th className="py-5 px-6">Event Date</th>
                                <th className="py-5 px-6">Classification</th>
                                <th className="py-5 px-6 text-right">Fiscal Impact</th>
                                <th className="py-5 px-6">Description</th>
                                <th className="py-5 px-6 text-center">Manage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-gray-500 font-medium">
                                        No fiscal records identified for this asset.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-5 px-6">
                                            <span className="text-gray-400 text-xs font-medium">{formatDate(tx.date)}</span>
                                        </td>
                                        <td className="py-5 px-6">
                                            <span
                                                className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                                                style={{
                                                    color: ENTRY_KINDS[kindOf(tx)].color,
                                                    backgroundColor: `${ENTRY_KINDS[kindOf(tx)].color}1a`,
                                                    borderColor: `${ENTRY_KINDS[kindOf(tx)].color}44`,
                                                }}
                                            >
                                                {ENTRY_KINDS[kindOf(tx)].label}
                                            </span>
                                            {tx.period && (
                                                <span className="block text-[10px] text-gray-600 font-mono mt-1">
                                                    for {formatPeriod(tx.period)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-5 px-6 text-right font-black text-sm text-white">
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="py-5 px-6">
                                            <span className="text-gray-400 text-xs italic">{tx.description || 'No description provided'}</span>
                                        </td>
                                        <td className="py-5 px-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                                    className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTx(tx.id)}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AssetTransactionModal
                isOpen={isTxModalOpen}
                onClose={() => { setIsTxModalOpen(false); setEditingTx(null); }}
                onSave={handleSaveTx}
                initialData={editingTx}
                isRealEstate={isRealEstate}
            />

            <AssetItemModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                onSave={handleSaveAsset}
                initialData={item}
                categoryType={category.type}
            />
        </div>
    );
};

export default AssetItemDetails;
