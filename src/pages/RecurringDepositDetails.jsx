import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, RefreshCcw, Plus, Edit2, Trash2, TrendingUp } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import RecurringDepositModal from '../components/RecurringDepositModal';

const RecurringDepositDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRD, setEditingRD] = useState(null);

    const account = savings.find(s => s.id.toString() === id);

    if (!account) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Recurring Deposit account not found.</p>
                <button onClick={() => navigate(-1)} className="text-primary hover:underline mt-4">
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

        // Calculate total amount (sum of installments * duration? Or current value?)
        // For simplicity, let's sum maturity amounts for now or just keep it 0 as it's tracked individually
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

    const totalInstallment = account.recurringDeposits?.reduce((sum, d) => sum + (Number(d.installmentAmount) || 0), 0) || 0;
    const totalMaturity = account.recurringDeposits?.reduce((sum, d) => sum + (Number(d.maturityAmount) || 0), 0) || 0;

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
                        <RefreshCcw className="text-blue-400" size={32} />
                        {account.title}
                    </h2>
                    <p className="text-secondary">Track your Recurring Deposits.</p>
                </div>
                <button
                    onClick={() => { setEditingRD(null); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/40"
                >
                    <Plus size={20} />
                    Add RD
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Monthly Installment</p>
                    <p className="font-bold text-lg text-blue-400">{formatCurrency(totalInstallment)}/mo</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Maturity Value</p>
                    <p className="font-bold text-lg text-emerald-400">{formatCurrency(totalMaturity)}</p>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Name/Goal</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Installment</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Rate (%)</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Start Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>End Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Maturity Value</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Status</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...(account.recurringDeposits || [])]
                            .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
                            .map((rd) => (
                                <tr
                                    key={rd.id}
                                    onClick={() => navigate(`/savings/recurring-deposit/${id}/rd/${rd.id}`)}
                                    style={{
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                        cursor: 'pointer'
                                    }}
                                    className="hover:bg-white/5 transition-colors group"
                                >
                                    <td style={{ padding: 'var(--spacing-md)', fontWeight: 'bold' }}>{rd.name}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(rd.installmentAmount)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-accent)' }}>{rd.interestRate}%</td>
                                    <td style={{ padding: 'var(--spacing-md)' }}>{formatDate(rd.startDate)}</td>
                                    <td style={{ padding: 'var(--spacing-md)' }}>{rd.endDate ? formatDate(rd.endDate) : '-'}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-success)' }}>{formatCurrency(rd.maturityAmount)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${rd.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                            {rd.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingRD(rd); setIsModalOpen(true); }}
                                                className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteRD(rd.id); }}
                                                className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        {!account.recurringDeposits?.length && (
                            <tr>
                                <td colSpan="8" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No recurring deposits found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
