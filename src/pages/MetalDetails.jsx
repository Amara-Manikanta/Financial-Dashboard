import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Coins, Calendar, Tag, Plus, Edit2, Trash2, MapPin, Info } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import MetalModal from '../components/MetalModal';

const MetalDetails = () => {
    const { type } = useParams(); // 'gold' or 'silver'
    const navigate = useNavigate();
    const { metals, formatCurrency, addMetal, updateMetal, deleteMetal } = useFinance();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const metalItems = metals[type] || [];

    // Filter items based on search term
    const filteredItems = metalItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.purity && item.purity.toString().includes(searchTerm)) ||
        (item.place && item.place.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.remarks && item.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
    const colorClass = type === 'gold' ? 'text-yellow-400' : 'text-slate-300';
    const accentBg = type === 'gold' ? 'bg-yellow-500' : 'bg-slate-500';
    const accentBorder = type === 'gold' ? 'border-yellow-500/20' : 'border-slate-500/20';
    const accentShadow = type === 'gold' ? 'shadow-yellow-500/20' : 'shadow-slate-500/20';

    // Calculate aggregate stats (on all items, not filtered)
    const totalWeight = metalItems.reduce((sum, item) => sum + item.weightGm, 0);
    const totalCurrentValue = metalItems.reduce((sum, item) => sum + item.currentValue, 0);
    const totalInvested = metalItems.reduce((sum, item) => sum + item.purchasePrice, 0);

    const handleEdit = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm(`Are you sure you want to delete this ${type} item?`)) {
            deleteMetal(type, id);
        }
    };

    const handleSave = (data) => {
        if (editingItem) {
            updateMetal(type, data);
        } else {
            addMetal(type, data);
        }
        setEditingItem(null);
    };

    return (
        <div className="animate-fade-in pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => navigate('/metals')}
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest group w-fit"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Back to Metals</span>
                    </button>
                    <div className="flex items-center gap-5">
                        <div className={`p-4 rounded-[28px] ${accentBg}/10 border ${accentBorder} backdrop-blur-xl shadow-2xl ${accentShadow}`}>
                            <Coins className={colorClass} size={32} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight text-white leading-tight">
                                {formattedType} <span className="text-gray-500">Portfolio</span>
                            </h2>
                            <p className="text-secondary text-sm font-medium mt-1">Detailed inventory of your precious metal holdings</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Plus size={18} className="text-gray-500 group-focus-within:text-white transition-colors rotate-45" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 text-white text-sm rounded-2xl pl-12 pr-6 py-4 w-full md:w-64 outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-gray-600 font-medium"
                        />
                    </div>

                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className={`flex items-center gap-2 ${accentBg} text-white font-black px-8 py-4 rounded-2xl hover:opacity-90 transition-all shadow-2xl ${accentShadow} text-xs uppercase tracking-widest active:scale-95`}
                    >
                        <Plus size={20} />
                        <span>Add {formattedType}</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="card group relative overflow-hidden border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
                    <div className="relative z-10 p-1">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Accumulation</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-black text-white tracking-tighter">{parseFloat(totalWeight.toFixed(4))}</p>
                            <span className="text-sm font-bold text-gray-400">grams</span>
                        </div>
                    </div>
                    <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 ${accentBg} blur-2xl`} />
                </div>

                <div className="card group relative overflow-hidden border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
                    <div className="relative z-10 p-1">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Historical Investment</p>
                        <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(totalInvested)}</p>
                    </div>
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 bg-emerald-500 blur-2xl" />
                </div>

                <div className="card group relative overflow-hidden border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                    <div className="relative z-10 p-1">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Current Valuation</p>
                        <p className={`text-4xl font-black ${colorClass} tracking-tighter`}>{formatCurrency(totalCurrentValue)}</p>
                    </div>
                    <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-[0.05] group-hover:opacity-[0.1] transition-all duration-500 ${accentBg} blur-2xl`} />
                </div>
            </div>

            {/* Table View Component */}
            <div className="card border border-white/5 p-0 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Inventory Items</h3>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{filteredItems.length} Records Found</span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/[0.02]">
                                <th className="py-5 px-8">Item Identity</th>
                                <th className="py-5 px-6 text-right">Mass (Gm)</th>
                                <th className="py-5 px-6 text-right">Acquisition</th>
                                <th className="py-5 px-6 text-right">Current Value</th>
                                <th className="py-5 px-8">Source/History</th>
                                <th className="py-5 px-8 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredItems.map((item) => (
                                <tr key={item.id} className="hover:bg-white/[0.03] transition-all group">
                                    <td className="py-6 px-8">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white font-black text-base tracking-tight capitalize group-hover:text-amber-200 transition-colors">
                                                {item.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {item.purity && (
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${accentBg}/20 ${colorClass} uppercase tracking-tighter`}>
                                                        {item.purity}{type === 'gold' ? 'K' : '%'} Pure
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">ID: {item.id.toString().slice(-4)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-6 px-6 text-right font-black text-lg text-gray-300 tracking-tighter">{item.weightGm}g</td>
                                    <td className="py-6 px-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-200 font-bold text-sm tracking-tight">{formatCurrency(item.purchasePrice)}</span>
                                            <span className="text-[10px] text-gray-600 font-black uppercase tracking-tight">{formatDate(item.purchaseDate)}</span>
                                        </div>
                                    </td>
                                    <td className="py-6 px-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-base font-black ${colorClass} tracking-tight`}>{formatCurrency(item.currentValue)}</span>
                                        </div>
                                    </td>
                                    <td className="py-6 px-8">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-300 transition-colors">
                                                <MapPin size={12} className={colorClass} />
                                                <span className="text-xs font-bold">{item.place || 'Official Reserve'}</span>
                                            </div>
                                            {item.remarks && (
                                                <div className="flex items-start gap-2 text-gray-600">
                                                    <Info size={12} className="shrink-0 mt-0.5" />
                                                    <span className="text-[10px] leading-relaxed italic line-clamp-2 max-w-[200px]">{item.remarks}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-6 px-8">
                                        <div className="flex items-center justify-center gap-3">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110 active:scale-90"
                                                title="Edit Entry"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110 active:scale-90"
                                                title="Delete Entry"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {(filteredItems.length === 0 && metalItems.length > 0) && (
                    <div className="text-center py-24 bg-white/[0.02]">
                        <div className="inline-flex p-6 rounded-full bg-white/5 mb-6">
                            <Plus size={40} className="text-gray-700 rotate-45" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-400 mb-2">No results found for "{searchTerm}"</h4>
                        <p className="text-gray-600 text-sm font-medium">Try adjusting your search criteria or clear the filter.</p>
                        <button
                            onClick={() => setSearchTerm('')}
                            className="text-white text-xs font-black uppercase tracking-widest mt-8 px-6 py-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                        >
                            Clear Search Filter
                        </button>
                    </div>
                )}

                {metalItems.length === 0 && (
                    <div className="text-center py-24 bg-white/[0.02]">
                        <div className="inline-flex p-6 rounded-full bg-white/5 mb-6">
                            <Coins size={40} className="text-gray-700" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-300 mb-2">Portfolio is Empty</h4>
                        <p className="text-gray-600 text-sm font-medium">Start building your {type} wealth by adding your first item.</p>
                        <button
                            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                            className={`${colorClass} text-xs font-black uppercase tracking-widest mt-8 hover:opacity-80 transition-all`}
                        >
                            + Add New Entry
                        </button>
                    </div>
                )}
            </div>

            <MetalModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
                onAdd={handleSave}
                initialData={editingItem}
                metalType={type}
            />
        </div>
    );
};

export default MetalDetails;
