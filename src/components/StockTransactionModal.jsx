import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Hash, FileText, PieChart, Layers, Tag, DollarSign, CheckSquare, Info } from 'lucide-react';
import CurrencyInput from './CurrencyInput';

const StockTransactionModal = ({ isOpen, onClose, onSave, initialData = null, customColumns = [] }) => {
    const [name, setName] = useState('');
    const [ticker, setTicker] = useState('');
    const [shares, setShares] = useState('');
    const [avgCost, setAvgCost] = useState('');
    const [currentPrice, setCurrentPrice] = useState('');
    const [remarks, setRemarks] = useState('');
    const [customValues, setCustomValues] = useState({});
    const [investedAmount, setInvestedAmount] = useState('');
    const [realisedPL, setRealisedPL] = useState('');
    const [expectsDividends, setExpectsDividends] = useState(false);
    const [marketCap, setMarketCap] = useState('');
    const [sector, setSector] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name || '');
            setTicker(initialData.ticker || '');
            setShares(initialData.shares !== undefined && initialData.shares !== null ? initialData.shares : '');
            // Rounded for the field too, so a holding saved before the formula
            // rounded does not present its stored 974.3366666666667 for editing.
            setAvgCost(initialData.avgCost !== undefined && initialData.avgCost !== null
                ? Math.round(Number(initialData.avgCost) * 100) / 100
                : '');
            setCurrentPrice(initialData.currentPrice !== undefined && initialData.currentPrice !== null ? initialData.currentPrice : '');
            setRemarks(initialData.remarks || '');
            setCustomValues(initialData.customValues || {});
            setInvestedAmount(initialData.manualInvestedAmount !== undefined && initialData.manualInvestedAmount !== null ? initialData.manualInvestedAmount : '');
            setRealisedPL(initialData.realisedPL !== undefined && initialData.realisedPL !== null ? initialData.realisedPL : '');

            setExpectsDividends(initialData.expectsDividends || false);
            setMarketCap(initialData.marketCap || '');
            setSector(initialData.sector || '');
        } else if (isOpen) {
            setName('');
            setTicker('');
            setShares('');
            setAvgCost('');
            setCurrentPrice('');
            setRemarks('');
            setCustomValues({});
            setInvestedAmount('');
            setRealisedPL('');
            setExpectsDividends(false);
            setMarketCap('');
            setSector('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData ? initialData.id : `s${Date.now()}`,
            name,
            ticker,
            shares: shares !== '' ? parseFloat(shares) : 0,
            avgCost: avgCost !== '' ? Math.round(parseFloat(avgCost) * 100) / 100 : 0,
            currentPrice: currentPrice !== '' ? parseFloat(currentPrice) : 0,
            remarks,
            customValues,
            manualInvestedAmount: investedAmount !== '' ? parseFloat(investedAmount) : null,
            realisedPL: realisedPL !== '' ? parseFloat(realisedPL) : null,
            dividends: initialData ? initialData.dividends : {},
            expectsDividends,
            marketCap: marketCap || null,
            sector: sector || null
        });
        onClose();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const inputStyle = {
        backgroundColor: '#27272a',
        color: '#ffffff',
        border: '1px solid #3f3f46',
        borderRadius: '0.75rem',
        padding: '0.75rem 1rem',
        width: '100%',
        outline: 'none',
        fontSize: '0.875rem',
        fontWeight: '500'
    };

    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer'
    };

    const labelStyle = "flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1";

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 2147483647,
                padding: '1rem', backdropFilter: 'blur(8px)'
            }}
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-2xl rounded-2xl shadow-2xl relative flex flex-col overflow-hidden"
                style={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800/80 bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                            <TrendingUp className="text-blue-500" size={22} />
                            {initialData ? 'Edit Stock Details' : 'Add New Stock'}
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">Configure company details, shares held, costs, and market sector.</p>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* Company & Ticker */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>
                                    <TrendingUp size={13} className="text-blue-400" />
                                    Company Name
                                </label>
                                <input
                                    type="text" 
                                    required 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)}
                                    style={inputStyle} 
                                    placeholder="e.g. Tata Motors Commercial Vehicles"
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>
                                    <Hash size={13} className="text-emerald-400" />
                                    Ticker Symbol
                                </label>
                                <input
                                    type="text" 
                                    required 
                                    value={ticker} 
                                    onChange={(e) => setTicker(e.target.value)}
                                    style={inputStyle} 
                                    placeholder="e.g. TMCV"
                                />
                            </div>
                        </div>

                        {/* Market Cap & Sector */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>
                                    <Layers size={13} className="text-purple-400" />
                                    Market Cap
                                </label>
                                <select
                                    value={marketCap}
                                    onChange={(e) => setMarketCap(e.target.value)}
                                    style={selectStyle}
                                >
                                    <option value="" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Select Cap Type</option>
                                    <option value="Large Cap" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Large Cap</option>
                                    <option value="Mid Cap" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Mid Cap</option>
                                    <option value="Small Cap" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Small Cap</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelStyle}>
                                    <Tag size={13} className="text-amber-400" />
                                    Market Sector
                                </label>
                                <select
                                    value={sector}
                                    onChange={(e) => setSector(e.target.value)}
                                    style={selectStyle}
                                >
                                    <option value="" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Select Sector</option>
                                    <option value="Information Technology" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Information Technology</option>
                                    <option value="Financials" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Financials</option>
                                    <option value="Health Care" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Health Care</option>
                                    <option value="Consumer Discretionary" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Consumer Discretionary</option>
                                    <option value="Consumer Staples" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Consumer Staples</option>
                                    <option value="Industrials" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Industrials</option>
                                    <option value="Communication Services" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Communication Services</option>
                                    <option value="Energy" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Energy</option>
                                    <option value="Utilities" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Utilities</option>
                                    <option value="Materials" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Materials</option>
                                    <option value="Real Estate" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>Real Estate</option>
                                </select>
                            </div>
                        </div>

                        {/* Shares, Avg Cost, Current Price */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelStyle}>
                                    <Hash size={13} className="text-cyan-400" />
                                    Shares Held
                                </label>
                                <input
                                    type="number" 
                                    step="any"
                                    required 
                                    value={shares} 
                                    onChange={(e) => setShares(e.target.value)}
                                    style={{ ...inputStyle, fontFamily: 'monospace' }} 
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>
                                    <span className="text-emerald-400 font-bold text-xs">₹</span>
                                    Average Cost
                                </label>
                                <CurrencyInput
                                    required
                                    value={avgCost}
                                    onChange={(e) => setAvgCost(e.target.value)}
                                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>
                                    <span className="text-blue-400 font-bold text-xs">₹</span>
                                    Current Price
                                </label>
                                <CurrencyInput
                                    required
                                    value={currentPrice}
                                    onChange={(e) => setCurrentPrice(e.target.value)}
                                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Archived/Manual Fields Card */}
                        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/90 space-y-3">
                            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                <PieChart size={14} className="text-indigo-400" />
                                Manual Override & Archived Data
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyle}>
                                        <span className="text-indigo-400 font-bold text-xs">₹</span>
                                        Invested Amount (Manual)
                                    </label>
                                    <CurrencyInput
                                        value={investedAmount}
                                        onChange={(e) => setInvestedAmount(e.target.value)}
                                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                                        placeholder="Auto-calculated if empty"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1 ml-1 flex items-center gap-1">
                                        <Info size={10} /> Required for 0 quantity stocks
                                    </p>
                                </div>
                                <div>
                                    <label className={labelStyle}>
                                        <span className="text-emerald-400 font-bold text-xs">₹</span>
                                        Realised P/L
                                    </label>
                                    <CurrencyInput
                                        value={realisedPL}
                                        onChange={(e) => setRealisedPL(e.target.value)}
                                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                                        placeholder="0.00"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1 ml-1 flex items-center gap-1">
                                        <Info size={10} /> Profit/Loss booked on sale
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Custom Columns Inputs */}
                        {customColumns.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {customColumns.map(col => (
                                    <div key={col}>
                                        <label className={labelStyle}>{col}</label>
                                        <input
                                            type="text"
                                            value={customValues[col] || ''}
                                            onChange={(e) => setCustomValues(prev => ({ ...prev, [col]: e.target.value }))}
                                            style={inputStyle}
                                            placeholder={col}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Remarks & Tracks Dividends */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className={labelStyle}>
                                    <FileText size={13} className="text-zinc-400" />
                                    Remarks
                                </label>
                                <input
                                    type="text" 
                                    value={remarks} 
                                    onChange={(e) => setRemarks(e.target.value)}
                                    style={inputStyle} 
                                    placeholder="Optional notes"
                                />
                            </div>
                            <div className="pb-1">
                                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 cursor-pointer hover:bg-emerald-500/20 transition-all select-none">
                                    <input
                                        type="checkbox"
                                        checked={expectsDividends}
                                        onChange={(e) => setExpectsDividends(e.target.checked)}
                                        className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 cursor-pointer"
                                    />
                                    Tracks Dividends?
                                </label>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="w-full py-3 rounded-xl border border-zinc-700/80 text-zinc-300 font-bold hover:bg-white/5 transition-all text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30 text-sm"
                            >
                                {initialData ? 'Update Stock' : 'Add Stock'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default StockTransactionModal;
