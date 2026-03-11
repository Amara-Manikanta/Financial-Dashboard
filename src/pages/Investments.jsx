import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Plus, Target, TrendingUp, TrendingDown, Layout, RefreshCcw, Trash2 } from 'lucide-react';
import InvestmentsItemModal from '../components/InvestmentsItemModal';
import ConfirmModal from '../components/ConfirmModal';

const Investments = () => {
    const { savings, formatCurrency, calculateItemCurrentValue, calculateItemInvestedValue, addItem, deleteItem } = useFinance();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Filter only investments
    const investments = savings.filter(item => item.type === 'mutual_fund' || item.type === 'stock_market');

    const handleDeleteClick = (e, item) => {
        e.stopPropagation();
        setItemToDelete(item);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            await deleteItem('savings', itemToDelete.id);
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'stock_market': return <Layout size={64} />;
            case 'mutual_fund': return <TrendingUp size={64} />;
            default: return <Target size={64} />;
        }
    };

    const getStyle = (type) => {
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', bar: 'bg-purple-500' };
    };

    const totalPortfolioValue = investments.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);

    const handleSaveNewItem = async (newItem) => {
        await addItem('savings', newItem);
        setIsModalOpen(false);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-8">
                <div>
                    <h2 className="text-5xl font-black text-white tracking-tighter mb-4">Investments</h2>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">Track your mutual funds and stocks</p>
                </div>
                <div className="flex items-center gap-6 w-full lg:w-auto">
                    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-left flex-1 lg:flex-none lg:min-w-[280px]">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Portfolio Value</p>
                        <p className="text-3xl font-black text-white tracking-tight">
                            {formatCurrency(totalPortfolioValue)}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 text-white font-black py-5 px-10 rounded-2xl transition-all shadow-2xl shadow-purple-900/40 active:scale-95 text-xs uppercase tracking-widest"
                    >
                        <Plus size={20} />
                        <span>Add Account</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {investments.map(item => {
                    const isStockMarket = item.type === 'stock_market';
                    const isMutualFund = item.type === 'mutual_fund';
                    const style = getStyle(item.type);

                    const displayAmount = calculateItemCurrentValue(item);

                    const handleClick = () => {
                        if (isMutualFund) { navigate(`/savings/mutual-fund/${item.id}`); }
                        else if (isStockMarket) { navigate(`/savings/stock-market/${item.id}`); }
                    };

                    return (
                        <div
                            key={item.id}
                            className="card group relative overflow-hidden p-8 bg-white/[0.02] border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer active:scale-[0.98]"
                            onClick={handleClick}
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all group-hover:scale-110">
                                {getIcon(item.type)}
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tight mb-2 group-hover:text-purple-400 transition-colors">{item.title}</h3>
                                        <span className={`text-[9px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest border ${style.bg} ${style.text} border-white/5`}>
                                            {item.type.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(displayAmount)}</p>

                                    {/* Profit/Loss Display */}
                                    {(() => {
                                        const invested = calculateItemInvestedValue(item);
                                        const pl = displayAmount - invested;
                                        const isProfit = pl >= 0;
                                        const plPercent = invested > 0 ? (pl / invested) * 100 : 0;

                                        return (
                                            <div className={`flex items-center gap-2 mt-4 text-[10px] font-black uppercase tracking-widest ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                <span>{formatCurrency(Math.abs(pl))} ({plPercent.toFixed(1)}%)</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>


                            <button
                                onClick={(e) => handleDeleteClick(e, item)}
                                className="absolute bottom-4 right-4 p-2 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all z-20"
                                title="Delete Account"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <InvestmentsItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveNewItem}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Delete Investment Account"
                message={`Are you sure you want to delete "${itemToDelete?.title}"? This action cannot be undone.`}
                confirmText="Delete"
            />
        </div >
    );
};

export default Investments;
