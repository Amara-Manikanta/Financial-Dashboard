import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Hash, FileText, CheckCircle } from 'lucide-react';

// Reuse similar styles to TransactionModal for consistency
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

const MutualFundTransactionModal = ({ isOpen, onClose, onSave, initialData, isEmergencyFund }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('buy');
    const [amount, setAmount] = useState('');
    const [nav, setNav] = useState('');
    const [units, setUnits] = useState('');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setDate(initialData.date);
                setType(initialData.type || 'buy');
                setAmount(initialData.amount);
                setNav(initialData.nav);
                // If units exist, use them. Else calc.
                setUnits(initialData.units || (initialData.amount && initialData.nav ? (initialData.amount / initialData.nav).toFixed(3) : ''));
                setRemarks(initialData.remarks || '');
            } else {
                setDate(new Date().toISOString().split('T')[0]);
                setType('buy');
                setAmount('');
                setNav(isEmergencyFund ? '1' : '');
                setUnits('');
                setRemarks('');
            }
        }
    }, [isOpen, initialData, isEmergencyFund]);

    const handleAmountChange = (e) => {
        const val = e.target.value;
        setAmount(val);
        if (!isEmergencyFund && val && nav) {
            setUnits((parseFloat(val) / parseFloat(nav)).toFixed(3));
        }
    };

    const handleNavChange = (e) => {
        const val = e.target.value;
        setNav(val);
        if (!isEmergencyFund && amount && val) {
            setUnits((parseFloat(amount) / parseFloat(val)).toFixed(3));
        }
    };

    // Allow manual unit override
    const handleUnitsChange = (e) => {
        setUnits(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData?.id || Date.now(),
            date,
            type,
            amount: parseFloat(amount),
            nav: isEmergencyFund ? 1 : parseFloat(nav),
            units: isEmergencyFund ? parseFloat(amount) : parseFloat(units),
            remarks
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
                    <h3 className="text-lg font-bold text-white">{initialData ? 'Edit Transaction' : 'Add Transaction'}</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, paddingLeft: '1rem', appearance: 'none' }}>
                                <option value="buy">{isEmergencyFund ? 'Deposit' : 'Buy'}</option>
                                <option value="sell">{isEmergencyFund ? 'Withdraw' : 'Sell'}</option>
                                {!isEmergencyFund && <option value="sip">SIP</option>}
                            </select>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
                            <div className="relative">
                                <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                                <Calendar style={iconStyle} />
                            </div>
                        </div>
                    </div>

                    <div className={isEmergencyFund ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amount</label>
                            <div className="relative">
                                <input type="number" step="0.01" required value={amount} onChange={handleAmountChange} style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                        {!isEmergencyFund && (
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">NAV</label>
                                <div className="relative">
                                    <input type="number" step="0.0001" required value={nav} onChange={handleNavChange} style={inputStyle} placeholder="NAV" />
                                    <Hash style={iconStyle} />
                                </div>
                            </div>
                        )}
                    </div>

                    {!isEmergencyFund && (
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Units (Calculated)</label>
                            <div className="relative">
                                <input type="number" step="0.001" required value={units} onChange={handleUnitsChange} style={inputStyle} placeholder="Units" />
                                <Hash style={iconStyle} />
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Remarks</label>
                        <div className="relative">
                            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} style={inputStyle} placeholder="Optional" />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors mt-2">
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default MutualFundTransactionModal;
