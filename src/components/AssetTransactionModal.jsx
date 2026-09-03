import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import CurrencyInput from './CurrencyInput';
import { ENTRY_KINDS, kindOf, parsePeriod, formatPeriod } from '../utils/rental';

const AssetTransactionModal = ({ isOpen, onClose, onSave, initialData, isRealEstate = false }) => {
    const blank = () => ({
        date: new Date().toISOString().split('T')[0],
        kind: isRealEstate ? 'rent' : 'other_income',
        type: 'income',
        amount: '',
        period: '',
        description: '',
    });

    const [formData, setFormData] = useState(blank);

    useEffect(() => {
        if (initialData) {
            setFormData({ ...blank(), ...initialData, kind: kindOf(initialData) });
        } else {
            setFormData(blank());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            // The kind decides the direction, so income/expense stays consistent
            // with it and older entries keep working off `type` alone.
            if (name === 'kind') next.type = ENTRY_KINDS[value]?.direction || 'income';
            return next;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const kind = formData.kind || 'other_income';
        onSave({
            ...formData,
            kind,
            type: ENTRY_KINDS[kind]?.direction || 'income',
            amount: Number(formData.amount),
            // Stored as YYYY-MM whatever was typed. `<input type="month">` gives
            // that already in Chrome, but Safari has no such input type and
            // renders a plain text box — an entry made there stored "August
            // 2026", which the rent ledger could not match to any month, so a
            // month that had been paid showed as short by the full rent.
            period: kind === 'rent' ? (parsePeriod(formData.period) || '') : '',
            id: initialData?.id || Date.now().toString(),
        });
    };

    /** What the typed period resolves to, so an unreadable one is visible. */
    const periodKey = parsePeriod(formData.period);

    if (!isOpen) return null;

    const kindOptions = isRealEstate
        ? Object.entries(ENTRY_KINDS)
        : Object.entries(ENTRY_KINDS).filter(([k]) => k.startsWith('other') || k === 'maintenance');

    const activeKind = ENTRY_KINDS[formData.kind] || ENTRY_KINDS.other_income;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl scale-100 animate-scale-in">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        {initialData ? 'Edit Entry' : 'Add Entry'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">What is this?</label>
                        <select
                            name="kind"
                            value={formData.kind}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                        >
                            {kindOptions.map(([key, meta]) => (
                                <option key={key} value={key} className="bg-gray-900">{meta.label}</option>
                            ))}
                        </select>
                        <p className="text-[11px] mt-1.5" style={{ color: activeKind.color }}>
                            {activeKind.direction === 'income' ? 'Money received' : 'Money paid out'}
                            {activeKind.countsAsYield === false && ' · held on the tenant\'s behalf, not counted as return'}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                required
                            />
                        </div>
                        {formData.kind === 'rent' && (
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Rent for month</label>
                                <input
                                    type="month"
                                    name="period"
                                    value={formData.period}
                                    onChange={handleChange}
                                    placeholder="2026-08"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                />
                                {/* Confirmed back in words. In Safari this is a
                                    plain text box, so without an echo there is
                                    nothing to tell a typo from a valid month
                                    until the rent ledger quietly reports the
                                    month unpaid. */}
                                {formData.period ? (
                                    <p className={`text-[11px] mt-1 ${periodKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {periodKey
                                            ? `Counted against ${formatPeriod(periodKey)}`
                                            : 'Not a month I can read — try 2026-08 or August 2026'}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Which month the rent covers, not when it was paid
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                            <CurrencyInput
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 h-20 resize-none"
                            placeholder="e.g., paid by UPI, meter reading 4821..."
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-gray-300 font-medium hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            {initialData ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssetTransactionModal;
