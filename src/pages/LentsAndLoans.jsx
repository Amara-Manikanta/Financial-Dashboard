import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, ArrowUpRight, ArrowDownLeft, Search, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LentModal from '../components/LentModal';

const DebtCard = ({ item, navigate, formatCurrency }) => {
    const isLent = item.type === 'lent';
    const amount = item.amount || 0;

    const totalTransactions = (item.transactions || []).reduce((acc, tx) => {
        if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
        if (tx.type === 'additional') return acc + parseFloat(tx.amount);
        return acc;
    }, 0);

    const pendingAmount = amount + totalTransactions;

    return (
        <div
            onClick={() => navigate(`/lents-loans/${item.id}`)}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer group"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${isLent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {isLent ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                {item.isEmi && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-lg border border-blue-500/20">
                        EMI
                    </span>
                )}
            </div>

            <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-amber-400 transition-colors">
                {item.name}
            </h3>
            <p className="text-gray-400 text-sm mb-4 line-clamp-1">{item.description || 'No description'}</p>

            <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                    {isLent ? 'Pending Amount' : 'Outstanding Balance'}
                </span>
                <span className={`text-2xl font-bold ${isLent ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(pendingAmount)}
                </span>
            </div>
        </div>
    );
};

const LentsAndLoans = () => {
    const { lents, formatCurrency } = useFinance();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, lent, borrowed
    const navigate = useNavigate();

    const totalLent = lents.filter(i => i.type === 'lent').reduce((sum, item) => {
        const pending = (item.amount || 0) + (item.transactions || []).reduce((acc, tx) => {
            if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
            if (tx.type === 'additional') return acc + parseFloat(tx.amount);
            return acc;
        }, 0);
        return sum + pending;
    }, 0);

    const totalBorrowed = lents.filter(i => i.type === 'borrowed').reduce((sum, item) => {
        const pending = (item.amount || 0) + (item.transactions || []).reduce((acc, tx) => {
            if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
            if (tx.type === 'additional') return acc + parseFloat(tx.amount);
            return acc;
        }, 0);
        return sum + pending;
    }, 0);

    const filteredItems = lents.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = filterType === 'all' || item.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-8 animate-fade-in pb-12 max-w-7xl mx-auto p-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-emerald-400 via-blue-500 to-rose-400 bg-clip-text text-transparent tracking-tight">
                        Loans & Lents
                    </h1>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-2">Manage peer-to-peer debts</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-all text-sm uppercase tracking-widest"
                >
                    <Plus size={18} />
                    Add Record
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                                <ArrowUpRight size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-emerald-200/60 font-black uppercase tracking-widest text-xs">Total Wait to Receive</span>
                        </div>
                        <div className="text-5xl font-black text-emerald-400 tracking-tighter">
                            {formatCurrency(totalLent)}
                        </div>
                    </div>
                </div>

                <div className="p-8 rounded-3xl bg-gradient-to-br from-rose-500/10 to-pink-500/5 border border-rose-500/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-rose-500/20 rounded-xl text-rose-400">
                                <ArrowDownLeft size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-rose-200/60 font-black uppercase tracking-widest text-xs">Total Need to Pay</span>
                        </div>
                        <div className="text-5xl font-black text-rose-400 tracking-tighter">
                            {formatCurrency(totalBorrowed)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                        <Search className="text-gray-500" size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search debts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors font-medium"
                    />
                </div>
                <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 overflow-hidden shrink-0">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterType('lent')}
                        className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${filterType === 'lent' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-emerald-400'}`}
                    >
                        Lent
                    </button>
                    <button
                        onClick={() => setFilterType('borrowed')}
                        className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${filterType === 'borrowed' ? 'bg-rose-500 text-white' : 'text-gray-400 hover:text-rose-400'}`}
                    >
                        Borrowed
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredItems.map(item => (
                    <DebtCard
                        key={item.id}
                        item={item}
                        navigate={navigate}
                        formatCurrency={formatCurrency}
                    />
                ))}
            </div>

            {filteredItems.length === 0 && (
                <div className="text-center py-24 bg-white/5 rounded-3xl border border-white/10 border-dashed">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <RefreshCcw size={32} className="text-gray-500" />
                    </div>
                    <p className="text-white text-2xl font-black mb-2 tracking-tight">No records found</p>
                    <p className="text-gray-500 text-sm font-medium">Add a new record to start tracking peer-to-peer debts</p>
                </div>
            )}

            {isAddModalOpen && (
                <LentModal
                    isOpen={true}
                    onClose={() => setIsAddModalOpen(false)}
                    defaultType="lent"
                />
            )}
        </div>
    );
};

export default LentsAndLoans;
