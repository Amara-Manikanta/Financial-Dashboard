import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Hash, FileText, CheckCircle } from 'lucide-react';
import CurrencyInput from './CurrencyInput';

// Reuse similar styles to TransactionModal for consistency
const inputStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '1rem',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    width: '100%',
    outline: 'none',
    transition: 'all 0.3s ease',
    fontSize: '0.875rem'
};

const iconStyle = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: '0.75rem',
    pointerEvents: 'none',
    color: '#71717a',
    width: '16px',
    height: '16px'
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
            // Spread first. A stored row carries more than this form shows —
            // a fund transaction linked to an expense carries `expenseId` and
            // `adoptedByExpense`, and detachExpense deletes rather than releases
            // a row whose flag has gone missing. Rebuilding the object dropped
            // both and silently broke the link.
            ...(initialData || {}),
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
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 1000,
            backdropFilter: 'blur(10px)'
        }} onClick={onClose}>
            <div style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(18, 18, 18, 0.98))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '2rem', width: '100%', maxWidth: '420px',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>{initialData ? 'Edit Transaction' : 'Add Transaction'}</h3>
                    <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.75rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, paddingLeft: '1rem', appearance: 'none', backgroundColor: 'rgba(30, 30, 32, 0.95)' }}>
                                <option value="buy">{isEmergencyFund ? 'Deposit' : 'Buy'}</option>
                                <option value="sell">{isEmergencyFund ? 'Withdraw' : 'Sell'}</option>
                                {!isEmergencyFund && <option value="sip">SIP</option>}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Date</label>
                            <div style={{ position: 'relative' }}>
                                <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                                <Calendar style={iconStyle} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isEmergencyFund ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Amount</label>
                            <div style={{ position: 'relative' }}>
                                <CurrencyInput required value={amount} onChange={handleAmountChange} style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>₹</span></div>
                            </div>
                        </div>
                        {!isEmergencyFund && (
                            <div>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>NAV</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="number" step="0.0001" required value={nav} onChange={handleNavChange} style={inputStyle} placeholder="NAV" />
                                    <Hash style={iconStyle} />
                                </div>
                            </div>
                        )}
                    </div>

                    {!isEmergencyFund && (
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Units (Calculated)</label>
                            <div style={{ position: 'relative' }}>
                                <input type="number" step="0.001" required value={units} onChange={handleUnitsChange} style={inputStyle} placeholder="Units" />
                                <Hash style={iconStyle} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Remarks</label>
                        <div style={{ position: 'relative' }}>
                            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} style={inputStyle} placeholder="Optional" />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '1.25rem',
                            backgroundColor: '#c084fc',
                            color: 'black',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            border: 'none',
                            transition: 'all 0.3s ease',
                            marginTop: '0.5rem'
                        }}
                    >
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default MutualFundTransactionModal;
