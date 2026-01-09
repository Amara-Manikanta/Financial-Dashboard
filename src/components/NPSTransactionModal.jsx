import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText } from 'lucide-react';

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

const NPSTransactionModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setDate(initialData.date);
                setAmount(initialData.amount || '');
                setRemarks(initialData.remarks || '');
            } else {
                setDate(new Date().toISOString().split('T')[0]);
                setAmount('');
                setRemarks('');
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData?.id || Date.now(),
            date,
            amount: parseFloat(amount || 0),
            remarks,
            type: 'contribution' // NPS transactions are usually contributions
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
                    <h3 className="text-lg font-bold text-white">{initialData ? 'Edit NPS Contribution' : 'Add NPS Contribution'}</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
                        <div className="relative">
                            <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                            <Calendar style={iconStyle} />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amount</label>
                        <div className="relative">
                            <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
                            <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Remarks</label>
                        <div className="relative">
                            <textarea
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                                style={{ ...inputStyle, paddingLeft: '2.5rem', minHeight: '80px', resize: 'none' }}
                                placeholder="Yearly contribution, Bonus, etc."
                            />
                            <FileText style={{ ...iconStyle, top: '20px', transform: 'none' }} />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors mt-2">
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default NPSTransactionModal;
