import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, PieChart, Plus, Edit2, Trash2, Settings, History } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import NPSModal from '../components/NPSModal';
import NPSTransactionModal from '../components/NPSTransactionModal';
import BackButton from '../components/BackButton';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const getSchemeCalculations = (h) => {
    if (!h.transactions || h.transactions.length === 0) {
        return {
            units: Number(h.totalunits || 0),
            amount: Number(h.amount || 0),
            current: Number(h.totalunits || 0) * Number(h.nav || 0)
        };
    }
    let units = 0;
    let invested = 0;
    h.transactions.forEach(tx => {
        units += Number(tx.units || 0);
        if (tx.type !== 'billing' && tx.amount > 0) {
            invested += Number(tx.amount || 0);
        }
    });
    return {
        units,
        amount: invested,
        current: units * Number(h.nav || 0)
    };
};

const NPSDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem, calculateItemCurrentValue, calculateItemInvestedValue } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingHolding, setEditingHolding] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingTx, setEditingTx] = useState(null);
    const [selectedSchemeFilter, setSelectedSchemeFilter] = useState('all');

    // Reset filter when navigating to a different NPS account
    useEffect(() => { 
        setSelectedSchemeFilter('all'); 
    }, [id]);

    const nps = savings.find(s => s.id === id);

    const allTransactions = useMemo(() => {
        if (!nps?.holdings) return [];
        let txs = [];
        nps.holdings.forEach(h => {
            (h.transactions || []).forEach(tx => {
                // Attach schemeId so the tab filter works correctly
                txs.push({ ...tx, schemeName: h.scheme, schemeId: h.id });
            });
        });
        return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [nps?.holdings]);

    const displayedTransactions = useMemo(() => {
        if (selectedSchemeFilter === 'all') return allTransactions;
        return allTransactions.filter(tx => tx.schemeId === selectedSchemeFilter);
    }, [allTransactions, selectedSchemeFilter]);

    const pieData = useMemo(() => {
        if (!nps?.holdings) return [];
        return nps.holdings.map(h => ({
            name: h.scheme.split('-')[0].trim(),
            value: getSchemeCalculations(h).current
        })).filter(d => d.value > 0);
    }, [nps?.holdings]);

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
            updatedHoldings[editingIndex] = { ...updatedHoldings[editingIndex], ...holdingData };
        } else {
            holdingData.transactions = [];
            updatedHoldings.push(holdingData);
        }

        let totalCurrent = 0;
        updatedHoldings.forEach(h => {
            totalCurrent += getSchemeCalculations(h).current;
        });

        const holdingsWithPercentage = updatedHoldings.map(h => {
            const hCurrent = getSchemeCalculations(h).current;
            return {
                ...h,
                percentage: totalCurrent > 0 ? parseFloat((hCurrent / totalCurrent * 100).toFixed(2)) : 0
            };
        });

        updateItem('savings', {
            ...nps,
            holdings: holdingsWithPercentage,
        });

        setIsModalOpen(false);
        setEditingHolding(null);
        setEditingIndex(null);
    };

    const handleDeleteHolding = (index) => {
        if (window.confirm('Delete this scheme and all its transactions?')) {
            const updatedHoldings = nps.holdings.filter((_, i) => i !== index);
            
            let totalCurrent = 0;
            updatedHoldings.forEach(h => {
                totalCurrent += getSchemeCalculations(h).current;
            });

            const holdingsWithPercentage = updatedHoldings.map(h => {
                const hCurrent = getSchemeCalculations(h).current;
                return {
                    ...h,
                    percentage: totalCurrent > 0 ? parseFloat((hCurrent / totalCurrent * 100).toFixed(2)) : 0
                };
            });

            updateItem('savings', {
                ...nps,
                holdings: holdingsWithPercentage,
            });
        }
    };

    const handleSaveTransaction = (txData) => {
        let updatedHoldings = (nps.holdings || []).map(h => ({ ...h }));
        
        // If editing, first remove from the old scheme if scheme changed
        if (editingTx && editingTx.schemeId !== txData.schemeId) {
            const oldHoldingIndex = updatedHoldings.findIndex(h => h.id === editingTx.schemeId);
            if (oldHoldingIndex !== -1) {
                updatedHoldings[oldHoldingIndex] = {
                    ...updatedHoldings[oldHoldingIndex],
                    transactions: (updatedHoldings[oldHoldingIndex].transactions || []).filter(t => t.id !== txData.id)
                };
            }
        }

        const holdingIndex = updatedHoldings.findIndex(h => h.id === txData.schemeId);
        if (holdingIndex !== -1) {
            let txs = [...(updatedHoldings[holdingIndex].transactions || [])];
            if (editingTx && editingTx.schemeId === txData.schemeId) {
                txs = txs.map(t => t.id === txData.id ? txData : t);
            } else {
                txs.push(txData);
            }
            updatedHoldings[holdingIndex] = { ...updatedHoldings[holdingIndex], transactions: txs };
        }

        // Recalculate percentages
        let totalCurrent = 0;
        updatedHoldings.forEach(h => {
            totalCurrent += getSchemeCalculations(h).current;
        });

        const holdingsWithPercentage = updatedHoldings.map(h => {
            const hCurrent = getSchemeCalculations(h).current;
            return {
                ...h,
                percentage: totalCurrent > 0 ? parseFloat((hCurrent / totalCurrent * 100).toFixed(2)) : 0
            };
        });

        updateItem('savings', {
            ...nps,
            holdings: holdingsWithPercentage,
        });

        setIsTxModalOpen(false);
        setEditingTx(null);
    };

    const handleDeleteTransaction = (tx) => {
        if (window.confirm('Delete this transaction?')) {
            let updatedHoldings = (nps.holdings || []).map(h => ({ ...h }));
            const holdingIndex = updatedHoldings.findIndex(h => h.id === tx.schemeId);
            if (holdingIndex !== -1) {
                updatedHoldings[holdingIndex] = {
                    ...updatedHoldings[holdingIndex],
                    transactions: (updatedHoldings[holdingIndex].transactions || []).filter(t => t.id !== tx.id)
                };
            }

            let totalCurrent = 0;
            updatedHoldings.forEach(h => {
                totalCurrent += getSchemeCalculations(h).current;
            });

            const holdingsWithPercentage = updatedHoldings.map(h => {
                const hCurrent = getSchemeCalculations(h).current;
                return {
                    ...h,
                    percentage: totalCurrent > 0 ? parseFloat((hCurrent / totalCurrent * 100).toFixed(2)) : 0
                };
            });

            updateItem('savings', {
                ...nps,
                holdings: holdingsWithPercentage,
            });
        }
    };

    const totalCurrent = calculateItemCurrentValue(nps);
    const totalInvested = calculateItemInvestedValue(nps);
    const totalProfitLoss = totalCurrent - totalInvested;
    const xirr = nps.xirr || 0;
    const isProfit = totalProfitLoss >= 0;

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

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

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '1rem', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PieChart style={{ color: '#60a5fa' }} size={24} />
                        </div>
                        {nps.name}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.5rem 0 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PRAN: {nps.pran}</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                        className="flex-1 md:flex-initial bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] text-xs uppercase tracking-widest active:scale-95"
                    >
                        <Plus size={16} />
                        Add Statement
                    </button>
                    <button
                        onClick={() => { setEditingHolding(null); setEditingIndex(null); setIsModalOpen(true); }}
                        className="flex-1 md:flex-initial bg-gradient-to-r from-blue-500 to-indigo-600 hover:brightness-110 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-xs uppercase tracking-widest active:scale-95"
                    >
                        <Settings size={16} />
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
                <div className="card p-6" style={glassCardStyle}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Total Invested Amount</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
                    border: '1px solid rgba(59, 130, 246, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Current Value</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totalCurrent)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: isProfit 
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))',
                    border: isProfit 
                        ? '1px solid rgba(16, 185, 129, 0.15)'
                        : '1px solid rgba(239, 68, 68, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Total Returns</p>
                    <div className={`text-3xl font-black flex items-center gap-3 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                        {formatCurrency(Math.abs(totalProfitLoss))}
                    </div>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">XIRR</p>
                    <p className="text-3xl font-black text-emerald-400">{xirr}%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* Scheme Holdings Table */}
                <div className="lg:col-span-2 card p-0 overflow-hidden shadow-2xl" style={glassCardStyle}>
                    <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <PieChart className="text-blue-400" size={20} />
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Scheme Holdings</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                    <th className="py-5 px-8 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Scheme</th>
                                    <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Invested</th>
                                    <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">NAV</th>
                                    <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Units</th>
                                    <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Current</th>
                                    <th className="py-5 px-8 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-bold">
                                {(nps.holdings || []).map((item, index) => {
                                    const calcs = getSchemeCalculations(item);
                                    return (
                                        <tr 
                                            key={index} 
                                            className="hover:bg-white/[0.03] transition-colors group cursor-pointer" 
                                            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                                            onClick={() => setSelectedSchemeFilter(item.id)}
                                        >
                                            <td className="py-5 px-8 text-zinc-200">
                                                {item.scheme}
                                                <div className="text-[9px] text-zinc-500 mt-1 uppercase font-semibold">{item.percentage}% Allocation</div>
                                            </td>
                                            <td className="py-5 px-6 text-right font-mono text-zinc-400">{formatCurrency(calcs.amount)}</td>
                                            <td className="py-5 px-6 text-right font-mono text-zinc-400">{formatCurrency(item.nav)}</td>
                                            <td className="py-5 px-6 text-right font-mono text-zinc-400">{calcs.units.toFixed(3)}</td>
                                            <td className="py-5 px-6 text-right font-mono text-emerald-400">{formatCurrency(calcs.current)}</td>
                                            <td className="py-5 px-8 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={() => { setEditingHolding(item); setEditingIndex(index); setIsModalOpen(true); }}
                                                        className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteHolding(index)}
                                                        className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pie Chart */}
                <div className="card p-6 flex flex-col items-center shadow-2xl justify-center" style={glassCardStyle}>
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 w-full text-center">Current Allocation</h3>
                    <div className="flex justify-center items-center w-full overflow-visible">
                        <RePieChart width={280} height={250}>
                            <Pie 
                                data={pieData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={60} 
                                outerRadius={80} 
                                stroke="none"
                                paddingAngle={5}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                formatter={(value) => formatCurrency(value)} 
                                contentStyle={{ backgroundColor: '#11111d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff' }} 
                                itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', color: '#a1a1aa' }} />
                        </RePieChart>
                    </div>
                </div>
            </div>

            {/* NPS Transactions Block */}
            <div className="card p-0 overflow-hidden shadow-2xl flex flex-col" style={glassCardStyle}>
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div className="flex items-center gap-3">
                        <History className="text-emerald-400" size={20} />
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Statements</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            style={{
                                padding: '0.375rem 0.75rem',
                                borderRadius: '0.5rem',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                border: selectedSchemeFilter === 'all' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                                backgroundColor: selectedSchemeFilter === 'all' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                color: selectedSchemeFilter === 'all' ? '#34d399' : '#a1a1aa',
                                transition: 'all 0.3s ease'
                            }}
                            onClick={() => setSelectedSchemeFilter('all')}
                        >
                            All Schemes
                        </button>
                        {nps.holdings.map(h => (
                            <button
                                key={h.id}
                                style={{
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    border: selectedSchemeFilter === h.id ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
                                    backgroundColor: selectedSchemeFilter === h.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    color: selectedSchemeFilter === h.id ? '#60a5fa' : '#a1a1aa',
                                    transition: 'all 0.3s ease'
                                }}
                                onClick={() => setSelectedSchemeFilter(h.id)}
                            >
                                {h.scheme.split('-')[0].trim()}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Description</th>
                                <th className="py-4 px-4 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Amount</th>
                                <th className="py-4 px-4 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">NAV</th>
                                <th className="py-4 px-4 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Units</th>
                                <th className="py-4 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-bold">
                            {displayedTransactions.map((tx, idx) => (
                                <tr 
                                    key={tx.id || idx} 
                                    className="hover:bg-white/[0.03] transition-colors group"
                                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                                >
                                    <td className="py-4 px-6 text-zinc-400 whitespace-nowrap">
                                        {formatDate(tx.date)}
                                        {selectedSchemeFilter === 'all' && <div className="text-[8px] text-blue-400 mt-1 truncate max-w-[120px] font-semibold">{tx.schemeName}</div>}
                                    </td>
                                    <td className="py-4 px-6 text-zinc-300">
                                        {tx.description}
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <span className={tx.type === 'billing' ? "text-red-400 font-black" : "text-emerald-400 font-black"}>
                                            {formatCurrency(tx.amount)}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right font-mono text-zinc-400">
                                        {tx.nav}
                                    </td>
                                    <td className="py-4 px-4 text-right font-mono text-zinc-400">
                                        {tx.units?.toFixed(4)}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                title="Edit"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTransaction(tx)}
                                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {displayedTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-zinc-500 font-medium italic">No statements recorded yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
                holdings={nps.holdings}
            />
        </div>
    );
};

export default NPSDetails;
