import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Edit2, Trash2, Plus, TrendingUp, TrendingDown, MapPin, Calendar, Briefcase, Info } from 'lucide-react';
import AssetTransactionModal from '../components/AssetTransactionModal';
import AssetItemModal from '../components/AssetItemModal';
import { formatDate } from '../utils/dateUtils';

const AssetItemDetails = () => {
    const { categoryId, itemId } = useParams();
    const navigate = useNavigate();
    const { assets, formatCurrency, updateItem } = useFinance();
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const category = assets.find(a => a.id === categoryId);
    if (!category) {
        return <div className="p-8 text-center bg-modal m-10 rounded-3xl">Category not found</div>;
    }

    const item = category.items.find(i => i.id === itemId);
    if (!item) {
        return <div className="p-8 text-center bg-modal m-10 rounded-3xl">Asset item not found</div>;
    }

    const transactions = item.transactions || [];
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

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
                    <button
                        onClick={() => navigate(`/assets/${categoryId}`)}
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 text-xs font-black uppercase tracking-widest"
                    >
                        <ArrowLeft size={16} /> Back to {category.title}
                    </button>
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
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">Total Yield (Income)</p>
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

            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Transaction History</h3>
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
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {tx.type === 'income' ? 'Income' : 'Expense'}
                                            </span>
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
