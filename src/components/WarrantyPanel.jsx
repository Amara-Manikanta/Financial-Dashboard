import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion, Upload, FileText, Trash2, Plus, Wrench, X } from 'lucide-react';
import {
    warrantyStatus, STATE_LABEL, receiptsOf, servicesOf, serviceTotals,
    extendedWorthIt, manufacturerExpiry, extendedExpiry
} from '../utils/warranty';
import { uploadFile, isImageRef } from '../utils/uploadFile';
import { formatDate } from '../utils/dateUtils';

const STATE_STYLE = {
    active: { icon: ShieldCheck, ring: 'border-emerald-500/30 bg-emerald-500/5', text: 'text-emerald-400' },
    expiring: { icon: ShieldAlert, ring: 'border-amber-500/30 bg-amber-500/5', text: 'text-amber-400' },
    expired: { icon: ShieldOff, ring: 'border-red-500/25 bg-red-500/5', text: 'text-red-400' },
    unknown: { icon: ShieldQuestion, ring: 'border-white/10 bg-white/5', text: 'text-gray-400' },
};

const BLANK_SERVICE = { date: new Date().toISOString().slice(0, 10), description: '', cost: '', provider: '', underWarranty: false };

/**
 * Warranty status, receipts and repair history for one owned item.
 *
 * Saving goes through the caller's `onSave`, which persists the whole asset
 * category — so every change here is applied to a copy of the item and handed
 * up in one piece rather than written field by field.
 */
