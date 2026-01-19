import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Plus, Edit2, Trash2, Calendar, DollarSign, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import LentModal from '../components/LentModal';
import LentTransactionModal from '../components/LentTransactionModal';

const LentDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { lents, deleteItem, updateItem, formatCurrency } = useFinance();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editTransaction, setEditTransaction] = useState(null);
    const [selectedYear, setSelectedYear] = useState('All');

    const item = lents.find(i => i.id === id);

    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400">
                <p>Record not found</p>
                <button onClick={() => navigate('/lents')} className="mt-4 text-emerald-400 hover:text-emerald-300">
                    Go Back
                </button>
            </div>
        );
    }

    const isLent = item.type === 'lent';
    const amount = item.amount || 0;
    const transactions = item.transactions || [];

    const totalRepaid = transactions
        .filter(t => t.type === 'repayment')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const totalAdditional = transactions
        .filter(t => t.type === 'additional')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    // Net Principal = Initial Principal + Additional Loans
    const netPrincipal = amount + totalAdditional;
    const pendingAmount = netPrincipal - totalRepaid;

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this record?')) {
            await deleteItem('lents', id);
            navigate('/lents');
        }
    };

    // Filter Logic
    const years = ['All', ...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);

    const filteredTransactions = transactions
        .filter(t => selectedYear === 'All' || new Date(t.date).getFullYear() === parseInt(selectedYear))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const handleEditTransaction = (transaction) => {
        setEditTransaction(transaction);
        setIsTransactionModalOpen(true);
    };

    const handleDeleteTransaction = async (transactionId) => {
        if (!item || !item.transactions) return;

        if (window.confirm('Are you sure you want to delete this transaction?')) {
            try {
                const updatedTransactions = item.transactions.filter(t => t.id !== transactionId);
                const updatedItem = { ...item, transactions: updatedTransactions };
                await updateItem('lents', updatedItem);
            } catch (error) {
                console.error("Failed to delete transaction:", error);
                alert("Failed to delete transaction. see console for details.");
            }
        }
    };

    // EMI Schedule Calculation
    let emiSchedule = [];
    if (item.isEmi && item.emiDetails) {
        const { totalMonths, amountPerMonth, startDate } = item.emiDetails;
        const start = new Date(startDate);

        for (let i = 0; i < totalMonths; i++) {
            const dueDate = new Date(start);
            dueDate.setMonth(start.getMonth() + i);

            // Check if this EMI is covered by repayments
            // This is a naive simplistic logic: sum of repayments covers X months
            // Real world logic might need specific linkage between payment and EMI, but simplistic accumulation is okay for V1
            const coveredAmount = (i + 1) * amountPerMonth;
            const status = totalRepaid >= coveredAmount ? 'paid' : totalRepaid >= (i * amountPerMonth) ? 'partial' : 'pending';

            emiSchedule.push({
                month: i + 1,
                dueDate: dueDate,
                amount: amountPerMonth,
                status: status
            });
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/lents')}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        {item.name}
                        {item.isEmi && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/20">
                                EMI
                            </span>
                        )}
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-sm text-gray-500 uppercase font-medium mb-1">Total Principal</p>
                    <h3 className="text-2xl font-bold text-white">{formatCurrency(netPrincipal)}</h3>
                    {totalAdditional > 0 && <p className="text-xs text-amber-400 mt-1">Includes +{formatCurrency(totalAdditional)} added</p>}
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-sm text-gray-500 uppercase font-medium mb-1">Total Repaid</p>
                    <h3 className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRepaid)}</h3>
                    {item.isEmi && <p className="text-xs text-gray-400 mt-1">{item.emiDetails?.amountPerMonth ? Math.floor(totalRepaid / item.emiDetails.amountPerMonth) : 0} EMIs paid approx</p>}
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
                    <div className={`absolute inset-0 opacity-10 ${pendingAmount > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <p className="text-sm text-gray-500 uppercase font-medium mb-1 relative z-10">Pending Balance</p>
                    <h3 className={`text-2xl font-bold relative z-10 ${pendingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(pendingAmount)}
                    </h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content: Transactions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-white">Transaction History</h2>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50"
                            >
                                {years.map(year => (
                                    <option key={year} value={year} className="bg-zinc-900">{year}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => {
                                    setEditTransaction(null);
                                    setIsTransactionModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-colors text-sm font-medium"
                            >
                                <Plus size={16} />
                                Add Transaction
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {filteredTransactions.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 bg-white/5 rounded-xl border border-white/10 border-dashed">
                                No transactions found.
                            </div>
                        ) : (
                            filteredTransactions.map(tx => (
                                <div key={tx.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'repayment'
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                            {tx.type === 'repayment' ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium capitalize">
                                                {tx.type === 'repayment' ? (isLent ? 'Repayment Received' : 'You Paid Back') : (isLent ? 'Lent More' : 'Borrowed More')}
                                            </p>
                                            <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`font-bold ${tx.type === 'repayment' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {tx.type === 'repayment' ? '-' : '+'}{formatCurrency(tx.amount)}
                                            </p>
                                            {tx.description && <p className="text-xs text-gray-500 max-w-[200px] truncate">{tx.description}</p>}
                                        </div>
                                        <button
                                            onClick={() => handleEditTransaction(tx)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                            title="Edit Transaction"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTransaction(tx.id);
                                            }}
                                            className="p-2 rounded-lg hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 z-10"
                                            title="Delete Transaction"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sidebar: Details & EMI */}
                <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                        <h3 className="text-lg font-bold text-white mb-2">Details</h3>
                        {item.description && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Notes</p>
                                <p className="text-gray-300 text-sm mt-1">{item.description}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Originally Created</p>
                            <p className="text-gray-300 text-sm mt-1">{new Date(item.created || Date.now()).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {item.isEmi && (
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Clock size={18} className="text-blue-400" />
                                EMI Schedule
                            </h3>
                            <div className="space-y-2">
                                {emiSchedule.map((emi) => (
                                    <div key={emi.month} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${emi.status === 'paid' ? 'bg-emerald-500' :
                                                emi.status === 'partial' ? 'bg-amber-500' : 'bg-gray-600'
                                                }`} />
                                            <span className="text-gray-300">
                                                {emi.dueDate.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                            </span>
                                        </div>
                                        <span className={emi.status === 'paid' ? 'text-emerald-400' : 'text-gray-400'}>
                                            {formatCurrency(emi.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isEditModalOpen && (
                <LentModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    editItem={item}
                />
            )}

            <LentTransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => {
                    setIsTransactionModalOpen(false);
                    setEditTransaction(null);
                }}
                person={item}
                editTransaction={editTransaction}
            />
        </div>
    );
};

export default LentDetails;
