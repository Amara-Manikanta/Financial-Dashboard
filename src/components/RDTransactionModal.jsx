import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText } from 'lucide-react';
import { toISODate } from '../utils/dateUtils';
import CurrencyInput from './CurrencyInput';

const inputStyle = {
    backgroundColor: '#27272a',
    color: 'white',
    border: '1px solid #3f3f46',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    width: '100%',
    outline: 'none'
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

const RDTransactionModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState({
        date: '',
        amount: '',
        remarks: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    date: toISODate(initialData.date) || '',
                    amount: initialData.amount || '',
                    remarks: initialData.remarks || ''
                });
            } else {
                setFormData({
                    date: toISODate(new Date()) || '',
                    amount: '',
                    remarks: ''
                });
            }
        }
    }, [isOpen, initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData?.id || Date.now(),
            ...formData,
            amount: parseFloat(formData.amount)
        });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#18181b', border: '1px solid #27272a',
                borderRadius: '1rem', width: '100%', maxWidth: '400px',
                position: 'relative', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-lg font-bold text-white">
                        {initialData ? 'Edit Installment' : 'Add Installment'}
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
                        <div className="relative">
                            <input type="date" name="date" required value={formData.date} onChange={handleChange} style={inputStyle} />
                            <Calendar style={iconStyle} />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amount</label>
                        <div className="relative">
                            <CurrencyInput name="amount" required value={formData.amount} onChange={handleChange} style={inputStyle} placeholder="0.00" />
                            <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Remarks (Optional)</label>
                        <div className="relative">
                            <input type="text" name="remarks" value={formData.remarks || ''} onChange={handleChange} style={inputStyle} placeholder="Add notes..." />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-colors mt-2 active:scale-95 shadow-xl shadow-blue-900/40">
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default RDTransactionModal;
