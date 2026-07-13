import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, Plus, Edit2, Trash2, Calendar } from 'lucide-react';
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
            <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all duration-300 mb-8 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-white/[0.1] backdrop-blur-md"
            >
                <ArrowLeft size={14} /> Back to Recurring Deposits
            </button>

            <div className="mb-10">
                <h2 className="text-4xl font-black mb-2 text-white tracking-tight">
                    {rd.name}
                </h2>
                <div className="flex gap-6 mt-4 text-xs font-semibold text-zinc-400">
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] py-2 px-4 rounded-xl backdrop-blur-md">
                        <Calendar size={14} className="text-blue-400" />
                        {formatDate(rd.startDate)} — {rd.endDate ? formatDate(rd.endDate) : 'Ongoing'}
                    </div>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <div className="card p-6" style={glassCardStyle}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Monthly Installment</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(rd.installmentAmount)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
                    border: '1px solid rgba(59, 130, 246, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Paid</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Maturity Goal</p>
                    <p className="text-2xl font-black text-emerald-400">{formatCurrency(rd.maturityAmount)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02))',
                    border: '1px solid rgba(245, 158, 11, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Total Interest</p>
                    <p className="text-2xl font-black text-amber-400">{formatCurrency(totalInterestReceived)}</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-12 bg-white/[0.02] border border-white/[0.06] p-6 rounded-2xl backdrop-blur-md shadow-2xl">
                <div className="flex justify-between items-end mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Goal Progress</span>
                    <span className="text-xs font-black text-white">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">Installments Paid</h3>
                <button
                    onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:brightness-110 text-white font-black py-3 px-5 rounded-2xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-xs uppercase tracking-widest active:scale-95"
                >
                    <Plus size={16} />
                    Add Installment
                </button>
            </div>

            <div className="card p-0 overflow-hidden shadow-2xl mb-12" style={glassCardStyle}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Amount</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Remarks</th>
                                <th className="py-4 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {installments
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((tx) => (
                                    <tr 
                                        key={tx.id} 
                                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} 
                                        className="hover:bg-white/[0.03] transition-colors group"
                                    >
                                        <td className="py-4 px-6 text-zinc-300">{formatDate(tx.date)}</td>
                                        <td className="py-4 px-6 text-zinc-100 font-mono">
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="py-4 px-6 text-zinc-400 font-medium">{tx.remarks || '—'}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingTx(tx); setIsModalOpen(true); }}
                                                    className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(tx.id)}
                                                    className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!installments.length && (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-zinc-500 italic">
                                        No installments recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">Interest Payouts</h3>
                <button
                    onClick={() => { setEditingInterestTx(null); setIsInterestModalOpen(true); }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-black py-3 px-5 rounded-2xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] text-xs uppercase tracking-widest active:scale-95"
                >
                    <Plus size={16} />
                    Add Interest
                </button>
            </div>

            <div className="card p-0 overflow-hidden shadow-2xl" style={glassCardStyle}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Amount</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Remarks</th>
                                <th className="py-4 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {interestTransactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((tx) => (
                                    <tr 
                                        key={tx.id} 
                                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} 
                                        className="hover:bg-white/[0.03] transition-colors group"
                                    >
                                        <td className="py-4 px-6 text-zinc-300">{formatDate(tx.date)}</td>
                                        <td className="py-4 px-6 text-emerald-400 font-mono">
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="py-4 px-6 text-zinc-400 font-medium">{tx.remarks || '—'}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingInterestTx(tx); setIsInterestModalOpen(true); }}
                                                    className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteInterest(tx.id)}
                                                    className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!interestTransactions.length && (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-zinc-500 italic">
                                        No interest transactions recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
