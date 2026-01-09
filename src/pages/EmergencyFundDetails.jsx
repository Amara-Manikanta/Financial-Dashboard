import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Edit2, Trash2, Plus, Settings } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import MutualFundTransactionModal from '../components/MutualFundTransactionModal';
import MutualFundEditModal from '../components/MutualFundEditModal';

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

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', color: 'white' }}
            >
                <ArrowLeft size={20} /> Back to Savings
            </button>

            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        {fund.title}
                    </h2>

                    <button
                        onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/40"
                    >
                        <Plus size={20} />
                        Add Transaction
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Current Balance</p>
                        <p className="font-bold text-3xl text-emerald-400">{formatCurrency(fund.amount)}</p>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Type</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Amount</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Remarks</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactionsWithCalcs.map((tx, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="hover:bg-white/5 transition-colors group">
                                <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-primary)' }}>{formatDate(tx.date)}</td>
                                <td style={{ padding: 'var(--spacing-md)' }}>
                                    <span style={{
                                        color: tx.isWithdraw ? 'var(--color-danger)' : 'var(--color-success)',
                                        backgroundColor: tx.isWithdraw ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        {tx.typeDisplay}
                                    </span>
                                </td>
                                <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(tx.displayAmount)}</td>
                                <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{tx.remarks || '-'}</td>
                                <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                            className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTransaction(tx.id)}
                                            className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
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
                                <td colSpan="5" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No transactions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
