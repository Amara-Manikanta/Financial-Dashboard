import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Plus, Edit2, Trash2, Calendar, DollarSign, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import LentModal from '../components/LentModal';
import LentTransactionModal from '../components/LentTransactionModal';
import BackButton from '../components/BackButton';

const LentDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { lents, deleteItem, updateItem, formatCurrency } = useFinance();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editTransaction, setEditTransaction] = useState(null);
    const [selectedYear, setSelectedYear] = useState('All');

    const item = lents.find(i => i.id === id);

    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400">
                <p>Record not found</p>
                <button onClick={() => navigate('/lents-loans')} className="mt-4 text-emerald-400 hover:text-emerald-300">
                    Go Back
                </button>
            </div>
        );
    }

    const isLent = item.type === 'lent';
    const amount = item.amount || 0;
    const transactions = item.transactions || [];

    const totalRepaid = transactions
        .filter(t => t.type === 'repayment')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const totalAdditional = transactions
        .filter(t => t.type === 'additional')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    // Net Principal = Initial Principal + Additional Loans
    const netPrincipal = amount + totalAdditional;
    const pendingAmount = netPrincipal - totalRepaid;

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this record?')) {
            await deleteItem('lents', id);
            navigate('/lents-loans');
        }
    };

    // Filter Logic
    const years = ['All', ...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);

    const filteredTransactions = transactions
        .filter(t => selectedYear === 'All' || new Date(t.date).getFullYear() === parseInt(selectedYear))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const handleEditTransaction = (transaction) => {
        setEditTransaction(transaction);
        setIsTransactionModalOpen(true);
    };

    const handleDeleteTransaction = async (transactionId) => {
        if (!item || !item.transactions) return;

        if (window.confirm('Are you sure you want to delete this transaction?')) {
            try {
                const updatedTransactions = item.transactions.filter(t => t.id !== transactionId);
                const updatedItem = { ...item, transactions: updatedTransactions };
                await updateItem('lents', updatedItem);
            } catch (error) {
                console.error("Failed to delete transaction:", error);
                alert("Failed to delete transaction. see console for details.");
            }
        }
    };

    // EMI Schedule Calculation
    let emiSchedule = [];
    if (item.isEmi && item.emiDetails) {
        const { totalMonths, amountPerMonth, startDate } = item.emiDetails;
        const start = new Date(startDate);

        for (let i = 0; i < totalMonths; i++) {
            const dueDate = new Date(start);
            dueDate.setMonth(start.getMonth() + i);

            // Check if this EMI is covered by repayments
            // This is a naive simplistic logic: sum of repayments covers X months
            // Real world logic might need specific linkage between payment and EMI, but simplistic accumulation is okay for V1
            const coveredAmount = (i + 1) * amountPerMonth;
            const status = totalRepaid >= coveredAmount ? 'paid' : totalRepaid >= (i * amountPerMonth) ? 'partial' : 'pending';

            emiSchedule.push({
                month: i + 1,
                dueDate: dueDate,
                amount: amountPerMonth,
                status: status
            });
        }
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <BackButton label="Back to Lent & Loans" to="/lents-loans" style={{ marginBottom: 0 }} />

            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {item.name}
                            {item.isEmi && (
                                <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                    EMI
                                </span>
                            )}
                        </h2>
                        <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Manage transactions and schedules for {item.name}.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer'
                        }}
                    >
                        Edit Details
                    </button>
                    <button
                        onClick={handleDelete}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer'
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '2rem',
                    padding: '2rem'
                }}>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Principal</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(netPrincipal)}</h3>
                    {totalAdditional > 0 && <span style={{ fontSize: '10px', color: '#fbbf24', display: 'block', marginTop: '0.25rem' }}>Includes +{formatCurrency(totalAdditional)} added</span>}
                </div>
                <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.02)',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    borderRadius: '2rem',
                    padding: '2rem'
                }}>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Repaid</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: '950', color: '#34d399', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(totalRepaid)}</h3>
                    {item.isEmi && <span style={{ fontSize: '10px', color: '#71717a', display: 'block', marginTop: '0.25rem' }}>{item.emiDetails?.amountPerMonth ? Math.floor(totalRepaid / item.emiDetails.amountPerMonth) : 0} EMIs paid approx</span>}
                </div>
                <div style={{
                    backgroundColor: pendingAmount > 0 ? 'rgba(239, 68, 68, 0.02)' : 'rgba(16, 185, 129, 0.02)',
                    border: pendingAmount > 0 ? '1px solid rgba(239, 68, 68, 0.1)' : '1px solid rgba(16, 185, 129, 0.1)',
                    borderRadius: '2rem',
                    padding: '2rem'
                }}>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: pendingAmount > 0 ? '#f87171' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Balance</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: '950', color: pendingAmount > 0 ? '#f87171' : '#34d399', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(pendingAmount)}</h3>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {/* Main Content: Transactions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justify: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>Transaction History</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', outline: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                            >
                                {years.map(year => (
                                    <option key={year} value={year} style={{ backgroundColor: '#18181b' }}>{year}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => {
                                    setEditTransaction(null);
                                    setIsTransactionModalOpen(true);
                                }}
                                style={{
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: '#c084fc',
                                    color: 'black',
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    cursor: 'pointer',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                <Plus size={12} /> Add Transaction
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredTransactions.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '1.5rem' }}>
                                No transactions found.
                            </div>
                        ) : (
                            filteredTransactions.map(tx => (
                                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '2.5rem',
                                            height: '2.5rem',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: tx.type === 'repayment' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: tx.type === 'repayment' ? '#34d399' : '#fbbf24'
                                        }}>
                                            {tx.type === 'repayment' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                        </div>
                                        <div>
                                            <p style={{ color: 'white', fontWeight: 'bold', fontSize: '0.875rem', margin: 0, textTransform: 'capitalize' }}>
                                                {tx.type === 'repayment' ? (isLent ? 'Repayment Received' : 'You Paid Back') : (isLent ? 'Lent More' : 'Borrowed More')}
                                            </p>
                                            <span style={{ fontSize: '10px', color: '#71717a' }}>{new Date(tx.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '1rem', fontWeight: 'bold', fontFamily: 'monospace', margin: 0, color: tx.type === 'repayment' ? '#34d399' : '#fbbf24' }}>
                                                {tx.type === 'repayment' ? '-' : '+'}{formatCurrency(tx.amount)}
                                            </p>
                                            {tx.description && <span style={{ fontSize: '10px', color: '#71717a', maxWidth: '200px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button
                                                onClick={() => handleEditTransaction(tx)}
                                                style={{ padding: '0.25rem', borderRadius: '0.375rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: '#71717a', cursor: 'pointer' }}
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }}
                                                style={{ padding: '0.25rem', borderRadius: '0.375rem', border: 'none', backgroundColor: 'rgba(239,68,68,0.05)', color: '#f87171', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sidebar: Details & EMI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '900', color: 'white', margin: 0 }}>Details</h4>
                        {item.description && (
                            <div>
                                <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</span>
                                <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: '0.25rem 0 0 0' }}>{item.description}</p>
                            </div>
                        )}
                        <div>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Originally Created</span>
                            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: '0.25rem 0 0 0' }}>{new Date(item.created || Date.now()).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {item.isEmi && (
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '900', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Clock size={16} className="text-[#818cf8]" /> EMI Schedule
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {emiSchedule.map((emi) => (
                                    <div key={emi.month} style={{ display: 'flex', justify: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                backgroundColor: emi.status === 'paid' ? '#34d399' : emi.status === 'partial' ? '#fbbf24' : '#71717a'
                                            }} />
                                            <span style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>
                                                {emi.dueDate.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 'bold', fontFamily: 'monospace', color: emi.status === 'paid' ? '#34d399' : '#a1a1aa' }}>
                                            {formatCurrency(emi.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isEditModalOpen && (
                <LentModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    editItem={item}
                />
            )}

            <LentTransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => {
                    setIsTransactionModalOpen(false);
                    setEditTransaction(null);
                }}
                person={item}
                editTransaction={editTransaction}
            />
        </div>
    );
};

export default LentDetails;
