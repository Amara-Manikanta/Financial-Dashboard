import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, PieChart, Plus, Edit2, Trash2, Settings, History } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import NPSModal from '../components/NPSModal';
import NPSTransactionModal from '../components/NPSTransactionModal';

const NPSDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingHolding, setEditingHolding] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingTx, setEditingTx] = useState(null);

    const nps = savings.find(s => s.id === id);

    if (!nps) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>NPS account not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    const handleSaveHolding = (holdingData) => {
        let updatedHoldings = [...(nps.holdings || [])];
        if (editingIndex !== null) {
            updatedHoldings[editingIndex] = holdingData;
        } else {
            updatedHoldings.push(holdingData);
        }

        // Recalculate totals and percentages based on Current Value (NAV * units)
        const totalCurrent = updatedHoldings.reduce((sum, h) => sum + (h.totalunits * h.nav), 0);
        const totalInvested = nps.investedAmount || 0; // Invested amount comes from transactions now
        const totalProfitLoss = totalCurrent - totalInvested;

        const holdingsWithPercentage = updatedHoldings.map(h => ({
            ...h,
            percentage: totalCurrent > 0 ? parseFloat(((h.totalunits * h.nav) / totalCurrent * 100).toFixed(2)) : 0
        }));

        updateItem('savings', {
            ...nps,
            holdings: holdingsWithPercentage,
            profitLoss: totalProfitLoss,
            amount: totalCurrent
        });

        setIsModalOpen(false);
        setEditingHolding(null);
        setEditingIndex(null);
    };

    const handleDeleteHolding = (index) => {
        if (window.confirm('Delete this scheme holding?')) {
            const updatedHoldings = nps.holdings.filter((_, i) => i !== index);
            const totalCurrent = updatedHoldings.reduce((sum, h) => sum + (h.totalunits * h.nav), 0);
            const totalInvested = nps.investedAmount || 0;
            const totalProfitLoss = totalCurrent - totalInvested;

            const holdingsWithPercentage = updatedHoldings.map(h => ({
                ...h,
                percentage: totalCurrent > 0 ? parseFloat(((h.totalunits * h.nav) / totalCurrent * 100).toFixed(2)) : 0
            }));

            updateItem('savings', {
                ...nps,
                holdings: holdingsWithPercentage,
                profitLoss: totalProfitLoss,
                amount: totalCurrent
            });
        }
    };

    const handleSaveTransaction = (txData) => {
        let updatedTransactions = [...(nps.transactions || [])];
        if (editingTx) {
            updatedTransactions = updatedTransactions.map(t => t.id === txData.id ? txData : t);
        } else {
            updatedTransactions.push(txData);
        }

        const totalInvested = updatedTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalCurrent = nps.holdings.reduce((sum, h) => sum + (h.totalunits * h.nav), 0);
        const totalProfitLoss = totalCurrent - totalInvested;

        updateItem('savings', {
            ...nps,
            transactions: updatedTransactions,
            investedAmount: totalInvested,
            profitLoss: totalProfitLoss
        });

        setIsTxModalOpen(false);
        setEditingTx(null);
    };

    const handleDeleteTransaction = (txId) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedTransactions = (nps.transactions || []).filter(t => t.id !== txId);
            const totalInvested = updatedTransactions.reduce((sum, t) => sum + t.amount, 0);
            const totalCurrent = nps.holdings.reduce((sum, h) => sum + (h.totalunits * h.nav), 0);
            const totalProfitLoss = totalCurrent - totalInvested;

            updateItem('savings', {
                ...nps,
                transactions: updatedTransactions,
                investedAmount: totalInvested,
                profitLoss: totalProfitLoss
            });
        }
    };

    const sortedTransactions = useMemo(() => {
        return [...(nps.transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [nps.transactions]);

    const { calculateItemCurrentValue, calculateItemInvestedValue } = useFinance();
    const totalCurrent = calculateItemCurrentValue(nps);
    const totalInvested = calculateItemInvestedValue(nps);
    const totalProfitLoss = totalCurrent - totalInvested;
    const xirr = nps.xirr || 0;
    const isProfit = totalProfitLoss >= 0;

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-8 text-sm font-bold uppercase tracking-widest text-gray-500"
                style={{ cursor: 'pointer' }}
            >
                <ArrowLeft size={16} /> Back to Savings
            </button>

            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-4xl font-black mb-2 flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <PieChart className="text-blue-400" size={32} />
                        </div>
                        {nps.name}
                    </h2>
                    <p className="text-secondary font-medium uppercase tracking-widest text-[10px] text-gray-400">PRAN: {nps.pran}</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 transition-all shadow-2xl shadow-emerald-900/40 text-xs uppercase tracking-widest active:scale-95"
                    >
                        <Plus size={20} />
                        Add Contribution
                    </button>
                    <button
                        onClick={() => { setEditingHolding(null); setEditingIndex(null); setIsModalOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 transition-all shadow-2xl shadow-blue-900/40 text-xs uppercase tracking-widest active:scale-95"
                    >
                        <Settings size={20} />
                        Add Scheme
                    </button>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <div className="card bg-white/[0.02] border-white/5 p-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Invested Amount</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="card bg-gradient-to-br from-blue-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Current Value</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totalCurrent)}</p>
                </div>
                <div className="card bg-white/[0.02] border-white/5 p-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Returns</p>
                    <div className={`text-3xl font-black flex items-center gap-3 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                        {formatCurrency(Math.abs(totalProfitLoss))}
                    </div>
                </div>
                <div className="card bg-white/[0.02] border-white/5 p-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">XIRR</p>
                    <p className="text-3xl font-black text-emerald-400">{xirr}%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* Scheme Holdings Table */}
                <div className="lg:col-span-2 card border-white/5 p-0 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center gap-3">
                        <PieChart className="text-blue-400" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Scheme Holdings</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/[0.02]">
                                    <th className="py-5 px-8">Scheme</th>
                                    <th className="py-5 px-6 text-right">NAV</th>
                                    <th className="py-5 px-6 text-right">Units</th>
                                    <th className="py-5 px-6 text-right font-black text-white">Value</th>
                                    <th className="py-5 px-8 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm font-bold">
                                {nps.holdings.map((item, index) => (
                                    <tr key={index} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-6 px-8 text-gray-300">
                                            {item.scheme}
                                            <div className="text-[9px] text-gray-500 mt-1 uppercase">{item.percentage}% Allocation</div>
                                        </td>
                                        <td className="py-6 px-6 text-right font-mono text-gray-400">{formatCurrency(item.nav)}</td>
                                        <td className="py-6 px-6 text-right font-mono text-gray-400">{item.totalunits.toFixed(3)}</td>
                                        <td className="py-6 px-6 text-right font-black text-white">{formatCurrency(item.totalunits * item.nav)}</td>
                                        <td className="py-6 px-8 text-center">
                                            <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => { setEditingHolding(item); setEditingIndex(index); setIsModalOpen(true); }}
                                                    className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteHolding(index)}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* NPS Transactions Block */}
                <div className="card border-white/5 p-0 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center gap-3">
                        <History className="text-emerald-400" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Contribution History</h3>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-gray-500 text-[9px] font-black uppercase tracking-widest bg-white/[0.02]">
                                    <th className="py-4 px-6">Date</th>
                                    <th className="py-4 px-4 text-right">Amount</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs font-bold">
                                {sortedTransactions.map((tx, idx) => (
                                    <tr key={tx.id || idx} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-5 px-6 text-gray-400">
                                            {formatDate(tx.date)}
                                            {tx.remarks && <div className="text-[8px] text-gray-600 mt-1 italic">{tx.remarks}</div>}
                                        </td>
                                        <td className="py-5 px-4 text-right font-black text-gray-200">{formatCurrency(tx.amount)}</td>
                                        <td className="py-5 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(tx.id)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sortedTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="py-12 text-center text-gray-500 font-medium">No contributions recorded yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <NPSModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveHolding}
                initialData={editingHolding}
            />

            <NPSTransactionModal
                isOpen={isTxModalOpen}
                onClose={() => setIsTxModalOpen(false)}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />
        </div>
    );
};

export default NPSDetails;
