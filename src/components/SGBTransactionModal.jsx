import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Hash, FileText } from 'lucide-react';

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

const SGBTransactionModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [series, setSeries] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [units, setUnits] = useState('');
    const [issuePrice, setIssuePrice] = useState('');
    const [currentPrice, setCurrentPrice] = useState('');
    const [maturityDate, setMaturityDate] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setSeries(initialData.series || '');
                setDate(initialData.date || '');
                setUnits(initialData.units || '');
                setIssuePrice(initialData.issuePrice || '');
                setCurrentPrice(initialData.currentPrice || '');
                setMaturityDate(initialData.maturityDate || '');
            } else {
                setSeries('');
                setDate(new Date().toISOString().split('T')[0]);
                setUnits('');
                setIssuePrice('');
                setCurrentPrice('');
                setMaturityDate('');
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            series,
            date,
            units: parseFloat(units),
            issuePrice: parseFloat(issuePrice),
            currentPrice: parseFloat(currentPrice),
            maturityDate
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
                    <h3 className="text-lg font-bold text-white">{initialData ? 'Edit SGB Holding' : 'Add SGB Holding'}</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Series Name</label>
                        <div className="relative">
                            <input type="text" required value={series} onChange={e => setSeries(e.target.value)} style={inputStyle} placeholder="e.g. SGB 2021-22 SERIES VI" />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Issue Date</label>
                            <div className="relative">
                                <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                                <Calendar style={iconStyle} />
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Units (g)</label>
                            <div className="relative">
                                <input type="number" step="0.001" required value={units} onChange={e => setUnits(e.target.value)} style={inputStyle} placeholder="0" />
                                <Hash style={iconStyle} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Issue Price</label>
                            <div className="relative">
                                <input type="number" step="0.01" required value={issuePrice} onChange={e => setIssuePrice(e.target.value)} style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Current Price</label>
                            <div className="relative">
                                <input type="number" step="0.01" required value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Maturity Date</label>
                        <div className="relative">
                            <input type="date" required value={maturityDate} onChange={e => setMaturityDate(e.target.value)} style={inputStyle} />
                            <Calendar style={iconStyle} />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors mt-2">
                        Save Holding
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default SGBTransactionModal;
