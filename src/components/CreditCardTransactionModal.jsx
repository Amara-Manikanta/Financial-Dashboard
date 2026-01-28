import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, CheckCircle, Award } from 'lucide-react';
import CurrencyInput from './CurrencyInput';

const CreditCardTransactionModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [month, setMonth] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [points, setPoints] = useState('');
    const [billAmount, setBillAmount] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    const [paidDate, setPaidDate] = useState('');
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            setMonth(initialData.month);
            setYear(initialData.year.toString());
            setPoints(initialData.points || '');
            setBillAmount(initialData.billAmount || '');
            setIsPaid(initialData.isPaid || false);
            setPaidDate(initialData.paidDate || '');
            setRemarks(initialData.remarks || '');
        } else {
            const currentMonth = new Date().toLocaleString('default', { month: 'long' });
            setMonth(currentMonth);
            setYear(new Date().getFullYear().toString());
            setPoints('');
            setBillAmount('');
            setIsPaid(false);
            setPaidDate('');
            setRemarks('');
        }
        setError('');
    }, [isOpen, initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!month || !year) {
            setError('Please select month and year.');
            return;
        }

        const transaction = {
            id: initialData ? initialData.id : Date.now().toString(),
            month,
            year: Number(year),
            points: Number(points) || 0,
            billAmount: Number(billAmount) || 0,
            isPaid,
            paidDate,
            remarks
        };

        onSave(transaction);
        onClose();
    };

    if (!isOpen) return null;

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-6 text-white">
                        {initialData ? 'Edit Monthly Data' : 'Add Monthly Data'}
                    </h2>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400 ml-1">Month</label>
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="w-full bg-[#27272a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none"
                                >
                                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400 ml-1">Year</label>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="w-full bg-[#27272a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1 flex items-center gap-2">
                                <Award size={14} className="text-amber-400" /> Points Earned
                            </label>
                            <input
                                type="number"
                                value={points}
                                onChange={(e) => setPoints(e.target.value)}
                                placeholder="0"
                                className="w-full bg-[#27272a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Bill Amount</label>
                            <CurrencyInput
                                value={billAmount}
                                onChange={setBillAmount}
                                placeholder="0.00"
                                className="w-full bg-[#27272a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                            />
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/5 cursor-pointer" onClick={() => setIsPaid(!isPaid)}>
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isPaid ? 'bg-green-500 border-green-500' : 'border-gray-500'}`}>
                                {isPaid && <CheckCircle size={14} className="text-white" />}
                            </div>
                            <span className="text-white font-medium select-none">Mark Bill as Paid</span>
                        </div>

                        {isPaid && (
                            <div className="space-y-2 animate-fade-in-up">
                                <label className="text-sm font-medium text-gray-400 ml-1">Paid Date</label>
                                <div className="relative">
                                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="date"
                                        value={paidDate}
                                        onChange={(e) => setPaidDate(e.target.value)}
                                        className="w-full bg-[#27272a] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Remarks</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Add notes..."
                                rows="2"
                                className="w-full bg-[#27272a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6 transition-colors shadow-lg shadow-blue-900/40"
                        >
                            {initialData ? 'Update Record' : 'Add Record'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreditCardTransactionModal;
