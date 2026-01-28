import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, ArrowDownLeft, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LentModal from '../components/LentModal';

const LoanCard = ({ item, navigate, formatCurrency }) => {
    // Determine the pending amount (simplified logic parallel to Lents.jsx)
    const amount = item.amount || 0;
    const totalTransactions = (item.transactions || []).reduce((acc, tx) => {
        // 'repayment' means we paid back part of the loan -> reduces debt
        // 'additional' means we borrowed more -> increases debt
        if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
        if (tx.type === 'additional') return acc + parseFloat(tx.amount);
        return acc;
    }, 0);

    const pendingAmount = amount + totalTransactions;

    return (
        <div
            onClick={() => navigate(`/loans/${item.id}`)}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer group"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400">
                    <ArrowDownLeft size={20} />
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
                <span className="text-xs text-gray-500 uppercase tracking-wider">Outstanding Balance</span>
                <span className="text-2xl font-bold text-rose-400">
                    {formatCurrency(pendingAmount)}
                </span>
            </div>
        </div>
    );
};

const Loans = () => {
    const { lents, formatCurrency } = useFinance();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    // Filter strictly for borrowed items
    const loans = lents.filter(i => i.type === 'borrowed');

    const totalBorrowed = loans.reduce((sum, item) => {
        const pending = (item.amount || 0) + (item.transactions || []).reduce((acc, tx) => {
            if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
            if (tx.type === 'additional') return acc + parseFloat(tx.amount);
            return acc;
        }, 0);
        return sum + pending;
    }, 0);

    const filteredLoans = loans.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">
                        Loans & Borrows
                    </h1>
                    <p className="text-gray-400 mt-1">Track money you owe to others</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl font-semibold text-white shadow-lg hover:shadow-rose-500/20 hover:scale-[1.02] transition-all"
                >
                    <Plus size={20} />
                    Add New Loan
                </button>
            </div>

            {/* Summary Card */}
            <div className="grid grid-cols-1 gap-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
                                <ArrowDownLeft size={24} />
                            </div>
                            <span className="text-rose-200/60 font-medium">Total Need to Pay</span>
                        </div>
                        <div className="text-4xl font-bold text-rose-400 mt-2">
                            {formatCurrency(totalBorrowed)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                        <Search className="text-gray-500" size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search loans..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500/50 transition-colors"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLoans.map(item => (
                    <LoanCard
                        key={item.id}
                        item={item}
                        navigate={navigate}
                        formatCurrency={formatCurrency}
                    />
                ))}
            </div>

            {filteredLoans.length === 0 && (
                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users size={32} className="text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-lg">No active loans found</p>
                    <p className="text-gray-600 text-sm mt-1">Add a new loan to start tracking</p>
                </div>
            )}

            {isAddModalOpen && (
                <LentModal
                    isOpen={true}
                    onClose={() => setIsAddModalOpen(false)}
                    defaultType="borrowed"
                />
            )}
        </div>
    );
};

export default Loans;
