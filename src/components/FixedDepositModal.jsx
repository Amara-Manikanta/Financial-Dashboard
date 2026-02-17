import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Building, Hash, Percent, FileText } from 'lucide-react';
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

const FixedDepositModal = ({ isOpen, onClose, onSave, initialData, isRenewal }) => {
    const [formData, setFormData] = useState({
        accountNo: '',
        bank: '',
        startDate: '',
        endDate: '',
        originalAmount: '',
        interestEarned: '',
        maturityAmount: '',
        remarks: '',
        tds: '',
        renewalCount: 0
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                if (isRenewal) {
                    setFormData({
                        accountNo: initialData.accountNo || '',
                        bank: initialData.bank || '',
                        startDate: toISODate(initialData.endDate) || '',
                        endDate: '',
                        originalAmount: initialData.maturityAmount || '',
                        interestRate: '',
                        interestEarned: '0',
                        maturityAmount: '',
                        remarks: '',
                        tds: '',
                        renewalCount: (initialData.renewalCount || 0) + 1,
                        interestTransactions: initialData.interestTransactions || []
                    });
                } else {
                    setFormData({
                        accountNo: initialData.accountNo || '',
                        bank: initialData.bank || '',
                        startDate: toISODate(initialData.startDate) || '',
                        endDate: toISODate(initialData.endDate) || '',
                        originalAmount: initialData.originalAmount || '',
                        interestRate: initialData.interestRate || '',
                        interestEarned: initialData.interestEarned || '',
                        maturityAmount: initialData.maturityAmount || '',
                        remarks: initialData.remarks || '',
                        tds: initialData.tds || '',
                        renewalCount: initialData.renewalCount || 0,
                        interestTransactions: initialData.interestTransactions || []
                    });
                }
            } else {
                setFormData({
                    accountNo: '',
                    bank: '',
                    startDate: toISODate(new Date()) || '',
                    endDate: '',
                    originalAmount: '',
                    interestEarned: '0',
                    maturityAmount: '',
                    remarks: '',
                    tds: '',
                    renewalCount: 0
                });
            }
        }
    }, [isOpen, initialData]);

    const calculateMaturity = (principal, rate, start, end) => {
        if (!principal || !rate || !start || !end) return { interest: 0, maturity: 0, accrued: 0 };

        const P = parseFloat(principal);
        const r = parseFloat(rate) / 100;
        const startDate = new Date(start);
        const endDate = new Date(end);
        const today = new Date();

        // Time in years
        const T = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);
        const tElapsed = Math.max(0, (Math.min(today, endDate) - startDate) / (1000 * 60 * 60 * 24 * 365.25));

        // Standard Indian FD: Quarterly Compounding (n=4)
        // A = P * (1 + r/n)^(n*t)
        const n = 4;
        const maturityValue = P * Math.pow((1 + r / n), (n * T));
        const accruedValue = P * Math.pow((1 + r / n), (n * tElapsed));

        return {
            interest: Math.round(maturityValue - P),
            maturity: Math.round(maturityValue),
            accrued: Math.round(accruedValue - P)
        };
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };

            // Auto-calculate if key fields change
            if (['originalAmount', 'interestRate', 'startDate', 'endDate'].includes(name)) {
                const { interest, maturity } = calculateMaturity(next.originalAmount, next.interestRate, next.startDate, next.endDate);
                next.interestEarned = interest;
                next.maturityAmount = maturity;
            }
            return next;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const { accrued } = calculateMaturity(formData.originalAmount, formData.interestRate, formData.startDate, formData.endDate);

        onSave({
            id: initialData?.id || Date.now(),
            ...formData,
            originalAmount: parseFloat(formData.originalAmount),
            interestRate: parseFloat(formData.interestRate),
            interestEarned: parseFloat(formData.interestEarned),
            maturityAmount: parseFloat(formData.maturityAmount),
            tds: parseFloat(formData.tds || 0),
            currentValue: parseFloat(formData.originalAmount) + accrued, // Current value based on accrual
            renewalCount: formData.renewalCount || 0
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
                borderRadius: '1rem', width: '100%', maxWidth: '500px',
                position: 'relative', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto'
            }} onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-lg font-bold text-white">
                        {isRenewal ? 'Renew Fixed Deposit' : (initialData ? 'Edit Fixed Deposit' : 'Add Fixed Deposit')}
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                {isRenewal && (
                    <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                            Renewal from Account {initialData.accountNo}
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Account No</label>
                            <div className="relative">
                                <input type="text" name="accountNo" required value={formData.accountNo} onChange={handleChange} style={inputStyle} placeholder="xxxx" />
                                <Hash style={iconStyle} />
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Bank Name</label>
                            <div className="relative">
                                <input type="text" name="bank" required value={formData.bank} onChange={handleChange} style={inputStyle} placeholder="Bank" />
                                <Building style={iconStyle} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Start Date</label>
                            <div className="relative">
                                <input type="date" name="startDate" required value={formData.startDate} onChange={handleChange} style={inputStyle} />
                                <Calendar style={iconStyle} />
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Maturity Date</label>
                            <div className="relative">
                                <input type="date" name="endDate" required value={formData.endDate} onChange={handleChange} style={inputStyle} />
                                <Calendar style={iconStyle} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Principal Amount</label>
                            <div className="relative">
                                <CurrencyInput name="originalAmount" required value={formData.originalAmount} onChange={handleChange} style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Interest Rate (%)</label>
                            <div className="relative">
                                <input type="number" step="0.01" name="interestRate" required value={formData.interestRate || ''} onChange={handleChange} style={inputStyle} placeholder="0.00" />
                                <Percent style={iconStyle} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">TDS Amount</label>
                            <div className="relative">
                                <CurrencyInput name="tds" value={formData.tds || ''} onChange={handleChange} style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative opacity-70">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Interest Earned (Total)</label>
                            <div className="relative">
                                <input type="number" step="0.01" name="interestEarned" readOnly value={formData.interestEarned} className="cursor-not-allowed" style={{ ...inputStyle, backgroundColor: '#1a1a1c' }} />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                        <div className="relative opacity-70">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Maturity Amount</label>
                            <div className="relative">
                                <input type="number" step="0.01" name="maturityAmount" readOnly value={formData.maturityAmount} className="cursor-not-allowed" style={{ ...inputStyle, backgroundColor: '#1a1a1c' }} />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
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
                        Save Deposit
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default FixedDepositModal;
