import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Percent, Plus, Landmark, Calculator, Edit2, Trash2, Calendar, CheckCircle2, DollarSign, TrendingDown } from 'lucide-react';
import LoanModal from '../components/LoanModal';
import EMICalculator from '../components/EMICalculator';

const LoanTracker = () => {
    const { loans, lents, addItem, updateItem, deleteItem, formatCurrency } = useFinance();
    const [activeTab, setActiveTab] = useState('loans'); // 'loans' or 'calculator'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLoan, setEditingLoan] = useState(null);

    const handleSaveLoan = async (loanData) => {
        if (editingLoan) {
            await updateItem('loans', loanData);
        } else {
            await addItem('loans', loanData);
        }
        setIsModalOpen(false);
        setEditingLoan(null);
    };

    const handleEdit = (loan) => {
        setEditingLoan(loan);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this loan record?')) {
            await deleteItem('loans', id);
        }
    };

    // Combine loans from `loans` state and borrowed items from `lents` (where type === 'borrowed')
    const activeLoanList = loans || [];
    const totalPrincipal = activeLoanList.reduce((sum, l) => sum + (Number(l.principalAmount) || 0), 0);
    const totalMonthlyEmi = activeLoanList.reduce((sum, l) => sum + (Number(l.emiAmount) || 0), 0);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Percent style={{ color: '#60a5fa' }} size={32} />
                        Loan & EMI Tracker
                    </h1>
                    <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>Track outstanding liabilities, monthly EMIs, and simulate prepayment savings</p>
                </div>
                <button
                    onClick={() => { setEditingLoan(null); setIsModalOpen(true); }}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#60a5fa',
                        color: 'black',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(96, 165, 250, 0.25)'
                    }}
                >
                    <Plus size={20} /> Add Loan
                </button>
            </div>

            {/* Top Level Navigation Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                    onClick={() => setActiveTab('loans')}
                    style={{
                        padding: '1rem 1.5rem', background: 'transparent', border: 'none',
                        color: activeTab === 'loans' ? '#60a5fa' : '#a1a1aa',
                        fontWeight: activeTab === 'loans' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'loans' ? '2px solid #60a5fa' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem'
                    }}
                >
                    Active Loans ({activeLoanList.length})
                </button>
                <button
                    onClick={() => setActiveTab('calculator')}
                    style={{
                        padding: '1rem 1.5rem', background: 'transparent', border: 'none',
                        color: activeTab === 'calculator' ? '#60a5fa' : '#a1a1aa',
                        fontWeight: activeTab === 'calculator' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'calculator' ? '2px solid #60a5fa' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem'
                    }}
                >
                    EMI Calculator & Amortization
                </button>
            </div>

            {activeTab === 'loans' ? (
                <>
                    {/* Top Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Total Loan Accounts</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', marginTop: '0.5rem' }}>{activeLoanList.length}</h3>
                        </div>

                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Total Principal Borrowed</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#f87171', marginTop: '0.5rem' }}>{formatCurrency(totalPrincipal)}</h3>
                        </div>

                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Total Monthly EMI</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#60a5fa', marginTop: '0.5rem' }}>{formatCurrency(totalMonthlyEmi)}</h3>
                        </div>
                    </div>

                    {/* Active Loans Cards */}
                    {activeLoanList.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'rgba(24, 24, 27, 0.4)',
                            borderRadius: '1.5rem', border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <Landmark size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>No Active Loans Tracked</h3>
                            <p style={{ color: '#71717a', marginTop: '0.5rem' }}>Click "Add Loan" above to start tracking your EMIs and home/car debts.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
                            {activeLoanList.map(loan => (
                                <div
                                    key={loan.id}
                                    style={{
                                        backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column',
                                        justifyContent: 'space-between', backdropFilter: 'blur(10px)',
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <div>
                                                <span style={{
                                                    fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.6rem',
                                                    borderRadius: '0.5rem', backgroundColor: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa',
                                                    textTransform: 'uppercase', letterSpacing: '0.05em'
                                                }}>
                                                    {loan.type} Loan
                                                </span>
                                                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginTop: '0.5rem' }}>{loan.name}</h3>
                                                <p style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>{loan.lender || 'Bank'} {loan.accountNumber ? `• ${loan.accountNumber}` : ''}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleEdit(loan)}
                                                    style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0.25rem' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(loan.id)}
                                                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.25rem' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', padding: '0.85rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', marginBottom: '1rem' }}>
                                            <div>
                                                <span style={{ color: '#71717a', fontSize: '0.75rem', display: 'block' }}>Monthly EMI</span>
                                                <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(loan.emiAmount)}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: '#71717a', fontSize: '0.75rem', display: 'block' }}>Interest Rate</span>
                                                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>{loan.interestRate}% p.a.</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#a1a1aa', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                                            <span>Principal: <strong style={{ color: 'white' }}>{formatCurrency(loan.principalAmount)}</strong></span>
                                            <span>Tenure: <strong style={{ color: 'white' }}>{loan.tenureMonths} Months</strong></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <EMICalculator />
            )}

            {/* Modal */}
            <LoanModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveLoan}
                editingLoan={editingLoan}
            />
        </div>
    );
};

export default LoanTracker;
