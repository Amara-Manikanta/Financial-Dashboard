import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Bell } from 'lucide-react';
import { ALERT_TYPES, writeAlert } from '../utils/priceRange';
import { CANONICAL_SECTORS } from '../utils/sectors';

const inputStyle = {
    backgroundColor: '#27272a', color: 'white', border: '1px solid #3f3f46',
    borderRadius: '0.5rem', padding: '0.55rem 0.7rem', width: '100%',
    outline: 'none', fontSize: '13px',
};

const labelStyle = 'block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5';

const blank = { name: '', ticker: '', sector: '', notes: '', alerts: [] };

/**
 * A watchlist entry and the levels its owner wants to hear about.
 *
 * Alerts are entered by hand and never suggested. The app has no basis for
 * proposing a price to watch, and a prefilled number would read as advice from
 * something that has none to give.
 */
const WatchlistItemModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [form, setForm] = useState(blank);

    useEffect(() => {
        if (!isOpen) return;
        setForm(initialData ? { ...blank, ...initialData, alerts: initialData.alerts || [] } : blank);
    }, [isOpen, initialData]);

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const addAlert = () => setForm((p) => ({
        ...p,
        alerts: [...(p.alerts || []), { id: `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type: 'below', price: '', note: '' }],
    }));

    const updateAlert = (id, field, value) => setForm((p) => ({
        ...p,
        alerts: p.alerts.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    }));

    const removeAlert = (id) => setForm((p) => ({ ...p, alerts: p.alerts.filter((a) => a.id !== id) }));

    const submit = (e) => {
        e.preventDefault();
        onSave({
            ...(initialData || {}),
            id: form.id || `w_${Date.now()}`,
            name: String(form.name || '').trim(),
            ticker: String(form.ticker || '').trim().toUpperCase(),
            sector: form.sector || '',
            notes: String(form.notes || '').trim(),
            addedAt: form.addedAt || new Date().toISOString(),
            alerts: (form.alerts || []).filter((a) => Number(a.price) > 0).map(writeAlert),
        });
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <div>
                        <h3 className="text-lg font-black text-white">{initialData ? 'Edit Watchlist Entry' : 'Add to Watchlist'}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Following, not owning</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className={labelStyle}>Company</label>
                            <input required value={form.name} onChange={set('name')} style={inputStyle} placeholder="Titan Company Limited" />
                        </div>
                        <div>
                            <label className={labelStyle}>Ticker</label>
                            <input required value={form.ticker} onChange={set('ticker')} style={inputStyle} placeholder="TITAN" />
                            <p className="text-[10px] text-zinc-500 mt-1">.NS added automatically</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle}>Sector</label>
                            <select value={form.sector} onChange={set('sector')} style={inputStyle}>
                                <option value="">Not set</option>
                                {CANONICAL_SECTORS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Why you are watching</label>
                            <input value={form.notes} onChange={set('notes')} style={inputStyle} placeholder="optional" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
                                    <Bell size={12} /> Your alert levels
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
                                    Prices you want flagged. Nothing is suggested — the app has no basis
                                    for proposing a level, and a prefilled one would read as advice.
                                </p>
                            </div>
                            <button type="button" onClick={addAlert}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-300 text-[11px] font-bold hover:bg-purple-500/25 shrink-0">
                                <Plus size={13} /> Add
                            </button>
                        </div>

                        {(form.alerts || []).length === 0 && (
                            <p className="text-[11px] text-zinc-600">No alerts set.</p>
                        )}

                        {(form.alerts || []).map((a) => (
                            <div key={a.id} className="grid grid-cols-12 gap-2 items-center">
                                <select className="col-span-3" value={a.type} onChange={(e) => updateAlert(a.id, 'type', e.target.value)} style={inputStyle}>
                                    {ALERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input className="col-span-3" type="number" step="any" placeholder="price" value={a.price}
                                    onChange={(e) => updateAlert(a.id, 'price', e.target.value)} style={inputStyle} />
                                <input className="col-span-5" placeholder="note (optional)" value={a.note}
                                    onChange={(e) => updateAlert(a.id, 'note', e.target.value)} style={inputStyle} />
                                <button type="button" onClick={() => removeAlert(a.id)}
                                    className="col-span-1 flex justify-center p-1.5 rounded-lg text-red-400 hover:bg-red-500/15">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </form>

                <div className="p-5 border-t border-zinc-800 flex justify-end">
                    <button onClick={submit} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700">
                        {initialData ? 'Update' : 'Add to watchlist'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default WatchlistItemModal;
