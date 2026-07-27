import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Edit2, Trash2, Plus, Shield } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import MutualFundTransactionModal from '../components/MutualFundTransactionModal';
import BackButton from '../components/BackButton';

const EmergencyFundDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    // State for modals
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const fund = savings.find(s => s.id.toString() === id);

    if (!fund) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Emergency Fund Account not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    // Treat NAV as 1 for Emergency Fund (1 Unit = 1 Currency)
    const currentNav = 1;

    // --- Transaction Handlers ---

    const handleSaveTransaction = (tx) => {
        let updatedTransactions = fund.transactions ? [...fund.transactions] : [];

        // For Emergency Fund, Units = Amount (since NAV is 1)
        const processTx = (transaction) => {
            return {
                ...transaction,
                units: Number(transaction.amount),
                nav: 1
            };
        };

        const processedTx = processTx(tx);

        if (editingTx) {
            // Edit existing
            updatedTransactions = updatedTransactions.map(t => t.id === processedTx.id ? processedTx : t);
        } else {
            // Add new
            updatedTransactions.push(processedTx);
        }

        updatedTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Recalculate Total Amount
        let totalAmount = 0;
        updatedTransactions.forEach(t => {
            const type = t.type || 'buy'; // buy = deposit, sell = withdraw
            if (type === 'buy' || type === 'sip') totalAmount += Number(t.amount);
            if (type === 'sell' || type === 'withdraw') totalAmount -= Number(t.amount);
        });

        updateItem('savings', { ...fund, transactions: updatedTransactions, amount: totalAmount });
        setEditingTx(null);
        setIsTxModalOpen(false);
    };

    const handleDeleteTransaction = (txId) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedTransactions = fund.transactions.filter(t => t.id !== txId);

            // Recalculate Total
            let totalAmount = 0;
            updatedTransactions.forEach(t => {
                const type = t.type || 'buy';
                if (type === 'buy' || type === 'sip') totalAmount += Number(t.amount);
                if (type === 'sell' || type === 'withdraw') totalAmount -= Number(t.amount);
            });

            updateItem('savings', { ...fund, transactions: updatedTransactions, amount: totalAmount });
        }
    };

    // ... Calculation Logic Simplified ...
    let runningBalance = 0;

    let transactionsWithCalcs = [];
    if (fund.transactions) {
        const sortedTransactions = [...fund.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

        transactionsWithCalcs = sortedTransactions.map(tx => {
            const isWithdraw = tx.type === 'sell' || tx.type === 'withdraw';
            const txAmount = Number(tx.amount);

            if (isWithdraw) {
                runningBalance -= txAmount;
                return {
                    ...tx,
                    isWithdraw: true,
                    typeDisplay: 'Withdraw',
                    displayAmount: txAmount
                };
            } else {
                runningBalance += txAmount;
                return {
                    ...tx,
                    isWithdraw: false,
                    typeDisplay: 'Deposit',
                    displayAmount: txAmount
                };
            }
        });
    }

    const glassCardStyle = {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '1.25rem',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
    };

    return (
        <div style={{ padding: 'var(--spacing-xl) var(--spacing-lg)', minHeight: '100vh', backgroundColor: '#070715' }}>
            <BackButton label="Back to Savings" />

            <div className="mb-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                    <h2 className="text-4xl font-black flex items-center gap-4 text-white tracking-tight">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                            <Shield className="text-emerald-400" size={32} />
                        </div>
                        {fund.title}
                    </h2>

                    <button
                        onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                        className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:brightness-110 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-xs uppercase tracking-widest active:scale-95"
                    >
                        <Plus size={16} />
                        Add Transaction
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="card p-6" style={{
                        ...glassCardStyle,
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                        border: '1px solid rgba(16, 185, 129, 0.15)'
                    }}>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Current Balance</p>
                        <p className="font-black text-3xl text-white">{formatCurrency(fund.amount)}</p>
                    </div>
                </div>
            </div>

            <div className="card p-0 overflow-hidden shadow-2xl" style={glassCardStyle}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Type</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Amount</th>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Remarks</th>
                                <th className="py-5 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {transactionsWithCalcs.map((tx, index) => (
                                <tr 
                                    key={index} 
                                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} 
                                    className="hover:bg-white/[0.03] transition-colors group"
                                >
                                    <td className="py-5 px-6 text-zinc-300">{formatDate(tx.date)}</td>
                                    <td className="py-5 px-6">
                                        <span style={{
                                            color: tx.isWithdraw ? '#f87171' : '#34d399',
                                            backgroundColor: tx.isWithdraw ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            border: tx.isWithdraw ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: '900',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            {tx.typeDisplay}
                                        </span>
                                    </td>
                                    <td className="py-5 px-6 text-right font-mono text-zinc-200">{formatCurrency(tx.displayAmount)}</td>
                                    <td className="py-5 px-6 text-zinc-400 font-medium">{tx.remarks || '-'}</td>
                                    <td className="py-5 px-6 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                                className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!transactionsWithCalcs.length && (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-zinc-500 font-medium italic">
                                        No transactions found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reuse MutualFundTransactionModal - Users can just ignore NAV/Units if we hide them or auto-fill */}
            <MutualFundTransactionModal
                isOpen={isTxModalOpen}
                onClose={() => { setIsTxModalOpen(false); setEditingTx(null); }}
                onSave={handleSaveTransaction}
                initialData={editingTx}
                isEmergencyFund={true} // Adding this prop to hide NAV/Units
            />
        </div>
    );
};

export default EmergencyFundDetails;
