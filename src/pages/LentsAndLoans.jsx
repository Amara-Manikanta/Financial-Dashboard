import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowUpRight, ArrowDownLeft, Search, RefreshCcw, Percent, Landmark, Edit2, Trash2, Calculator, Wallet, DollarSign, CheckCircle2, History, ChevronDown, ChevronUp, ShieldCheck, Smartphone, AlertTriangle } from 'lucide-react';
import LentModal from '../components/LentModal';
import LoanModal from '../components/LoanModal';
import LoanPaymentModal from '../components/LoanPaymentModal';
import EMICalculator from '../components/EMICalculator';
import { lentOutstanding } from '../utils/lents';

const DebtCard = ({ item, navigate, formatCurrency }) => {
    const isLent = item.type === 'lent';
    const amount = item.amount || 0;

    const totalTransactions = (item.transactions || []).reduce((acc, tx) => {
        if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
        if (tx.type === 'additional') return acc + parseFloat(tx.amount);
        return acc;
    }, 0);

    const pendingAmount = amount + totalTransactions;
    const accentColor = isLent ? '#10b981' : '#ef4444';
    const glowColor = isLent ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
    const borderColor = isLent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';

    return (
        <div
            onClick={() => navigate(`/lents-loans/${item.id}`)}
            style={{
                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${borderColor}`,
                borderRadius: '2rem',
                padding: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '220px',
                boxShadow: `0 10px 15px -3px ${glowColor}`,
                position: 'relative'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                    padding: '0.5rem',
                    borderRadius: '0.75rem',
                    backgroundColor: isLent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {isLent ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                </div>
                {item.isEmi && (
                    <span style={{
                        fontSize: '9px',
                        fontWeight: '900',
                        color: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        border: '1px solid rgba(96, 165, 250, 0.2)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        EMI
                    </span>
                )}
            </div>

            <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>{item.name}</h3>
                <p style={{ fontSize: '0.75rem', color: '#71717a', margin: '0 0 1rem 0', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description || 'No description'}</p>
                <div>
                    <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>
                        {isLent ? 'Pending Amount' : 'Outstanding Balance'}
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '950', color: accentColor, fontFamily: 'monospace', margin: 0 }}>
                        {formatCurrency(pendingAmount)}
                    </p>
                </div>
            </div>
        </div>
    );
};

const LentsAndLoans = () => {
    const { lents, loans, addItem, updateItem, deleteItem, formatCurrency } = useFinance();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Support tab switching via URL query params ?tab=loans, ?tab=calculator, ?tab=peer
    const initialTab = searchParams.get('tab') === 'loans' ? 'loans' : searchParams.get('tab') === 'calculator' ? 'calculator' : 'peer';
    const [activeTab, setActiveTab] = useState(initialTab);

    const [isLentModalOpen, setIsLentModalOpen] = useState(false);
    const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
    const [editingLoan, setEditingLoan] = useState(null);

    // Payment Transaction Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [activePaymentLoan, setActivePaymentLoan] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);
    const [expandedHistory, setExpandedHistory] = useState({});

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, lent, borrowed

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'loans') setActiveTab('loans');
        else if (tabParam === 'calculator') setActiveTab('calculator');
        else if (tabParam === 'peer') setActiveTab('peer');
    }, [searchParams]);

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setSearchParams({ tab: newTab });
    };

    // Bank Loans handlers
    const handleSaveLoan = async (loanData) => {
        if (editingLoan) {
            await updateItem('loans', loanData);
        } else {
            await addItem('loans', loanData);
        }
        setIsLoanModalOpen(false);
        setEditingLoan(null);
    };

    const handleEditLoan = (loan) => {
        setEditingLoan(loan);
        setIsLoanModalOpen(true);
    };

    const handleDeleteLoan = async (id) => {
        if (window.confirm('Are you sure you want to delete this loan record?')) {
            await deleteItem('loans', id);
        }
    };

    // EMI Payment Transaction Handlers
    const handleOpenPaymentModal = (loan, payment = null) => {
        setActivePaymentLoan(loan);
        setEditingPayment(payment);
        setIsPaymentModalOpen(true);
    };

    const handleSaveLoanPayment = async (paymentData) => {
        if (!activePaymentLoan) return;

        const currentPayments = activePaymentLoan.payments || [];
        let updatedPayments;
        if (editingPayment) {
            updatedPayments = currentPayments.map(p => p.id === paymentData.id ? paymentData : p);
        } else {
            updatedPayments = [...currentPayments, paymentData];
        }

        const updatedLoan = {
            ...activePaymentLoan,
            payments: updatedPayments,
            updatedAt: new Date().toISOString()
        };

        await updateItem('loans', updatedLoan);
        setIsPaymentModalOpen(false);
        setActivePaymentLoan(null);
        setEditingPayment(null);
    };

    const handleDeleteLoanPayment = async (loan, paymentId) => {
        if (window.confirm('Are you sure you want to delete this payment record?')) {
            const updatedPayments = (loan.payments || []).filter(p => p.id !== paymentId);
            const updatedLoan = { ...loan, payments: updatedPayments, updatedAt: new Date().toISOString() };
            await updateItem('loans', updatedLoan);
        }
    };

    const toggleHistory = (loanId) => {
        setExpandedHistory(prev => ({ ...prev, [loanId]: !prev[loanId] }));
    };

    // Peer debts metrics. The outstanding formula is shared with goals funded by
    // money lent out, so the two pages cannot report different figures.
    const totalLent = lents.filter(i => i.type === 'lent')
        .reduce((sum, item) => sum + lentOutstanding(item), 0);

    const totalBorrowed = lents.filter(i => i.type === 'borrowed')
        .reduce((sum, item) => sum + lentOutstanding(item), 0);

    const filteredLents = lents.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = filterType === 'all' || item.type === filterType;
        return matchesSearch && matchesType;
    });

    // Bank Loans metrics
    const activeLoanList = loans || [];
    const totalPrincipal = activeLoanList.reduce((sum, item) => sum + (Number(item.principalAmount) || 0), 0);
    const totalMonthlyEmi = activeLoanList.reduce((sum, item) => sum + (Number(item.emiAmount) || 0), 0);
    const totalFeesGstPaid = activeLoanList.reduce((sum, item) => sum + (Number(item.processingFee) || 0) + (Number(item.gstAmount) || 0), 0);

    const getLoanTypeBadge = (t) => {
        const typeStr = (t || '').toLowerCase();
        if (typeStr === 'gadget') return { label: '📱 Electronic Gadget EMI', bg: 'rgba(192, 132, 252, 0.15)', text: '#c084fc', border: 'rgba(192, 132, 252, 0.3)' };
        if (typeStr === 'home') return { label: '🏠 Home Loan', bg: 'rgba(52, 211, 153, 0.15)', text: '#34d399', border: 'rgba(52, 211, 153, 0.3)' };
        if (typeStr === 'car') return { label: '🚗 Car Loan', bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
        if (typeStr === 'personal') return { label: '💼 Personal Loan', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
        if (typeStr === 'no_cost_emi') return { label: '💳 No-Cost EMI', bg: 'rgba(244, 114, 182, 0.15)', text: '#f472b6', border: 'rgba(244, 114, 182, 0.3)' };
        if (typeStr === 'consumer_durable') return { label: '🛒 Consumer EMI', bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c', border: 'rgba(251, 146, 60, 0.3)' };
        if (typeStr === 'education') return { label: '🎓 Education Loan', bg: 'rgba(129, 140, 248, 0.15)', text: '#818cf8', border: 'rgba(129, 140, 248, 0.3)' };
        return { label: '🪙 Debt / Loan', bg: 'rgba(161, 161, 170, 0.15)', text: '#a1a1aa', border: 'rgba(161, 161, 170, 0.3)' };
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                        Loans & EMIs
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Track bank loans, gadget EMIs, processing fees, GST, and peer debts.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {activeTab === 'peer' && (
                        <button
                            onClick={() => setIsLentModalOpen(true)}
                            style={{
                                padding: '0.75rem 1.5rem', borderRadius: '1rem', backgroundColor: '#10b981',
                                color: 'black', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase',
                                letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', border: 'none'
                            }}
                        >
                            <Plus size={16} /> Add Peer Record
                        </button>
                    )}
                    {activeTab === 'loans' && (
                        <button
                            onClick={() => { setEditingLoan(null); setIsLoanModalOpen(true); }}
                            style={{
                                padding: '0.75rem 1.5rem', borderRadius: '1rem', backgroundColor: '#60a5fa',
                                color: 'black', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase',
                                letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', border: 'none'
                            }}
                        >
                            <Plus size={16} /> Add Bank Loan / Gadget EMI
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: '2rem' }}>
                <button
                    onClick={() => handleTabChange('peer')}
                    style={{
                        padding: '0.75rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer',
                        color: activeTab === 'peer' ? '#10b981' : '#a1a1aa',
                        fontWeight: activeTab === 'peer' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'peer' ? '2px solid #10b981' : '2px solid transparent',
                        fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                >
                    <Wallet size={16} /> Peer-to-Peer Debts
                </button>
                <button
                    onClick={() => handleTabChange('loans')}
                    style={{
                        padding: '0.75rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer',
                        color: activeTab === 'loans' ? '#60a5fa' : '#a1a1aa',
                        fontWeight: activeTab === 'loans' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'loans' ? '2px solid #60a5fa' : '2px solid transparent',
                        fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                >
                    <Landmark size={16} /> Bank Loans & Gadget EMIs
                </button>
                <button
                    onClick={() => handleTabChange('calculator')}
                    style={{
                        padding: '0.75rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer',
                        color: activeTab === 'calculator' ? '#c084fc' : '#a1a1aa',
                        fontWeight: activeTab === 'calculator' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'calculator' ? '2px solid #c084fc' : '2px solid transparent',
                        fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                >
                    <Calculator size={16} /> EMI Calculator
                </button>
            </div>

            {/* TAB 1: PEER-TO-PEER DEBTS */}
            {activeTab === 'peer' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '2rem', padding: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '9px', fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Receivable</span>
                                <div style={{ padding: '0.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                    <ArrowUpRight size={18} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '2rem', fontWeight: '950', color: '#10b981', fontFamily: 'monospace', margin: 0 }}>
                                {formatCurrency(totalLent)}
                            </h3>
                        </div>

                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '2rem', padding: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '9px', fontWeight: '900', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Payable</span>
                                <div style={{ padding: '0.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                                    <ArrowDownLeft size={18} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '2rem', fontWeight: '950', color: '#f87171', fontFamily: 'monospace', margin: 0 }}>
                                {formatCurrency(totalBorrowed)}
                            </h3>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                        {filteredLents.map((item) => (
                            <DebtCard key={item.id} item={item} navigate={navigate} formatCurrency={formatCurrency} />
                        ))}
                    </div>

                    {filteredLents.length === 0 && (
                        <div style={{
                            textAlign: 'center', padding: '4rem 2rem', border: '1px dashed rgba(255,255,255,0.08)',
                            borderRadius: '2rem', backgroundColor: 'rgba(255,255,255,0.01)', width: '100%'
                        }}>
                            <RefreshCcw size={32} style={{ color: '#71717a', marginBottom: '1rem' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 0.5rem 0' }}>No records found</h3>
                            <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>Add a new record to start tracking peer-to-peer debts</p>
                        </div>
                    )}
                </>
            )}

            {/* TAB 2: BANK LOANS & GADGET EMIS */}
            {activeTab === 'loans' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Active Loan Accounts</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', marginTop: '0.5rem' }}>{activeLoanList.length}</h3>
                        </div>

                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Total Principal</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#f87171', marginTop: '0.5rem', fontFamily: 'monospace' }}>{formatCurrency(totalPrincipal)}</h3>
                        </div>

                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Total Monthly EMI</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#60a5fa', marginTop: '0.5rem', fontFamily: 'monospace' }}>{formatCurrency(totalMonthlyEmi)}</h3>
                        </div>

                        <div style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Upfront Fees & GST</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#f59e0b', marginTop: '0.5rem', fontFamily: 'monospace' }}>{formatCurrency(totalFeesGstPaid)}</h3>
                        </div>
                    </div>

                    {activeLoanList.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'rgba(24, 24, 27, 0.4)',
                            borderRadius: '1.5rem', border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <Landmark size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>No Active Loans or EMIs Tracked</h3>
                            <p style={{ color: '#71717a', marginTop: '0.5rem' }}>Click "Add Bank Loan / Gadget EMI" above to track your gadget EMIs, processing fees, GST, and loan payments.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.75rem' }}>
                            {activeLoanList.map(loan => {
                                const payments = loan.payments || [];
                                const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                                const totalTenure = Number(loan.tenureMonths) || 12;

                                const estimatedTotalCost = loan.emiAmount > 0
                                    ? Math.round(loan.emiAmount * totalTenure)
                                    : Number(loan.principalAmount) || 0;

                                const pendingBalance = Math.max(0, estimatedTotalCost - totalPaid);
                                const paidCount = payments.length;
                                const progressPercent = Math.min(100, Math.round((paidCount / totalTenure) * 100));

                                const badge = getLoanTypeBadge(loan.type);
                                const isHistoryOpen = !!expandedHistory[loan.id];

                                const pFee = Number(loan.processingFee) || 0;
                                const gstAmt = Number(loan.gstAmount) || 0;

                                const now = new Date();
                                const currentMonthName = now.toLocaleString('default', { month: 'long' });
                                const isCurrentMonthPaid = payments.some(p => {
                                    if (!p.date) return false;
                                    const parts = p.date.split('-').map(Number);
                                    if (parts.length === 3) {
                                        return parts[0] === now.getFullYear() && (parts[1] - 1) === now.getMonth();
                                    }
                                    const d = new Date(p.date);
                                    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                                });
                                const isCurrentMonthPending = !isCurrentMonthPaid && (pendingBalance > 0);
                                const sortedPayments = [...payments].sort((a, b) => (Number(a.emiNumber) || 0) - (Number(b.emiNumber) || 0));

                                return (
                                    <div
                                        key={loan.id}
                                        style={{
                                            backgroundColor: 'rgba(24, 24, 27, 0.6)',
                                            border: isCurrentMonthPending ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '1.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column',
                                            justifyContent: 'space-between', backdropFilter: 'blur(10px)',
                                            boxShadow: isCurrentMonthPending ? '0 10px 25px -5px rgba(239, 68, 68, 0.08)' : '0 10px 20px -5px rgba(0,0,0,0.4)',
                                            transition: 'border-color 0.2s'
                                        }}
                                    >
                                        <div>
                                            {/* Current Month EMI Pending Banner */}
                                            {isCurrentMonthPending && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '0.4rem 0.75rem', borderRadius: '0.6rem',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#f87171', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.85rem'
                                                }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <AlertTriangle size={14} /> {currentMonthName} EMI Pending
                                                    </span>
                                                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(loan.emiAmount)}</span>
                                                </div>
                                            )}
                                            {/* Top Badge & Actions */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div>
                                                    <span style={{
                                                        fontSize: '0.75rem', fontWeight: 'bold', padding: '0.3rem 0.65rem',
                                                        borderRadius: '0.5rem', backgroundColor: badge.bg, color: badge.text,
                                                        border: `1px solid ${badge.border}`, textTransform: 'uppercase', letterSpacing: '0.05em'
                                                    }}>
                                                        {badge.label}
                                                    </span>
                                                    <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'white', marginTop: '0.6rem', letterSpacing: '-0.02em' }}>
                                                        {loan.name}
                                                    </h3>
                                                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.15rem 0 0 0' }}>
                                                        {loan.lender || 'Bank'} {loan.accountNumber ? `• Account: ${loan.accountNumber}` : ''}
                                                    </p>
                                                </div>

                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button
                                                        onClick={() => handleEditLoan(loan)}
                                                        title="Edit Loan Entry"
                                                        style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0.35rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)' }}
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLoan(loan.id)}
                                                        title="Delete Loan Entry"
                                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.35rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* EMI & Rate Grid */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', padding: '0.85rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.85rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div>
                                                    <span style={{ color: '#71717a', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Monthly EMI</span>
                                                    <span style={{ color: '#60a5fa', fontWeight: '950', fontSize: '1.2rem', fontFamily: 'monospace' }}>{formatCurrency(loan.emiAmount)}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#71717a', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Interest Rate</span>
                                                    <span style={{ color: 'white', fontWeight: '950', fontSize: '1.2rem', fontFamily: 'monospace' }}>{loan.interestRate}% p.a.</span>
                                                </div>
                                            </div>

                                            {/* Financial Overview (Principal vs Outstanding vs Paid) */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                                                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <span style={{ color: '#71717a', fontSize: '0.7rem', display: 'block', uppercase: true }}>Principal</span>
                                                    <span style={{ color: 'white', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(loan.principalAmount)}</span>
                                                </div>
                                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '0.6rem', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                                    <span style={{ color: '#34d399', fontSize: '0.7rem', display: 'block', uppercase: true }}>Paid So Far</span>
                                                    <span style={{ color: '#34d399', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(totalPaid)}</span>
                                                </div>
                                                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '0.6rem', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                                    <span style={{ color: '#f87171', fontSize: '0.7rem', display: 'block', uppercase: true }}>Outstanding</span>
                                                    <span style={{ color: '#f87171', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(pendingBalance)}</span>
                                                </div>
                                            </div>

                                            {/* Tenure Progress Bar */}
                                            <div style={{ marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem' }}>
                                                    <span>EMIs Paid: <strong style={{ color: 'white' }}>{paidCount} of {totalTenure} Months</strong></span>
                                                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{progressPercent}% Completed</span>
                                                </div>
                                                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#60a5fa', transition: 'width 0.3s' }}></div>
                                                </div>
                                            </div>

                                            {/* Processing Fee & GST Tag */}
                                            {(pFee > 0 || gstAmt > 0) && (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '0.6rem', marginBottom: '1rem', color: '#fcd34d' }}>
                                                    <span>Processing Fee: <strong>{formatCurrency(pFee)}</strong></span>
                                                    <span>GST: <strong>{formatCurrency(gstAmt)}</strong></span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Bar */}
                                        <div>
                                            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
                                                <button
                                                    onClick={() => handleOpenPaymentModal(loan)}
                                                    style={{
                                                        flex: 1, padding: '0.6rem 0.85rem', borderRadius: '0.75rem',
                                                        backgroundColor: '#34d399', color: 'black', fontWeight: 'bold',
                                                        fontSize: '0.75rem', border: 'none', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'
                                                    }}
                                                >
                                                    <Plus size={14} /> Record EMI Payment
                                                </button>
                                                <button
                                                    onClick={() => toggleHistory(loan.id)}
                                                    style={{
                                                        padding: '0.6rem 0.85rem', borderRadius: '0.75rem',
                                                        backgroundColor: isHistoryOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                                                        border: '1px solid rgba(255,255,255,0.08)', color: 'white',
                                                        fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '0.35rem'
                                                    }}
                                                >
                                                    <History size={14} /> ({payments.length}) {isHistoryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                            </div>

                                            {/* Expandable Payment History Log */}
                                            {isHistoryOpen && (
                                                <div style={{ marginTop: '1rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0.85rem', padding: '0.85rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#a1a1aa', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>Payment History</span>
                                                        <span>Total Paid: {formatCurrency(totalPaid)}</span>
                                                    </div>

                                                    {payments.length === 0 ? (
                                                        <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0, textAlign: 'center', padding: '0.5rem' }}>No EMI payments recorded yet.</p>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                                                            {sortedPayments.map(p => (
                                                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                                                                    <div>
                                                                        <span style={{ fontWeight: 'bold', color: 'white' }}>EMI #{p.emiNumber} • {formatCurrency(p.amount)}</span>
                                                                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#71717a' }}>{p.date} • {p.paymentMode} {p.creditCardName ? `(${p.creditCardName})` : ''}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                                        <button
                                                                            onClick={() => handleOpenPaymentModal(loan, p)}
                                                                            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0.2rem' }}
                                                                        >
                                                                            <Edit2 size={12} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteLoanPayment(loan, p.id)}
                                                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem' }}
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* TAB 3: STANDALONE EMI CALCULATOR */}
            {activeTab === 'calculator' && (
                <EMICalculator />
            )}

            {/* Modals */}
            {isLentModalOpen && (
                <LentModal
                    isOpen={true}
                    onClose={() => setIsLentModalOpen(false)}
                    defaultType="lent"
                />
            )}

            <LoanModal
                isOpen={isLoanModalOpen}
                onClose={() => setIsLoanModalOpen(false)}
                onSave={handleSaveLoan}
                editingLoan={editingLoan}
            />

            <LoanPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => { setIsPaymentModalOpen(false); setActivePaymentLoan(null); setEditingPayment(null); }}
                onSave={handleSaveLoanPayment}
                loan={activePaymentLoan}
                editingPayment={editingPayment}
            />
        </div>
    );
};

export default LentsAndLoans;
