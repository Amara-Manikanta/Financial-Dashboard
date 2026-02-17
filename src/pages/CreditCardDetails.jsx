import React, { useState } from 'react';
import { Plus, CreditCard, Calendar, Building, Trash2, Edit2, ArrowRight } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import CreditCardModal from '../components/CreditCardModal';
import { useNavigate } from 'react-router-dom';

const CreditCardDetails = () => {
    const { creditCards, expenses, addItem, updateItem, deleteItem, formatCurrency } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const navigate = useNavigate();

    const getCardSpend = (card) => {
        let spend = 0;
        const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
        const currentYearStr = new Date().getFullYear().toString();

        if (expenses) {
            const yearData = expenses[currentYearStr];
            if (yearData && yearData[currentMonthName] && yearData[currentMonthName].transactions) {
                yearData[currentMonthName].transactions.forEach(tx => {
                    if (tx.paymentMode === 'credit_card' && tx.creditCardName) {
                        const txName = tx.creditCardName.trim().toLowerCase();
                        const cardName = card.name.trim().toLowerCase();
                        const aliases = { 'coral rupay': ['icici rupay'], 'hpcl': ['icici hp card'] };
                        const knownAliases = aliases[cardName] || [];

                        if (txName === cardName || cardName.includes(txName) || txName.includes(cardName) || knownAliases.includes(txName)) {
                            if (tx.category === 'credit card bill' && tx.deductFromSalary) {
                                spend -= Number(tx.amount);
                            } else {
                                spend += (tx.isCredited ? -Number(tx.amount) : Number(tx.amount));
                            }
                        }
                    }
                });
            }
        }
        return spend;
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
        if (window.confirm('Are you sure you want to delete this credit card?')) {
            await deleteItem('creditCards', id);
        }
    };

    const handleEdit = (e, card) => {
        e.stopPropagation();
        setEditingCard(card);
        setIsModalOpen(true);
    };

    const totalDue = creditCards.reduce((sum, card) => {
        const billPending = (card.monthlyData || [])
            .filter(m => !m.isPaid)
            .reduce((s, m) => s + (Number(m.billAmount) || 0), 0);
        return sum + (billPending > 0 ? billPending : getCardSpend(card));
    }, 0);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight">
                        Credit Cards
                        <span className="text-purple-500">.</span>
                    </h1>
                    <p className="text-secondary mt-2">Manage your credit cards, billing cycles, and reward points.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl flex flex-col items-end">
                        <span className="text-xs text-red-300 font-bold uppercase tracking-wider">Total Est. Due</span>
                        <span className="text-2xl font-black text-red-400">
                            {formatCurrency(totalDue)}
                        </span>
                    </div>
                    <button
                        onClick={() => { setEditingCard(null); setIsModalOpen(true); }}
                        className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-purple-900/40 hover:scale-105 active:scale-95"
                    >
                        <Plus size={20} />
                        <span>Add New Card</span>
                    </button>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {creditCards.map((card) => {
                    const totalPoints = (card.monthlyData || []).reduce((sum, m) => sum + (Number(m.points) || 0), 0);
                    const pendingAmount = (card.monthlyData || [])
                        .filter(m => !m.isPaid)
                        .reduce((sum, m) => sum + (Number(m.billAmount) || 0), 0);

                    const currentSpend = getCardSpend(card);
                    const displayDue = pendingAmount > 0 ? pendingAmount : currentSpend;
                    const isUnbilled = pendingAmount <= 0;

                    const getBankConfig = (name) => {
                        const n = (name || '').toLowerCase();
                        if (n.includes('icici')) return { gradient: 'from-[#f37e10] to-[#d84e0e]', initials: 'ICICI' }; // ICICI Orange
                        if (n.includes('federal')) return { gradient: 'from-[#E1A400] to-[#B8860B]', initials: 'FED' }; // Federal Gold
                        if (n.includes('hdfc')) return { gradient: 'from-[#004c8f] to-[#003366]', initials: 'HDFC' }; // HDFC Blue
                        if (n.includes('sbi')) return { gradient: 'from-[#0092dd] to-[#005a8b]', initials: 'SBI' }; // SBI Blue
                        if (n.includes('axis')) return { gradient: 'from-[#97144d] to-[#7f1141]', initials: 'AXIS' }; // Axis Burgundy
                        if (n.includes('kotak')) return { gradient: 'from-[#ed1c24] to-[#c4161c]', initials: 'KOTAK' }; // Kotak Red
                        if (n.includes('idfc')) return { gradient: 'from-[#9f2536] to-[#7d1d2b]', initials: 'IDFC' }; // IDFC Red
                        if (n.includes('amex')) return { gradient: 'from-[#2671b9] to-[#1e5a94]', initials: 'AMEX' }; // Amex Blue
                        return { gradient: 'from-gray-700 to-gray-800', initials: <CreditCard className="text-white/80" size={24} /> };
                    };

                    const bankParams = getBankConfig(card.bankName);

                    return (
                        <div
                            key={card.id}
                            onClick={() => navigate(`/credit-cards/${card.id}`)}
                            className="bg-[#18181b] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all cursor-pointer shadow-xl"
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${bankParams.gradient} opacity-10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:opacity-20`} />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${bankParams.gradient} flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform shadow-lg`}>
                                        {typeof bankParams.initials === 'string' ? (
                                            <span className="font-black text-white text-[10px] tracking-wider">{bankParams.initials}</span>
                                        ) : (
                                            bankParams.initials
                                        )}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleEdit(e, card)}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, card.id)}
                                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">{card.name}</h3>
                                {card.bankName && (
                                    <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
                                        <Building size={14} />
                                        {card.bankName}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 my-6">
                                    <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                        <p className="text-xs text-secondary uppercase tracking-wider mb-1">Limit</p>
                                        <p className="font-mono font-bold text-white">{formatCurrency(card.creditLimit)}</p>
                                    </div>
                                    <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                        <p className="text-xs text-secondary uppercase tracking-wider mb-1">{isUnbilled ? 'Unbilled' : 'To Pay'}</p>
                                        <p className={`font-mono font-bold flex items-center gap-1 ${displayDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {formatCurrency(displayDue)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <div className="font-mono bg-white/5 px-2 py-1 rounded">
                                            •••• {card.last4Digits}
                                        </div>
                                    </div>
                                    {card.billingDay && (
                                        <div className="flex items-center gap-1.5 text-purple-400">
                                            <Calendar size={14} />
                                            <span>Bill Day: {card.billingDay}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Add New Card Blank State if empty */}
                {creditCards.length === 0 && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#18181b] border-2 border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-gray-500 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group h-[300px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus size={32} />
                        </div>
                        <p className="font-medium">Add your first credit card</p>
                    </button>
                )}
            </div>

            <CreditCardModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingCard}
            />
        </div >
    );
};

export default CreditCardDetails;
