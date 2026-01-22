import React, { useState } from 'react';
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

    const totalOriginalAmount = fund.deposits?.reduce((sum, d) => sum + d.originalAmount, 0) || 0;
    const totalMaturityAmount = fund.deposits?.reduce((sum, d) => sum + d.maturityAmount, 0) || 0;
    const totalInterest = fund.deposits?.reduce((sum, d) => sum + d.interestEarned, 0) || 0;

    const yearlyBreakdown = React.useMemo(() => {
        const breakdown = {};
        if (!fund.deposits) return [];

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
    }, [fund.deposits]);

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', color: 'white' }}
            >
                <ArrowLeft size={20} /> Back to Savings
            </button>

            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <PiggyBank className="text-accent-primary" size={32} />
                        {fund.title}
                    </h2>
                    <p className="text-secondary">Summary of all your active Fixed Deposits.</p>
                </div>
                <button
                    onClick={() => { setEditingDeposit(null); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/40"
                >
                    <Plus size={20} />
                    Add Deposit
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Principal</p>
                    <p className="font-bold text-lg">{formatCurrency(totalOriginalAmount)}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Interest Earned</p>
                    <p className="font-bold text-lg text-success">{formatCurrency(totalInterest)}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Maturity Value</p>
                    <p className="font-bold text-lg">{formatCurrency(totalMaturityAmount)}</p>
                </div>
            </div>


            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Account No</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Bank</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Rate (%)</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Start Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>End Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Principal</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Interest (Total)</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>TDS</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Accrued Value</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Maturity Value</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Remarks</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
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
                                return (
                                    <tr key={deposit.id}
                                        onClick={() => navigate(`/savings/fixed-deposit/${id}/deposit/${deposit.id}`)}
                                        style={{
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                            cursor: 'pointer',
                                            backgroundColor: isMatured ? 'rgba(16, 185, 129, 0.03)' : (isNearingMaturity ? 'rgba(234, 179, 8, 0.03)' : 'transparent')
                                        }} className="hover:bg-white/5 transition-colors group text-sm">
                                        <td style={{ padding: 'var(--spacing-md)', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                            <div className="flex flex-col">
                                                <span>{deposit.accountNo}</span>
                                                {isMatured ? (
                                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Matured</span>
                                                ) : isNearingMaturity && (
                                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 animate-pulse">Maturing Soon</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>{deposit.bank}</td>
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: 'bold', color: 'var(--text-accent)' }}>{deposit.interestRate || '—'}%</td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>{formatDate(deposit.startDate)}</td>
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: (isNearingMaturity || isMatured) ? 'bold' : 'normal', color: isMatured ? '#10b981' : (isNearingMaturity ? '#fbbf24' : 'inherit') }}>{formatDate(deposit.endDate)}</td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(deposit.originalAmount)}</td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-success)' }}>{formatCurrency(deposit.interestEarned)}</td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-accent)' }}>{deposit.tds ? formatCurrency(deposit.tds) : '-'}</td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(deposit.currentValue)}</td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatCurrency(deposit.maturityAmount)}</td>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={deposit.remarks}>{deposit.remarks || '—'}</td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                            <div className="flex items-center justify-center gap-2">
                                                {isMatured && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRenewDeposit(deposit); }}
                                                        className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                                                        title="Renew Deposit"
                                                    >
                                                        <RefreshCw size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingDeposit(deposit); setIsRenewal(false); setIsModalOpen(true); }}
                                                    className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteDeposit(deposit.id); }}
                                                    className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
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
                                <td colSpan="12" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No fixed deposits found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Yearly Interest Summary Section */}
            {yearlyBreakdown.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <TrendingUp size={24} className="text-emerald-500" />
                        Yearly Interest Accrual
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {yearlyBreakdown.map(({ year, amount }) => (
                            <div key={year} className="card p-4 flex flex-col items-center justify-center text-center border-l-4 border-l-emerald-500">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">{year}</span>
                                <span className="text-lg font-bold text-emerald-400">{formatCurrency(amount)}</span>
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
