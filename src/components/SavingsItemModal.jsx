import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText, Layout, CreditCard, Shield, TrendingUp, Landmark, RefreshCcw } from 'lucide-react';
import CurrencyInput from './CurrencyInput';

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

const SavingsItemModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [type, setType] = useState('fixed_deposit');
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Type specific fields
    const [extra, setExtra] = useState({});

    useEffect(() => {
        if (initialData) {
            setType(initialData.type || 'fixed_deposit');
            setTitle(initialData.title || initialData.name || '');
            setAmount(initialData.amount !== undefined ? initialData.amount : '');
            setDate(initialData.date || new Date().toISOString().split('T')[0]);
            setExtra({
                policyNo: initialData.policyNo || initialData.policyDetails?.policyNumber || '',
                insurer: initialData.insurer || initialData.policyDetails?.insurer || '',
                pran: initialData.pran || '',
                bank: initialData.bank || initialData.bankName || ''
            });
        } else {
            resetForm();
        }
    }, [initialData, isOpen]);

    const types = [
        { id: 'policy', label: 'Insurance Policy', icon: <Shield size={16} /> },
        { id: 'fixed_deposit', label: 'Fixed Deposit', icon: <Landmark size={16} /> },
        { id: 'recurring_deposit', label: 'Recurring Deposit', icon: <RefreshCcw size={16} /> },
        { id: 'savings_account', label: 'Savings Account', icon: <CreditCard size={16} /> },
        { id: 'nps', label: 'NPS Account', icon: <Layout size={16} /> },
        { id: 'ppf', label: 'PPF Account', icon: <Landmark size={16} /> },
        { id: 'pf', label: 'PF Account', icon: <Landmark size={16} /> }
    ];

    const handleExtraChange = (key, value) => {
        setExtra(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const updatedItem = {
            ...(initialData || {}),
            id: initialData ? initialData.id : Date.now().toString(),
            title,
            name: title,
            amount: parseFloat(amount || 0),
            type,
            date,
            ...extra
        };

        if (!initialData) {
            // Add default structures for new items
            if (type === 'nps') {
                updatedItem.holdings = [];
                updatedItem.transactions = [];
                updatedItem.investedAmount = parseFloat(amount || 0);
            } else if (type === 'ppf') {
                updatedItem.details = [];
            } else if (type === 'recurring_deposit') {
                updatedItem.recurringDeposits = [];
                updatedItem.amount = 0;
            } else if (type === 'savings_account') {
                updatedItem.transactions = [];
                updatedItem.interestRate = 5.4;
            } else if (type === 'pf') {
                updatedItem.details = [];
            }
        }

        onSave(updatedItem);
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setTitle('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setExtra({});
        setType('fixed_deposit');
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
                borderRadius: '2rem', width: '100%', maxWidth: '520px',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>
                            {initialData ? 'Edit Account Details' : 'Add New Account'}
                        </h3>
                        <p style={{ fontSize: '9px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                            {initialData ? 'Update title and account details' : 'Select type and enter details'}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.75rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Account Type</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {types.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setType(t.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.625rem 1rem',
                                        borderRadius: '0.75rem',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        border: type === t.id ? '1px solid rgba(192, 132, 252, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                        backgroundColor: type === t.id ? 'rgba(192, 132, 252, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                        color: type === t.id ? '#c084fc' : '#a1a1aa',
                                        boxShadow: type === t.id ? '0 0 10px rgba(192, 132, 252, 0.1)' : 'none'
                                    }}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Account Title</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    style={inputStyle}
                                    placeholder="e.g. HDFC Savings, LIC Jeevan Anand"
                                />
                                <Layout style={iconStyle} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Initial Amount</label>
                                <div style={{ position: 'relative' }}>
                                    <CurrencyInput
                                        required
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        style={inputStyle}
                                        placeholder="0.00"
                                    />
                                    <div style={iconStyle}><span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>₹</span></div>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Date</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="date"
                                        required
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        style={inputStyle}
                                    />
                                    <Calendar style={iconStyle} />
                                </div>
                            </div>
                        </div>

                        {type === 'policy' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Policy No</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type="text" value={extra.policyNo || ''} onChange={e => handleExtraChange('policyNo', e.target.value)} style={inputStyle} placeholder="POL-12345" />
                                        <FileText style={iconStyle} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Insurer</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type="text" value={extra.insurer || ''} onChange={e => handleExtraChange('insurer', e.target.value)} style={inputStyle} placeholder="LIC, ICICI Pru" />
                                        <Shield style={iconStyle} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {type === 'nps' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>PRAN Number</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="text" value={extra.pran || ''} onChange={e => handleExtraChange('pran', e.target.value)} style={inputStyle} placeholder="1234-5678-9012" />
                                    <CreditCard style={iconStyle} />
                                </div>
                            </div>
                        )}

                        {(type === 'savings_account' || type === 'ppf' || type === 'pf') && (
                            <div>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Bank / Account Number</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="text" value={extra.bank || ''} onChange={e => handleExtraChange('bank', e.target.value)} style={inputStyle} placeholder="HDFC, SBI, etc." />
                                    <Landmark style={iconStyle} />
                                </div>
                            </div>
                        )}
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
                            marginTop: '1rem'
                        }}
                    >
                        {initialData ? 'Save Changes' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default SavingsItemModal;
