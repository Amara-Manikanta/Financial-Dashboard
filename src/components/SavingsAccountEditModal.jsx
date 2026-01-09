import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';

const inputStyle = {
    backgroundColor: '#27272a',
    color: 'white',
    border: '1px solid #3f3f46',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    width: '100%',
    outline: 'none'
};

const SavingsAccountEditModal = ({ isOpen, onClose, onSave, account }) => {
    const [title, setTitle] = useState('');
    const [interestRate, setInterestRate] = useState('');

    useEffect(() => {
        if (isOpen && account) {
            setTitle(account.title || '');
            setInterestRate(account.interestRate || '5.4'); // Defaulting to 5.4% if not set
        }
    }, [isOpen, account]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...account,
            title,
            interestRate: parseFloat(interestRate) || 0
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
                    <h3 className="text-lg font-bold text-white">Edit Account Details</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Account Title</label>
                        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Annual Interest Rate (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            value={interestRate}
                            onChange={e => setInterestRate(e.target.value)}
                            style={inputStyle}
                            placeholder="e.g. 5.4"
                        />
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors mt-2">
                        Save Changes
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default SavingsAccountEditModal;
