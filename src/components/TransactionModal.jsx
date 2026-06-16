import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Calculator, CreditCard, Wallet, Tag, FileText, ChevronDown, Check, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useFinance } from '../context/FinanceContext';
import CurrencyInput from './CurrencyInput';
import { CATEGORY_MAP } from '../utils/categories';

const TransactionModal = ({ isOpen, onClose, onAdd, initialData = null, defaultDate = null }) => {
    // State initialization
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [mainCategory, setMainCategory] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date());
    const [paymentMode, setPaymentMode] = useState('direct');
    const [creditCardName, setCreditCardName] = useState('');
    const [isCredited, setIsCredited] = useState(false);
    const [isCreditCardBill, setIsCreditCardBill] = useState(false);

    const { creditCards, mergedCategoryMap, addCustomCategory } = useFinance();
    const mainCategoriesList = Object.keys(mergedCategoryMap);
    const subCategoriesList = mainCategory ? mergedCategoryMap[mainCategory] : [];

    const availableCreditCards = creditCards && creditCards.length > 0
        ? creditCards.map(c => c.name)
        : ["Scapia", "Amazon", "Icici Rupay", "ICICI HP card"];

    // Sync state with initialData
    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title || '');
            setAmount(initialData.amount || '');

            const initialCat = initialData.category || '';
            let initialMain = initialData.mainCategory || '';
            let properCaseCat = initialCat;

            if (initialMain && mergedCategoryMap[initialMain]) {
                const matched = mergedCategoryMap[initialMain].find(s => s.toLowerCase() === initialCat.toLowerCase());
                if (matched) properCaseCat = matched;
            }

            if (!initialMain && initialCat) {
                for (const [main, subs] of Object.entries(mergedCategoryMap)) {
                    const matched = subs.find(s => s.toLowerCase() === initialCat.toLowerCase());
                    if (matched) {
                        initialMain = main;
                        properCaseCat = matched;
                        break;
                    }
                }
            }
            if (!initialMain && initialCat) initialMain = 'Miscellaneous';

            setMainCategory(initialMain);
            setCategory(properCaseCat);

            setDate(initialData.date ? new Date(initialData.date) : (defaultDate || new Date()));
            setPaymentMode(initialData.paymentMode || 'direct');
            setCreditCardName(initialData.creditCardName || '');
            setIsCredited(!!initialData.isCredited);
            setIsCreditCardBill(initialCat.toLowerCase() === 'credit card bill' || initialCat.toLowerCase() === 'credit card payment');
        } else if (isOpen && !initialData) {
            setTitle('');
            setAmount('');
            setMainCategory('');
            setCategory('');
            setIsCredited(false);
            setDate(defaultDate || new Date());
            setPaymentMode('direct');
            setCreditCardName('');
            setIsCreditCardBill(false);
        }
    }, [initialData, isOpen, defaultDate]);

    // Auto-set credit mode for salary/income (only for NEW transactions, not when editing)
    useEffect(() => {
        if (!initialData && (mainCategory === 'Income' || (category && (category.toLowerCase() === 'salary received' || category.toLowerCase() === 'income')))) {
            setIsCredited(true);
        }
    }, [category, mainCategory, initialData]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleCreditCardBillToggle = () => {
        const newState = !isCreditCardBill;
        setIsCreditCardBill(newState);
        if (newState) {
            setMainCategory('Finance');
            setCategory('Credit Card Bill'); // Must match FinanceContext check for marking card as paid
            setIsCredited(false);
            setPaymentMode('credit_card');
            if (!title) setTitle('Credit Card Bill');
        }
    };

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const parsedAmount = parseFloat(amount);
        if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) return;
        if (paymentMode === 'credit_card' && !creditCardName) return;
        onAdd({
            ...initialData,
            title,
            amount: parsedAmount,
            mainCategory: mainCategory,
            category: category.toLowerCase(),
            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
            deductFromSalary: (paymentMode === 'direct' && !category.toLowerCase().includes('tax')) || category.toLowerCase() === 'credit card bill',
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
                        {initialData ? 'Update Record' : 'Log Transaction'}
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
                                    <CurrencyInput
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

                        {/* Credit Card Bill Toggle */}
                        <div onClick={handleCreditCardBillToggle} className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${isCreditCardBill ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/10' : 'bg-white/2 border-white/5'}`}>
                            <div className="flex items-center gap-3">
                                <CreditCard size={18} className={isCreditCardBill ? 'text-indigo-400' : 'text-gray-500'} />
                                <div>
                                    <span className={`text-[12px] font-bold block ${isCreditCardBill ? 'text-white' : 'text-gray-400'}`}>Paying a Credit Card Bill?</span>
                                    <span className="text-[10px] text-gray-500 mt-0.5 block font-medium">Auto-configures the correct options below</span>
                                </div>
                            </div>
                            <div className={`w-10 h-5 rounded-full p-1 transition-all ${isCreditCardBill ? 'bg-indigo-500' : 'bg-white/10'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transition-all ${isCreditCardBill ? 'translate-x-5' : 'translate-x-0'}`} />
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

                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Main Category</label>
                                <div className="relative group">
                                    <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
                                    <select
                                        required
                                        value={mainCategory}
                                        onChange={(e) => {
                                            if (e.target.value === '__add_custom__') {
                                                const newMain = window.prompt("Enter new Main Category name:");
                                                if (newMain && newMain.trim()) {
                                                    const formattedMain = newMain.trim();
                                                    addCustomCategory(formattedMain);
                                                    setMainCategory(formattedMain);
                                                    setCategory('');
                                                }
                                            } else {
                                                setMainCategory(e.target.value);
                                                setCategory(''); // reset sub category
                                            }
                                        }}
                                        className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-12 text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 focus:bg-[#2c2c2e] transition-all text-sm cursor-pointer"
                                    >
                                        <option value="" disabled className="bg-[#0c0c0e]">Select Main</option>
                                        {mainCategoriesList.map(cat => <option key={cat} value={cat} className="bg-[#0c0c0e] capitalize">{cat}</option>)}
                                        <option value="__add_custom__" className="bg-[#0c0c0e] text-emerald-400 font-bold">+ Add New Main Category</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex-1 space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Sub Category</label>
                                <div className="relative group">
                                    <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
                                    <select
                                        required
                                        value={category}
                                        onChange={(e) => {
                                            if (e.target.value === '__add_custom__') {
                                                const newSub = window.prompt(`Enter new Sub Category for ${mainCategory}:`);
                                                if (newSub && newSub.trim()) {
                                                    const formattedSub = newSub.trim();
                                                    addCustomCategory(mainCategory, formattedSub);
                                                    setCategory(formattedSub);
                                                }
                                            } else {
                                                setCategory(e.target.value);
                                            }
                                        }}
                                        disabled={!mainCategory}
                                        className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-12 text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 focus:bg-[#2c2c2e] transition-all text-sm cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="" disabled className="bg-[#0c0c0e]">{mainCategory ? "Select Sub" : "Select Main First"}</option>
                                        {subCategoriesList.map(cat => <option key={cat} value={cat} className="bg-[#0c0c0e] capitalize">{cat}</option>)}
                                        {mainCategory && <option value="__add_custom__" className="bg-[#0c0c0e] text-emerald-400 font-bold">+ Add New Sub Category</option>}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Transaction Type</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCredited(false)}
                                    className={`flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all ${!isCredited ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-md shadow-indigo-500/10' : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'}`}
                                >
                                    <ArrowDownCircle size={18} />
                                    <span className="text-[11px] font-black tracking-widest uppercase">Debit</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCredited(true)}
                                    className={`flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all ${isCredited ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/10' : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'}`}
                                >
                                    <ArrowUpCircle size={18} />
                                    <span className="text-[11px] font-black tracking-widest uppercase">Credit</span>
                                </button>
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
                                            className="w-full bg-white/10 rounded-lg border border-white/10 text-white font-bold appearance-none focus:outline-none text-xs pl-8 pr-8 py-2"
                                        >
                                            <option value="" disabled className="bg-[#1c1c1e] text-gray-400">Select Card</option>
                                            {availableCreditCards.map(card => <option key={card} value={card} className="bg-[#1c1c1e] text-white">{card}</option>)}
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