const WarrantyPanel = ({ item, onSave, formatCurrency }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [addingService, setAddingService] = useState(false);
    const [draft, setDraft] = useState(BLANK_SERVICE);

    const status = warrantyStatus(item);
    const style = STATE_STYLE[status.state];
    const Icon = style.icon;
    const receipts = receiptsOf(item);
    const services = servicesOf(item).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const totals = serviceTotals(item);
    const worth = extendedWorthIt(item);
    const base = manufacturerExpiry(item);
    const ext = extendedExpiry(item);

    const persist = async (changes) => {
        setError(null);
        setBusy(true);
        try {
            await onSave({ ...item, ...changes });
        } catch (e) {
            // A silent failure here would leave the screen showing a receipt
            // the database does not have.
            setError(e.message || 'Could not save that.');
        } finally {
            setBusy(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError(null);
        setBusy(true);
        try {
            // Receipts go to the documents folder, which keeps them at full
            // resolution so serial numbers and small print stay readable.
            const stored = await uploadFile(file, `${item.name || 'receipt'}-receipt`, 'documents');
            await onSave({ ...item, receipts: [...receipts, { ...stored, kind: 'receipt' }] });
        } catch (err) {
            setError(err.message || 'Upload failed');
        } finally {
            setBusy(false);
        }
    };

    const removeReceipt = (url) => persist({ receipts: receipts.filter((r) => r.url !== url) });

    const saveService = async () => {
        if (!draft.description.trim()) { setError('Describe what was done.'); return; }
        const entry = {
            id: Date.now().toString(),
            date: draft.date,
            description: draft.description.trim(),
            provider: draft.provider.trim(),
            cost: Number(draft.cost) || 0,
            underWarranty: Boolean(draft.underWarranty),
        };
        await persist({ services: [...servicesOf(item), entry] });
        setDraft(BLANK_SERVICE);
        setAddingService(false);
    };

    const removeService = (id) => persist({ services: servicesOf(item).filter((s) => String(s.id) !== String(id)) });

    const label = 'block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5';
    const field = 'w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50';

    return (
        <div className="space-y-4">
            {/* Status */}
            <div className={`rounded-2xl border p-5 ${style.ring}`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Icon className={style.text} size={22} />
                        <div>
                            <p className={`text-sm font-black ${style.text}`}>{STATE_LABEL[status.state]}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                {status.state === 'unknown'
                                    ? 'No warranty period recorded for this item.'
                                    : status.state === 'expired'
                                        ? `Cover ended ${formatDate(status.expiryIso)} — ${Math.abs(status.daysLeft)} days ago.`
                                        : `Covered until ${formatDate(status.expiryIso)} — ${status.daysLeft} days left.`}
                                {status.extended && status.state !== 'unknown' && ' Extended cover.'}
                            </p>
                        </div>
                    </div>
                    {item.serialNumber && (
                        <div className="text-right">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Serial</p>
                            <p className="text-xs font-mono text-gray-300">{item.serialNumber}</p>
                        </div>
                    )}
                </div>

                {(base || ext || item.seller) && (
                    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/5 pt-3">
                        {base && (
                            <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Manufacturer</p>
                                <p className="text-xs text-gray-300">{formatDate(base.toISOString().slice(0, 10))}</p>
                            </div>
                        )}
                        {ext && (
                            <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Extended</p>
                                <p className="text-xs text-gray-300">{formatDate(ext.toISOString().slice(0, 10))}</p>
                            </div>
                        )}
                        {item.seller && (
                            <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Bought from</p>
                                <p className="text-xs text-gray-300">{item.seller}</p>
                            </div>
                        )}
                    </div>
                )}

                {worth && (
                    <p className={`mt-3 text-[11px] ${worth.net >= 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                        Extended cover cost {formatCurrency(worth.cost)} and has covered{' '}
                        {formatCurrency(worth.covered)} of repairs —{' '}
                        {worth.net >= 0
                            ? `ahead by ${formatCurrency(worth.net)}.`
                            : `${formatCurrency(Math.abs(worth.net))} still to earn back.`}
                    </p>
                )}
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                    {error}
                </div>
            )}

            {/* Receipts */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Receipts &amp; proof of purchase
                    </h3>
                    <label className={`flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white ${busy ? 'opacity-50' : 'cursor-pointer hover:bg-white/20'}`}>
                        <Upload size={12} /> Add
                        <input type="file" className="hidden" disabled={busy}
                            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                            onChange={handleUpload} />
                    </label>
                </div>

                {receipts.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                        Nothing attached. Without the bill a warranty claim usually will not be accepted.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {receipts.map((r) => (
                            <div key={r.url} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
                                <a href={r.url} target="_blank" rel="noreferrer" className="block">
                                    {isImageRef(r) ? (
                                        <img src={r.url} alt={r.name || 'Receipt'} className="h-24 w-full object-cover" />
                                    ) : (
                                        <div className="flex h-24 flex-col items-center justify-center gap-1 text-gray-400">
                                            <FileText size={20} />
                                            <span className="text-[10px] font-bold">PDF</span>
                                        </div>
                                    )}
                                </a>
                                <p className="truncate px-2 py-1 text-[10px] text-gray-400">{r.name || 'Receipt'}</p>
                                <button
                                    type="button"
                                    onClick={() => removeReceipt(r.url)}
                                    disabled={busy}
                                    aria-label={`Remove ${r.name || 'receipt'}`}
                                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Service history */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Wrench size={12} /> Service &amp; repairs
                    </h3>
                    <button
                        type="button"
                        onClick={() => setAddingService((v) => !v)}
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/20"
                    >
                        <Plus size={12} /> Log a repair
                    </button>
                </div>

                {totals.count > 0 && (
                    <div className="mb-3 flex flex-wrap gap-4 text-[11px]">
                        <span className="text-gray-400">{totals.count} logged</span>
                        <span className="text-gray-300">Paid: <strong>{formatCurrency(totals.paid)}</strong></span>
                        <span className="text-emerald-400">Covered: <strong>{formatCurrency(totals.covered)}</strong></span>
                    </div>
                )}

                {addingService && (
                    <div className="mb-3 space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={label}>Date</label>
                                <input type="date" value={draft.date} className={field}
                                    onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                            </div>
                            <div>
                                <label className={label}>Cost</label>
                                <input type="number" min="0" value={draft.cost} className={field} placeholder="0"
                                    onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label className={label}>What was done</label>
                            <input type="text" value={draft.description} className={field}
                                placeholder="Screen replaced, compressor gas refill…"
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                        </div>
                        <div>
                            <label className={label}>Service centre</label>
                            <input type="text" value={draft.provider} className={field} placeholder="Optional"
                                onChange={(e) => setDraft({ ...draft, provider: e.target.value })} />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-gray-300">
                            <input type="checkbox" checked={draft.underWarranty}
                                onChange={(e) => setDraft({ ...draft, underWarranty: e.target.checked })} />
                            Covered by warranty (no money paid)
                        </label>
                        <div className="flex gap-2">
                            <button type="button" onClick={saveService} disabled={busy}
                                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30">
                                Save
                            </button>
                            <button type="button" onClick={() => { setAddingService(false); setDraft(BLANK_SERVICE); setError(null); }}
                                className="rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold text-gray-400 hover:bg-white/10">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {services.length === 0 ? (
                    <p className="text-[11px] text-gray-500">No repairs logged.</p>
                ) : (
                    <div className="space-y-2">
                        {services.map((s) => (
                            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-bold text-white">{s.description}</p>
                                    <p className="text-[10px] text-gray-500">
                                        {formatDate(s.date)}{s.provider ? ` · ${s.provider}` : ''}
                                        {s.underWarranty ? ' · under warranty' : ''}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <span className={`font-mono text-xs ${s.underWarranty ? 'text-emerald-400' : 'text-gray-300'}`}>
                                        {formatCurrency(Number(s.cost) || 0)}
                                    </span>
                                    <button type="button" onClick={() => removeService(s.id)} disabled={busy}
                                        aria-label={`Remove ${s.description}`}
                                        className="text-gray-600 hover:text-red-400">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WarrantyPanel;
