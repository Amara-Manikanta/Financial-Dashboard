import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Tag, FileText, MapPin, Ruler, Briefcase, Coins } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import CurrencyInput from './CurrencyInput';

const AssetItemModal = ({ isOpen, onClose, onSave, initialData = null, categoryType = 'real_estate' }) => {
    const [name, setName] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date());
    const [purchasePrice, setPurchasePrice] = useState('');
    const [currentValue, setCurrentValue] = useState('');
    const [place, setPlace] = useState('');
    const [dimensions, setDimensions] = useState('');
    const [remarks, setRemarks] = useState('');



    const parseInput = (value) => {
        return value.replace(/,/g, '');
    };

    const isRealEstate = categoryType === 'real_estate';

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name || '');
            setPurchaseDate(initialData.purchaseDate ? new Date(initialData.purchaseDate) : null);
            setPurchaseDate(initialData.purchaseDate ? new Date(initialData.purchaseDate) : null);
            setPurchaseDate(initialData.purchaseDate ? new Date(initialData.purchaseDate) : null);
            setPurchasePrice(initialData.purchasePrice || initialData.purchasedValue || '');
            setCurrentValue(initialData.currentValue || '');
            setPlace(initialData.place || '');
            setDimensions(initialData.dimensions || initialData.Dimensions || '');
            setRemarks(initialData.remarks || '');
        } else if (isOpen && !initialData) {
            setName('');
            setPurchaseDate(null);
            setPurchasePrice('');
            setCurrentValue('');
            setPlace('');
            setDimensions('');
            setRemarks('');
        }
    }, [initialData, isOpen, categoryType]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...initialData,
            id: initialData?.id || Date.now().toString(),
            name,
            purchaseDate: purchaseDate ? purchaseDate.toISOString().split('T')[0] : '',
            purchaseDate: purchaseDate ? purchaseDate.toISOString().split('T')[0] : '',
            purchasePrice: parseFloat(purchasePrice) || 0,
            currentValue: parseFloat(currentValue) || 0,
            place: isRealEstate ? place : null,
            dimensions: isRealEstate ? dimensions : null,
            remarks,
            transactions: initialData?.transactions || []
        });
        onClose();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

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
                        <Briefcase className="text-blue-400" size={20} />
                        {initialData ? 'Update Asset' : 'Add New Asset'}
                    </h2>
                    <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-wider">
                        {isRealEstate ? 'Property & Investment tracking' : 'Valuable asset logging'}
                    </p>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-10">
                    <form id="asset-form" onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Asset Name</label>
                            <div className="relative">
                                <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-3 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                                    placeholder="e.g. Dream Villa, iPhone 15"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Purchase Price</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs">₹</span>
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs">₹</span>
                                    <CurrencyInput
                                        value={purchasePrice}
                                        onChange={(e) => setPurchasePrice(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Current Value</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs">₹</span>
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs">₹</span>
                                    <CurrencyInput
                                        value={currentValue}
                                        onChange={(e) => setCurrentValue(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Purchase Date</label>
                                <div className="relative text-xs">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
                                    <DatePicker
                                        selected={purchaseDate}
                                        onChange={(date) => setPurchaseDate(date)}
                                        dateFormat="dd/MM/yyyy"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-8 pr-2 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all"
                                    />
                                </div>
                            </div>
                            {isRealEstate && (
                                <div className="flex-1">
                                    <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Dimensions</label>
                                    <div className="relative">
                                        <Ruler size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input
                                            type="text"
                                            value={dimensions}
                                            onChange={(e) => setDimensions(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-3 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                                            placeholder="40x60"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {isRealEstate && (
                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Location / Place</label>
                                <div className="relative">
                                    <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="text"
                                        value={place}
                                        onChange={(e) => setPlace(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-3 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                                        placeholder="City, Area name..."
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Remarks</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white font-medium placeholder:text-gray-700 focus:outline-none focus:border-blue-500/50 transition-all text-sm min-h-[80px] resize-none"
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
                        form="asset-form"
                        type="submit"
                        className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-500 transition-all text-xs uppercase tracking-[0.15em] shadow-lg shadow-blue-500/40"
                    >
                        {initialData ? 'Update Asset' : 'Add Asset'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AssetItemModal;
