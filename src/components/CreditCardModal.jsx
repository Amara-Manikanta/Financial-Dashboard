import React, { useState, useEffect } from 'react';
import { X, Calendar, CreditCard, DollarSign, Building } from 'lucide-react';
import CurrencyInput from './CurrencyInput';

const CreditCardModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [name, setName] = useState('');
    const [last4Digits, setLast4Digits] = useState('');
    const [bankName, setBankName] = useState('');
    const [billingDay, setBillingDay] = useState('');
    const [creditLimit, setCreditLimit] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name);
            setLast4Digits(initialData.last4Digits || '');
            setBankName(initialData.bankName || '');
            setBillingDay(initialData.billingDay || '');
            setCreditLimit(initialData.creditLimit || '');
        } else {
            setName('');
            setLast4Digits('');
            setBankName('');
            setBillingDay('');
            setCreditLimit('');
        }
        setError('');
    }, [isOpen, initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!name) {
            setError('Please enter a card name.');
            return;
        }

        const newCard = {
            id: initialData ? initialData.id : Date.now().toString(),
            name,
            last4Digits,
            bankName,
            billingDay: Number(billingDay),
            creditLimit: Number(creditLimit),
            monthlyData: initialData ? initialData.monthlyData : []
        };

        onSave(newCard);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <CreditCard className="text-purple-400" />
                        {initialData ? 'Edit Credit Card' : 'Add Credit Card'}
                    </h2>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Card Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. HDFC Regalia"
                                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                                style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Bank Name</label>
                            <div className="relative">
                                <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    placeholder="e.g. HDFC Bank"
                                    className="w-full bg-gray-800 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                                    style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400 ml-1">Last 4 Digits</label>
                                <input
                                    type="text"
                                    maxLength="4"
                                    value={last4Digits}
                                    onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, ''))}
                                    placeholder="1234"
                                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                                    style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400 ml-1">Billing Day</label>
                                <div className="relative">
                                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={billingDay}
                                        onChange={(e) => setBillingDay(e.target.value)}
                                        placeholder="e.g. 25"
                                        className="w-full bg-gray-800 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                                        style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Credit Limit</label>
                            <CurrencyInput
                                value={creditLimit}
                                onChange={(e) => setCreditLimit(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                                style={{ backgroundColor: '#27272a', color: '#ffffff' }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl mt-6 transition-colors shadow-lg shadow-purple-900/40"
                        >
                            {initialData ? 'Update Card' : 'Add Card'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreditCardModal;
