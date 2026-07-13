import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, RefreshCcw, Plus, Edit2, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import RecurringDepositModal from '../components/RecurringDepositModal';

const RecurringDepositDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRD, setEditingRD] = useState(null);

    const account = savings.find(s => s.id.toString() === id);

    if (!account) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Recurring Deposit account not found.</p>
                <button onClick={() => navigate(-1)} className="text-primary hover:underline mt-4">
                    Back to Savings
                </button>
            </div>
        );
    }

    const handleSaveRD = (rd) => {
        let updatedRDs = account.recurringDeposits ? [...account.recurringDeposits] : [];

        if (editingRD) {
            updatedRDs = updatedRDs.map(d => d.id === rd.id ? rd : d);
        } else {
            updatedRDs.push(rd);
        }

        // Calculate total amount (sum of installments * duration? Or current value?)
        const newTotalAmount = updatedRDs.reduce((sum, d) => sum + (d.maturityAmount || 0), 0);

        updateItem('savings', { ...account, recurringDeposits: updatedRDs, amount: newTotalAmount });
        setEditingRD(null);
        setIsModalOpen(false);
    };

    const handleDeleteRD = (rdId) => {
        if (window.confirm('Delete this recurring deposit entry?')) {
            const updatedRDs = account.recurringDeposits.filter(d => d.id !== rdId);
            const newTotalAmount = updatedRDs.reduce((sum, d) => sum + (d.maturityAmount || 0), 0);
            updateItem('savings', { ...account, recurringDeposits: updatedRDs, amount: newTotalAmount });
        }
    };

    const totalInstallment = account.recurringDeposits?.reduce((sum, d) => sum + (Number(d.installmentAmount) || 0), 0) || 0;
    const totalMaturity = account.recurringDeposits?.reduce((sum, d) => sum + (Number(d.maturityAmount) || 0), 0) || 0;
    const totalCurrentValue = account.recurringDeposits?.reduce((sum, rd) => {
        const rdTotalPaid = (rd.installments || []).reduce((acc, tx) => acc + (tx.amount || 0), 0);
        return sum + rdTotalPaid;
    }, 0) || 0;

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
                <ArrowLeft size={14} /> Back to Savings
            </button>

            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-4xl font-black mb-2 flex items-center gap-4 text-white tracking-tight">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                            <RefreshCcw className="text-blue-400" size={32} />
                        </div>
                        {account.title}
                    </h2>
                    <p className="text-zinc-400 font-semibold uppercase tracking-widest text-[10px] pl-1">Track your Recurring Deposits</p>
                </div>
                <button
                    onClick={() => { setEditingRD(null); setIsModalOpen(true); }}
                    className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:brightness-110 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-xs uppercase tracking-widest active:scale-95"
                >
                    <Plus size={16} />
                    Add RD
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <div className="card p-6" style={glassCardStyle}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Total Monthly Installment</p>
                    <p className="text-2xl font-black text-blue-400">{formatCurrency(totalInstallment)}/mo</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
                    border: '1px solid rgba(59, 130, 246, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Current Value</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(totalCurrentValue)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Total Maturity Value</p>
                    <p className="text-2xl font-black text-emerald-400">{formatCurrency(totalMaturity)}</p>
                </div>
            </div>

            <div className="card p-0 overflow-hidden shadow-2xl" style={glassCardStyle}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" style={{ minWidth: '1000px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Name/Goal</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Installment</th>
                                <th className="py-5 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Rate (%)</th>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Start Date</th>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">End Date</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Current Paid</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Maturity Value</th>
                                <th className="py-5 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {[...(account.recurringDeposits || [])]
                                .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
                                .map((rd) => {
                                    const currentPaid = (rd.installments || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
                                    return (
                                        <tr
                                            key={rd.id}
                                            onClick={() => navigate(`/savings/recurring-deposit/${id}/rd/${rd.id}`)}
                                            style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                cursor: 'pointer'
                                            }}
                                            className="hover:bg-white/[0.03] transition-colors group"
                                        >
                                            <td className="py-5 px-6 text-zinc-200">{rd.name}</td>
                                            <td className="py-5 px-6 text-right font-mono text-zinc-400">{formatCurrency(rd.installmentAmount)}</td>
                                            <td className="py-5 px-6 text-center text-blue-400">{rd.interestRate}%</td>
                                            <td className="py-5 px-6 text-zinc-400">{formatDate(rd.startDate)}</td>
                                            <td className="py-5 px-6 text-zinc-400">{rd.endDate ? formatDate(rd.endDate) : '-'}</td>
                                            <td className="py-5 px-6 text-right font-mono text-zinc-300">{formatCurrency(currentPaid)}</td>
                                            <td className="py-5 px-6 text-right font-mono text-emerald-400">{formatCurrency(rd.maturityAmount)}</td>
                                            <td className="py-5 px-6 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { setEditingRD(rd); setIsModalOpen(true); }}
                                                        className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRD(rd.id)}
                                                        className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            {!account.recurringDeposits?.length && (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-zinc-500 italic">
                                        No recurring deposits found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <RecurringDepositModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveRD}
                initialData={editingRD}
            />
        </div>
    );
};

export default RecurringDepositDetails;
