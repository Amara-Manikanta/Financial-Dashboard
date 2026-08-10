import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Tag, FileText, MapPin, Ruler, Briefcase, Coins, ShieldCheck } from 'lucide-react';
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

    const BLANK_RENTAL = {
        unitName: '', tenantName: '', tenantContact: '',
        monthlyRent: '', rentDueDay: '', advanceAmount: '',
        escalationType: 'percent', escalationValue: '', escalationEveryMonths: 12,
        leaseStart: '', leaseEnd: '', rules: '',
    };
    const [isLet, setIsLet] = useState(false);
    const [rental, setRental] = useState(BLANK_RENTAL);

    // Warranty cover. Months are stored rather than a computed date so the
    // expiry stays correct if the purchase date is later corrected; an explicit
    // date is still allowed for plans that do not start on the purchase day.
    const BLANK_WARRANTY = {
        serialNumber: '', seller: '',
        warrantyMonths: '', warrantyExpiry: '',
        extendedMonths: '', extendedExpiry: '', extendedCost: '',
    };
    const [warranty, setWarranty] = useState(BLANK_WARRANTY);
    const setWarrantyField = (field) => (e) =>
        setWarranty((prev) => ({ ...prev, [field]: e.target.value }));

    const parseInput = (value) => {
        return value.replace(/,/g, '');
    };

    const isRealEstate = categoryType === 'real_estate';

    const warrantyInputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white font-medium placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm';

    const setRentalField = (field) => (e) =>
        setRental((prev) => ({ ...prev, [field]: e.target.value }));

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name || '');
            setPurchaseDate(initialData.purchaseDate ? new Date(initialData.purchaseDate) : null);
            setPurchasePrice(initialData.purchasePrice || initialData.purchasedValue || '');
            setCurrentValue(initialData.currentValue || '');
            setPlace(initialData.place || '');
            setDimensions(initialData.dimensions || initialData.Dimensions || '');
            setRemarks(initialData.remarks || '');
            setRental({ ...BLANK_RENTAL, ...(initialData.rental || {}) });
            setIsLet(Boolean(initialData.rental));
            setWarranty({
                serialNumber: initialData.serialNumber || '',
                seller: initialData.seller || '',
                warrantyMonths: initialData.warrantyMonths ?? '',
                warrantyExpiry: initialData.warrantyExpiry || '',
                extendedMonths: initialData.extendedMonths ?? '',
                extendedExpiry: initialData.extendedExpiry || '',
                extendedCost: initialData.extendedCost ?? '',
            });
        } else if (isOpen && !initialData) {
            setName('');
            setPurchaseDate(null);
            setPurchasePrice('');
            setCurrentValue('');
            setPlace('');
            setDimensions('');
            setRemarks('');
            setRental(BLANK_RENTAL);
            setIsLet(false);
            setWarranty(BLANK_WARRANTY);
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
            purchasePrice: parseFloat(purchasePrice) || 0,
            currentValue: parseFloat(currentValue) || 0,
            place: isRealEstate ? place : null,
            dimensions: isRealEstate ? dimensions : null,
            remarks,
            // Warranty applies to goods, not land. Blank fields are stored as
            // empty rather than 0, because 0 months would read as "expired the
            // day it was bought" instead of "not recorded".
            ...(isRealEstate ? {} : {
                serialNumber: warranty.serialNumber.trim(),
                seller: warranty.seller.trim(),
                warrantyMonths: warranty.warrantyMonths === '' ? '' : Number(warranty.warrantyMonths) || '',
                warrantyExpiry: warranty.warrantyExpiry || '',
                extendedMonths: warranty.extendedMonths === '' ? '' : Number(warranty.extendedMonths) || '',
                extendedExpiry: warranty.extendedExpiry || '',
                extendedCost: warranty.extendedCost === '' ? '' : Number(parseInput(String(warranty.extendedCost))) || '',
                // Attachments and service history are edited on the item page,
                // so they are carried through untouched rather than reset here.
                receipts: initialData?.receipts || [],
                services: initialData?.services || [],
            }),
            // Only real estate carries a tenancy; unticking "let out" removes it
            // rather than leaving a stale block behind.
            rental: (isRealEstate && isLet)
                ? {
                    ...rental,
                    monthlyRent: Number(parseInput(String(rental.monthlyRent || ''))) || 0,
                    advanceAmount: Number(parseInput(String(rental.advanceAmount || ''))) || 0,
                    escalationValue: Number(rental.escalationValue) || 0,
                    escalationEveryMonths: Number(rental.escalationEveryMonths) || 12,
                    rentDueDay: Number(rental.rentDueDay) || '',
                }
                : undefined,
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
                className="w-full max-w-2xl bg-modal rounded-[40px] overflow-hidden border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] animate-slide-up flex flex-col"
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
                                        wrapperClassName="w-full"
                                        portalId="datepicker-portal"
                                        showMonthDropdown
                                        showYearDropdown
                                        dropdownMode="select"
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

                        {!isRealEstate && (
                            <div className="pt-5 border-t border-white/5 space-y-4">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-emerald-400" size={16} />
                                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                        Warranty &amp; proof of purchase
                                    </h3>
                                </div>
                                <p className="text-[10px] text-gray-500 -mt-2">
                                    Cover is counted from the purchase date, so correcting that date keeps
                                    the expiry right. Receipts and service history are added on the item page.
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Serial / Model no.</label>
                                        <input
                                            type="text"
                                            value={warranty.serialNumber}
                                            onChange={setWarrantyField('serialNumber')}
                                            className={warrantyInputCls}
                                            placeholder="Asked for on any claim"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Bought from</label>
                                        <input
                                            type="text"
                                            value={warranty.seller}
                                            onChange={setWarrantyField('seller')}
                                            className={warrantyInputCls}
                                            placeholder="Amazon, Croma, dealer…"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Warranty (months)</label>
                                        <input
                                            type="number" min="0"
                                            value={warranty.warrantyMonths}
                                            onChange={setWarrantyField('warrantyMonths')}
                                            className={warrantyInputCls}
                                            placeholder="12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">
                                            Or exact expiry
                                        </label>
                                        <input
                                            type="date"
                                            value={warranty.warrantyExpiry}
                                            onChange={setWarrantyField('warrantyExpiry')}
                                            className={warrantyInputCls}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Extended (months)</label>
                                        <input
                                            type="number" min="0"
                                            value={warranty.extendedMonths}
                                            onChange={setWarrantyField('extendedMonths')}
                                            className={warrantyInputCls}
                                            placeholder="24"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Or exact expiry</label>
                                        <input
                                            type="date"
                                            value={warranty.extendedExpiry}
                                            onChange={setWarrantyField('extendedExpiry')}
                                            className={warrantyInputCls}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">What it cost</label>
                                        <input
                                            type="text"
                                            value={warranty.extendedCost}
                                            onChange={setWarrantyField('extendedCost')}
                                            className={warrantyInputCls}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-600">
                                    Recording what the extended plan cost lets the item page tell you whether
                                    it has paid for itself yet.
                                </p>
                            </div>
                        )}

                        {isRealEstate && (
                            <div className="pt-5 border-t border-white/5 space-y-5">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isLet}
                                        onChange={(e) => setIsLet(e.target.checked)}
                                        className="w-4 h-4 accent-emerald-500"
                                    />
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                        This property is let out
                                    </span>
                                </label>

                                {isLet && (
                                    <div className="space-y-5">
                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Shop / Flat name</label>
                                                <input
                                                    type="text"
                                                    value={rental.unitName}
                                                    onChange={setRentalField('unitName')}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                    placeholder="Shop 2, Ground Floor"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Tenant</label>
                                                <input
                                                    type="text"
                                                    value={rental.tenantName}
                                                    onChange={setRentalField('tenantName')}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                    placeholder="Tenant name"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Monthly rent</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs">₹</span>
                                                    <CurrencyInput
                                                        value={rental.monthlyRent}
                                                        onChange={setRentalField('monthlyRent')}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Advance held</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 font-bold text-xs">₹</span>
                                                    <CurrencyInput
                                                        value={rental.advanceAmount}
                                                        onChange={setRentalField('advanceAmount')}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="w-[92px] space-y-2">
                                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Due day</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    value={rental.rentDueDay}
                                                    onChange={setRentalField('rentDueDay')}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-3 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                    placeholder="5"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Yearly increment</label>
                                            <div className="flex gap-3 items-center">
                                                <select
                                                    value={rental.escalationType}
                                                    onChange={setRentalField('escalationType')}
                                                    className="bg-white/5 border border-white/10 rounded-2xl py-3 px-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                >
                                                    <option value="percent" className="bg-gray-900">Percent</option>
                                                    <option value="fixed" className="bg-gray-900">Fixed ₹</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={rental.escalationValue}
                                                    onChange={setRentalField('escalationValue')}
                                                    className="w-24 bg-white/5 border border-white/10 rounded-2xl py-3 px-3 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                    placeholder={rental.escalationType === 'fixed' ? '500' : '5'}
                                                />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">every</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={rental.escalationEveryMonths}
                                                    onChange={setRentalField('escalationEveryMonths')}
                                                    className="w-20 bg-white/5 border border-white/10 rounded-2xl py-3 px-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">months</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Lease start</label>
                                                <input
                                                    type="date"
                                                    value={rental.leaseStart}
                                                    onChange={setRentalField('leaseStart')}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Lease end</label>
                                                <input
                                                    type="date"
                                                    value={rental.leaseEnd}
                                                    onChange={setRentalField('leaseEnd')}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Rules / agreement notes</label>
                                            <textarea
                                                value={rental.rules}
                                                onChange={setRentalField('rules')}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white font-medium placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm min-h-[80px] resize-none"
                                                placeholder="Lock-in 11 months, 2 months notice, maintenance by tenant, current bill paid by tenant..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
