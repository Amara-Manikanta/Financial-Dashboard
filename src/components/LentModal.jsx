import React, { useState, useEffect } from 'react';

import { X, IndianRupee, User, FileText } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import CurrencyInput from './CurrencyInput';

const LentModal = ({ isOpen, onClose, editItem = null }) => {
    const { addItem, updateItem } = useFinance();
    const [formData, setFormData] = useState({
        name: '',
        type: 'lent', // 'lent' or 'borrowed'
        amount: '',
        description: ''
    });

    useEffect(() => {
        if (editItem) {
            setFormData({
                name: editItem.name || '',
                type: editItem.type || 'lent',
                amount: editItem.amount || '',
                description: editItem.description || ''
            });
        }
    }, [editItem]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const itemData = {
            id: editItem ? editItem.id : Date.now().toString(),
            name: formData.name,
            type: formData.type,
            amount: parseFloat(formData.amount),
            description: formData.description,
            transactions: editItem ? editItem.transactions : [],
            created: editItem ? editItem.created : new Date().toISOString()
        };

        if (editItem) {
            await updateItem('lents', itemData);
        } else {
            await addItem('lents', itemData);
        }
        onClose();
    };

    if (!isOpen && !editItem) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-lg font-bold text-white">
                        {editItem ? 'Edit Details' : 'Add New Person'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 uppercase">Person Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                className="w-full border border-zinc-700 rounded-xl pl-10 pr-4 py-3 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                    </div>

                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'lent' })}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.type === 'lent'
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <span className="text-sm font-semibold">You Lent</span>
                            <span className="text-[10px] opacity-80">You gave money</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'borrowed' })}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.type === 'borrowed'
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <span className="text-sm font-semibold">You Borrowed</span>
                            <span className="text-[10px] opacity-80">You received money</span>
                        </button>
                    </div>

                    {/* Amount */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 uppercase">Principal Amount</label>
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

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 uppercase">Description (Optional)</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                className="w-full border border-zinc-700 rounded-xl pl-10 pr-4 py-3 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors min-h-[80px]"
                                placeholder="Add notes..."
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold text-white shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transition-all"
                    >
                        {editItem ? 'Save Changes' : 'Add Person'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LentModal;
