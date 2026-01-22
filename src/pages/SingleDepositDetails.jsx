import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import InterestTransactionModal from '../components/InterestTransactionModal';

const SingleDepositDetails = () => {
    const { id, depositId } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const fund = savings.find(s => s.id.toString() === id);
    const depositIndex = fund?.deposits?.findIndex(d => d.id.toString() === depositId);
    const deposit = depositIndex !== -1 ? fund.deposits[depositIndex] : null;

    if (!fund || !deposit) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Deposit not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back
                </button>
            </div>
        );
    }

    const interestTransactions = deposit.interestTransactions || [];
    const totalInterestReceived = interestTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const handleSaveTransaction = (transaction) => {
        const updatedTransactions = editingTx
            ? interestTransactions.map(t => t.id === transaction.id ? transaction : t)
            : [...interestTransactions, transaction];

        const updatedDeposit = { ...deposit, interestTransactions: updatedTransactions };
        const updatedDeposits = [...fund.deposits];
        updatedDeposits[depositIndex] = updatedDeposit;

        updateItem('savings', { ...fund, deposits: updatedDeposits });
        setEditingTx(null);
        setIsModalOpen(false);
    };

    const handleDeleteTransaction = (txId) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedTransactions = interestTransactions.filter(t => t.id !== txId);
            const updatedDeposit = { ...deposit, interestTransactions: updatedTransactions };
            const updatedDeposits = [...fund.deposits];
            updatedDeposits[depositIndex] = updatedDeposit;

            updateItem('savings', { ...fund, deposits: updatedDeposits });
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', color: 'white' }}
            >
                <ArrowLeft size={20} /> Back to Deposits
            </button>

            <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <span className="text-gray-400">#{deposit.accountNo}</span>
                    <span>{deposit.bank}</span>
                </h2>
                <div className="flex gap-6 mt-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {formatDate(deposit.startDate)} — {formatDate(deposit.endDate)}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Principal Amount</p>
                    <p className="font-bold text-2xl">{formatCurrency(deposit.originalAmount)}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Interest Rate</p>
                    <p className="font-bold text-2xl text-accent-primary">{deposit.interestRate}%</p>
                </div>
                <div className="card relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <TrendingUp size={48} />
                    </div>
                    <p className="text-secondary text-sm mb-1">Interest Received (Payouts)</p>
                    <p className="font-bold text-2xl text-emerald-400">{formatCurrency(totalInterestReceived)}</p>
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Interest Payouts</h3>
                <button
                    onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/40"
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
                                    <td style={{ padding: 'var(--spacing-md)', fontWeight: 'bold', color: 'var(--color-success)', fontFamily: 'monospace' }}>
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

            <InterestTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />
        </div>
    );
};

export default SingleDepositDetails;
