import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, Plus, Edit2, Trash2, Calendar, Target } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import RDTransactionModal from '../components/RDTransactionModal';

import InterestTransactionModal from '../components/InterestTransactionModal';

const SingleRecurringDepositDetails = () => {
    const { id, rdId } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
    const [editingInterestTx, setEditingInterestTx] = useState(null);

    const account = savings.find(s => s.id.toString() === id);
    const rdIndex = account?.recurringDeposits?.findIndex(d => d.id.toString() === rdId);
    const rd = (account && rdIndex !== undefined && rdIndex !== -1) ? account.recurringDeposits[rdIndex] : null;

    if (!account || !rd) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Recurring Deposit not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back
                </button>
            </div>
        );
    }

    const installments = rd.installments || [];
    const totalPaid = installments.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const progress = rd.maturityAmount > 0 ? (totalPaid / rd.maturityAmount) * 100 : 0;

    const interestTransactions = rd.interestTransactions || [];
    const totalInterestReceived = interestTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const handleSaveTransaction = (transaction) => {
        const updatedTransactions = editingTx
            ? installments.map(t => t.id === transaction.id ? transaction : t)
            : [...installments, transaction];

        const updatedRD = { ...rd, installments: updatedTransactions };
        const updatedRDs = [...account.recurringDeposits];
        updatedRDs[rdIndex] = updatedRD;

        updateItem('savings', { ...account, recurringDeposits: updatedRDs });
        setEditingTx(null);
        setIsModalOpen(false);
    };

    const handleDeleteTransaction = (txId) => {
        if (window.confirm('Delete this installment?')) {
            const updatedTransactions = installments.filter(t => t.id !== txId);
            const updatedRD = { ...rd, installments: updatedTransactions };
            const updatedRDs = [...account.recurringDeposits];
            updatedRDs[rdIndex] = updatedRD;

            updateItem('savings', { ...account, recurringDeposits: updatedRDs });
        }
    };

    const handleSaveInterest = (transaction) => {
        const updatedTransactions = editingInterestTx
            ? interestTransactions.map(t => t.id === transaction.id ? transaction : t)
            : [...interestTransactions, transaction];

        const updatedRD = { ...rd, interestTransactions: updatedTransactions };
        const updatedRDs = [...account.recurringDeposits];
        updatedRDs[rdIndex] = updatedRD;

        updateItem('savings', { ...account, recurringDeposits: updatedRDs });
        setEditingInterestTx(null);
        setIsInterestModalOpen(false);
    };

    const handleDeleteInterest = (txId) => {
        if (window.confirm('Delete this interest transaction?')) {
            const updatedTransactions = interestTransactions.filter(t => t.id !== txId);
            const updatedRD = { ...rd, interestTransactions: updatedTransactions };
            const updatedRDs = [...account.recurringDeposits];
            updatedRDs[rdIndex] = updatedRD;

            updateItem('savings', { ...account, recurringDeposits: updatedRDs });
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', color: 'white' }}
            >
                <ArrowLeft size={20} /> Back to Recurring Deposits
            </button>

            <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <span className="text-blue-400">{rd.name}</span>
                </h2>
                <div className="flex gap-6 mt-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {formatDate(rd.startDate)} — {rd.endDate ? formatDate(rd.endDate) : 'Ongoing'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="card p-4">
                    <p className="text-secondary text-xs mb-1 uppercase tracking-wider">Monthly Installment</p>
                    <p className="font-bold text-xl">{formatCurrency(rd.installmentAmount)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-secondary text-xs mb-1 uppercase tracking-wider">Total Paid</p>
                    <p className="font-bold text-xl text-blue-400">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-secondary text-xs mb-1 uppercase tracking-wider">Maturity Goal</p>
                    <p className="font-bold text-xl text-emerald-400">{formatCurrency(rd.maturityAmount)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-secondary text-xs mb-1 uppercase tracking-wider">Total Interest</p>
                    <p className="font-bold text-xl text-amber-400">{formatCurrency(totalInterestReceived)}</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-12">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Progress</span>
                    <span className="text-xs font-bold text-white">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Installments Paid</h3>
                <button
                    onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/40"
                    style={{ color: 'white' }}
                >
                    <Plus size={20} />
                    Add Installment
                </button>
            </div>

            <div className="card mb-12" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Amount</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Remarks</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {installments
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((tx) => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="hover:bg-white/5 transition-colors group">
                                    <td style={{ padding: 'var(--spacing-md)' }}>{formatDate(tx.date)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                        {formatCurrency(tx.amount)}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{tx.remarks || '—'}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingTx(tx); setIsModalOpen(true); }}
                                                className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        {!installments.length && (
                            <tr>
                                <td colSpan="4" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No installments recorded.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Interest Payouts</h3>
                <button
                    onClick={() => { setEditingInterestTx(null); setIsInterestModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/40"
                    style={{ color: 'white' }}
                >
                    <Plus size={20} />
                    Add Interest
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Amount</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Remarks</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {interestTransactions
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((tx) => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="hover:bg-white/5 transition-colors group">
                                    <td style={{ padding: 'var(--spacing-md)' }}>{formatDate(tx.date)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                        {formatCurrency(tx.amount)}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{tx.remarks || '—'}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingInterestTx(tx); setIsInterestModalOpen(true); }}
                                                className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteInterest(tx.id)}
                                                className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        {!interestTransactions.length && (
                            <tr>
                                <td colSpan="4" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No interest transactions recorded.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <RDTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />

            <InterestTransactionModal
                isOpen={isInterestModalOpen}
                onClose={() => setIsInterestModalOpen(false)}
                onSave={handleSaveInterest}
                initialData={editingInterestTx}
            />
        </div>
    );
};

export default SingleRecurringDepositDetails;
