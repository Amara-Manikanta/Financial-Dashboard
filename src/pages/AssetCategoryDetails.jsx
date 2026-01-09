import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Plus, Edit2, Trash2, MapPin, Ruler, Briefcase, TrendingUp } from 'lucide-react';
import AssetItemModal from '../components/AssetItemModal';

const AssetCategoryDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { assets, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const category = assets.find(a => a.id === id);

    if (!category) {
        return <div className="p-8 text-center bg-modal m-10 rounded-3xl border border-white/5">
            <h2 className="text-xl font-bold">Category not found</h2>
            <button onClick={() => navigate('/assets')} className="mt-4 text-blue-400 font-bold uppercase tracking-widest text-xs">Back to Assets</button>
        </div>;
    }

    const isRealEstate = category.type === 'real_estate';

    // Helper to safely get value
    const getValue = (item, field) => item[field] || '-';

    const totalPurchaseValue = category.items.reduce((sum, item) => sum + (Number(item.purchasePrice) || Number(item.purchasedValue) || 0), 0);
    const totalCurrentValue = category.items.reduce((sum, item) => sum + (Number(item.currentValue) || 0), 0);

    const handleSaveItem = async (data) => {
        let updatedItems;
        if (editingItem) {
            updatedItems = category.items.map(i => i.id === data.id ? data : i);
        } else {
            updatedItems = [...category.items, data];
        }

        await updateItem('asset', { ...category, items: updatedItems });
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleDeleteItem = async (itemId, e) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this asset?')) {
            const updatedItems = category.items.filter(i => i.id !== itemId);
            await updateItem('asset', { ...category, items: updatedItems });
        }
    };

    const handleEditItem = (item, e) => {
        e.stopPropagation();
        setEditingItem(item);
        setIsModalOpen(true);
    };

    return (
        <div className="animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <button
                        onClick={() => navigate('/assets')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 text-xs font-black uppercase tracking-widest"
                    >
                        <ArrowLeft size={16} /> Back to Assets
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20">
                            <Briefcase className="text-blue-400" size={32} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight">{category.title} <span className="text-gray-500">Inventory</span></h2>
                            <p className="text-secondary text-sm font-medium mt-1">Detailed management of your {category.title.toLowerCase()}</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-blue-600 text-white font-black px-6 py-4 rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 text-xs uppercase tracking-widest"
                >
                    <Plus size={20} />
                    <span>Add {category.title.slice(0, -1)}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">Total Investment</p>
                    <p className="text-3xl font-black tracking-tight relative z-10">{formatCurrency(totalPurchaseValue)}</p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-blue-500" />
                </div>
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">Market Valuation</p>
                    <p className="text-3xl font-black text-emerald-400 tracking-tight relative z-10">{formatCurrency(totalCurrentValue)}</p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-emerald-500" />
                </div>
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">Asset Count</p>
                    <p className="text-3xl font-black text-indigo-400 tracking-tight relative z-10">{category.items.length}</p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-indigo-500" />
                </div>
            </div>

            <div className="card p-0 overflow-hidden border border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/2">
                                <th className="py-5 px-6">Asset Identity</th>
                                <th className="py-5 px-6">Acquisition</th>
                                {isRealEstate && <th className="py-5 px-6">Physical Details</th>}
                                <th className="py-5 px-6 text-right">Purchase Price</th>
                                <th className="py-5 px-6 text-right">Current Value</th>
                                {id === 'plots' && <th className="py-5 px-6 text-right">Yield/Returns</th>}
                                <th className="py-5 px-6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {category.items.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-20 text-center text-gray-500 font-medium">
                                        No items recorded in this folder.
                                    </td>
                                </tr>
                            ) : (
                                category.items.map(item => {
                                    const returns = id === 'plots'
                                        ? (item.transactions || []).reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0)
                                        : 0;

                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                                            onClick={() => navigate(`/assets/${id}/${item.id}`)}
                                        >
                                            <td className="py-5 px-6">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold tracking-tight text-sm group-hover:text-blue-400 transition-colors">{getValue(item, 'name')}</span>
                                                    {isRealEstate && <span className="text-[10px] text-gray-500 font-medium mt-0.5">{getValue(item, 'place')}</span>}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">
                                                <span className="text-gray-400 text-xs font-medium">{getValue(item, 'purchaseDate')}</span>
                                            </td>
                                            {isRealEstate && (
                                                <td className="py-5 px-6">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-gray-500">
                                                        <Ruler size={10} className="text-gray-600" />
                                                        {item.dimensions || item.Dimensions || 'N/A'}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="py-5 px-6 text-right font-bold text-gray-400 text-sm">
                                                {formatCurrency(item.purchasePrice || item.purchasedValue || 0)}
                                            </td>
                                            <td className="py-5 px-6 text-right font-black text-emerald-400 text-sm">
                                                {formatCurrency(item.currentValue || 0)}
                                            </td>
                                            {id === 'plots' && (
                                                <td className={`py-5 px-6 text-right font-black text-sm ${returns >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                    {formatCurrency(returns)}
                                                </td>
                                            )}
                                            <td className="py-5 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={(e) => handleEditItem(item, e)}
                                                        className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteItem(item.id, e)}
                                                        className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AssetItemModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
                onSave={handleSaveItem}
                initialData={editingItem}
                categoryType={category.type}
            />
        </div>
    );
};

export default AssetCategoryDetails;
