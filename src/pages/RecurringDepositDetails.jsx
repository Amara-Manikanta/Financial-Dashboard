import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, RefreshCcw, Plus, Edit2, Trash2, TrendingUp, PiggyBank, Sparkles, Calendar, DollarSign } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import RecurringDepositModal from '../components/RecurringDepositModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts';

const RecurringDepositDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRD, setEditingRD] = useState(null);

    const account = savings.find(s => s.id.toString() === id);

    if (!account) {
        return (
            <div className="p-8 text-white">
                <p>Recurring Deposit account not found.</p>
                <button onClick={() => navigate(-1)} className="text-blue-400 hover:underline mt-4">
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

    const totalInstallment = useMemo(() => {
        return account.recurringDeposits?.reduce((sum, d) => sum + (Number(d.installmentAmount) || 0), 0) || 0;
    }, [account]);

    const totalMaturity = useMemo(() => {
        return account.recurringDeposits?.reduce((sum, d) => sum + (Number(d.maturityAmount) || 0), 0) || 0;
    }, [account]);

    const totalCurrentValue = useMemo(() => {
        return account.recurringDeposits?.reduce((sum, rd) => {
            const rdTotalPaid = (rd.installments || []).reduce((acc, tx) => acc + (tx.amount || 0), 0);
            return sum + rdTotalPaid;
        }, 0) || 0;
    }, [account]);

    const overallProgress = useMemo(() => {
        return totalMaturity > 0 ? (totalCurrentValue / totalMaturity) * 100 : 0;
    }, [totalCurrentValue, totalMaturity]);

    const rdChartData = useMemo(() => {
        if (!account?.recurringDeposits) return [];
        return account.recurringDeposits.map(rd => {
            const currentPaid = (rd.installments || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
            return {
                name: rd.name,
                paid: currentPaid,
                maturity: rd.maturityAmount || 0,
                rate: rd.interestRate || 0
            };
        });
    }, [account]);

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
            {/* Top Navigation */}
            <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all duration-300 mb-8 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] backdrop-blur-md shadow-lg"
            >
                <ArrowLeft size={14} /> Back to Savings
            </button>

            {/* Header Section */}
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-blue-900/20 via-indigo-900/10 to-transparent p-6 rounded-2xl border border-blue-500/10 backdrop-blur-xl">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl text-white shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                        <RefreshCcw size={32} className="animate-spin-slow" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-3xl font-black text-white tracking-tight">{account.title}</h2>
                            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                                {account.recurringDeposits?.length || 0} Deposits
                            </span>
                        </div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-widest text-[11px]">Systematic Monthly Savings & Interest Accumulation</p>
                    </div>
                </div>

                <button
                    onClick={() => { setEditingRD(null); setIsModalOpen(true); }}
                    className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] text-xs uppercase tracking-widest active:scale-95 border border-blue-400/30"
                >
                    <Plus size={16} />
                    Add Deposit
                </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="card p-6 relative overflow-hidden" style={glassCardStyle}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Monthly Commitment</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <RefreshCcw size={16} />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight mb-1">{formatCurrency(totalInstallment)}<span className="text-xs font-bold text-zinc-400 ml-1">/mo</span></p>
                    <p className="text-[11px] font-bold text-blue-400/80">Combined Monthly Outflow</p>
                </div>

                <div className="card p-6 relative overflow-hidden" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(99, 102, 241, 0.02))',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Current Paid Value</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <PiggyBank size={16} />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight mb-1">{formatCurrency(totalCurrentValue)}</p>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(overallProgress, 100)}%` }} />
                    </div>
                </div>

                <div className="card p-6 relative overflow-hidden" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Maturity Goal</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-emerald-400 tracking-tight mb-1">{formatCurrency(totalMaturity)}</p>
                    <p className="text-[11px] font-bold text-emerald-400/80">{overallProgress.toFixed(1)}% Achieved</p>
                </div>
            </div>

            {/* Recharts Bar Chart: Paid vs Maturity per Deposit */}
            {rdChartData.length > 0 && (
                <div className="mb-10 bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-2xl shadow-2xl">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={22} className="text-blue-400" />
                            <h3 className="text-xl font-bold text-white tracking-tight">Current Paid vs Target Maturity</h3>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rdChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#e4e4e7' }} />
                                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} tick={{ fill: '#a1a1aa' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                                    formatter={(value, name) => [formatCurrency(value), name === 'paid' ? 'Current Paid' : 'Maturity Target']}
                                    labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                                <Bar dataKey="paid" fill="#34d399" radius={[6, 6, 0, 0]} barSize={28} name="Current Paid" />
                                <Bar dataKey="maturity" fill="#60a5fa" radius={[6, 6, 0, 0]} barSize={28} name="Target Maturity" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* RD Table Section */}
            <div className="card p-0 overflow-hidden shadow-2xl border border-white/10" style={glassCardStyle}>
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <Sparkles size={18} className="text-blue-400" />
                        Active Recurring Deposits
                    </h3>
                    <span className="text-xs font-bold text-zinc-400">Click any row to manage installments</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" style={{ minWidth: '950px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Name / Goal</th>
                                <th className="py-4 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Monthly Installment</th>
                                <th className="py-4 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Interest Rate</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Tenure Period</th>
                                <th className="py-4 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Total Paid</th>
                                <th className="py-4 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Maturity Target</th>
                                <th className="py-4 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Progress</th>
                                <th className="py-4 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {[...(account.recurringDeposits || [])]
                                .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
                                .map((rd) => {
                                    const currentPaid = (rd.installments || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
                                    const itemProgress = rd.maturityAmount > 0 ? (currentPaid / rd.maturityAmount) * 100 : 0;
                                    return (
                                        <tr
                                            key={rd.id}
                                            onClick={() => navigate(`/savings/recurring-deposit/${id}/rd/${rd.id}`)}
                                            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}
                                            className="hover:bg-white/[0.04] transition-colors group"
                                        >
                                            <td className="py-5 px-6 text-white font-extrabold flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                                {rd.name}
                                            </td>
                                            <td className="py-5 px-6 text-right font-mono text-zinc-200">{formatCurrency(rd.installmentAmount)}</td>
                                            <td className="py-5 px-6 text-center">
                                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                                                    {rd.interestRate}% p.a.
                                                </span>
                                            </td>
                                            <td className="py-5 px-6 text-zinc-400 text-xs">
                                                {formatDate(rd.startDate)} ➔ {rd.endDate ? formatDate(rd.endDate) : 'Ongoing'}
                                            </td>
                                            <td className="py-5 px-6 text-right font-mono text-emerald-400">{formatCurrency(currentPaid)}</td>
                                            <td className="py-5 px-6 text-right font-mono text-blue-400">{formatCurrency(rd.maturityAmount)}</td>
                                            <td className="py-5 px-6 text-center">
                                                <div className="w-20 bg-white/10 h-2 rounded-full mx-auto overflow-hidden">
                                                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(itemProgress, 100)}%` }} />
                                                </div>
                                                <span className="text-[10px] font-black text-zinc-400 mt-1 block">{itemProgress.toFixed(0)}%</span>
                                            </td>
                                            <td className="py-5 px-6 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { setEditingRD(rd); setIsModalOpen(true); }}
                                                        className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110 border border-blue-500/20"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRD(rd.id)}
                                                        className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110 border border-red-500/20"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            {!account.recurringDeposits?.length && (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-zinc-500 italic">
                                        No recurring deposits found. Click "+ Add Deposit" above to create one.
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
