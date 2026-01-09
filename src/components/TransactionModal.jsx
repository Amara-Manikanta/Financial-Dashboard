import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Calculator, CreditCard, Wallet, Tag, FileText, ChevronDown, Check, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useFinance } from '../context/FinanceContext';

const TransactionModal = ({ isOpen, onClose, onAdd, initialData = null }) => {
    // State initialization
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date());
    const [deductFromSalary, setDeductFromSalary] = useState(true);
    const [paymentMode, setPaymentMode] = useState('direct');
    const [creditCardName, setCreditCardName] = useState('');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [isCredited, setIsCredited] = useState(false);

    const { categories } = useFinance();

    const creditCards = ["Scapia", "Amazon", "Icici Rupay", "ICICI HP card"];

    // Sync state with initialData
    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title || '');
            setAmount(initialData.amount || '');

            const initialCat = initialData.category || '';
            const isKnown = categories.some(c => c.toLowerCase() === initialCat.toLowerCase());

            setCategory(initialCat);
            setIsCustomCategory(!!initialCat && !isKnown);

            setDate(initialData.date ? new Date(initialData.date) : new Date());
            setDeductFromSalary(initialData.deductFromSalary !== false);
            setPaymentMode(initialData.paymentMode || 'direct');
            setCreditCardName(initialData.creditCardName || '');
            setIsCredited(!!initialData.isCredited);
        } else if (isOpen && !initialData) {
            setTitle('');
            setAmount('');
            setCategory('');
            setIsCustomCategory(false);
            setIsCredited(false);
            setDate(new Date());
            setDeductFromSalary(true);
            setPaymentMode('direct');
            setCreditCardName('');
        }
    }, [initialData, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd({
            ...initialData,
            title,
            amount: parseFloat(amount),
            category: category.toLowerCase(),
            date: date.toISOString().split('T')[0],
            deductFromSalary,
            paymentMode,
            creditCardName: paymentMode === 'credit_card' ? creditCardName : null,
            isCredited,
            transactionType: isCredited ? 'credit' : 'debit',
            type: 'monthly'
        });
        onClose();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-sm bg-modal rounded-[40px] overflow-hidden border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] animate-slide-up flex flex-col"
                style={{ maxHeight: '82vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 pb-4 border-b border-white/5">
                    <button
                        onClick={onClose}
                        className="absolute right-5 top-6 p-2 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                    >
                        <X size={18} />
                    </button>

                    <h2 className="text-xl font-black text-white tracking-tight">
                        {initialData ? 'Update Record' : 'Log Expense'}
                    </h2>
                    <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-wider">
                        Enter transaction details below
                    </p>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar pb-10">
                    <form id="transaction-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Amount</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-lg">₹</span>
                                    <input
                                        type="number"
                                        required
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-10 pr-4 text-white font-bold text-xl placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 focus:bg-[#2c2c2e] transition-all"
                                        placeholder="0"
                                        autoFocus={!initialData}
                                    />
                                </div>
                            </div>
                            <div className="w-[140px] space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Date</label>
                                <div className="relative group">
                                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <DatePicker
                                        selected={date}
                                        onChange={(date) => setDate(date)}
                                        dateFormat="dd/MM/yy"
                                        className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-white font-bold text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-[#2c2c2e] transition-all"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Reference Name</label>
                            <div className="relative group">
                                <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-white font-bold text-sm placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 focus:bg-[#2c2c2e] transition-all"
                                    placeholder="Enter reference..."
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Category</label>
                            {isCustomCategory ? (
                                <div className="relative group">
                                    <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <input
                                        type="text"
                                        required
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-12 text-white font-bold text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-[#2c2c2e] transition-all"
                                        placeholder="Enter custom category"
                                    />
                                    <button type="button" onClick={() => setIsCustomCategory(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative group">
                                    <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
                                    <select
                                        required
                                        value={category}
                                        onChange={(e) => {
                                            if (e.target.value === '__custom__') setIsCustomCategory(true);
                                            else setCategory(e.target.value);
                                        }}
                                        className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-12 text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 focus:bg-[#2c2c2e] transition-all text-sm cursor-pointer"
                                    >
                                        <option value="" disabled className="bg-[#0c0c0e]">Select Category</option>
                                        {categories.map(cat => <option key={cat} value={cat} className="bg-[#0c0c0e] capitalize">{cat}</option>)}
                                        <option value="__custom__" className="bg-[#0c0c0e] text-emerald-400 font-bold">+ Add New Category</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Transaction Type</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCredited(false)}
                                    className={`flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all ${!isCredited ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-md shadow-indigo-500/10' : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'}`}
                                >
                                    <ArrowUpCircle size={18} />
                                    <span className="text-[11px] font-black tracking-widest uppercase">Debit</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCredited(true)}
                                    className={`flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all ${isCredited ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/10' : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'}`}
                                >
                                    <ArrowDownCircle size={18} />
                                    <span className="text-[11px] font-black tracking-widest uppercase">Credit</span>
                                </button>
                            </div>
                        </div>

                        <div onClick={() => setDeductFromSalary(!deductFromSalary)} className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${deductFromSalary ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/2 border-white/5'}`}>
                            <div className="flex items-center gap-3">
                                <Calculator size={16} className={deductFromSalary ? 'text-emerald-400' : 'text-gray-500'} />
                                <span className={`text-[11px] font-bold ${deductFromSalary ? 'text-white' : 'text-gray-500'}`}>{isCredited ? 'Add to Salary' : 'Deduct from Salary'}</span>
                            </div>
                            <div className={`w-8 h-4 rounded-full p-1 transition-all ${deductFromSalary ? 'bg-emerald-500' : 'bg-white/10'}`}>
                                <div className={`w-2 h-2 bg-white rounded-full transition-all ${deductFromSalary ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Method</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMode('direct')}
                                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl border transition-all ${paymentMode === 'direct' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/10' : 'bg-white/5 border-white/10 text-gray-600'}`}
                                >
                                    <Wallet size={14} />
                                    <span className="text-[10px] font-black tracking-widest">UPI</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMode('credit_card')}
                                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl border transition-all ${paymentMode === 'credit_card' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-md shadow-indigo-500/10' : 'bg-white/5 border-white/10 text-gray-600'}`}
                                >
                                    <CreditCard size={14} />
                                    <span className="text-[10px] font-black tracking-widest">CARD</span>
                                </button>
                            </div>

                            {paymentMode === 'credit_card' && (
                                <div className="animate-slide-up bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                                    <div className="relative">
                                        <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                                        <select
                                            required
                                            value={creditCardName}
                                            onChange={(e) => setCreditCardName(e.target.value)}
                                            className="w-full bg-transparent border-none text-white font-bold appearance-none focus:outline-none text-xs pl-8 pr-8"
                                        >
                                            <option value="" disabled className="bg-[#0c0c0e]">Select Card</option>
                                            {creditCards.map(card => <option key={card} value={card} className="bg-[#0c0c0e]">{card}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-indigo-400" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="p-6 bg-[#0c0c0e] border-t border-white/5 flex items-center gap-4 sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-14 rounded-2xl border border-white/10 bg-white/5 text-gray-300 font-bold hover:bg-white/10 hover:text-white transition-all text-xs uppercase tracking-widest"
                    >
                        Cancel
                    </button>
                    <button
                        form="transaction-form"
                        type="submit"
                        className="flex-[2] h-14 rounded-2xl bg-emerald-500 text-white font-black hover:bg-emerald-400 transition-all text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TransactionModal;
