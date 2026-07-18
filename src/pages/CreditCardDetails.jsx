import React, { useState, useMemo } from 'react';
import { Plus, CreditCard, Calendar, Building, Trash2, Edit2, ArrowRight } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import CreditCardModal from '../components/CreditCardModal';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

const CreditCardDetails = () => {
    const { creditCards, expenses, addItem, updateItem, deleteItem, formatCurrency } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [deletingCardId, setDeletingCardId] = useState(null);
    const navigate = useNavigate();

    const cardSpendMap = useMemo(() => {
        const map = {};
        if (!expenses) return map;
        Object.values(expenses).forEach(yearData => {
            Object.values(yearData).forEach(monthData => {
                if (!monthData.transactions) return;
                monthData.transactions.forEach(tx => {
                    if (tx.paymentMode === 'credit_card' && tx.creditCardName) {
                        const txName = tx.creditCardName.trim().toLowerCase();
                        if (!map[txName]) map[txName] = { spend: 0, walletBalance: 0 };
                        const cat = (tx.category || '').toLowerCase();
                        const amt = Number(tx.amount) || 0;
                        if (cat === 'credit card bill' || cat === 'credit card payment') {
                            map[txName].spend -= amt;
                        } else {
                            map[txName].spend += tx.isCredited ? -amt : amt;
                            map[txName].walletBalance += tx.isCredited ? amt : -amt;
                        }
                    }
                });
            });
        });
        return map;
    }, [expenses]);

    const getCardSpend = (card) => {
        const aliases = { 'coral rupay': ['icici rupay'], 'hpcl': ['icici hp card'] };
        const cardName = card.name.trim().toLowerCase();
        const knownAliases = aliases[cardName] || [];
        let spend = 0;
        Object.entries(cardSpendMap).forEach(([txName, stats]) => {
            if (txName === cardName || cardName.includes(txName) || txName.includes(cardName) || knownAliases.includes(txName)) {
                // Apply carryForwardBaseline: only count from baseline date
                // (cardSpendMap is pre-aggregated without baseline, so we fall back to per-tx for baseline cards)
                spend += stats.spend;
            }
        });
        return Math.max(0, spend);
    };

    const getWalletBalance = (card) => {
        const cardName = card.name.trim().toLowerCase();
        let balance = 0;
        Object.entries(cardSpendMap).forEach(([txName, stats]) => {
            if (txName === cardName || cardName.includes(txName) || txName.includes(cardName)) {
                balance += stats.walletBalance;
            }
        });
        return balance;
    };

    const handleSave = async (card) => {
        if (editingCard) {
            await updateItem('creditCards', card);
        } else {
            await addItem('creditCards', card);
        }
        setEditingCard(null);
        setIsModalOpen(false);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        setDeletingCardId(id);
    };

    const handleEdit = (e, card) => {
        e.stopPropagation();
        setEditingCard(card);
        setIsModalOpen(true);
    };

    const totalDue = useMemo(() => creditCards.reduce((sum, card) => {
        if (card.type === 'wallet') return sum;
        const billPending = (card.monthlyData || [])
            .filter(m => !m.isPaid)
            .reduce((s, m) => s + (Number(m.billAmount) || 0), 0);
        return sum + (billPending > 0 ? billPending : getCardSpend(card));
    }, 0), [creditCards, expenses]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                        Credit Cards
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Manage your credit cards, billing cycles, and reward points.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.03)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(239, 68, 68, 0.1)',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        boxShadow: '0 4px 15px -3px rgba(239, 68, 68, 0.05)'
                    }}>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Est. Due</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#f87171', fontFamily: 'monospace' }}>
                            {formatCurrency(totalDue)}
                        </span>
                    </div>
                    <button
                        onClick={() => { setEditingCard(null); setIsModalOpen(true); }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '1rem',
                            backgroundColor: '#c084fc',
                            color: 'black',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 4px 10px -2px rgba(192, 132, 252, 0.2)'
                        }}
                    >
                        <Plus size={16} /> Add New Card
                    </button>
                </div>
            </div>

            {/* Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '2rem'
            }}>
                {creditCards.map((card) => {
                    const totalPoints = (card.monthlyData || []).reduce((sum, m) => sum + (Number(m.points) || 0), 0) + (Number(card.manualPoints) || 0);
                    const pendingAmount = (card.monthlyData || [])
                        .filter(m => !m.isPaid)
                        .reduce((sum, m) => sum + (Number(m.billAmount) || 0), 0);

                    const currentSpend = getCardSpend(card);
                    const displayDue = pendingAmount > 0 ? pendingAmount : currentSpend;
                    const isUnbilled = pendingAmount <= 0;

                    const getBankConfig = (name) => {
                        const n = (name || '').toLowerCase();
                        if (n.includes('icici')) return { gradient: 'from-[#f37e10] to-[#d84e0e]', initials: 'ICICI', accent: '#f37e10' };
                        if (n.includes('federal')) return { gradient: 'from-[#E1A400] to-[#B8860B]', initials: 'FED', accent: '#E1A400' };
                        if (n.includes('hdfc')) return { gradient: 'from-[#004c8f] to-[#003366]', initials: 'HDFC', accent: '#004c8f' };
                        if (n.includes('sbi')) return { gradient: 'from-[#0092dd] to-[#005a8b]', initials: 'SBI', accent: '#0092dd' };
                        if (n.includes('axis')) return { gradient: 'from-[#97144d] to-[#7f1141]', initials: 'AXIS', accent: '#97144d' };
                        if (n.includes('kotak')) return { gradient: 'from-[#ed1c24] to-[#c4161c]', initials: 'KOTAK', accent: '#ed1c24' };
                        if (n.includes('idfc')) return { gradient: 'from-[#9f2536] to-[#7d1d2b]', initials: 'IDFC', accent: '#9f2536' };
                        if (n.includes('amex')) return { gradient: 'from-[#2671b9] to-[#1e5a94]', initials: 'AMEX', accent: '#2671b9' };
                        return { gradient: 'from-gray-700 to-gray-800', initials: <CreditCard style={{ color: 'rgba(255,255,255,0.8)' }} size={20} />, accent: '#a855f7' };
                    };

                    const bankParams = getBankConfig(card.bankName);

                    return (
                        <div
                            key={card.id}
                            onClick={() => navigate(`/credit-cards/${card.id}`)}
                            style={{
                                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '2rem',
                                padding: '1.75rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                height: '280px',
                                cursor: 'pointer',
                                transition: 'transform 0.2s, border-color 0.2s',
                                boxShadow: `0 10px 20px -5px rgba(192, 132, 252, 0.05)`,
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{
                                    width: '2.5rem',
                                    height: '2.5rem',
                                    borderRadius: '1rem',
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '9px',
                                    fontWeight: '900',
                                    color: 'white',
                                    textTransform: 'uppercase'
                                }}>
                                    {bankParams.initials}
                                </div>
                                <div style={{ display: 'flex', gap: '0.375rem' }} className="card-actions">
                                    <button
                                        onClick={(e) => handleEdit(e, card)}
                                        style={{
                                            padding: '0.375rem',
                                            borderRadius: '0.5rem',
                                            border: 'none',
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            color: '#71717a',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = '#71717a'}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, card.id)}
                                        style={{
                                            padding: '0.375rem',
                                            borderRadius: '0.5rem',
                                            border: 'none',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            color: '#f87171',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ margin: '1rem 0' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>{card.name}</h3>
                                {card.bankName && (
                                    <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Building size={12} /> {card.bankName}
                                    </p>
                                )}
                            </div>

                            {card.type === 'wallet' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available</span>
                                        <p style={{ fontSize: '1rem', fontWeight: '950', color: '#34d399', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(getWalletBalance(card))}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-Load</span>
                                        <p style={{ fontSize: '1rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>
                                            {card.autoCredit ? formatCurrency(card.autoCredit.amount) : 'Manual'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Limit</span>
                                        <p style={{ fontSize: '1rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(card.creditLimit)}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: displayDue > 0 ? '#f87171' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isUnbilled ? 'Unbilled' : 'To Pay'}</span>
                                        <p style={{ fontSize: '1rem', fontWeight: '950', color: displayDue > 0 ? '#f87171' : '#34d399', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(displayDue)}</p>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: '#71717a' }}>
                                <span style={{ fontFamily: 'monospace', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                                    {card.type === 'wallet' ? 'Wallet' : card.last4Digits ? `•••• ${card.last4Digits}` : 'Card'}
                                </span>
                                {card.type !== 'wallet' && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#c084fc', fontWeight: 'bold' }}>
                                        <Calendar size={12} /> Due: {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} {new Date().toLocaleString('default', { month: 'short' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Add New Card Blank State */}
                {creditCards.length === 0 && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.2)',
                            border: '2px dashed rgba(255, 255, 255, 0.08)',
                            borderRadius: '2rem',
                            height: '280px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1rem',
                            color: '#71717a',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.5)';
                            e.currentTarget.style.color = '#c084fc';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.color = '#71717a';
                        }}
                    >
                        <div style={{
                            width: '3.5rem',
                            height: '3.5rem',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Plus size={24} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 'bold' }}>Add your first credit card</p>
                    </button>
                )}
            </div>

            <CreditCardModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingCard}
            />
            <ConfirmModal
                isOpen={!!deletingCardId}
                onClose={() => setDeletingCardId(null)}
                onConfirm={async () => { await deleteItem('creditCards', deletingCardId); setDeletingCardId(null); }}
                title="Delete Card"
                message="Are you sure you want to delete this credit card? All associated data will be lost."
                confirmText="Delete"
            />
        </div>
    );
};

export default CreditCardDetails;
