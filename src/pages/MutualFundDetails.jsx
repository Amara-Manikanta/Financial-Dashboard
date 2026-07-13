import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Edit2, Trash2, Plus, Settings, RefreshCw, X, Archive, ArchiveRestore } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import MutualFundTransactionModal from '../components/MutualFundTransactionModal';
import MutualFundEditModal from '../components/MutualFundEditModal';

const MutualFundDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem, refreshMutualFundNAV, calculateItemCurrentValue, calculateItemInvestedValue, addItem, deleteItem } = useFinance();

    // State for modals
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const [isFundEditModalOpen, setIsFundEditModalOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState({ type: '', text: '' });

    const fund = savings.find(s => s.id.toString() === id);

    const currentNav = fund ? (fund.currentNav || 0) : 0;

    // --- Unit-based Accounting (Centralized Logic with useMemo) ---
    const fundCalcs = useMemo(() => {
        if (!fund) {
            return {
                currentTotalValue: 0,
                total_cost_held: 0,
                total_unrealised_profit: 0,
                transactionsWithCalcs: [],
                total_units_held: 0,
                avgNav: 0,
                total_realised_profit: 0,
                total_profit: 0
            };
        }

        const currentTotalValue = calculateItemCurrentValue(fund);
        const total_cost_held = calculateItemInvestedValue(fund);
        const total_unrealised_profit = currentTotalValue - total_cost_held;

        let runningUnits = 0;
        let runningCost = 0;
        let transactionsWithCalcs = [];

        if (fund.transactions) {
            const sortedTransactions = [...fund.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

            transactionsWithCalcs = sortedTransactions.map(tx => {
                const isSell = tx.type === 'sell' || tx.type === 'withdraw';
                const txAmount = Number(tx.amount);
                const txUnits = Number(tx.units);

                if (isSell) {
                    const average_cost_per_unit = runningUnits > 0 ? runningCost / runningUnits : 0;
                    const cost_of_units_sold = txUnits * average_cost_per_unit;
                    const realized_for_tx = txAmount - cost_of_units_sold;

                    runningUnits -= txUnits;
                    runningCost -= cost_of_units_sold;
                    // Guard against going negative due to out-of-order data
                    if (runningUnits < 0) runningUnits = 0;
                    if (runningCost < 0) runningCost = 0;

                    return {
                        ...tx,
                        isSell: true,
                        displayAmount: txAmount,
                        displayUnits: -txUnits,
                        displayValue: txAmount,
                        displayPL: realized_for_tx,
                    };
                } else {
                    runningUnits += txUnits;
                    runningCost += txAmount;
                    const currentVal = txUnits * currentNav;
                    return {
                        ...tx,
                        isSell: false,
                        displayAmount: txAmount,
                        displayUnits: txUnits,
                        displayValue: currentVal,
                        displayPL: currentVal - txAmount,
                    };
                }
            });
        }

        const total_units_held = runningUnits;
        const avgNav = total_units_held > 0 ? (runningCost / total_units_held) : 0;
        const total_realised_profit = transactionsWithCalcs.filter(tx => tx.isSell).reduce((sum, tx) => sum + tx.displayPL, 0);
        const total_profit = total_unrealised_profit + total_realised_profit;

        return {
            currentTotalValue,
            total_cost_held,
            total_unrealised_profit,
            transactionsWithCalcs,
            total_units_held,
            avgNav,
            total_realised_profit,
            total_profit
        };
    }, [fund, currentNav, calculateItemCurrentValue, calculateItemInvestedValue]);

    if (!fund) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Mutual Fund not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    const {
        currentTotalValue,
        total_cost_held,
        total_unrealised_profit,
        transactionsWithCalcs,
        total_units_held,
        avgNav,
        total_realised_profit,
        total_profit
    } = fundCalcs;

    const handleRefreshNav = async () => {
        setIsRefreshing(true);
        setRefreshMessage({ type: '', text: '' });
        const result = await refreshMutualFundNAV(id);
        setIsRefreshing(false);
        if (result.success) {
            setRefreshMessage({ type: 'success', text: `NAV updated to ${result.nav}!` });
            setTimeout(() => setRefreshMessage({ type: '', text: '' }), 3000);
        } else {
            setRefreshMessage({ type: 'error', text: result.message || 'Failed to refresh NAV' });
            setTimeout(() => setRefreshMessage({ type: '', text: '' }), 5000);
        }
    };

    // --- Transaction Handlers ---
    const handleSaveTransaction = (tx) => {
        let updatedTransactions = fund.transactions ? [...fund.transactions] : [];

        if (editingTx) {
            // Edit existing
            updatedTransactions = updatedTransactions.map(t => t.id === tx.id ? tx : t);
            updateItem('expense', {
                 id: tx.id,
                 title: `${tx.type === 'sell' ? 'Sell' : 'Buy'} ${fund.title || fund.name || 'Mutual Fund'}`,
                 amount: Number(tx.amount || (tx.units * (tx.nav || fund.currentNav || 0))),
                 category: 'mutual funds',
                 mainCategory: 'Investments',
                 date: tx.date,
                 paymentMode: 'direct',
                 isCredited: tx.type === 'sell' || tx.type === 'withdraw',
                 transactionType: tx.type === 'sell' || tx.type === 'withdraw' ? 'credit' : 'debit',
                 deductFromSalary: true,
                 skipInvestmentSync: true,
                 investmentData: { type: 'mutual_fund', assetId: fund.id, action: tx.type, nav: fund.currentNav, units: tx.units, remarks: tx.remarks }
            });
        } else {
            // Add new
            updatedTransactions.push(tx);
            addItem('expense', {
                 id: tx.id,
                 title: `${tx.type === 'sell' ? 'Sell' : 'Buy'} ${fund.title || fund.name || 'Mutual Fund'}`,
                 amount: Number(tx.amount || (tx.units * (tx.nav || fund.currentNav || 0))),
                 category: 'mutual funds',
                 mainCategory: 'Investments',
                 date: tx.date,
                 paymentMode: 'direct',
                 isCredited: tx.type === 'sell' || tx.type === 'withdraw',
                 transactionType: tx.type === 'sell' || tx.type === 'withdraw' ? 'credit' : 'debit',
                 deductFromSalary: true,
                 skipInvestmentSync: true,
                 investmentData: { type: 'mutual_fund', assetId: fund.id, action: tx.type, nav: fund.currentNav, units: tx.units, remarks: tx.remarks }
            });
        }

        updatedTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Recalculate Total Amount (Current Value)
        let totalUnits = 0;
        updatedTransactions.forEach(t => {
            const type = t.type || (t.remarks && t.remarks.toLowerCase().includes('sip') ? 'sip' : 'buy');
            if (type === 'buy' || type === 'sip') totalUnits += Number(t.units);
            if (type === 'sell' || type === 'withdraw') totalUnits -= Number(t.units);
        });
        // Prevent negative zero
        if (totalUnits < 0.0001) totalUnits = 0;

        const newAmount = totalUnits * (fund.currentNav || 0);

        updateItem('savings', { ...fund, transactions: updatedTransactions, amount: newAmount });
        setEditingTx(null);
        setIsTxModalOpen(false);
    };

    const handleDeleteTransaction = (txId) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedTransactions = fund.transactions.filter(t => t.id !== txId);
            const updatedFund = { ...fund, transactions: updatedTransactions };
            updatedFund.amount = calculateItemCurrentValue(updatedFund);
            updateItem('savings', updatedFund);
            deleteItem('expense', txId);
        }
    };

    const handleEditFundDetails = (updatedFund) => {
        const finalFund = { ...updatedFund };
        finalFund.amount = calculateItemCurrentValue(finalFund);
        updateItem('savings', finalFund);
        setIsFundEditModalOpen(false);
    };

    const handleToggleArchive = () => {
        const action = fund.isArchived ? 'unarchive' : 'archive';
        if (window.confirm(`Are you sure you want to ${action} this fund? Archived funds are hidden from your main dashboard but retain their data.`)) {
            updateItem('savings', { ...fund, isArchived: !fund.isArchived });
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
            {/* Custom Styles Injection */}
            <style>{`
                .mf-glass-panel {
                    background: rgba(10, 11, 20, 0.45) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(99, 102, 241, 0.15) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px 1px rgba(99, 102, 241, 0.05) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .mf-glass-panel:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(99, 102, 241, 0.35) !important;
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px 2px rgba(99, 102, 241, 0.15) !important;
                }
                .mf-glass-glow-card {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(99, 102, 241, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(99, 102, 241, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .mf-glass-glow-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(99, 102, 241, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(99, 102, 241, 0.25) !important;
                }
                .mf-table-container {
                    background: rgba(10, 11, 20, 0.35) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border-radius: 1.5rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4) !important;
                    overflow: hidden !important;
                    margin-top: 2rem !important;
                }
                .mf-table {
                    width: 100%;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                }
                .mf-table th {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: rgba(255, 255, 255, 0.5) !important;
                    font-weight: 700 !important;
                    font-size: 0.75rem !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                }
                .mf-table td {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
                    transition: all 0.2s ease !important;
                }
                .mf-table tr:last-child td {
                    border-bottom: none !important;
                }
                .mf-table tr:hover td {
                    background-color: rgba(99, 102, 241, 0.04) !important;
                    color: #ffffff !important;
                }
            `}</style>

            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6 text-xs font-black uppercase tracking-widest"
                style={{ cursor: 'pointer' }}
            >
                <ArrowLeft size={16} /> Back to Savings
            </button>

            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                                {fund.title}
                            </h2>
                            <button
                                onClick={() => setIsFundEditModalOpen(true)}
                                className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                title="Edit Fund Details (NAV, Name)"
                            >
                                <Settings size={18} />
                            </button>
                        </div>
                        <p className="text-gray-500 text-sm mt-1">Folio: {fund.folioNumber || 'N/A'}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleToggleArchive}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${fund.isArchived ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 hover:bg-white/10 text-gray-300'} border border-white/5`}
                            title={fund.isArchived ? "Unarchive this fund" : "Archive this fund"}
                        >
                            {fund.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                            <span>{fund.isArchived ? 'Unarchive' : 'Archive'}</span>
                        </button>

                        <button
                            onClick={handleRefreshNav}
                            disabled={isRefreshing}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${isRefreshing ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20'}`}
                        >
                            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                            <span>{isRefreshing ? 'Refreshing...' : 'Refresh NAV'}</span>
                        </button>

                        <button
                            onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-indigo-500/25"
                        >
                            <Plus size={18} />
                            Add Transaction
                        </button>
                    </div>
                </div>

                {refreshMessage.text && (
                    <div style={{
                        position: 'fixed',
                        top: '80px',
                        right: '2rem',
                        padding: '1rem 1.5rem',
                        borderRadius: '12px',
                        backgroundColor: refreshMessage.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        zIndex: 100,
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        {refreshMessage.type === 'success' ? <TrendingUp size={20} /> : <X size={20} onClick={() => setRefreshMessage({ type: '', text: '' })} style={{ cursor: 'pointer' }} />}
                        <span className="font-medium">{refreshMessage.text}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Invested (Net)</p>
                        <p className="font-bold text-2xl tracking-tight">{formatCurrency(total_cost_held)}</p>
                        <p className="text-xs text-gray-600 mt-1">Active Capital</p>
                    </div>
                    <div className="mf-glass-glow-card">
                        <p className="text-indigo-300 text-xs font-black uppercase tracking-widest mb-1">Current Value</p>
                        <p className="font-bold text-2xl tracking-tight text-white">{formatCurrency(currentTotalValue)}</p>
                        <p className="text-xs text-indigo-400/70 mt-1">Valued at Current NAV</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Profit (All Time)</p>
                        <div className={`font-bold text-2xl tracking-tight flex items-center gap-2 ${total_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_profit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                            {formatCurrency(Math.abs(total_profit))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Realized + Unrealized</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Unrealized P/L</p>
                        <div className={`font-bold text-2xl tracking-tight flex items-center gap-2 ${total_unrealised_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_unrealised_profit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                            {formatCurrency(Math.abs(total_unrealised_profit))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Paper Profits</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Realized P/L (Booked)</p>
                        <div className={`font-bold text-2xl tracking-tight flex items-center gap-2 ${total_realised_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_realised_profit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                            {formatCurrency(Math.abs(total_realised_profit))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Booked Profit/Loss</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Units Held</p>
                        <p className="font-mono font-bold text-2xl tracking-tight">{total_units_held.toFixed(3)}</p>
                        <p className="text-xs text-gray-600 mt-1">Accumulated units</p>
                    </div>
                    <div className="mf-glass-panel cursor-pointer" onClick={() => setIsFundEditModalOpen(true)}>
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Average Cost (NAV)</p>
                        <p className="font-mono font-bold text-2xl tracking-tight">{avgNav.toFixed(4)}</p>
                        <p className="text-xs text-gray-600 mt-1">Weighted Average</p>
                    </div>
                    <div className="mf-glass-panel cursor-pointer" onClick={() => setIsFundEditModalOpen(true)}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Current NAV</p>
                                <p className="font-mono font-bold text-2xl tracking-tight">{currentNav.toFixed(4)}</p>
                            </div>
                            <Edit2 size={16} className="text-indigo-400" />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Click to edit manually</p>
                    </div>
                </div>
            </div>

            <div className="mf-table-container">
                <div style={{ overflowX: 'auto' }}>
                    <table className="mf-table">
                        <thead>
                            <tr>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Type</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Amount</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>NAV</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Units</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Value</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>P/L</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '2rem' }}>Remarks</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactionsWithCalcs.map((tx, index) => {
                                const isProfit = tx.displayPL >= 0;

                                return (
                                    <tr key={index} className="group">
                                        <td style={{ padding: '1.25rem 1rem', color: 'var(--text-primary)' }}>{formatDate(tx.date)}</td>
                                        <td style={{ padding: '1.25rem 1rem' }}>
                                            <span style={{
                                                color: tx.isSell ? 'var(--color-danger)' : 'var(--color-success)',
                                                backgroundColor: tx.isSell ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: '900',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                {tx.type === 'sip' ? 'SIP' : (tx.isSell ? 'Sell' : 'Buy')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(tx.displayAmount)}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#a1a1aa' }}>{tx.nav}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500', color: tx.isSell ? 'var(--color-danger)' : '#ffffff' }}>{tx.displayUnits.toFixed(3)}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(tx.displayValue)}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: isProfit ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: '500' }}>
                                            {tx.isSell ? (
                                                <span className="text-gray-500">-</span>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                    {formatCurrency(Math.abs(tx.displayPL))}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem', paddingLeft: '2rem', color: 'var(--text-secondary)' }}>{tx.remarks || '-'}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
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
                                );
                            })}
                            {!transactionsWithCalcs.length && (
                                <tr>
                                    <td colSpan="9" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No transactions found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <MutualFundTransactionModal
                isOpen={isTxModalOpen}
                onClose={() => { setIsTxModalOpen(false); setEditingTx(null); }}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />

            <MutualFundEditModal
                isOpen={isFundEditModalOpen}
                onClose={() => setIsFundEditModalOpen(false)}
                onSave={handleEditFundDetails}
                fund={fund}
            />
        </div>
    );
};

export default MutualFundDetails;
