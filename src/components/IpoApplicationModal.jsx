import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IPO_STATUSES, IPO_CATEGORIES, writeApplication, wasAllotted } from '../utils/ipoApplications';

const inputStyle = {
    backgroundColor: '#27272a', color: 'white', border: '1px solid #3f3f46',
    borderRadius: '0.5rem', padding: '0.55rem 0.7rem', width: '100%',
    outline: 'none', fontSize: '13px',
};

const labelStyle = 'block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5';

const blank = {
    company: '', symbol: '', category: 'retail', status: 'applied',
    appliedDate: new Date().toISOString().split('T')[0],
    lots: '', sharesPerLot: '', cutOffPrice: '', amountBlocked: '',
    sharesAllotted: '', allotmentDate: '', refundDate: '',
    listingDate: '', listingPrice: '', linkedStockId: '', notes: '',
};

/**
 * Record an IPO application, whatever came of it.
 *
 * The allotment fields only appear once the status says there was one — an
 * empty "shares allotted" box on a rejected application invites a zero that
 * later reads as a real figure.
 */
const IpoApplicationModal = ({ isOpen, onClose, onSave, initialData, stocks = [] }) => {
    const [form, setForm] = useState(blank);

    useEffect(() => {
        if (!isOpen) return;
        setForm(initialData ? { ...blank, ...initialData } : blank);
    }, [isOpen, initialData]);

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const sharesApplied = (Number(form.lots) || 0) * (Number(form.sharesPerLot) || 0);
    const impliedBlock = sharesApplied * (Number(form.cutOffPrice) || 0);
    const showAllotment = wasAllotted(form);

    // Only holdings that actually carry an IPO leg can be what an allotment
    // created, so the picker does not offer the whole portfolio.
    const ipoStocks = useMemo(
        () => (stocks || []).filter((s) => (s.transactions || []).some((t) => t.type === 'ipo')),
        [stocks],
    );

    const submit = (e) => {
        e.preventDefault();
        onSave(writeApplication(form));
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <div>
                        <h3 className="text-lg font-black text-white">{initialData ? 'Edit IPO Application' : 'Record IPO Application'}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                            Applications that were not allotted matter just as much
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className={labelStyle}>Company</label>
                            <input required value={form.company} onChange={set('company')} style={inputStyle} placeholder="Bajaj Housing Finance Limited" />
                        </div>
                        <div>
                            <label className={labelStyle}>Symbol</label>
                            <input value={form.symbol} onChange={set('symbol')} style={inputStyle} placeholder="BAJAJHFL" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className={labelStyle}>Applied on</label>
                            <input type="date" required value={form.appliedDate} onChange={set('appliedDate')} style={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Category</label>
                            <select value={form.category} onChange={set('category')} style={inputStyle}>
                                {IPO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Lots</label>
                            <input type="number" step="any" required value={form.lots} onChange={set('lots')} style={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Shares / lot</label>
                            <input type="number" step="any" required value={form.sharesPerLot} onChange={set('sharesPerLot')} style={inputStyle} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                            <label className={labelStyle}>Price applied at</label>
                            <input type="number" step="any" required value={form.cutOffPrice} onChange={set('cutOffPrice')} style={inputStyle} placeholder="cut-off" />
                        </div>
                        <div>
                            <label className={labelStyle}>Amount blocked</label>
                            <input type="number" step="any" value={form.amountBlocked} onChange={set('amountBlocked')} style={inputStyle}
                                placeholder={impliedBlock ? String(Math.round(impliedBlock)) : '0'} />
                            <p className="text-[10px] text-zinc-500 mt-1">
                                {sharesApplied > 0 ? `${sharesApplied} shares · leave blank to use ₹${Math.round(impliedBlock).toLocaleString('en-IN')}` : 'defaults to lots × shares × price'}
                            </p>
                        </div>
                        <div>
                            <label className={labelStyle}>Result</label>
                            <select value={form.status} onChange={set('status')} style={inputStyle}>
                                {IPO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {showAllotment && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Allotment</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelStyle}>Shares allotted</label>
                                    <input type="number" step="any" value={form.sharesAllotted} onChange={set('sharesAllotted')} style={inputStyle} />
                                </div>
                                <div>
                                    <label className={labelStyle}>Allotment date</label>
                                    <input type="date" value={form.allotmentDate} onChange={set('allotmentDate')} style={inputStyle} />
                                </div>
                                <div>
                                    <label className={labelStyle}>Listing date</label>
                                    <input type="date" value={form.listingDate} onChange={set('listingDate')} style={inputStyle} />
                                </div>
                                <div>
                                    <label className={labelStyle}>Listing price</label>
                                    <input type="number" step="any" value={form.listingPrice} onChange={set('listingPrice')} style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label className={labelStyle}>Holding this created</label>
                                <select value={form.linkedStockId} onChange={set('linkedStockId')} style={inputStyle}>
                                    <option value="">Not linked</option>
                                    {ipoStocks.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name || s.ticker}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
                                    The shares stay on the holding — linking points at them rather than
                                    recording them a second time.
                                </p>
                            </div>
                        </div>
                    )}

                    {!showAllotment && form.status === 'not-allotted' && (
                        <div>
                            <label className={labelStyle}>Refund date</label>
                            <input type="date" value={form.refundDate} onChange={set('refundDate')} style={inputStyle} />
                            <p className="text-[10px] text-zinc-500 mt-1">Used to work out how long the money was blocked.</p>
                        </div>
                    )}

                    <div>
                        <label className={labelStyle}>Notes</label>
                        <input value={form.notes} onChange={set('notes')} style={inputStyle} placeholder="optional" />
                    </div>
                </form>

                <div className="p-5 border-t border-zinc-800 flex justify-end">
                    <button onClick={submit} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700">
                        {initialData ? 'Update application' : 'Save application'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default IpoApplicationModal;
