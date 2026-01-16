import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Plus, Target, TrendingUp, TrendingDown, Landmark, Shield, ScrollText } from 'lucide-react';
import SavingsItemModal from '../components/SavingsItemModal';

const Savings = () => {
    const { savings, formatCurrency, calculateItemCurrentValue, calculateItemInvestedValue, addItem } = useFinance();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const getIcon = (type) => {
        switch (type) {
            case 'savings_account': return <Landmark size={64} />;
            case 'fixed_deposit': return <Landmark size={64} />;
            case 'Policy': return <Shield size={64} />;
            case 'stock_market':
            case 'mutual_fund': return <TrendingUp size={64} />;
            case 'sgb': return <ScrollText size={64} />;
            default: return <Target size={64} />;
        }
    };

    const getStyle = (type) => {
        switch (type) {
            case 'stock_market':
            case 'mutual_fund':
                return { bg: 'bg-purple-500/20', text: 'text-purple-400', bar: 'bg-purple-500' };
            case 'savings_account':
            case 'fixed_deposit':
                return { bg: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' };
            case 'Policy':
            case 'policy':
                return { bg: 'bg-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500' };
            default:
                return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' };
        }
    };

    const totalPortfolioValue = savings.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);

    const handleSaveNewItem = async (newItem) => {
        await addItem('savings', newItem);
        setIsModalOpen(false);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-8">
                <div>
                    <h2 className="text-5xl font-black text-white tracking-tighter mb-4">Savings & Investments</h2>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">Track your financial goals and portfolios</p>
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
                        className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-10 rounded-2xl transition-all shadow-2xl shadow-blue-900/40 active:scale-95 text-xs uppercase tracking-widest"
                    >
                        <Plus size={20} />
                        <span>Add Account</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {savings.map(item => {
                    const progress = item.goal > 0 ? Math.min((item.amount / item.goal) * 100, 100) : 0;
                    const isStockMarket = item.type === 'stock_market';
                    const isMutualFund = item.type === 'mutual_fund';
                    const isFixedDeposit = item.type === 'fixed_deposit';
                    const isSavingsAccount = item.type === 'savings_account';
                    const isPolicy = item.type === 'policy' || item.type === 'Policy';
                    const isPPF = item.type === 'ppf';
                    const isNPS = item.type === 'nps';
                    const isSGB = item.type === 'sgb';
                    const isLiquid = item.type === 'liquid';
                    const isClickable = true;
                    const style = getStyle(item.type);

                    const displayAmount = calculateItemCurrentValue(item);
                    const showProgress = item.goal > 0 && !isStockMarket && !isPolicy && !isFixedDeposit && !isLiquid && !isPPF && !isNPS && !isSGB && !isSavingsAccount;

                    const handleClick = () => {
                        if (isMutualFund) { navigate(`/savings/mutual-fund/${item.id}`); }
                        else if (isFixedDeposit) { navigate(`/savings/fixed-deposit/${item.id}`); }
                        else if (isPolicy) { navigate(`/savings/policy/${item.id}`); }
                        else if (isStockMarket) { navigate(`/savings/stock-market/${item.id}`); }
                        else if (isPPF) { navigate(`/savings/ppf/${item.id}`); }
                        else if (isNPS) { navigate(`/savings/nps/${item.id}`); }
                        else if (isSGB) { navigate(`/savings/sgb/${item.id}`); }
                        else if (isLiquid) { navigate(`/savings/emergency-fund/${item.id}`); }
                        else if (isSavingsAccount) { navigate(`/savings/savings-account/${item.id}`); }
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
                                        <h3 className="text-2xl font-black text-white tracking-tight mb-2 group-hover:text-blue-400 transition-colors">{item.title}</h3>
                                        <span className={`text-[9px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest border ${style.bg} ${style.text} border-white/5`}>
                                            {item.type.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(displayAmount)}</p>

                                    {/* Profit/Loss Display */}
                                    {(isStockMarket || isMutualFund || isFixedDeposit || isPPF || isNPS || isSGB || isSavingsAccount) && (
                                        (() => {
                                            if (isFixedDeposit || isPPF || isSavingsAccount) {
                                                const invested = calculateItemInvestedValue(item);
                                                const totalInterest = displayAmount - invested;
                                                return (
                                                    <div className="flex items-center gap-2 mt-4 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                                        <TrendingUp size={14} />
                                                        <span>{formatCurrency(totalInterest)} Interest</span>
                                                    </div>
                                                );
                                            }

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
                                        })()
                                    )}
                                </div>

                                {showProgress && (
                                    <div className="mt-8">
                                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${style.bar}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                            {progress.toFixed(1)}% Goal
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <SavingsItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveNewItem}
            />
        </div>
    );
};

export default Savings;
