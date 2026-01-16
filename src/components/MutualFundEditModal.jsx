import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Hash, FileText, TrendingUp } from 'lucide-react';

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

const MutualFundEditModal = ({ isOpen, onClose, onSave, fund }) => {
    const [title, setTitle] = useState('');
    const [currentNav, setCurrentNav] = useState('');
    const [folioNumber, setFolioNumber] = useState('');
    const [schemeCode, setSchemeCode] = useState('');

    useEffect(() => {
        if (isOpen && fund) {
            setTitle(fund.title || '');
            setCurrentNav(fund.currentNav || '');
            setFolioNumber(fund.folioNumber || '');
            setSchemeCode(fund.schemeCode || '');
        }
    }, [isOpen, fund]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...fund,
            title,
            currentNav: parseFloat(currentNav),
            folioNumber,
            schemeCode
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
                    <h3 className="text-lg font-bold text-white">Edit Fund Details</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Fund Name</label>
                        <div className="relative">
                            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Current NAV (Market)</label>
                        <div className="relative">
                            <input type="number" step="0.0001" required value={currentNav} onChange={e => setCurrentNav(e.target.value)} style={inputStyle} />
                            <Hash style={iconStyle} />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Folio Number</label>
                        <div className="relative">
                            <input type="text" value={folioNumber} onChange={e => setFolioNumber(e.target.value)} style={inputStyle} />
                            <Hash style={iconStyle} />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scheme Code (mfapi.in)</label>
                        <div className="relative">
                            <input type="text" value={schemeCode} onChange={e => setSchemeCode(e.target.value)} style={inputStyle} placeholder="e.g. 120503" />
                            <TrendingUp style={iconStyle} />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Found on mfapi.in (e.g., 120503 for Axis Bluechip)</p>
                    </div>

                    <div className="bg-gray-800 p-3 rounded-lg text-xs text-gray-400">
                        Note: Updating Current NAV will recalculate current value and Unrealized P/L automatically.
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors mt-2">
                        Update Details
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default MutualFundEditModal;
