import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Calendar, Award, CheckCircle, XCircle } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatDate } from '../utils/dateUtils';
import CreditCardTransactionModal from '../components/CreditCardTransactionModal';

const SingleCreditCardDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { creditCards, expenses, updateItem, formatCurrency, categories } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const [filterYear, setFilterYear] = useState('All');
    const [filterMonth, setFilterMonth] = useState('All');
    const [filterType, setFilterType] = useState('All');

    const card = creditCards.find(c => c.id.toString() === id);

    if (!card) {
        return (
            <div className="p-8 text-center text-gray-500">
                <p>Credit Card not found.</p>
                <button onClick={() => navigate(-1)} className="text-purple-400 hover:underline mt-4">Go Back</button>
            </div>
        );
    }

    const monthlyData = card.monthlyData || [];
    const totalPoints = monthlyData.reduce((sum, m) => sum + (Number(m.points) || 0), 0);

    // Filter Linked Transactions from Expenses
    const linkedTransactions = [];
    if (expenses) {
        Object.entries(expenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, data]) => {
                if (data.transactions) {
                    data.transactions.forEach(tx => {
                        // Match payment mode and credit card name loosely
                        if (tx.paymentMode === 'credit_card' && tx.creditCardName) {
                            const txName = tx.creditCardName.trim().toLowerCase();
                            const cardName = card.name.trim().toLowerCase();

                            // Check for exact match, or partial matches (e.g. "Scapia" matches "Scapia Card")
                            // Also check aliases for legacy data
                            const aliases = {
                                'coral rupay': ['icici rupay'],
                                'hpcl': ['icici hp card']
                            };

                            const knownAliases = aliases[cardName] || [];

                            if (
                                txName === cardName ||
                                cardName.includes(txName) ||
                                txName.includes(cardName) ||
                                knownAliases.includes(txName)
                            ) {
                                linkedTransactions.push({ ...tx, month, year });
                            }
                        }
                    });
                }
            });
        });
    }

    // Extract available filter options
    const yearsSet = new Set(linkedTransactions.map(t => t.year));
    const currentYear = new Date().getFullYear();
    for (let y = 2022; y <= currentYear + 1; y++) {
        yearsSet.add(y.toString());
    }
    const availableYears = [...yearsSet].sort((a, b) => b - a);

    const availableMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Filter Logic
    // Filter Logic
    const filteredTransactions = linkedTransactions.filter(tx => {
        if (filterYear !== 'All' && String(tx.year) !== String(filterYear)) return false;
        if (filterMonth !== 'All' && String(tx.month).trim().toLowerCase() !== String(filterMonth).trim().toLowerCase()) return false;
        if (filterType !== 'All') {
            const isCredit = !!tx.isCredited;
            if (filterType === 'credit' && !isCredit) return false;
            if (filterType === 'debit' && isCredit) return false;
        }
        return true;
    });

    const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
    const currentYearStr = new Date().getFullYear().toString();
    const currentMonthSpending = linkedTransactions
        .filter(t => t.month === currentMonthName && t.year === currentYearStr)
        .reduce((sum, t) => sum + (t.isCredited ? -Number(t.amount) : Number(t.amount)), 0);

    const filteredNetSpend = filteredTransactions.reduce((sum, t) => sum + (t.isCredited ? -Number(t.amount) : Number(t.amount)), 0);


    const handleSaveTransaction = async (transaction) => {
        let updatedMonthlyData;
        if (editingTx) {
            updatedMonthlyData = monthlyData.map(m => m.id === transaction.id ? transaction : m);
        } else {
            updatedMonthlyData = [...monthlyData, transaction];
        }

        const updatedCard = { ...card, monthlyData: updatedMonthlyData };
        await updateItem('creditCards', updatedCard);
        setEditingTx(null);
        setIsModalOpen(false);
    };

    const handleDeleteTransaction = async (txId) => {
        if (window.confirm('Delete this monthly record?')) {
            const updatedMonthlyData = monthlyData.filter(m => m.id !== txId);
            const updatedCard = { ...card, monthlyData: updatedMonthlyData };
            await updateItem('creditCards', updatedCard);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group mb-4"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Cards
            </button>

            {/* Header Card */}
            <div className="bg-gradient-to-br from-[#18181b] to-purple-900/10 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2">{card.name}</h1>
                        <p className="text-gray-400 flex items-center gap-2">
                            {card.bankName} • Ending in <span className="font-mono text-white">{card.last4Digits}</span>
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 border border-white/5 min-w-[140px]">
                            <p className="text-xs text-secondary uppercase tracking-wider mb-1">Net Spend (This Month)</p>
                            <p className="font-mono font-bold text-2xl text-white flex items-center gap-2">
                                {formatCurrency(currentMonthSpending)}
                            </p>
                        </div>
                        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 border border-white/5 min-w-[140px]">
                            <p className="text-xs text-secondary uppercase tracking-wider mb-1">Total Points</p>
                            <p className="font-mono font-bold text-2xl text-amber-400 flex items-center gap-2">
                                <Award size={20} />
                                {totalPoints.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions & List */}
            <div className="flex items-center justify-between mt-8">
                <h2 className="text-2xl font-bold text-white">Monthly history</h2>
                <button
                    onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/40"
                >
                    <Plus size={18} />
                    Add Entry
                </button>
            </div>

            <div className="bg-[#18181b] border border-white/5 rounded-3xl overflow-hidden shadow-xl mb-12">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Month / Year</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Bill Amount</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Points Earned</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                <th className="text-center py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {monthlyData
                                .sort((a, b) => {
                                    if (b.year !== a.year) return b.year - a.year;
                                    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                    return months.indexOf(b.month) - months.indexOf(a.month);
                                })
                                .map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="py-4 px-6 font-medium text-white">
                                            {item.month} {item.year}
                                        </td>
                                        <td className="py-4 px-6 font-mono text-white text-right">
                                            {item.billAmount > 0 ? formatCurrency(item.billAmount) : '—'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {item.billAmount > 0 ? (
                                                item.isPaid ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                                        <CheckCircle size={12} /> Paid {item.paidDate ? `on ${formatDate(item.paidDate)}` : ''}
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                                                        <XCircle size={12} /> Unpaid
                                                    </div>
                                                )
                                            ) : (
                                                <span className="text-gray-600 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right font-mono text-amber-400 font-bold">
                                            {item.points > 0 ? `+${item.points.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="py-4 px-6 text-gray-400 text-sm max-w-xs truncate">
                                            {item.remarks || '—'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingTx(item); setIsModalOpen(true); }}
                                                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(item.id)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!monthlyData.length && (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-gray-500">
                                        No monthly records found. Add one to start tracking.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Linked Expenses Section */}
            <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Recent Transactions (Expenses)</h2>
                        <p className="text-gray-400 text-sm mt-1">
                            Net Bill Amount (Selected Period): <span className={`font-mono font-bold ${filteredNetSpend > 0 ? 'text-white' : 'text-emerald-400'}`}>{formatCurrency(filteredNetSpend)}</span>
                        </p>
                    </div>

                    <div className="flex bg-[#18181b] p-1 rounded-xl border border-white/10">
                        {/* Year Filter */}
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-transparent text-gray-300 text-sm font-medium px-3 py-2 rounded-lg hover:text-white focus:outline-none cursor-pointer"
                        >
                            <option value="All" className="bg-[#18181b]">All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year} className="bg-[#18181b]">{year}</option>
                            ))}
                        </select>
                        <div className="w-px bg-white/10 my-2" />

                        {/* Month Filter */}
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-transparent text-gray-300 text-sm font-medium px-3 py-2 rounded-lg hover:text-white focus:outline-none cursor-pointer"
                        >
                            <option value="All" className="bg-[#18181b]">All Months</option>
                            {availableMonths.map(month => (
                                <option key={month} value={month} className="bg-[#18181b]">{month}</option>
                            ))}
                        </select>
                        <div className="w-px bg-white/10 my-2" />

                        {/* Type Filter */}
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-transparent text-gray-300 text-sm font-medium px-3 py-2 rounded-lg hover:text-white focus:outline-none cursor-pointer"
                        >
                            <option value="All" className="bg-[#18181b]">All Types</option>
                            <option value="debit" className="bg-[#18181b]">Debit</option>
                            <option value="credit" className="bg-[#18181b]">Credit</option>
                        </select>
                    </div>
                </div>

                <div className="bg-[#18181b] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredTransactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((tx) => (
                                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                        <td className="py-4 px-6 text-gray-400 text-sm whitespace-nowrap">
                                            {formatDate(tx.date)}
                                        </td>
                                        <td className="py-4 px-6 font-medium text-white">
                                            {tx.title}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${tx.isCredited ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                {tx.isCredited ? 'Credit' : 'Debit'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-300 capitalize">
                                                {tx.category}
                                            </span>
                                        </td>
                                        <td className={`py-4 px-6 text-right font-mono font-bold ${tx.isCredited ? 'text-emerald-400' : 'text-white'}`}>
                                            {tx.isCredited ? '+' : ''}{formatCurrency(tx.amount)}
                                        </td>
                                    </tr>
                                ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-gray-500">
                                        No linked expense transactions found matching filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreditCardTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />
        </div>
    );
};

export default SingleCreditCardDetails;
