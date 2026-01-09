import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Hash, FileText, Calendar } from 'lucide-react';

const StockTransactionModal = ({ isOpen, onClose, onSave, initialData = null, customColumns = [] }) => {
    const [name, setName] = useState('');
    const [ticker, setTicker] = useState('');
    const [shares, setShares] = useState('');
    const [avgCost, setAvgCost] = useState('');
    const [currentPrice, setCurrentPrice] = useState('');
    const [remarks, setRemarks] = useState('');
    const [customValues, setCustomValues] = useState({});

    const currentYear = new Date().getFullYear();
    const dividendYears = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

    const [dividends, setDividends] = useState(
        dividendYears.reduce((acc, year) => ({ ...acc, [year]: 0 }), {})
    );

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name || '');
            setTicker(initialData.ticker || '');
            setShares(initialData.shares || '');
            setAvgCost(initialData.avgCost || '');
            setCurrentPrice(initialData.currentPrice || '');
            setRemarks(initialData.remarks || '');
            setCustomValues(initialData.customValues || {});
            const initialDividends = {};
            dividendYears.forEach(year => {
                initialDividends[year] = initialData.dividends?.[year] || 0;
            });
            setDividends(initialDividends);
        } else if (isOpen) {
            setName('');
            setTicker('');
            setShares('');
            setAvgCost('');
            setCurrentPrice('');
            setRemarks('');
            setCustomValues({});
            setDividends(dividendYears.reduce((acc, year) => ({ ...acc, [year]: 0 }), {}));
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData ? initialData.id : `s${Date.now()}`,
            name,
            ticker,
            shares: parseFloat(shares),
            avgCost: parseFloat(avgCost),
            currentPrice: parseFloat(currentPrice),

            remarks,
            customValues,
            dividends: Object.entries(dividends).reduce((acc, [k, v]) => ({ ...acc, [k]: parseFloat(v) }), {})
        });
        onClose();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const inputStyle = {
        backgroundColor: '#27272a',
        color: 'white',
        border: '1px solid #3f3f46',
        borderRadius: '0.75rem',
    };

    const iconStyle = {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        left: '0.75rem',
        pointerEvents: 'none',
        color: '#9ca3af'
    };

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 2147483647,
                padding: '1rem', backdropFilter: 'blur(4px)'
            }}
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-2xl rounded-2xl shadow-2xl relative flex flex-col overflow-hidden"
                style={{ backgroundColor: '#18181b', border: '1px solid #27272a', maxHeight: '90vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            {initialData ? 'Edit Stock' : 'Add New Stock'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Company Name</label>
                                <div className="relative">
                                    <input
                                        type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                                        style={inputStyle} placeholder="e.g. Reliance Industries"
                                    />
                                    <TrendingUp size={18} style={iconStyle} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Ticker Symbol</label>
                                <div className="relative">
                                    <input
                                        type="text" required value={ticker} onChange={(e) => setTicker(e.target.value)}
                                        className="w-full px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                                        style={inputStyle} placeholder="e.g. RELIANCE"
                                    />
                                    <Hash size={18} style={iconStyle} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Shares Held</label>
                                <div className="relative">
                                    <input
                                        type="number" required value={shares} onChange={(e) => setShares(e.target.value)}
                                        className="w-full px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                                        style={inputStyle} placeholder="0"
                                    />
                                    <Hash size={18} style={iconStyle} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Average Cost</label>
                                <div className="relative">
                                    <input
                                        type="number" required value={avgCost} onChange={(e) => setAvgCost(e.target.value)}
                                        className="w-full px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                                        style={inputStyle} placeholder="0.00"
                                    />
                                    <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Current Price</label>
                                <div className="relative">
                                    <input
                                        type="number" required value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)}
                                        className="w-full px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                                        style={inputStyle} placeholder="0.00"
                                    />
                                    <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                                </div>
                            </div>
                        </div>



                        {/* Custom Columns Inputs */}
                        {customColumns.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {customColumns.map(col => (
                                    <div key={col}>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">{col}</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={customValues[col] || ''}
                                                onChange={(e) => setCustomValues(prev => ({ ...prev, [col]: e.target.value }))}
                                                className="w-full px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                                                style={inputStyle}
                                                placeholder={col}
                                            />
                                            <TrendingUp size={18} style={iconStyle} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Remarks</label>
                            <div className="relative">
                                <input
                                    type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                                    className="w-full px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                                    style={inputStyle} placeholder="Optional notes"
                                />
                                <FileText size={18} style={iconStyle} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">Dividends History</label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {Object.keys(dividends).sort((a, b) => b - a).map(year => (
                                    <div key={year}>
                                        <label className="block text-[10px] text-gray-500 mb-1">{year}</label>
                                        <input
                                            type="number"
                                            value={dividends[year]}
                                            onChange={(e) => setDividends(prev => ({ ...prev, [year]: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[#27272a] border border-[#3f3f46] text-white text-sm focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                            <button type="button" onClick={onClose} className="w-full py-3 rounded-xl border border-gray-700 text-white font-bold hover:bg-white/5 transition-all">Cancel</button>
                            <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/40">
                                {initialData ? 'Update Stock' : 'Add Stock'}
                            </button>
                        </div>
                    </form>
                </div>
            </div >
        </div >,
        document.body
    );
};

export default StockTransactionModal;
