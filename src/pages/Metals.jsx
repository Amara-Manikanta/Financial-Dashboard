import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Plus, Coins, ChevronRight } from 'lucide-react';
import MetalModal from '../components/MetalModal';

const Metals = () => {
    const { metals, formatCurrency, addMetal, metalRates } = useFinance();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('gold');

    const handleAddItem = (type) => {
        setModalType(type);
        setIsModalOpen(true);
    };

    const renderMetalSection = (title, items = [], color) => {
        const totalWeight = items.reduce((sum, item) => sum + (item.weightGm || 0), 0);
        const totalValue = items.reduce((sum, item) => sum + (item.currentValue || 0), 0);
        const urlType = title.toLowerCase().replace(' ', '_');
        const hideWeight = urlType === 'antique_coins' || urlType === 'currencies';

        return (
            <div
                className="card mb-6 hover:bg-white/5 transition-all group relative overflow-hidden"
                onClick={() => navigate(`/metals/${urlType}`)}
            >
                <div className="flex justify-between items-end mb-2 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Coins className={color} size={20} />
                            <h3 className="text-2xl font-black tracking-tight">{title}</h3>
                        </div>
                        <p className="text-secondary text-xs font-bold uppercase tracking-wider">{items.length} holdings</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Current Valuation</p>
                        <p className={`text-3xl font-black ${color} tracking-tighter`}>{formatCurrency(totalValue)}</p>
                        <div className="flex items-center justify-end gap-2 mt-1">
                            {!hideWeight && <span className="text-xs text-secondary font-medium">{parseFloat(totalWeight.toFixed(4))}g Total weight</span>}
                            <ChevronRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                    </div>
                </div>
                {/* Decorative background element */}
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.07] transition-opacity ${color.replace('text', 'bg')}`} />
            </div>
        );
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-4xl font-black tracking-tight mb-2">Precious <span className="text-gray-500">Metals</span></h2>
                    <p className="text-secondary text-sm font-medium">Manage and track your physical gold and silver assets.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Gold Rate (24K)</p>
                        <p className="text-yellow-400 font-black tracking-tight">{formatCurrency(metalRates?.gold || 0)}/g</p>
                    </div>
                    <div className="text-right hidden md:block mr-4">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Silver Rate</p>
                        <p className="text-slate-400 font-black tracking-tight">{formatCurrency(metalRates?.silver || 0)}/g</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        <button
                            onClick={() => handleAddItem('gold')}
                            className="flex items-center gap-1 bg-yellow-500 text-black font-black px-4 py-2 rounded-xl hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20 text-[10px] uppercase tracking-widest"
                        >
                            <Plus size={14} />
                            <span>Gold</span>
                        </button>
                        <button
                            onClick={() => handleAddItem('silver')}
                            className="flex items-center gap-1 bg-slate-600 text-white font-black px-4 py-2 rounded-xl hover:bg-slate-500 transition-all shadow-lg shadow-slate-500/20 text-[10px] uppercase tracking-widest border border-white/10"
                        >
                            <Plus size={14} />
                            <span>Silver</span>
                        </button>
                        <button
                            onClick={() => handleAddItem('antique_coins')}
                            className="flex items-center gap-1 bg-[#8B5A2B] text-white font-black px-4 py-2 rounded-xl hover:bg-[#A0522D] transition-all shadow-lg shadow-[#8B5A2B]/20 text-[10px] uppercase tracking-widest border border-white/10"
                        >
                            <Plus size={14} />
                            <span>Antique Coin</span>
                        </button>
                        <button
                            onClick={() => handleAddItem('currencies')}
                            className="flex items-center gap-1 bg-emerald-600 text-white font-black px-4 py-2 rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 text-[10px] uppercase tracking-widest border border-white/10"
                        >
                            <Plus size={14} />
                            <span>Currency</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {renderMetalSection('Gold', metals.gold, 'text-yellow-400')}
                {renderMetalSection('Silver', metals.silver, 'text-gray-300')}
                {renderMetalSection('Antique Coins', metals.antique_coins, 'text-[#CD853F]')}
                {renderMetalSection('Currencies', metals.currencies, 'text-emerald-400')}
            </div>

            <MetalModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={(data) => addMetal(modalType, data)}
                metalType={modalType}
            />
        </div>
    );
};

export default Metals;
