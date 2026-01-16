import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText, Layout, CreditCard, Shield, TrendingUp, Landmark } from 'lucide-react';

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

const SavingsItemModal = ({ isOpen, onClose, onSave }) => {
    const [type, setType] = useState('mutual_fund');
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Type specific fields
    const [extra, setExtra] = useState({});

    const types = [
        { id: 'mutual_fund', label: 'Mutual Fund', icon: <TrendingUp size={16} /> },
        { id: 'policy', label: 'Insurance Policy', icon: <Shield size={16} /> },
        { id: 'fixed_deposit', label: 'Fixed Deposit', icon: <Landmark size={16} /> },
        { id: 'savings_account', label: 'Savings Account', icon: <CreditCard size={16} /> },
        { id: 'nps', label: 'NPS Account', icon: <Layout size={16} /> },
        { id: 'ppf', label: 'PPF Account', icon: <Landmark size={16} /> }
    ];

    const handleExtraChange = (key, value) => {
        setExtra(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const newItem = {
            id: Date.now().toString(),
            title,
            amount: parseFloat(amount || 0),
            type,
            date,
            ...extra
        };

        // Add default structures for certain types
        if (type === 'nps') {
            newItem.holdings = [];
            newItem.transactions = [];
            newItem.investedAmount = parseFloat(amount || 0);
        } else if (type === 'ppf') {
            newItem.details = [];
        } else if (type === 'savings_account') {
            newItem.transactions = [];
            newItem.interestRate = 5.4;
        } else if (type === 'mutual_fund') {
            newItem.transactions = [];
        }

        onSave(newItem);
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setTitle('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setExtra({});
        setType('mutual_fund');
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
                borderRadius: '1.5rem', width: '100%', maxWidth: '500px',
                position: 'relative', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Add New Account</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Select type and enter details</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Account Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {types.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setType(t.id)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${type === t.id
                                        ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10'
                                        }`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Account Title</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    style={inputStyle}
                                    placeholder="e.g. HDFC Bluechip, LIC Jeevan Anand"
                                />
                                <Layout style={iconStyle} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Initial Amount</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        style={inputStyle}
                                        placeholder="0.00"
                                    />
                                    <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                                </div>
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Date</label>
                                <div className="relative">
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

                        {/* Type Specific Fields */}
                        {type === 'mutual_fund' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Folio Number</label>
                                        <div className="relative">
                                            <input type="text" onChange={e => handleExtraChange('folioNo', e.target.value)} style={inputStyle} placeholder="12345/67" />
                                            <FileText style={iconStyle} />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">AMC</label>
                                        <div className="relative">
                                            <input type="text" onChange={e => handleExtraChange('amc', e.target.value)} style={inputStyle} placeholder="SBI, HDFC, Mirae" />
                                            <Landmark style={iconStyle} />
                                        </div>
                                    </div>
                                </div>
                                <div className="relative">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Scheme Code (mfapi.in)</label>
                                    <div className="relative">
                                        <input type="text" onChange={e => handleExtraChange('schemeCode', e.target.value)} style={inputStyle} placeholder="e.g. 120503" />
                                        <TrendingUp style={iconStyle} />
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-1">Found on mfapi.in (e.g., 120503 for Axis Bluechip)</p>
                                </div>
                            </div>
                        )}

                        {type === 'policy' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Policy No</label>
                                    <div className="relative">
                                        <input type="text" onChange={e => handleExtraChange('policyNo', e.target.value)} style={inputStyle} placeholder="POL-12345" />
                                        <FileText style={iconStyle} />
                                    </div>
                                </div>
                                <div className="relative">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Insurer</label>
                                    <div className="relative">
                                        <input type="text" onChange={e => handleExtraChange('insurer', e.target.value)} style={inputStyle} placeholder="LIC, ICICI Pru" />
                                        <Shield style={iconStyle} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {type === 'nps' && (
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">PRAN Number</label>
                                <div className="relative">
                                    <input type="text" onChange={e => handleExtraChange('pran', e.target.value)} style={inputStyle} placeholder="1234-5678-9012" />
                                    <CreditCard style={iconStyle} />
                                </div>
                            </div>
                        )}

                        {(type === 'savings_account' || type === 'ppf') && (
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Bank / Account Number</label>
                                <div className="relative">
                                    <input type="text" onChange={e => handleExtraChange('bank', e.target.value)} style={inputStyle} placeholder="HDFC, SBI, etc." />
                                    <Landmark style={iconStyle} />
                                </div>
                            </div>
                        )}
                    </div>

                    <button type="submit" className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/40 active:scale-95 mt-4">
                        Create Account
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default SavingsItemModal;
