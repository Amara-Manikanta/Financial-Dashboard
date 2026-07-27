import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, Plus, Edit2, Trash2, Calendar, PiggyBank, Sparkles, DollarSign, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import RDTransactionModal from '../components/RDTransactionModal';
import InterestTransactionModal from '../components/InterestTransactionModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

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
            <div className="p-8 text-white">
                <p>Recurring Deposit not found.</p>
                <button onClick={() => navigate(-1)} className="text-blue-400 hover:underline mt-4">
                    Back to Recurring Deposits
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

    const monthlyChartData = useMemo(() => {
        if (!installments.length) return [];
        const sorted = [...installments].sort((a, b) => new Date(a.date) - new Date(b.date));
        return sorted.map(tx => ({
            date: formatDate(tx.date),
            amount: tx.amount || 0
        }));
    }, [installments]);

    const glassCardStyle = {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '1.25rem',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
    };

    return (
        <div style={{ padding: 'var(--spacing-xl) var(--spacing-lg)', minHeight: '100vh', backgroundColor: '#070715' }}>
            {/* Navigation */}
            <button
                onClick={() => navigate(-1)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.875rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    marginBottom: '2rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <ArrowLeft size={16} style={{ color: '#60a5fa' }} />
                <span>Back to {account.title}</span>
            </button>

            {/* Hero Header */}
            <div style={{
                marginBottom: '2.5rem',
                padding: '1.75rem 2rem',
                borderRadius: '1.25rem',
                background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.3) 0%, rgba(17, 24, 39, 0.6) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.5rem',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, lineHeight: 1.2 }}>
                            {rd.name}
                        </h2>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            color: '#60a5fa',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            whiteSpace: 'nowrap'
                        }}>
                            {rd.interestRate}% p.a. Interest
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.375rem 0.875rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#a1a1aa',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                        }}>
                            <Calendar size={14} style={{ color: '#60a5fa' }} />
                            <span>{formatDate(rd.startDate)} ➔ {rd.endDate ? formatDate(rd.endDate) : 'Ongoing'}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                        style={{
                            padding: '0.875rem 1.25rem',
                            borderRadius: '0.875rem',
                            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                            color: 'white',
                            fontWeight: '900',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            border: '1px solid rgba(96, 165, 250, 0.3)',
                            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus size={16} />
                        <span>Add Installment</span>
                    </button>

                    <button
                        onClick={() => { setEditingInterestTx(null); setIsInterestModalOpen(true); }}
                        style={{
                            padding: '0.875rem 1.25rem',
                            borderRadius: '0.875rem',
                            background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                            color: 'white',
                            fontWeight: '900',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus size={16} />
                        <span>Record Interest</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="card p-6" style={glassCardStyle}>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Monthly Installment</p>
                    <p className="text-3xl font-black text-white font-mono">{formatCurrency(rd.installmentAmount)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(59, 130, 246, 0.01))',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Paid to Date</p>
                    <p className="text-3xl font-black text-white font-mono">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.01))',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Target Maturity Goal</p>
                    <p className="text-3xl font-black text-emerald-400 font-mono">{formatCurrency(rd.maturityAmount)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.01))',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                }}>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Interest Received</p>
                    <p className="text-3xl font-black text-amber-400 font-mono">{formatCurrency(totalInterestReceived)}</p>
                </div>
            </div>

            {/* Goal Progress Section */}
            <div className="mb-10 bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        Maturity Goal Progress
                    </span>
                    <span className="text-sm font-black text-white">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>

            {/* Installment History Bar Chart */}
            {monthlyChartData.length > 0 && (
                <div className="mb-10 bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-2xl shadow-2xl">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp size={22} className="text-emerald-400" />
                        <h3 className="text-xl font-bold text-white tracking-tight">Installment Contribution History</h3>
                    </div>

                    <div style={{ width: '100%', height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#e4e4e7' }} />
                                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} tick={{ fill: '#a1a1aa' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                    itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                                    formatter={(value) => [formatCurrency(value), 'Installment Paid']}
                                    labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Bar dataKey="amount" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={45} name="Installment Paid">
                                    {monthlyChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === monthlyChartData.length - 1 ? '#10b981' : '#34d399'} opacity={0.9} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Installments Table */}
            <div className="card p-0 overflow-hidden shadow-2xl mb-10 border border-white/10" style={glassCardStyle}>
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <Sparkles size={18} className="text-blue-400" />
                        Installment Transactions
                    </h3>
                    <span className="text-xs font-bold text-zinc-400">{installments.length} Paid</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest text-right">Amount</th>
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
                                        className="hover:bg-white/[0.04] transition-colors group"
                                    >
                                        <td className="py-4 px-6 text-zinc-300 font-semibold">{formatDate(tx.date)}</td>
                                        <td className="py-4 px-6 text-emerald-400 font-mono text-right font-extrabold">
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="py-4 px-6 text-zinc-400 font-medium">{tx.remarks || '—'}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingTx(tx); setIsModalOpen(true); }}
                                                    className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(tx.id)}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!installments.length && (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-zinc-500 italic">
                                        No installments recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Interest Received Section */}
            <div className="card p-0 overflow-hidden shadow-2xl border border-white/10" style={glassCardStyle}>
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <TrendingUp size={18} className="text-amber-400" />
                        Interest Payouts Received
                    </h3>
                    <span className="text-xs font-bold text-amber-400/80 font-mono">Total: {formatCurrency(totalInterestReceived)}</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest text-right">Interest Amount</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Remarks</th>
                                <th className="py-4 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {interestTransactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((tx) => (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="hover:bg-white/[0.04] transition-colors group">
                                        <td className="py-4 px-6 text-zinc-300 font-semibold">{formatDate(tx.date)}</td>
                                        <td className="py-4 px-6 text-amber-400 font-mono text-right font-extrabold">
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="py-4 px-6 text-zinc-400 font-medium">{tx.remarks || 'Interest Payout'}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingInterestTx(tx); setIsInterestModalOpen(true); }}
                                                    className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteInterest(tx.id)}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!interestTransactions.length && (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-zinc-500 italic">
                                        No interest payouts recorded yet.
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
