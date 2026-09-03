import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Home } from 'lucide-react';
import CurrencyInput from './CurrencyInput';
import { UNIT_TYPES, blankUnit } from '../utils/propertyUnits';

const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white font-medium '
    + 'placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm';

const labelClass = 'block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1';

const SUGGESTED_TERMS = [
    'Current bill paid by tenant',
    '2 months notice',
    '11 month lock-in',
    'Maintenance by tenant',
    'No subletting',
];

const BLANK_RENTAL = {
    tenantName: '', tenantContact: '',
    monthlyRent: '', rentDueDay: '', advanceAmount: '',
    escalationType: 'percent', escalationValue: '', escalationEveryMonths: 12,
    leaseStart: '', leaseEnd: '', rules: '', terms: [],
};

/**
 * One lettable part of a property.
 *
 * The self-occupied switch is first and deliberately prominent. A unit you
 * live in has no tenant, no rent and no lease, and every field below becomes
 * noise — but it still has to exist on the property, because a building with
 * three shops let and a floor you live in is fully occupied, not 75% let.
 */
const PropertyUnitModal = ({ isOpen, onClose, onSave, onDelete, initialData }) => {
    const [form, setForm] = useState(blankUnit);
    const [rental, setRental] = useState(BLANK_RENTAL);

    useEffect(() => {
        if (!isOpen) return;
        if (initialData) {
            setForm({ ...blankUnit(), ...initialData });
            setRental({ ...BLANK_RENTAL, ...(initialData.rental || {}) });
        } else {
            setForm(blankUnit());
            setRental(BLANK_RENTAL);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
    const setRent = (k) => (e) => setRental((p) => ({ ...p, [k]: e.target.value }));

    const submit = (e) => {
        e.preventDefault();
        onSave({
            // Spread the stored unit so its entries survive an edit — this form
            // knows nothing about `transactions` and rebuilding the object here
            // would throw away every rent row against the unit.
            ...(initialData || {}),
            ...form,
            name: String(form.name || '').trim() || 'Unnamed unit',
            selfOccupied: !!form.selfOccupied,
            rental: form.selfOccupied ? null : {
                ...rental,
                monthlyRent: Number(rental.monthlyRent) || 0,
                advanceAmount: Number(rental.advanceAmount) || 0,
                escalationValue: Number(rental.escalationValue) || 0,
                escalationEveryMonths: Number(rental.escalationEveryMonths) || 12,
                rentDueDay: Number(rental.rentDueDay) || '',
                terms: (rental.terms || []).map((t) => String(t).trim()).filter(Boolean),
            },
            transactions: initialData?.transactions || [],
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <div>
                        <h3 className="text-lg font-black text-white">{initialData ? 'Edit Unit' : 'Add Unit'}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                            A separately lettable part of this property
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className={labelClass}>Unit name</label>
                            <input required value={form.name} onChange={set('name')} className={inputClass} placeholder="Shop 1 / First floor" />
                        </div>
                        <div>
                            <label className={labelClass}>Type</label>
                            <select value={form.unitType} onChange={set('unitType')} className={inputClass} style={{ backgroundColor: '#27272a' }}>
                                {Object.entries(UNIT_TYPES).map(([k, v]) => (
                                    <option key={k} value={k}>{v.icon} {v.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, selfOccupied: !p.selfOccupied }))}
                        className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between text-left ${
                            form.selfOccupied
                                ? 'bg-indigo-500/10 border-indigo-500/30'
                                : 'bg-white/[0.02] border-white/5'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <Home size={18} className={form.selfOccupied ? 'text-indigo-400' : 'text-gray-500'} />
                            <div>
                                <span className={`text-[12px] font-bold block ${form.selfOccupied ? 'text-white' : 'text-gray-400'}`}>
                                    {form.selfOccupied ? 'You occupy this yourself' : 'Let out, or available to let'}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                    {form.selfOccupied
                                        ? 'No rent, no lease, and never counted as vacant'
                                        : 'Counted in occupancy and the rent roll'}
                                </span>
                            </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full p-1 transition-all shrink-0 ${form.selfOccupied ? 'bg-indigo-500' : 'bg-white/10'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transition-all ${form.selfOccupied ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </button>

                    {!form.selfOccupied && (
                        <div className="space-y-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Tenant</label>
                                    <input value={rental.tenantName} onChange={setRent('tenantName')} className={inputClass} placeholder="Leave blank if vacant" />
                                </div>
                                <div>
                                    <label className={labelClass}>Contact</label>
                                    <input value={rental.tenantContact} onChange={setRent('tenantContact')} className={inputClass} placeholder="optional" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className={labelClass}>Monthly rent</label>
                                    {/* CurrencyInput hands back a synthetic event
                                        with target.value, not a bare value —
                                        taking the argument directly stored the
                                        event object and every rent saved as 0. */}
                                    <CurrencyInput
                                        value={rental.monthlyRent}
                                        onChange={(e) => setRental((p) => ({ ...p, monthlyRent: e.target.value }))}
                                        className={inputClass}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Advance held</label>
                                    <CurrencyInput
                                        value={rental.advanceAmount}
                                        onChange={(e) => setRental((p) => ({ ...p, advanceAmount: e.target.value }))}
                                        className={inputClass}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Rent due day</label>
                                    <input type="number" min="1" max="31" value={rental.rentDueDay} onChange={setRent('rentDueDay')} className={inputClass} placeholder="5" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Lease start</label>
                                    <input type="date" value={rental.leaseStart} onChange={setRent('leaseStart')} className={inputClass} />
                                    <p className="text-[10px] text-zinc-500 mt-1">Needed for the rent ledger</p>
                                </div>
                                <div>
                                    <label className={labelClass}>Lease end</label>
                                    <input type="date" value={rental.leaseEnd} onChange={setRent('leaseEnd')} className={inputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className={labelClass}>Increment</label>
                                    <select value={rental.escalationType} onChange={setRent('escalationType')} className={inputClass} style={{ backgroundColor: '#27272a' }}>
                                        <option value="percent">Percent</option>
                                        <option value="fixed">Fixed amount</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>By</label>
                                    <input type="number" value={rental.escalationValue} onChange={setRent('escalationValue')} className={inputClass}
                                        placeholder={rental.escalationType === 'fixed' ? '500' : '10'} />
                                </div>
                                <div>
                                    <label className={labelClass}>Every (months)</label>
                                    <input type="number" value={rental.escalationEveryMonths} onChange={setRent('escalationEveryMonths')} className={inputClass} placeholder="12" />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5 ml-1">
                                    <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest">Agreement points</label>
                                    <button type="button"
                                        onClick={() => setRental((p) => ({ ...p, terms: [...(p.terms || []), ''] }))}
                                        className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest">
                                        + Add point
                                    </button>
                                </div>

                                {(rental.terms || []).length === 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {SUGGESTED_TERMS.map((s) => (
                                            <button key={s} type="button"
                                                onClick={() => setRental((p) => ({ ...p, terms: [...(p.terms || []), s] }))}
                                                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:text-white hover:border-emerald-500/40 transition-all">
                                                + {s}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {(rental.terms || []).map((term, i) => (
                                    // eslint-disable-next-line react/no-array-index-key
                                    <div key={i} className="flex gap-2 items-center mt-2">
                                        <span className="text-emerald-500 text-xs font-black w-4 text-center">{i + 1}</span>
                                        <input value={term}
                                            onChange={(e) => setRental((p) => {
                                                const terms = [...(p.terms || [])];
                                                terms[i] = e.target.value;
                                                return { ...p, terms };
                                            })}
                                            placeholder="e.g. Current bill paid by tenant"
                                            className={inputClass} />
                                        <button type="button"
                                            onClick={() => setRental((p) => ({ ...p, terms: (p.terms || []).filter((_, j) => j !== i) }))}
                                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 transition-all" aria-label="Remove point">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className={labelClass}>Other notes</label>
                                <textarea value={rental.rules} onChange={setRent('rules')}
                                    className={`${inputClass} min-h-[70px] resize-none`}
                                    placeholder="Anything that does not fit as a single point" />
                            </div>
                        </div>
                    )}
                </form>

                <div className="p-5 border-t border-zinc-800 flex justify-between gap-3">
                    {initialData && onDelete ? (
                        <button
                            onClick={() => onDelete(initialData)}
                            className="px-4 py-2.5 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 font-bold text-[11px] uppercase tracking-widest hover:bg-red-500/20"
                        >
                            Delete unit
                        </button>
                    ) : <span />}
                    <button onClick={submit} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700">
                        {initialData ? 'Update unit' : 'Add unit'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PropertyUnitModal;
