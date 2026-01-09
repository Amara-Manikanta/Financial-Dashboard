import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Edit2, Trash2, Plus, Settings } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import MutualFundTransactionModal from '../components/MutualFundTransactionModal';
import MutualFundEditModal from '../components/MutualFundEditModal';

const MutualFundDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    // State for modals
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const [isFundEditModalOpen, setIsFundEditModalOpen] = useState(false);

    const fund = savings.find(s => s.id.toString() === id);

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

    const currentNav = fund.currentNav || 0;

    // --- Transaction Handlers ---

    const handleSaveTransaction = (tx) => {
        let updatedTransactions = fund.transactions ? [...fund.transactions] : [];

        if (editingTx) {
            // Edit existing
            updatedTransactions = updatedTransactions.map(t => t.id === tx.id ? tx : t);
        } else {
            // Add new
            updatedTransactions.push(tx);
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

            // Recalculate Total Amount
            let totalUnits = 0;
            updatedTransactions.forEach(t => {
                const type = t.type || (t.remarks && t.remarks.toLowerCase().includes('sip') ? 'sip' : 'buy');
                if (type === 'buy' || type === 'sip') totalUnits += Number(t.units);
                if (type === 'sell' || type === 'withdraw') totalUnits -= Number(t.units);
            });
            if (totalUnits < 0.0001) totalUnits = 0;
            const newAmount = totalUnits * (fund.currentNav || 0);

            updateItem('savings', { ...fund, transactions: updatedTransactions, amount: newAmount });
        }
    };

    const handleEditFundDetails = (updatedFund) => {
        updateItem('savings', updatedFund);
        setIsFundEditModalOpen(false);
    };

    // --- Calculation Logic (Unit-based Accounting) ---
    /*
        Rules:
        1. Track total_units_held, total_cost_held, realised_profit
        2. BUY: total_units_held += units, total_cost_held += amount
        3. SELL: 
            avg_cost = total_cost_held / total_units_held
            cost_of_sold = units_sold * avg_cost
            realised_profit += sell_amount - cost_of_sold
            total_units_held -= units_sold
            total_cost_held -= cost_of_sold
        4. Unrealised = (current_nav * total_units_held) - total_cost_held
        5. Total Profit = realised_profit + unrealised_profit
    */

    let total_units_held = 0;
    let total_cost_held = 0;
    let total_realised_profit = 0;
    let transactionsWithCalcs = [];

    if (fund.transactions) {
        const sortedTransactions = [...fund.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

        transactionsWithCalcs = sortedTransactions.map(tx => {
            const isSell = tx.type === 'sell' || tx.type === 'withdraw';
            const txAmount = Number(tx.amount);
            const txUnits = Number(tx.units);

            if (isSell) {
                // Rule 3: SELL logic
                const average_cost_per_unit = total_units_held > 0 ? total_cost_held / total_units_held : 0;
                const cost_of_units_sold = txUnits * average_cost_per_unit;

                const realized_for_tx = txAmount - cost_of_units_sold;
                total_realised_profit += realized_for_tx;

                total_units_held -= txUnits;
                total_cost_held -= cost_of_units_sold;

                return {
                    ...tx,
                    isSell: true,
                    displayAmount: txAmount, // Value received
                    displayUnits: -txUnits,
                    displayValue: txAmount,
                    displayPL: realized_for_tx,
                };
            } else {
                // Rule 2: BUY logic
                total_units_held += txUnits;
                total_cost_held += txAmount;

                // For table display purposes only (Snapshot at that time if held)
                const currentVal = txUnits * currentNav;
                const unrealized_for_start = currentVal - txAmount;

                return {
                    ...tx,
                    isSell: false,
                    displayAmount: txAmount, // Invested
                    displayUnits: txUnits,
                    displayValue: currentVal,
                    displayPL: unrealized_for_start,
                };
            }
        });
    }

    // Prevent negative zeros
    if (total_units_held < 0.0001) total_units_held = 0;
    if (total_cost_held < 0.0001) total_cost_held = 0;

    // Rule 4: Unrealised Profit
    const currentTotalValue = total_units_held * currentNav;
    const total_unrealised_profit = currentTotalValue - total_cost_held;

    // Rule 5: Total Profit
    const total_profit = total_realised_profit + total_unrealised_profit;
    const avgNav = total_units_held > 0 ? (total_cost_held / total_units_held) : 0;

    const isTotalProfit = total_profit >= 0;

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', color: 'white' }}
            >
                <ArrowLeft size={20} /> Back to Savings
            </button>

            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        {fund.title}
                        <button
                            onClick={() => setIsFundEditModalOpen(true)}
                            className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            title="Edit Fund Details (NAV, Name)"
                        >
                            <Settings size={20} />
                        </button>
                    </h2>

                    <button
                        onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/40"
                    >
                        <Plus size={20} />
                        Add Transaction
                    </button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Folio Number</p>
                        <p className="font-mono font-bold text-lg">{fund.folioNumber || 'N/A'}</p>
                    </div>
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Total Invested (Net)</p>
                        <p className="font-bold text-lg">{formatCurrency(total_cost_held)}</p>
                        <p className="text-xs text-gray-500">Active Capital</p>
                    </div>
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Current Value</p>
                        <p className="font-bold text-lg">{formatCurrency(currentTotalValue)}</p>
                    </div>
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Total Profit (All Time)</p>
                        <div className={`font-bold text-lg flex items-center gap-2 ${total_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                            {formatCurrency(Math.abs(total_profit))}
                        </div>
                        <p className="text-xs text-gray-500">Realized + Unrealized</p>
                    </div>
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Unrealized P/L</p>
                        <div className={`font-bold text-lg flex items-center gap-2 ${total_unrealised_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_unrealised_profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                            {formatCurrency(Math.abs(total_unrealised_profit))}
                        </div>
                    </div>
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Realized P/L (Booked)</p>
                        <div className={`font-bold text-lg flex items-center gap-2 ${total_realised_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_realised_profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                            {formatCurrency(Math.abs(total_realised_profit))}
                        </div>
                    </div>
                    <div className="card">
                        <p className="text-secondary text-sm mb-1">Total Units</p>
                        <p className="font-mono font-bold text-lg">{total_units_held.toFixed(3)}</p>
                    </div>
                    <div className="card relative group cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsFundEditModalOpen(true)}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-secondary text-sm mb-1">Average Cost (NAV)</p>
                                <p className="font-mono font-bold text-lg">{avgNav.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="card relative group cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsFundEditModalOpen(true)}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-secondary text-sm mb-1">Current NAV</p>
                                <p className="font-mono font-bold text-lg">{currentNav.toFixed(2)}</p>
                            </div>
                            <Edit2 size={16} className="text-gray-500 group-hover:text-blue-400" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Type</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Amount</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>NAV</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Units</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Value</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>P/L</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Remarks</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactionsWithCalcs.map((tx, index) => {
                            const isProfit = tx.displayPL >= 0;

                            return (
                                <tr key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="hover:bg-white/5 transition-colors group">
                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-primary)' }}>{formatDate(tx.date)}</td>
                                    <td style={{ padding: 'var(--spacing-md)' }}>
                                        <span style={{
                                            color: tx.isSell ? 'var(--color-danger)' : 'var(--color-success)',
                                            backgroundColor: tx.isSell ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase'
                                        }}>
                                            {tx.type === 'sip' ? 'SIP' : (tx.isSell ? 'Sell' : 'Buy')}
                                        </span>
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(tx.displayAmount)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{tx.nav}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: tx.isSell ? 'var(--color-danger)' : 'inherit' }}>{tx.displayUnits.toFixed(3)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(tx.displayValue)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: isProfit ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {tx.isSell ? (
                                            <span className="text-gray-500">-</span>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1">
                                                {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                                {formatCurrency(Math.abs(tx.displayPL))}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{tx.remarks || '-'}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
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
                                <td colSpan="9" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No transactions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
