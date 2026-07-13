import React, { useState, useMemo } from 'react';
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
    const [isTdsModalOpen, setIsTdsModalOpen] = useState(false);
    const [editingTdsTx, setEditingTdsTx] = useState(null);

    const fund = savings.find(s => s.id.toString() === id);
    const depositIndex = fund?.deposits?.findIndex(d => d.id.toString() === depositId);
    const deposit = depositIndex !== -1 && depositIndex !== undefined && fund?.deposits ? fund.deposits[depositIndex] : null;

    // Use useMemo for transaction calculations
    const transactionCalcs = useMemo(() => {
        if (!deposit) {
            return {
                interestTransactions: [],
                totalInterestReceived: 0,
                tdsTransactions: [],
                totalTdsPaid: 0
            };
        }

        const interestTransactions = deposit.interestTransactions || [];
        const totalInterestReceived = interestTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        const tdsTransactions = deposit.tdsTransactions || [];
        const totalTdsPaid = tdsTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        return {
            interestTransactions,
            totalInterestReceived,
            tdsTransactions,
            totalTdsPaid
        };
    }, [deposit]);

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

    const {
        interestTransactions,
        totalInterestReceived,
        tdsTransactions,
        totalTdsPaid
    } = transactionCalcs;

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

    const handleSaveTds = (transaction) => {
        const updatedTransactions = editingTdsTx
            ? tdsTransactions.map(t => t.id === transaction.id ? transaction : t)
            : [...tdsTransactions, transaction];

        const updatedDeposit = { ...deposit, tdsTransactions: updatedTransactions };
        const updatedDeposits = [...fund.deposits];
        updatedDeposits[depositIndex] = updatedDeposit;

        updateItem('savings', { ...fund, deposits: updatedDeposits });
        setEditingTdsTx(null);
        setIsTdsModalOpen(false);
    };

    const handleDeleteTds = (txId) => {
        if (window.confirm('Delete this TDS record?')) {
            const updatedTransactions = tdsTransactions.filter(t => t.id !== txId);
            const updatedDeposit = { ...deposit, tdsTransactions: updatedTransactions };
            const updatedDeposits = [...fund.deposits];
            updatedDeposits[depositIndex] = updatedDeposit;

            updateItem('savings', { ...fund, deposits: updatedDeposits });
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
            {/* Custom Styles Injection */}
            <style>{`
                .sd-glass-panel {
                    background: rgba(10, 11, 20, 0.45) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(45, 212, 191, 0.15) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px 1px rgba(45, 212, 191, 0.05) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .sd-glass-panel:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(45, 212, 191, 0.35) !important;
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px 2px rgba(45, 212, 191, 0.15) !important;
                }
                .sd-glass-glow-card {
                    background: linear-gradient(135deg, rgba(45, 212, 191, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(45, 212, 191, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(45, 212, 191, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .sd-glass-glow-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(45, 212, 191, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(45, 212, 191, 0.25) !important;
                }
                .sd-glass-glow-card-rose {
                    background: linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(244, 63, 94, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(244, 63, 94, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .sd-glass-glow-card-rose:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(244, 63, 94, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(244, 63, 94, 0.25) !important;
                }
                .sd-table-container {
                    background: rgba(10, 11, 20, 0.35) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border-radius: 1.5rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4) !important;
                    overflow: hidden !important;
                }
                .sd-table {
                    width: 100%;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                }
                .sd-table th {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: rgba(255, 255, 255, 0.5) !important;
                    font-weight: 700 !important;
                    font-size: 0.75rem !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                }
                .sd-table td {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
                    transition: all 0.2s ease !important;
                }
                .sd-table tr:last-child td {
                    border-bottom: none !important;
                }
                .sd-table tr:hover td {
                    background-color: rgba(45, 212, 191, 0.04) !important;
                    color: #ffffff !important;
                }
                .sd-table-rose tr:hover td {
                    background-color: rgba(244, 63, 94, 0.04) !important;
                    color: #ffffff !important;
                }
            `}</style>

            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6 text-xs font-black uppercase tracking-widest"
                style={{ cursor: 'pointer' }}
            >
                <ArrowLeft size={16} /> Back to Deposits
            </button>

            <div className="mb-8">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                    <span className="text-gray-500">#{deposit.accountNo}</span>
                    <span>{deposit.bank}</span>
                </h2>
                <div className="flex gap-6 mt-3 text-sm text-gray-500 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-teal-400" />
                        <span>{formatDate(deposit.startDate)} — {formatDate(deposit.endDate)}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                <div className="sd-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Principal Amount</p>
                    <p className="font-bold text-2xl tracking-tight text-white">{formatCurrency(deposit.originalAmount)}</p>
                    <p className="text-xs text-gray-600 mt-1">Capital Invested</p>
                </div>
                <div className="sd-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Interest Rate</p>
                    <p className="font-bold text-2xl tracking-tight text-teal-400">{deposit.interestRate}%</p>
                    <p className="text-xs text-gray-600 mt-1">Annual Interest Rate</p>
                </div>
                <div className="sd-glass-glow-card">
                    <p className="text-teal-300 text-xs font-black uppercase tracking-widest mb-1">Total Interest</p>
                    <p className="font-bold text-2xl tracking-tight text-emerald-400">{formatCurrency(totalInterestReceived)}</p>
                    <p className="text-xs text-teal-500/70 mt-1">Interest payout total</p>
                </div>
                <div className="sd-glass-glow-card-rose">
                    <p className="text-rose-300 text-xs font-black uppercase tracking-widest mb-1">Total TDS Deducted</p>
                    <p className="font-bold text-2xl tracking-tight text-rose-400">{formatCurrency(totalTdsPaid)}</p>
                    <p className="text-xs text-rose-400/70 mt-1">Tax Deducted at Source</p>
                </div>
            </div>

            {/* Interest Section */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold tracking-tight text-white">Interest Payouts</h3>
                <button
                    onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-emerald-500/25"
                >
                    <Plus size={18} />
                    Add Interest
                </button>
            </div>

            <div className="sd-table-container mb-12">
                <div style={{ overflowX: 'auto' }}>
                    <table className="sd-table">
                        <thead>
                            <tr>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Amount</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '2rem' }}>Remarks</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {interestTransactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((tx) => (
                                    <tr key={tx.id} className="group">
                                        <td style={{ padding: '1.25rem 1rem', color: 'var(--text-primary)' }}>{formatDate(tx.date)}</td>
                                        <td style={{ padding: '1.25rem 1rem', fontWeight: 'bold', color: 'var(--color-success)', fontFamily: 'monospace' }}>
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem', paddingLeft: '2rem', color: 'var(--text-secondary)' }}>{tx.remarks || '—'}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
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
                                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No interest transactions recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TDS Section */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold tracking-tight text-white">TDS Deductions</h3>
                <button
                    onClick={() => { setEditingTdsTx(null); setIsTdsModalOpen(true); }}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-rose-500/25"
                >
                    <Plus size={18} />
                    Add TDS
                </button>
            </div>

            <div className="sd-table-container">
                <div style={{ overflowX: 'auto' }}>
                    <table className="sd-table sd-table-rose">
                        <thead>
                            <tr>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Financial Year</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Amount</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '2rem' }}>Remarks</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tdsTransactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((tx) => (
                                    <tr key={tx.id} className="group">
                                        <td style={{ padding: '1.25rem 1rem', color: 'var(--text-primary)' }}>{tx.financialYear || formatDate(tx.date)}</td>
                                        <td style={{ padding: '1.25rem 1rem', fontWeight: 'bold', color: 'var(--color-danger)', fontFamily: 'monospace' }}>
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem', paddingLeft: '2rem', color: 'var(--text-secondary)' }}>{tx.remarks || '—'}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingTdsTx(tx); setIsTdsModalOpen(true); }}
                                                    className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTds(tx.id)}
                                                    className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!tdsTransactions.length && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No TDS transactions recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <InterestTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransaction}
                initialData={editingTx}
                title="Interest"
            />

            <InterestTransactionModal
                isOpen={isTdsModalOpen}
                onClose={() => setIsTdsModalOpen(false)}
                onSave={handleSaveTds}
                initialData={editingTdsTx}
                title="TDS"
                useFinancialYear={true}
            />
        </div>
    );
};

export default SingleDepositDetails;
