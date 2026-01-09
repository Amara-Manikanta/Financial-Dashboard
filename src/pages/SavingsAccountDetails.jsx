import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Plus, Trash2, Edit2, Settings } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import SavingsAccountTransactionModal from '../components/SavingsAccountTransactionModal';
import SavingsAccountEditModal from '../components/SavingsAccountEditModal';

const SavingsAccountDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    // Flag to ensure we don't loop infinitely
    const processedInterestRef = React.useRef(false);

    const [selectedYear, setSelectedYear] = useState('All');
    const [selectedMonth, setSelectedMonth] = useState('All');
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);

    const account = savings.find(s => s.id.toString() === id);

    // Calculate Balance & Auto-Generate Interest
    const syncInterest = () => {
        if (!account) return;

        const transactions = [...(account.transactions || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
        // Use interestRate from account or default to 5.4%
        const annualRate = account.interestRate || 5.4;
        const ratePerDay = annualRate / 100 / 365;

        const newTransactions = [];

        if (transactions.length === 0) return;

        let currentDate = new Date(transactions[0].date);
        currentDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(0, 0, 0, 0);

        let runningBalance = 0;
        let madeChanges = false;
        const existingTxs = [...transactions];

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];

            // 1. Process all NON-INTEREST transactions for this day
            const daysTransactions = existingTxs.filter(t => t.date === dateStr && t.type !== 'interest');

            daysTransactions.forEach(tx => {
                const amount = Number(tx.amount);
                if (tx.type === 'deposit') runningBalance += amount;
                else if (tx.type === 'withdraw') runningBalance -= amount;
            });

            // 2. Check if Interest exists for this day
            const interestTx = existingTxs.find(t => t.date === dateStr && t.type === 'interest');

            if (interestTx) {
                runningBalance += Number(interestTx.amount);
            } else {
                if (runningBalance > 0) {
                    const dailyInterest = runningBalance * ratePerDay;
                    // Only add if interest > 0.005 to avoid spamming 0.00
                    if (dailyInterest > 0.005) {
                        const newTx = {
                            id: Date.now() + Math.random(),
                            date: dateStr,
                            type: 'interest',
                            amount: Number(dailyInterest.toFixed(2)),
                            remarks: 'Auto Daily Interest'
                        };
                        newTransactions.push(newTx);
                        existingTxs.push(newTx);
                        runningBalance += newTx.amount;
                        madeChanges = true;
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (madeChanges && newTransactions.length > 0) {
            console.log("Adding ", newTransactions.length, " interest transactions.");
            const finalTransactions = [...(account.transactions || []), ...newTransactions];
            finalTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Recalc final amount to be safe
            let finalAmount = 0;
            finalTransactions.forEach(t => {
                const val = Number(t.amount) || 0;
                if (t.type === 'deposit' || t.type === 'interest') finalAmount += val;
                else if (t.type === 'withdraw') finalAmount -= val;
            });

            updateItem('savings', {
                ...account,
                transactions: finalTransactions,
                amount: finalAmount
            });
        }
    };

    useEffect(() => {
        if (!processedInterestRef.current && account) {
            syncInterest();
            processedInterestRef.current = true;
        }
    }, [account]);

    // Sorting and Filtering
    const sortedTransactions = useMemo(() => {
        if (!account || !account.transactions) return [];

        let filtered = [...account.transactions];

        if (selectedYear !== 'All') {
            filtered = filtered.filter(t => t.date.startsWith(selectedYear));
        }

        if (selectedMonth !== 'All') {
            filtered = filtered.filter(t => {
                const month = new Date(t.date).getMonth() + 1;
                return month === parseInt(selectedMonth);
            });
        }

        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [account, selectedYear, selectedMonth]);

    const years = useMemo(() => {
        if (!account || !account.transactions) return ['All'];
        const uniqueYears = [...new Set(account.transactions.map(t => t.date.split('-')[0]))];
        return ['All', ...uniqueYears.sort((a, b) => b - a)];
    }, [account]);

    const months = [
        { value: 'All', label: 'All Months' },
        { value: '1', label: 'January' },
        { value: '2', label: 'February' },
        { value: '3', label: 'March' },
        { value: '4', label: 'April' },
        { value: '5', label: 'May' },
        { value: '6', label: 'June' },
        { value: '7', label: 'July' },
        { value: '8', label: 'August' },
        { value: '9', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' }
    ];

    // Interest Received Summary (Year & Month wise)
    const interestSummary = useMemo(() => {
        if (!account || !account.transactions) return {};
        return account.transactions
            .filter(t => t.type === 'interest')
            .reduce((acc, t) => {
                const date = new Date(t.date);
                const year = date.getFullYear();
                const month = date.toLocaleString('default', { month: 'long' });

                if (!acc[year]) acc[year] = { total: 0, months: {} };
                acc[year].total += t.amount;
                acc[year].months[month] = (acc[year].months[month] || 0) + t.amount;
                return acc;
            }, {});
    }, [account]);

    if (!account) return <div>Account not found</div>;

    const handleSaveTransaction = async (tx) => {
        try {
            console.log("Processing transaction save:", tx);

            if (!tx.amount || isNaN(tx.amount)) {
                alert("Please enter a valid amount");
                return;
            }

            let updatedTransactions = [...(account.transactions || [])];

            if (editingTx) {
                // Update existing
                updatedTransactions = updatedTransactions.map(t => t.id === tx.id ? tx : t);
            } else {
                // Add new - Ensure ID is unique
                if (updatedTransactions.some(t => t.id === tx.id)) {
                    tx.id = Date.now() + Math.random();
                }
                updatedTransactions.push(tx);
            }

            // Calculate new basic amount (sum of manual transactions)
            let newAmount = 0;
            updatedTransactions.forEach(t => {
                const val = Number(t.amount) || 0;
                if (t.type === 'deposit' || t.type === 'interest') newAmount += val;
                else if (t.type === 'withdraw') newAmount -= val;
            });

            await updateItem('savings', {
                ...account,
                transactions: updatedTransactions,
                amount: newAmount
            });

            setIsTxModalOpen(false);
            setEditingTx(null);
        } catch (error) {
            console.error("Failed to save transaction:", error);
            alert("Failed to save transaction. Please try again.");
        }
    };

    const handleDeleteTransaction = (txId) => {
        if (window.confirm("Delete transaction?")) {
            const updatedTransactions = account.transactions.filter(t => t.id !== txId);
            let newAmount = 0;
            updatedTransactions.forEach(t => {
                const val = Number(t.amount) || 0;
                if (t.type === 'deposit' || t.type === 'interest') newAmount += val;
                else if (t.type === 'withdraw') newAmount -= val;
            });
            updateItem('savings', {
                ...account,
                transactions: updatedTransactions,
                amount: newAmount
            });
        }
    };

    const handleEditAccount = (updatedAccount) => {
        updateItem('savings', updatedAccount);
    };

    // Calculate stats details...
    let totalDeposits = 0;
    let totalInterest = 0;
    let totalWithdrawals = 0;

    sortedTransactions.forEach(t => {
        const amt = Number(t.amount);
        if (t.type === 'deposit') totalDeposits += amt;
        else if (t.type === 'interest') totalInterest += amt;
        else if (t.type === 'withdraw') totalWithdrawals += amt;
    });

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-all mb-8 text-xs font-black uppercase tracking-[0.2em] text-gray-500 group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Savings
            </button>

            <div className="mb-12 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                <div>
                    <div className="flex items-center gap-4 mb-3">
                        <h2 className="text-5xl font-black text-white tracking-tighter">
                            {account.title}
                        </h2>
                        <button
                            onClick={() => setIsEditAccountModalOpen(true)}
                            className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90 border border-white/5"
                            title="Edit Account Details"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full uppercase tracking-widest">
                            {account.interestRate || 5.4}% Annual Interest
                        </span>
                        <span className="text-[10px] font-black bg-white/5 text-gray-400 border border-white/10 px-3 py-1 rounded-full uppercase tracking-widest">
                            {account.bank || 'Savings Account'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <button
                        onClick={() => { processedInterestRef.current = false; syncInterest(); }}
                        className="flex-1 lg:flex-none bg-white/5 hover:bg-white/10 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all border border-white/10 active:scale-95 text-xs uppercase tracking-widest"
                    >
                        <TrendingUp size={18} className="text-purple-400" />
                        Sync Interest
                    </button>
                    <button
                        onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                        className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-900/40 active:scale-95 text-xs uppercase tracking-widest"
                    >
                        <Plus size={18} />
                        Add Transaction
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="card bg-gradient-to-br from-blue-600/20 via-blue-600/5 to-transparent border-white/10 p-8 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={120} />
                    </div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3">Available Balance</p>
                    <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(account.amount)}</p>
                </div>
                <div className="card bg-white/[0.02] border-white/5 p-8">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3">Principal Deposits</p>
                    <p className="text-2xl font-black text-gray-200">{formatCurrency(totalDeposits)}</p>
                </div>
                <div className="card bg-gradient-to-br from-emerald-500/10 to-transparent border-white/5 p-8">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-3">Accrued Interest</p>
                    <div className="flex items-center gap-3">
                        <p className="text-3xl font-black text-emerald-400 tracking-tight">{formatCurrency(totalInterest)}</p>
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                            <TrendingUp size={16} className="text-emerald-500" />
                        </div>
                    </div>
                </div>
                <div className="card bg-white/[0.02] border-white/5 p-8">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3">Total Withdrawals</p>
                    <p className="text-2xl font-black text-red-400/80">{formatCurrency(totalWithdrawals)}</p>
                </div>
            </div>

            {/* Interest Summary Section */}
            <div className="mb-12">
                <div className="flex items-center justify-between mb-6 px-1">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Earnings Distribution</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Object.entries(interestSummary).sort((a, b) => b[0] - a[0]).map(([year, data]) => (
                        <div key={year} className="card border-white/5 p-6 bg-white/[0.02] relative overflow-hidden group hover:bg-white/[0.04] transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xl font-black text-white">{year}</span>
                                <span className="text-sm font-bold text-emerald-400">{formatCurrency(data.total)}</span>
                            </div>
                            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                {Object.entries(data.months).map(([month, amount]) => (
                                    <div key={month} className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                        <span>{month}</span>
                                        <span className="text-gray-300">{formatCurrency(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Transactions Section */}
            <div className="card border-white/5 p-0 overflow-hidden shadow-2xl bg-white/[0.01]">
                <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Transaction History</h3>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-300 outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                        >
                            {years.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
                        </select>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-300 outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                        >
                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/[0.02]">
                                <th className="py-6 px-10">Date</th>
                                <th className="py-6 px-6">Classification</th>
                                <th className="py-6 px-6 text-right">Value</th>
                                <th className="py-6 px-6">Memorandum</th>
                                <th className="py-6 px-10 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sortedTransactions.map((tx, idx) => (
                                <tr key={tx.id || idx} className="hover:bg-white/[0.03] transition-colors group">
                                    <td className="py-7 px-10 text-sm font-bold text-gray-400">{formatDate(tx.date)}</td>
                                    <td className="py-7 px-6">
                                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.1em] border ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                tx.type === 'withdraw' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="py-7 px-6 text-right font-black tracking-tighter text-base">
                                        <span className={tx.type === 'withdraw' ? 'text-red-400/90' : 'text-white'}>
                                            {tx.type === 'withdraw' ? '-' : '+'}{formatCurrency(tx.amount)}
                                        </span>
                                    </td>
                                    <td className="py-7 px-6 text-xs font-medium text-gray-500 italic">
                                        {tx.remarks || '—'}
                                    </td>
                                    <td className="py-7 px-10 text-right">
                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                                className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-105"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-105"
                                                title="Delete"
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

                {sortedTransactions.length === 0 && (
                    <div className="text-center py-32 bg-white/[0.01]">
                        <div className="mb-4 flex justify-center text-gray-700">
                            <TrendingUp size={48} />
                        </div>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No entries found for this period</p>
                    </div>
                )}
            </div>

            <SavingsAccountTransactionModal
                isOpen={isTxModalOpen}
                onClose={() => { setIsTxModalOpen(false); setEditingTx(null); }}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />

            <SavingsAccountEditModal
                isOpen={isEditAccountModalOpen}
                onClose={() => setIsEditAccountModalOpen(false)}
                onSave={handleEditAccount}
                account={account}
            />
        </div>
    );
};

export default SavingsAccountDetails;
