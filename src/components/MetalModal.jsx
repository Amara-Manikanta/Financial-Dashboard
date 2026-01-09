import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Tag, FileText, Weight, MapPin, Edit2, Coins } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const MetalModal = ({ isOpen, onClose, onAdd, initialData = null, metalType = 'gold' }) => {
    // State initialization
    const [name, setName] = useState('');
    const [weightGm, setWeightGm] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purity, setPurity] = useState(24);
    const [purchaseDate, setPurchaseDate] = useState(new Date());
    const [place, setPlace] = useState('');
    const [remarks, setRemarks] = useState('');

    // Sync state with initialData
    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name || '');
            setWeightGm(initialData.weightGm || '');
            setPurchasePrice(initialData.purchasePrice || '');
            setPurity(initialData.purity || (metalType === 'gold' ? 24 : ''));
            setPurchaseDate(initialData.purchaseDate ? new Date(initialData.purchaseDate) : new Date());
            setPlace(initialData.place || '');
            setRemarks(initialData.remarks || '');
        } else if (isOpen && !initialData) {
            setName('');
            setWeightGm('');
            setPurchasePrice('');
            setPurity(metalType === 'gold' ? 24 : '');
            setPurchaseDate(new Date());
            setPlace('');
            setRemarks('');
        }
    }, [initialData, isOpen, metalType]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd({
            ...initialData,
            name,
            weightGm: parseFloat(weightGm),
            purchasePrice: parseFloat(purchasePrice) || 0,
            purity: metalType === 'gold' ? parseInt(purity) : null,
            purchaseDate: purchaseDate.toISOString().split('T')[0],
            place,
            remarks,
            currentValue: initialData?.currentValue || 0
        });
        onClose();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const accentColor = metalType === 'gold' ? 'yellow-500' : 'slate-400';
    const accentText = metalType === 'gold' ? 'text-yellow-400' : 'text-slate-400';
    const accentBg = metalType === 'gold' ? 'bg-yellow-500' : 'bg-slate-500';

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-sm bg-modal rounded-[40px] overflow-hidden border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] animate-slide-up flex flex-col"
                style={{ maxHeight: '82vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 pb-4 border-b border-white/5">
                    <button
                        onClick={onClose}
                        className="absolute right-5 top-6 p-2 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                    >
                        <X size={18} />
                    </button>

                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <Coins className={accentText} size={20} />
                        {initialData ? `Update ${metalType}` : `New ${metalType} Entry`}
                    </h2>
                    <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-wider">
                        Track your precious metal holdings
                    </p>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-10">
                    <form id="metal-form" onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Asset Name</label>
                            <div className="relative">
                                <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-3 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                                    placeholder="e.g. Gold Ring, Silver Coin"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Weight (Gm)</label>
                                <div className="relative">
                                    <Weight size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="number"
                                        step="0.001"
                                        required
                                        value={weightGm}
                                        onChange={(e) => setWeightGm(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-3 text-white font-bold focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                                        placeholder="0.000"
                                    />
                                </div>
                            </div>
                            {metalType === 'gold' && (
                                <div className="w-[100px]">
                                    <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Purity</label>
                                    <select
                                        value={purity}
                                        onChange={(e) => setPurity(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-3 text-white font-bold focus:outline-none focus:border-indigo-500/50 transition-all text-sm appearance-none"
                                    >
                                        <option value={24} className="bg-[#0c0c0e]">24K</option>
                                        <option value={22} className="bg-[#0c0c0e]">22K</option>
                                        <option value={18} className="bg-[#0c0c0e]">18K</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Purchase Price</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs">₹</span>
                                    <input
                                        type="number"
                                        value={purchasePrice}
                                        onChange={(e) => setPurchasePrice(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Date</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <DatePicker
                                        selected={purchaseDate}
                                        onChange={(date) => setPurchaseDate(date)}
                                        dateFormat="dd/MM/yy"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-8 pr-2 text-white font-bold focus:outline-none focus:border-indigo-500/50 transition-all text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Purchase Place</label>
                            <div className="relative">
                                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={place}
                                    onChange={(e) => setPlace(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-3 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                                    placeholder="Jeweller name, City..."
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Remarks</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white font-medium placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 transition-all text-sm min-h-[80px] resize-none"
                                placeholder="Any additional notes..."
                            />
                        </div>
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="p-6 bg-modal-footer border-t border-white/10 flex gap-3 shadow-[0_-12px_40px_rgba(0,0,0,0.8)] sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl border border-white/10 bg-white/5 text-white font-bold hover:bg-white/10 transition-all text-xs uppercase tracking-widest"
                    >
                        Cancel
                    </button>
                    <button
                        form="metal-form"
                        type="submit"
                        className={`flex-[2] py-4 rounded-2xl ${accentBg} text-white font-black hover:opacity-90 transition-all text-xs uppercase tracking-[0.15em] shadow-lg`}
                    >
                        {initialData ? 'Update Item' : 'Add Item'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MetalModal;
