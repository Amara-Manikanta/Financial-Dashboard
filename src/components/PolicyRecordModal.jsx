import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText, Tag } from 'lucide-react';
import CurrencyInput from './CurrencyInput';

const inputStyle = {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '0.75rem',
    padding: '0.65rem 0.75rem 0.65rem 2.5rem',
    color: 'white',
    fontSize: '0.875rem'
};

const iconStyle = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: '0.75rem',
    pointerEvents: 'none',
    color: '#9ca3af',
    width: '18px',
    height: '18px'
};

/**
 * One modal for both policy benefits and claims. They share a shape — a dated,
 * priced entry that is either still outstanding or settled — so they share a
 * form rather than duplicating one.
 */
const CONFIG = {
    benefit: {
        title: 'Benefit',
        labelField: 'Benefit',
        placeholder: 'e.g. Survival benefit - 5th year',
        kinds: ['Survival Benefit', 'Maturity', 'Bonus', 'Rider Payout', 'Other'],
        statuses: ['Expected', 'Received'],
        settledLabel: 'Received On',
        settledStatus: 'Received'
    },
    claim: {
        title: 'Claim',
        labelField: 'Claim',
        placeholder: 'e.g. Hospitalisation - Apollo',
        kinds: ['Death', 'Hospitalisation', 'Accident', 'Own Damage', 'Theft', 'Other'],
        statuses: ['Filed', 'Under Review', 'Approved', 'Settled', 'Rejected'],
        settledLabel: 'Settled On',
        settledStatus: 'Settled'
    }
};

const PolicyRecordModal = ({ isOpen, onClose, onSave, initialData, kind = 'benefit' }) => {
    const cfg = CONFIG[kind] || CONFIG.benefit;

    const [formData, setFormData] = useState({
        title: '', category: '', date: '', amount: '', status: '', settledDate: '', settledAmount: '', reference: '', notes: ''
    });

    useEffect(() => {
        if (!isOpen) return;
        const today = new Date().toISOString().split('T')[0];
        setFormData({
            title: initialData?.title || '',
            category: initialData?.category || cfg.kinds[0],
            date: initialData?.date || today,
            amount: initialData?.amount ?? '',
            status: initialData?.status || cfg.statuses[0],
            settledDate: initialData?.settledDate || '',
            settledAmount: initialData?.settledAmount ?? '',
            reference: initialData?.reference || '',
            notes: initialData?.notes || ''
        });
    }, [isOpen, initialData, kind]);

    if (!isOpen) return null;

    // Only a concluded entry has a settlement date and amount to record.
    const isSettled = formData.status === cfg.settledStatus || formData.status === 'Approved';

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            amount: Number(formData.amount) || 0,
            settledAmount: isSettled ? (Number(formData.settledAmount) || Number(formData.amount) || 0) : 0,
            settledDate: isSettled ? formData.settledDate : ''
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-modal shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">
                        {initialData ? `Edit ${cfg.title}` : `Add ${cfg.title}`}
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{cfg.labelField}</label>
                        <div className="relative">
                            <input type="text" name="title" required value={formData.title} onChange={handleChange}
                                style={inputStyle} placeholder={cfg.placeholder} />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Type</label>
                            <div className="relative">
                                <select name="category" value={formData.category} onChange={handleChange}
                                    style={{ ...inputStyle, appearance: 'none' }}>
                                    {cfg.kinds.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                                <Tag style={iconStyle} />
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange}
                                style={{ ...inputStyle, paddingLeft: '1rem', appearance: 'none' }}>
                                {cfg.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                                {kind === 'claim' ? 'Claim Date' : 'Due / Expected'}
                            </label>
                            <div className="relative">
                                <input type="date" name="date" required value={formData.date} onChange={handleChange} style={inputStyle} />
                                <Calendar style={iconStyle} />
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                                {kind === 'claim' ? 'Claimed Amount' : 'Amount'}
                            </label>
                            <div className="relative">
                                <CurrencyInput name="amount" required value={formData.amount} onChange={handleChange}
                                    style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                    </div>

                    {isSettled && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{cfg.settledLabel}</label>
                                <div className="relative">
                                    <input type="date" name="settledDate" value={formData.settledDate} onChange={handleChange} style={inputStyle} />
                                    <Calendar style={iconStyle} />
                                </div>
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                                    {kind === 'claim' ? 'Settled Amount' : 'Received Amount'}
                                </label>
                                <div className="relative">
                                    <CurrencyInput name="settledAmount" value={formData.settledAmount} onChange={handleChange}
                                        style={inputStyle} placeholder="Same as above" />
                                    <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                            {kind === 'claim' ? 'Claim No / Remarks' : 'Reference / Remarks'}
                        </label>
                        <div className="relative">
                            <input type="text" name="reference" value={formData.reference} onChange={handleChange}
                                style={inputStyle} placeholder={kind === 'claim' ? 'CLM-12345' : 'Optional'} />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors mt-2">
                        Save {cfg.title}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default PolicyRecordModal;
