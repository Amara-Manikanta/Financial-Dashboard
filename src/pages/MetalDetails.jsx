import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Coins, Plus, Edit2, Trash2, MapPin, Settings, X, RefreshCw } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import MetalModal from '../components/MetalModal';

const MetalDetails = () => {
    const { type } = useParams(); // 'gold' or 'silver'
    const navigate = useNavigate();
    const { metals, formatCurrency, addMetal, updateMetal, deleteMetal, metalRates, manualMetalRates, updateManualRates } = useFinance();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);

    // Rate state
    const [goldRate, setGoldRate] = useState('');
    const [silverRate, setSilverRate] = useState('');

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

    // Determine active rate
    // Note: manualMetalRates might be undefined if not yet loaded, handle safely
    const isManualRateActive = (type === 'gold' && Number(manualMetalRates?.gold) > 0) || (type === 'silver' && Number(manualMetalRates?.silver) > 0);

    const currentRate = type === 'gold'
        ? (isManualRateActive ? Number(manualMetalRates?.gold) : (metalRates.gold || 0))
        : (isManualRateActive ? Number(manualMetalRates?.silver) : (metalRates.silver || 0));

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

    // Rate Modal Handlers
    const openRateModal = () => {
        setGoldRate(manualMetalRates?.gold || '');
        setSilverRate(manualMetalRates?.silver || '');
        setIsRateModalOpen(true);
    };

    const handleRateSubmit = (e) => {
        e.preventDefault();
        updateManualRates({
            gold: parseFloat(goldRate) || 0,
            silver: parseFloat(silverRate) || 0
        });
        setIsRateModalOpen(false);
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
                            <div className="flex items-center gap-3">
                                <h2 className="text-4xl font-black tracking-tight text-white leading-tight">
                                    {formattedType} <span className="text-gray-500">Portfolio</span>
                                </h2>
                                <button
                                    onClick={openRateModal}
                                    className={`p-2 rounded-full transition-all ${isManualRateActive ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                    title="Set Manual Rates"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                            <div
                                onClick={openRateModal}
                                className="flex items-center gap-2 mt-2 text-xs font-bold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white transition-colors"
                                title="Click to edit rate"
                            >
                                {isManualRateActive ? (
                                    <span className="text-yellow-500 flex items-center gap-1">
                                        <Edit2 size={12} /> Manual Rate:
                                    </span>
                                ) : (
                                    <span className="text-emerald-500 flex items-center gap-1">
                                        <RefreshCw size={12} /> Live Rate:
                                    </span>
                                )}
                                <span className="underline decoration-dotted underline-offset-4 decoration-gray-600">{formatCurrency(currentRate)}/g</span>
                            </div>
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
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

            {/* Grid View Component */}
            {/* Grid View Component */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-10">
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => navigate(`/metals/${type}/${item.id}`)}
                        className="group relative bg-[#1c1c20] rounded-[32px] overflow-hidden border border-white/20 shadow-xl hover:shadow-2xl hover:shadow-black/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                    >
                        {/* Image Section */}
                        <div className="relative h-64 w-full overflow-hidden bg-black/20">
                            {item.image ? (
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                    <Coins size={48} className={`opacity-20 ${type === 'gold' ? 'text-yellow-500' : 'text-slate-400'}`} />
                                </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c20] via-[#1c1c20]/40 to-transparent opacity-80" />

                            {/* Buttons moved to content section */}

                            {type === 'gold' && item.purity && (
                                <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-xl backdrop-blur-md border ${accentBorder} ${accentBg}/20 shadow-lg`}>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${colorClass}`}>
                                        {item.purity}K
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Content Section */}
                        <div className="relative p-6 -mt-12 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight leading-tight mb-1">{item.name}</h3>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <MapPin size={12} className={colorClass} />
                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{item.place || 'Unknown Place'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/5"
                                        title="Edit Item"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all active:scale-95 border border-white/5"
                                        title="Delete Item"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Weight</p>
                                    <p className="text-lg font-black text-gray-300">{item.weightGm}g</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Value</p>
                                    <p className={`text-lg font-black ${colorClass}`}>{formatCurrency(item.currentValue)}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{formatDate(item.purchaseDate)}</span>
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                    ID: {type === 'gold' ? 'G' : 'S'}{(filteredItems.indexOf(item) + 1)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {
                (filteredItems.length === 0 && metalItems.length > 0) && (
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
                )
            }

            {
                metalItems.length === 0 && (
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
                )
            }

            <MetalModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
                onAdd={handleSave}
                initialData={editingItem}
                metalType={type}
            />

            {/* Manual Rate Modal */}
            {/* Manual Rate Modal */}
            {isRateModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsRateModalOpen(false)}
                >
                    <div
                        className="bg-[#1c1c20] w-full max-w-md rounded-[32px] border border-white/10 shadow-2xl p-8 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsRateModalOpen(false)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-500">
                                <Settings size={24} />
                            </div>
                            <h2 className="text-2xl font-black text-white">Set Manual Rates</h2>
                        </div>
                        <p className="text-gray-400 text-sm mb-6 ml-1">Enter today's market rates (per gram). Set to 0 to use live API rates.</p>

                        <form onSubmit={handleRateSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Gold Rate (24K / gram)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold pointer-events-none">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={goldRate}
                                        onChange={(e) => setGoldRate(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white font-bold focus:outline-none focus:border-yellow-500/50 transition-colors"
                                        placeholder="e.g. 7800"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Silver Rate (per gram)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold pointer-events-none">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={silverRate}
                                        onChange={(e) => setSilverRate(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white font-bold focus:outline-none focus:border-slate-500/50 transition-colors"
                                        placeholder="e.g. 95"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-gray-200 transition-all transform active:scale-95"
                            >
                                Save Rates
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
};

export default MetalDetails;
