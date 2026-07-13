import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, ArrowUpRight, ArrowDownLeft, Search, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LentModal from '../components/LentModal';

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
    const { lents, formatCurrency } = useFinance();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, lent, borrowed
    const navigate = useNavigate();

    const totalLent = lents.filter(i => i.type === 'lent').reduce((sum, item) => {
        const pending = (item.amount || 0) + (item.transactions || []).reduce((acc, tx) => {
            if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
            if (tx.type === 'additional') return acc + parseFloat(tx.amount);
            return acc;
        }, 0);
        return sum + pending;
    }, 0);

    const totalBorrowed = lents.filter(i => i.type === 'borrowed').reduce((sum, item) => {
        const pending = (item.amount || 0) + (item.transactions || []).reduce((acc, tx) => {
            if (tx.type === 'repayment') return acc - parseFloat(tx.amount);
            if (tx.type === 'additional') return acc + parseFloat(tx.amount);
            return acc;
        }, 0);
        return sum + pending;
    }, 0);

    const filteredItems = lents.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = filterType === 'all' || item.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Header Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                        Loans & Lents
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.25rem' }}>
                        Manage peer-to-peer debts
                    </p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        cursor: 'pointer'
                    }}
                >
                    <Plus size={16} /> Add Record
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    borderRadius: '2rem',
                    padding: '1.5rem',
                    boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ArrowUpRight size={18} />
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Wait to Receive</span>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>
                        {formatCurrency(totalLent)}
                    </p>
                </div>

                <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(239, 68, 68, 0.1)',
                    borderRadius: '2rem',
                    padding: '1.5rem',
                    boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ArrowDownLeft size={18} />
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Need to Pay</span>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>
                        {formatCurrency(totalBorrowed)}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} size={16} />
                    <input
                        type="text"
                        placeholder="Search debts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem 0.75rem 2.5rem',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '1rem',
                            color: 'white',
                            fontSize: '0.875rem',
                            outline: 'none'
                        }}
                    />
                </div>
                <div style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    padding: '2px',
                    gap: '2px'
                }}>
                    <button
                        onClick={() => setFilterType('all')}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '9px',
                            fontWeight: '900',
                            letterSpacing: '0.05em',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: filterType === 'all' ? 'white' : 'transparent',
                            color: filterType === 'all' ? 'black' : '#71717a',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterType('lent')}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '9px',
                            fontWeight: '900',
                            letterSpacing: '0.05em',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: filterType === 'lent' ? '#10b981' : 'transparent',
                            color: filterType === 'lent' ? 'white' : '#71717a',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        Lent
                    </button>
                    <button
                        onClick={() => setFilterType('borrowed')}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '9px',
                            fontWeight: '900',
                            letterSpacing: '0.05em',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: filterType === 'borrowed' ? '#ef4444' : 'transparent',
                            color: filterType === 'borrowed' ? 'white' : '#71717a',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        Borrowed
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '2rem'
            }}>
                {filteredItems.map(item => (
                    <DebtCard
                        key={item.id}
                        item={item}
                        navigate={navigate}
                        formatCurrency={formatCurrency}
                    />
                ))}
            </div>

            {filteredItems.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    border: '1px dashed rgba(255,255,255,0.08)',
                    borderRadius: '2rem',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    width: '100%'
                }}>
                    <div style={{
                        width: '3.5rem',
                        height: '3.5rem',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <RefreshCcw size={24} style={{ color: '#71717a' }} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 0.5rem 0' }}>No records found</h3>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>Add a new record to start tracking peer-to-peer debts</p>
                </div>
            )}

            {isAddModalOpen && (
                <LentModal
                    isOpen={true}
                    onClose={() => setIsAddModalOpen(false)}
                    defaultType="lent"
                />
            )}
        </div>
    );
};

export default LentsAndLoans;
