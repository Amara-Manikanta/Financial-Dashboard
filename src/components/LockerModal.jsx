import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Landmark, Building2, MapPin, Hash, IndianRupee, CalendarClock } from 'lucide-react';

const LockerModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [bankName, setBankName] = useState('');
    const [branch, setBranch] = useState('');
    const [lockerNumber, setLockerNumber] = useState('');
    const [annualRent, setAnnualRent] = useState('');
    const [renewalDate, setRenewalDate] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setBankName(initialData?.bankName || '');
        setBranch(initialData?.branch || '');
        setLockerNumber(initialData?.lockerNumber || '');
        setAnnualRent(initialData?.annualRent ?? '');
        setRenewalDate(initialData?.renewalDate || '');
        setNotes(initialData?.notes || '');
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...(initialData || {}),
            bankName: bankName.trim(),
            branch: branch.trim(),
            lockerNumber: lockerNumber.trim(),
            // Empty stays null rather than 0: a rent nobody has entered is a gap
            // in the records, and 0 would read as a locker that is free.
            annualRent: annualRent === '' ? null : Number(annualRent),
            renewalDate: renewalDate || null,
            notes: notes.trim(),
        });
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const inputClass = 'w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-3 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 transition-all text-sm';
    const labelClass = 'block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1';
    const iconClass = 'absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500';

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
                <div className="relative p-6 pb-4 border-b border-white/5">
                    <button
                        onClick={onClose}
                        className="absolute right-5 top-6 p-2 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                    >
                        <X size={18} />
                    </button>

                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <Landmark className="text-indigo-400" size={20} />
                        {initialData ? 'Update Locker' : 'New Bank Locker'}
                    </h2>
                    <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-wider">
                        Where your items are kept
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-10">
                    <form id="locker-form" onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className={labelClass}>Bank</label>
                            <div className="relative">
                                <Building2 size={14} className={iconClass} />
                                <input
                                    type="text"
                                    required
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g. State Bank of India"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className={labelClass}>Branch</label>
                                <div className="relative">
                                    <MapPin size={14} className={iconClass} />
                                    <input
                                        type="text"
                                        value={branch}
                                        onChange={(e) => setBranch(e.target.value)}
                                        className={inputClass}
                                        placeholder="e.g. Kakinada"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className={labelClass}>Locker No.</label>
                                <div className="relative">
                                    <Hash size={14} className={iconClass} />
                                    <input
                                        type="text"
                                        value={lockerNumber}
                                        onChange={(e) => setLockerNumber(e.target.value)}
                                        className={inputClass}
                                        placeholder="e.g. L-214"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className={labelClass}>Annual Rent</label>
                                <div className="relative">
                                    <IndianRupee size={14} className={iconClass} />
                                    <input
                                        type="number"
                                        step="1"
                                        value={annualRent}
                                        onChange={(e) => setAnnualRent(e.target.value)}
                                        className={inputClass}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className={labelClass}>Renewal Due</label>
                                <div className="relative">
                                    <CalendarClock size={14} className={iconClass} />
                                    <input
                                        type="date"
                                        value={renewalDate}
                                        onChange={(e) => setRenewalDate(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 ml-1 leading-relaxed">
                            Leave the renewal date blank if you do not know it. It is shown as
                            not recorded rather than overdue, so it stays on the list to fill in.
                        </p>

                        <div className="space-y-2">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white font-medium placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 transition-all text-sm min-h-[80px] resize-none"
                                placeholder="Joint holders, who has the keys, access timings..."
                            />
                        </div>
                    </form>
                </div>

                <div className="p-6 bg-modal-footer border-t border-white/10 flex gap-3 shadow-[0_-12px_40px_rgba(0,0,0,0.8)] sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl border border-white/10 bg-white/5 text-white font-bold hover:bg-white/10 transition-all text-xs uppercase tracking-widest"
                    >
                        Cancel
                    </button>
                    <button
                        form="locker-form"
                        type="submit"
                        className="flex-[2] py-4 rounded-2xl bg-indigo-500 text-white font-black hover:opacity-90 transition-all text-xs uppercase tracking-[0.15em] shadow-lg"
                    >
                        {initialData ? 'Update Locker' : 'Add Locker'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default LockerModal;
