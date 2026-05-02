import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Activity } from 'lucide-react';
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

const PFTransactionModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('Contribution');
    const [employeeAmount, setEmployeeAmount] = useState('');
    const [employerAmount, setEmployerAmount] = useState('');
    const [interestAmount, setInterestAmount] = useState('');

    useEffect(() => {
        if (initialData) {
            setDate(initialData.date);
            setType(initialData.type === 'Interest' ? 'Interest' : 'Contribution');
            setEmployeeAmount(initialData.employeeContribution ? initialData.employeeContribution.toString() : '');
            setEmployerAmount(initialData.employerContribution ? initialData.employerContribution.toString() : '');
            setInterestAmount(initialData.interestEarned ? initialData.interestEarned.toString() : '');
        } else {
            resetForm();
        }
    }, [initialData, isOpen]);

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setType('Contribution');
        setEmployeeAmount('');
        setEmployerAmount('');
        setInterestAmount('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const numEmployee = parseFloat(employeeAmount || 0);
        const numEmployer = parseFloat(employerAmount || 0);
        const numInterest = parseFloat(interestAmount || 0);

        let txData = {
            id: initialData?.id || Date.now(),
            date,
            type
        };

        if (type === 'Contribution') {
            txData.employeeContribution = numEmployee;
            txData.employerContribution = numEmployer;
            txData.interestEarned = 0;
            txData.amount = numEmployee + numEmployer;
        } else if (type === 'Interest') {
            txData.employeeContribution = 0;
            txData.employerContribution = 0;
            txData.interestEarned = numInterest;
            txData.amount = numInterest;
        }

        onSave(txData);
        if (!initialData) resetForm();
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
                borderRadius: '1.5rem', width: '100%', maxWidth: '400px',
                position: 'relative', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">{initialData ? 'Edit Transaction' : 'Add Transaction'}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">PF Account</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

                    <div className="relative">
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Transaction Type</label>
                        <div className="relative">
                            <select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                style={{...inputStyle, appearance: 'none'}}
                            >
                                <option value="Contribution">Contribution</option>
                                <option value="Interest">Interest</option>
                            </select>
                            <Activity style={iconStyle} />
                        </div>
                    </div>

                    {type === 'Contribution' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">My Contribution</label>
                                <div className="relative">
                                    <CurrencyInput
                                        required
                                        value={employeeAmount}
                                        onChange={e => setEmployeeAmount(e.target.value)}
                                        style={inputStyle}
                                        placeholder="0.00"
                                    />
                                    <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                                </div>
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Employer</label>
                                <div className="relative">
                                    <CurrencyInput
                                        value={employerAmount}
                                        onChange={e => setEmployerAmount(e.target.value)}
                                        style={inputStyle}
                                        placeholder="0.00"
                                    />
                                    <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {type === 'Interest' && (
                        <div className="relative">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Interest Earned</label>
                            <div className="relative">
                                <CurrencyInput
                                    required
                                    value={interestAmount}
                                    onChange={e => setInterestAmount(e.target.value)}
                                    style={inputStyle}
                                    placeholder="0.00"
                                />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/40 active:scale-95">
                        {initialData ? 'Update Transaction' : 'Save Transaction'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default PFTransactionModal;
