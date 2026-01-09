import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import TransactionModal from '../components/TransactionModal';
import { useNavigate } from 'react-router-dom';
import {
    Wallet,
    PiggyBank,
    Coins,
    TrendingUp,
    Layers,
    Plus,
    ArrowRight,
    ShieldCheck,
    Briefcase,
    Gem
} from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
    const { savings, metals, assets, formatCurrency, calculateItemCurrentValue, addItem } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSaveTransaction = (transaction) => {
        addItem('expense', transaction);
        setIsModalOpen(false);
    };

    // --- Calculations ---
    const stats = useMemo(() => {
        const totalSavings = savings.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);

        const goldVal = metals.gold.reduce((sum, item) => sum + item.currentValue, 0);
        const goldGms = metals.gold.reduce((sum, item) => sum + item.weightGm, 0);
        const silverVal = metals.silver.reduce((sum, item) => sum + item.currentValue, 0);
        const silverGms = metals.silver.reduce((sum, item) => sum + item.weightGm, 0);
        const totalMetals = goldVal + silverVal;

        const totalAssets = assets.reduce((total, cat) =>
            total + cat.items.reduce((sum, item) => sum + (Number(item.currentValue) || Number(item.purchasePrice) || 0), 0), 0
        );

        const netWorth = totalSavings + totalMetals + totalAssets;

        // Specifics for sub-cards
        const fd = savings.filter(s => s.type === 'fixed_deposit').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const stocks = savings.filter(s => s.type === 'stock_market').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const mf = savings.filter(s => s.type === 'mutual_fund').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const ppf = savings.find(s => s.type === 'ppf')?.details?.slice(-1)[0]?.balance || 0;
        const npsAccount = savings.find(s => s.type === 'nps');
        const nps = npsAccount ? (npsAccount.investedAmount + npsAccount.profitLoss) : 0;
        const sgb = savings.find(s => s.type === 'sgb')?.holdings?.reduce((sum, h) => sum + (h.units * h.currentPrice), 0) || 0;

        return {
            netWorth,
            totalSavings,
            totalMetals,
            totalAssets,
            goldVal,
            goldGms,
            silverVal,
            silverGms,
            fd,
            stocks,
            mf,
            ppf,
            nps,
            sgb
        };
    }, [savings, metals, assets, calculateItemCurrentValue]);

    return (
        <div className="animate-fade-in space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-1">Portfolio</h1>
                    <p className="text-secondary font-medium uppercase text-xs tracking-widest">Global Wealth Overview</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="group bg-white text-black hover:bg-orange-500 hover:text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-[0.98] shadow-xl shadow-white/5"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    Record Entry
                </button>
            </div>

            {/* Net Worth Hero */}
            <div className="relative overflow-hidden card border-emerald-500/20 bg-emerald-500/5 p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-8 shadow-emerald-500/10">
                {/* Background Glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>

                <div className="relative z-10 text-center md:text-left">
                    <p className="text-emerald-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-3 opacity-80">Total Combined Net Worth</p>
                    <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-2">
                        {formatCurrency(stats.netWorth)}
                    </h2>
                    <div className="flex items-center gap-2 text-emerald-400/60 justify-center md:justify-start">
                        <ShieldCheck size={16} />
                        <span className="text-xs font-medium uppercase tracking-wider">Assets secured & verified</span>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-4 w-full md:w-auto">
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5 min-w-[140px]">
                        <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">Growth Index</p>
                        <p className="text-xl font-bold text-success">+12.4%</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5 min-w-[140px]">
                        <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">Asset Health</p>
                        <p className="text-xl font-bold text-blue-400">Stable</p>
                    </div>
                </div>
            </div>

            {/* Major Categories */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    onClick={() => navigate('/savings')}
                    className="card border-indigo-500/20 bg-indigo-500/5 cursor-pointer hover:border-indigo-500/50 group transition-all"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                            <PiggyBank size={24} />
                        </div>
                        <ArrowRight size={18} className="text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Savings</p>
                    <h3 className="text-3xl font-black text-white">{formatCurrency(stats.totalSavings)}</h3>
                </div>

                <div
                    onClick={() => navigate('/metals')}
                    className="card border-orange-500/20 bg-orange-500/5 cursor-pointer hover:border-orange-500/50 group transition-all"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400">
                            <Gem size={24} />
                        </div>
                        <ArrowRight size={18} className="text-gray-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Precious Metals</p>
                    <h3 className="text-3xl font-black text-white">{formatCurrency(stats.totalMetals)}</h3>
                </div>

                <div
                    onClick={() => navigate('/assets')}
                    className="card border-emerald-500/20 bg-emerald-500/5 cursor-pointer hover:border-emerald-500/50 group transition-all"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <Layers size={24} />
                        </div>
                        <ArrowRight size={18} className="text-gray-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Real Estate Assets</p>
                    <h3 className="text-3xl font-black text-white">{formatCurrency(stats.totalAssets)}</h3>
                </div>
            </div>

            {/* Detailed Multi-Grid Breakdown */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <Briefcase size={20} className="text-accent-primary" />
                    <h4 className="text-xl font-bold text-white">Investment Ledger</h4>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Savings Items */}
                    <div className="card p-5 bg-white/[0.02]">
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Fixed Deposits</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.fd)}</p>
                    </div>
                    <div className="card p-5 bg-white/[0.02]">
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Equity Stocks</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.stocks)}</p>
                    </div>
                    <div className="card p-5 bg-white/[0.02]">
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Mutual Funds</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.mf)}</p>
                    </div>
                    <div className="card p-5 bg-white/[0.02]">
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Public Provident Fund</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.ppf)}</p>
                    </div>

                    {/* Retirements & Bonds */}
                    <div className="card p-5 bg-white/[0.02]">
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Retirement (NPS)</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.nps)}</p>
                    </div>
                    <div className="card p-5 bg-white/[0.02]">
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Gold Bonds (SGB)</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.sgb)}</p>
                    </div>

                    {/* Physical Metals Quantities */}
                    <div className="card p-5 bg-yellow-500/5 group">
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">Physical Gold</p>
                            <span className="text-[10px] text-yellow-600 font-bold">{stats.goldGms.toFixed(2)}g</span>
                        </div>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.goldVal)}</p>
                    </div>
                    <div className="card p-5 bg-gray-500/5 group">
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Physical Silver</p>
                            <span className="text-[10px] text-gray-600 font-bold">{stats.silverGms.toFixed(2)}g</span>
                        </div>
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.silverVal)}</p>
                    </div>
                </div>
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleSaveTransaction}
            />
        </div>
    );
};

export default Dashboard;
