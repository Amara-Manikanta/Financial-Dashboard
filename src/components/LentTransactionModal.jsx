import React, { useState, useEffect } from 'react';
import { X, Calendar, IndianRupee, FileText, ArrowRightLeft } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import CurrencyInput from './CurrencyInput';

const LentTransactionModal = ({ isOpen, onClose, person, editTransaction = null }) => {
    const { updateItem } = useFinance();
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'repayment', // 'repayment' | 'additional'
        description: ''
    });

    useEffect(() => {
        if (editTransaction) {
            setFormData({
                amount: editTransaction.amount,
                date: editTransaction.date,
                type: editTransaction.type,
                description: editTransaction.description || ''
            });
        }
    }, [editTransaction]);

    const isLent = person?.type === 'lent';

    const handleSubmit = async (e) => {
        e.preventDefault();

        let updatedTransactions;

        if (editTransaction) {
            updatedTransactions = person.transactions.map(t =>
                t.id === editTransaction.id ? {
                    ...t,
                    amount: parseFloat(formData.amount),
                    date: formData.date,
                    type: formData.type,
                    description: formData.description
                } : t
            );
        } else {
            const newTransaction = {
                id: Date.now().toString(),
                amount: parseFloat(formData.amount),
                date: formData.date,
                type: formData.type,
                description: formData.description
            };
            updatedTransactions = [...(person.transactions || []), newTransaction];
        }

        const updatedPerson = {
            ...person,
            transactions: updatedTransactions
        };

        await updateItem('lents', updatedPerson);
        onClose();
    };

    if (!isOpen || !person) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-lg font-bold text-white">
                        {editTransaction ? 'Edit Transaction' : `Add Transaction for ${person.name}`}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'repayment' })}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.type === 'repayment'
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <span className="text-sm font-semibold">
                                {isLent ? 'Received Payment' : 'You Paid Back'}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'additional' })}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.type === 'additional'
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <span className="text-sm font-semibold">
                                {isLent ? 'Lent More' : 'Borrowed More'}
                            </span>
                        </button>
                    </div>

                    {/* Amount */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 uppercase">Amount</label>
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <CurrencyInput
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                className="w-full border border-zinc-700 rounded-xl pl-10 pr-4 py-3 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Date */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 uppercase">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                className="w-full border border-zinc-700 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 uppercase">Notes (Optional)</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                className="w-full border border-zinc-700 rounded-xl pl-10 pr-4 py-3 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors min-h-[80px]"
                                placeholder="Details about this transaction..."
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold text-white shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transition-all"
                    >
                        {editTransaction ? 'Update Transaction' : 'Save Transaction'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LentTransactionModal;
