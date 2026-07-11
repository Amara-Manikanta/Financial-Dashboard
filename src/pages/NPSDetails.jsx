import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, PieChart, Plus, Edit2, Trash2, Settings, History, ChevronDown } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import NPSModal from '../components/NPSModal';
import NPSTransactionModal from '../components/NPSTransactionModal';
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
    useEffect(() => { setSelectedSchemeFilter('all'); }, [id]);

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
                        Add Statement
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
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Invested Amount</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="card bg-gradient-to-br from-blue-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Current Value</p>
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
                                    <th className="py-5 px-6 text-right">Invested</th>
                                    <th className="py-5 px-6 text-right">NAV</th>
                                    <th className="py-5 px-6 text-right">Units</th>
                                    <th className="py-5 px-6 text-right">Current</th>
                                    <th className="py-5 px-8 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm font-bold">
                                {(nps.holdings || []).map((item, index) => {
                                    const calcs = getSchemeCalculations(item);
                                    return (
                                        <tr key={index} className="hover:bg-white/[0.03] transition-colors group cursor-pointer" onClick={() => setSelectedSchemeFilter(item.id)}>
                                            <td className="py-6 px-8 text-gray-300">
                                                {item.scheme}
                                                <div className="text-[9px] text-gray-500 mt-1 uppercase">{item.percentage}% Allocation</div>
                                            </td>
                                            <td className="py-6 px-6 text-right font-mono text-gray-400">{formatCurrency(calcs.amount)}</td>
                                            <td className="py-6 px-6 text-right font-mono text-gray-400">{formatCurrency(item.nav)}</td>
                                            <td className="py-6 px-6 text-right font-mono text-gray-400">{calcs.units.toFixed(3)}</td>
                                            <td className="py-6 px-6 text-right font-mono text-emerald-400">{formatCurrency(calcs.current)}</td>
                                            <td className="py-6 px-8 text-center" onClick={e => e.stopPropagation()}>
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pie Chart */}
                <div className="card border-white/5 p-6 flex flex-col items-center shadow-2xl justify-center bg-white/[0.02]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 w-full text-center">Current Allocation</h3>
                    <div className="flex justify-center items-center w-full overflow-visible">
                        <RePieChart width={300} height={250}>
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
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff' }} 
                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        </RePieChart>
                    </div>
                </div>
            </div>

                {/* NPS Transactions Block */}
                <div className="card border-white/5 p-0 overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-white/5 bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <History className="text-emerald-400" size={20} />
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Statements</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedSchemeFilter === 'all' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}
                                onClick={() => setSelectedSchemeFilter('all')}
                            >
                                All Schemes
                            </button>
                            {nps.holdings.map(h => (
                                <button
                                    key={h.id}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedSchemeFilter === h.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}
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
                                <tr className="text-gray-500 text-[9px] font-black uppercase tracking-widest bg-white/[0.02]">
                                    <th className="py-4 px-6">Date</th>
                                    <th className="py-4 px-6">Description</th>
                                    <th className="py-4 px-4 text-right">Amount</th>
                                    <th className="py-4 px-4 text-right">NAV</th>
                                    <th className="py-4 px-4 text-right">Units</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs font-bold">
                                {displayedTransactions.map((tx, idx) => (
                                    <tr key={tx.id || idx} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-4 px-6 text-gray-400 whitespace-nowrap">
                                            {formatDate(tx.date)}
                                            {selectedSchemeFilter === 'all' && <div className="text-[8px] text-blue-400 mt-1 truncate max-w-[120px]">{tx.schemeName}</div>}
                                        </td>
                                        <td className="py-4 px-6 text-gray-300">
                                            {tx.description}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <span className={tx.type === 'billing' ? "text-red-400 font-black" : "text-emerald-400 font-black"}>
                                                {formatCurrency(tx.amount)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right font-mono text-gray-400">
                                            {tx.nav}
                                        </td>
                                        <td className="py-4 px-4 text-right font-mono text-gray-400">
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
                                        <td colSpan="6" className="py-12 text-center text-gray-500 font-medium">No statements recorded yet.</td>
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
