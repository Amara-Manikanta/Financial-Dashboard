import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, PiggyBank, Plus, Edit2, Trash2, RefreshCw, TrendingUp } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import FixedDepositModal from '../components/FixedDepositModal';

const FixedDepositDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDeposit, setEditingDeposit] = useState(null);
    const [isRenewal, setIsRenewal] = useState(false);

    const fund = savings.find(s => s.id.toString() === id);

    const totalOriginalAmount = useMemo(() => fund?.deposits?.reduce((sum, d) => sum + d.originalAmount, 0) || 0, [fund]);
    const totalMaturityAmount = useMemo(() => fund?.deposits?.reduce((sum, d) => sum + d.maturityAmount, 0) || 0, [fund]);
    const totalInterest = useMemo(() => fund?.deposits?.reduce((sum, d) => sum + d.interestEarned, 0) || 0, [fund]);

    const yearlyBreakdown = useMemo(() => {
        const breakdown = {};
        if (!fund || !fund.deposits) return [];

        fund.deposits.forEach(deposit => {
            const P = deposit.originalAmount;
            const r = (deposit.interestRate || 0) / 100;
            const n = 4; // Quarterly
            const start = new Date(deposit.startDate);
            const end = new Date(deposit.endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

            let currentYear = start.getFullYear();
            const lastYear = end.getFullYear();

            while (currentYear <= lastYear) {
                const yearStart = new Date(currentYear, 0, 1);
                const yearEnd = new Date(currentYear, 12, 0); // End of Dec

                const periodStart = start > yearStart ? start : yearStart;
                const periodEnd = end < yearEnd ? end : yearEnd;

                if (periodEnd > periodStart) {
                    const tStart = (periodStart - start) / (1000 * 60 * 60 * 24 * 365.25);
                    const tEnd = (periodEnd - start) / (1000 * 60 * 60 * 24 * 365.25);

                    const vStart = P * Math.pow((1 + r / n), (n * tStart));
                    const vEnd = P * Math.pow((1 + r / n), (n * tEnd));

                    const interestInYear = vEnd - vStart;
                    breakdown[currentYear] = (breakdown[currentYear] || 0) + interestInYear;
                }
                currentYear++;
            }
        });

        return Object.entries(breakdown)
            .map(([year, amount]) => ({ year, amount }))
            .sort((a, b) => b.year - a.year);
    }, [fund]);

    const yearlyTdsBreakdown = useMemo(() => {
        const breakdown = {};
        if (!fund || !fund.deposits) return [];

        fund.deposits.forEach(deposit => {
            (deposit.tdsTransactions || []).forEach(tx => {
                const year = tx.financialYear || new Date(tx.date).getFullYear().toString();
                breakdown[year] = (breakdown[year] || 0) + (tx.amount || 0);
            });
        });

        return Object.entries(breakdown)
            .map(([year, amount]) => ({ year, amount }))
            .sort((a, b) => b.year.localeCompare(a.year));
    }, [fund]);

    if (!fund) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Fixed Deposit account not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    const handleSaveDeposit = (deposit) => {
        let updatedDeposits = fund.deposits ? [...fund.deposits] : [];

        if (editingDeposit) {
            updatedDeposits = updatedDeposits.map(d => d.id === deposit.id ? deposit : d);
        } else {
            updatedDeposits.push(deposit);
        }

        // Calculate total amount for the main item if needed, but 'amount' usually implies total current value
        const newTotalAmount = updatedDeposits.reduce((sum, d) => sum + (d.currentValue || d.originalAmount), 0);

        updateItem('savings', { ...fund, deposits: updatedDeposits, amount: newTotalAmount });
        setEditingDeposit(null);
        setIsRenewal(false);
        setIsModalOpen(false);
    };

    const handleRenewDeposit = (deposit) => {
        setEditingDeposit(deposit);
        setIsRenewal(true);
        setIsModalOpen(true);
    };

    const handleDeleteDeposit = (depositId) => {
        if (window.confirm('Delete this deposit entry?')) {
            const updatedDeposits = fund.deposits.filter(d => d.id !== depositId);
            const newTotalAmount = updatedDeposits.reduce((sum, d) => sum + (d.currentValue || d.originalAmount), 0);
            updateItem('savings', { ...fund, deposits: updatedDeposits, amount: newTotalAmount });
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
            {/* Custom Styles Injection */}
            <style>{`
                .fd-glass-panel {
                    background: rgba(10, 11, 20, 0.45) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(16, 185, 129, 0.15) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px 1px rgba(16, 185, 129, 0.05) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .fd-glass-panel:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(16, 185, 129, 0.35) !important;
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px 2px rgba(16, 185, 129, 0.15) !important;
                }
                .fd-glass-glow-card {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(16, 185, 129, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(16, 185, 129, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .fd-glass-glow-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(16, 185, 129, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(16, 185, 129, 0.25) !important;
                }
                .fd-table-container {
                    background: rgba(10, 11, 20, 0.35) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border-radius: 1.5rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4) !important;
                    overflow: hidden !important;
                }
                .fd-table {
                    width: 100%;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                }
                .fd-table th {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: rgba(255, 255, 255, 0.5) !important;
                    font-weight: 700 !important;
                    font-size: 0.75rem !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                }
                .fd-table td {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
                    transition: all 0.2s ease !important;
                }
                .fd-table tr:last-child td {
                    border-bottom: none !important;
                }
                .fd-table tr:hover td {
                    background-color: rgba(16, 185, 129, 0.04) !important;
                    color: #ffffff !important;
                }
                .fd-year-card {
                    background: rgba(10, 11, 20, 0.4) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    border-radius: 1rem !important;
                    padding: 1rem !important;
                    box-shadow: 0 4px 15px -3px rgba(0, 0, 0, 0.3) !important;
                    transition: all 0.3s ease !important;
                }
                .fd-year-card:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.5) !important;
                }
            `}</style>

            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6 text-xs font-black uppercase tracking-widest"
                style={{ cursor: 'pointer' }}
            >
                <ArrowLeft size={16} /> Back to Savings
            </button>

            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                        <PiggyBank className="text-emerald-400" size={32} />
                        {fund.title}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Summary of all your active Fixed Deposits.</p>
                </div>
                <button
                    onClick={() => { setEditingDeposit(null); setIsModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-emerald-500/25"
                >
                    <Plus size={18} />
                    Add Deposit
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div className="fd-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Principal</p>
                    <p className="font-bold text-2xl tracking-tight">{formatCurrency(totalOriginalAmount)}</p>
                    <p className="text-xs text-gray-600 mt-1">Total Capital Invested</p>
                </div>
                <div className="fd-glass-glow-card">
                    <p className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Total Interest Earned</p>
                    <p className="font-bold text-2xl tracking-tight text-emerald-400">{formatCurrency(totalInterest)}</p>
                    <p className="text-xs text-emerald-500/70 mt-1">Accumulated returns</p>
                </div>
                <div className="fd-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Maturity Value</p>
                    <p className="font-bold text-2xl tracking-tight text-white">{formatCurrency(totalMaturityAmount)}</p>
                    <p className="text-xs text-gray-600 mt-1">Value on completion</p>
                </div>
            </div>

            <div className="fd-table-container">
                <div style={{ overflowX: 'auto' }}>
                    <table className="fd-table" style={{ minWidth: '1000px' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Account No</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Bank</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Rate (%)</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Start Date</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>End Date</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Principal</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Interest (Total)</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>TDS</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Accrued Value</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Maturity Value</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '1.5rem' }}>Remarks</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Times Renewed</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...(fund.deposits || [])]
                                .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
                                .map((deposit) => {
                                    const maturityDate = new Date(deposit.endDate);
                                    const today = new Date();
                                    const isMatured = today >= maturityDate;
                                    const isNearingMaturity = !isMatured && (maturityDate - today) / (1000 * 60 * 60 * 24 * 30.44) <= 2;
                                    
                                    const totalInterest = (deposit.interestTransactions || []).reduce((sum, tx) => sum + (tx.amount || 0), 0) || deposit.interestEarned || 0;
                                    const totalTds = (deposit.tdsTransactions || []).reduce((sum, tx) => sum + (tx.amount || 0), 0) || deposit.tds || 0;

                                    return (
                                        <tr key={deposit.id}
                                            onClick={() => navigate(`/savings/fixed-deposit/${id}/deposit/${deposit.id}`)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: isMatured ? 'rgba(16, 185, 129, 0.04)' : (isNearingMaturity ? 'rgba(234, 179, 8, 0.04)' : 'transparent')
                                            }} className="group">
                                            <td style={{ padding: '1.25rem 1rem', fontFamily: 'monospace', fontWeight: '500' }}>
                                                <div className="flex flex-col">
                                                    <span>{deposit.accountNo}</span>
                                                    {isMatured ? (
                                                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Matured</span>
                                                    ) : isNearingMaturity && (
                                                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 animate-pulse">Maturing Soon</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem', color: '#ffffff' }}>{deposit.bank}</td>
                                            <td style={{ padding: '1.25rem 1rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>{deposit.interestRate || '—'}%</td>
                                            <td style={{ padding: '1.25rem 1rem', color: '#a1a1aa' }}>{formatDate(deposit.startDate)}</td>
                                            <td style={{ padding: '1.25rem 1rem', fontWeight: (isNearingMaturity || isMatured) ? 'bold' : 'normal', color: isMatured ? '#10b981' : (isNearingMaturity ? '#fbbf24' : '#ffffff') }}>{formatDate(deposit.endDate)}</td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(deposit.originalAmount)}</td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-success)', fontWeight: '500' }}>{formatCurrency(totalInterest)}</td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#f87171', fontWeight: '500' }}>{totalTds ? formatCurrency(totalTds) : '-'}</td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#a1a1aa', fontWeight: '500' }}>{formatCurrency(deposit.currentValue)}</td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(deposit.maturityAmount)}</td>
                                            <td style={{ padding: '1.25rem 1rem', paddingLeft: '1.5rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={deposit.remarks}>{deposit.remarks || '—'}</td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                <div className="flex items-center justify-center">
                                                    {deposit.renewalCount > 0 ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-black">
                                                            {deposit.renewalCount}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-600 text-xs">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {isMatured && (
                                                        <button
                                                            onClick={() => handleRenewDeposit(deposit)}
                                                            className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors animate-pulse"
                                                            title="Renew Deposit"
                                                        >
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => { setEditingDeposit(deposit); setIsRenewal(false); setIsModalOpen(true); }}
                                                        className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDeposit(deposit.id)}
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
                            {!fund.deposits?.length && (
                                <tr>
                                    <td colSpan="13" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No fixed deposits found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Yearly Interest Summary Section */}
            {yearlyBreakdown.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <TrendingUp size={22} className="text-emerald-400" />
                        Yearly Interest Accrual
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {yearlyBreakdown.map(({ year, amount }) => (
                            <div key={year} className="fd-year-card flex flex-col items-center justify-center text-center border-l-4 border-l-emerald-500">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">{year}</span>
                                <span className="text-lg font-bold text-emerald-400">{formatCurrency(amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Yearly TDS Summary Section */}
            {yearlyTdsBreakdown.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <TrendingUp size={22} className="text-rose-400" />
                        Yearly TDS Deducted
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {yearlyTdsBreakdown.map(({ year, amount }) => (
                            <div key={year} className="fd-year-card flex flex-col items-center justify-center text-center border-l-4 border-l-rose-500">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">{year}</span>
                                <span className="text-lg font-bold text-rose-400">{formatCurrency(amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <FixedDepositModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setIsRenewal(false); }}
                onSave={handleSaveDeposit}
                initialData={editingDeposit}
                isRenewal={isRenewal}
            />
        </div>
    );
};

export default FixedDepositDetails;
