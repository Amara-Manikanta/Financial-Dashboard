import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import CurrencyInput from './CurrencyInput';
import {
    ENTRY_KINDS, kindOf, parsePeriod, formatPeriod, kindHasPeriod, kindsFor,
    BORNE_BY, asksWhoPays, borneBy, netCost,
} from '../utils/rental';

/** The option meaning "not any one unit" — the building's own costs. */
export const BUILDING_SCOPE = '';

const AssetTransactionModal = ({
    isOpen, onClose, onSave, initialData, isRealEstate = false,
    units = [], unitId = BUILDING_SCOPE,
}) => {
    const blank = () => ({
        date: new Date().toISOString().split('T')[0],
        // Rent for a let property, a repair for a good — what each is most
        // often used to record. `other_income` was the default for goods, which
        // is close to the least likely thing anyone logs against a washing
        // machine, and it started every entry on the wrong side of the ledger.
        kind: isRealEstate ? 'rent' : 'maintenance',
        type: isRealEstate ? 'income' : 'expense',
        amount: '',
        period: '',
        description: '',
        borne: 'owner',
        recoveredAmount: '',
    });

    const [formData, setFormData] = useState(blank);
    /**
     * Which unit this entry belongs to.
     *
     * Held here rather than taken from whatever the page had selected. The unit
     * was previously implied by a card highlighted behind the modal, which is
     * invisible while the form is open — you could not tell which shop you were
     * recording rent against, and could not change it without cancelling.
     */
    const [scope, setScope] = useState(unitId);

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...blank(),
                ...initialData,
                kind: kindOf(initialData),
                borne: borneBy(initialData),
            });
        } else {
            setFormData(blank());
        }
        setScope(unitId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, isOpen, unitId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            // The kind decides the direction, so income/expense stays consistent
            // with it and older entries keep working off `type` alone.
            if (name === 'kind') next.type = ENTRY_KINDS[value]?.direction || 'income';
            return next;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const kind = formData.kind || 'other_income';
        onSave({
            ...formData,
            kind,
            type: ENTRY_KINDS[kind]?.direction || 'income',
            amount: Number(formData.amount),
            // Stored as YYYY-MM whatever was typed. `<input type="month">` gives
            // that already in Chrome, but Safari has no such input type and
            // renders a plain text box — an entry made there stored "August
            // 2026", which the rent ledger could not match to any month, so a
            // month that had been paid showed as short by the full rent.
            period: kindHasPeriod(kind) ? (parsePeriod(formData.period) || '') : '',
            // Only meaningful on an expense a tenant could have covered. Cleared
            // otherwise so a stale value cannot survive a change of kind and
            // quietly zero out a cost you do carry.
            borne: asksWhoPays(kind, isRealEstate) ? (formData.borne || 'owner') : undefined,
            recoveredAmount: asksWhoPays(kind, isRealEstate) && formData.borne === 'recovered' && formData.recoveredAmount !== ''
                ? Number(formData.recoveredAmount) || 0
                : undefined,
            id: initialData?.id || Date.now().toString(),
            // The target is passed alongside rather than stored on the entry:
            // an entry already knows where it lives by being in that unit's
            // array, and a second copy of that fact could disagree with it.
        }, scope);
    };

    /** What the typed period resolves to, so an unreadable one is visible. */
    const periodKey = parsePeriod(formData.period);

    if (!isOpen) return null;

    // Scoped to the kind of asset, with whatever is already set always kept so
    // editing an old entry cannot silently change its classification. `legacy`
    // kinds are hidden from new entries — two ways to record the same thing is
    // how a figure ends up counted twice.
    const kindOptions = kindsFor(isRealEstate, formData.kind);

    const activeKind = ENTRY_KINDS[formData.kind] || ENTRY_KINDS.other_income;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            {/* Capped and scrollable.
                The card had no height limit and no overflow, so once the form
                grew — a unit picker, then the "who pays this" block — the
                Cancel and Add buttons fell below the bottom of the window with
                no way to reach them. The header and footer stay put; only the
                fields between them scroll. */}
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl scale-100 animate-scale-in flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        {initialData ? 'Edit Entry' : 'Add Entry'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                    {/* First, because it decides where everything below lands.
                        A rent row against the wrong shop is silently wrong: it
                        clears one unit's arrears and leaves another's standing. */}
                    {units.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Which unit?</label>
                            <select
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                            >
                                {units.map((u) => (
                                    <option key={u.id} value={u.id} className="bg-gray-900">
                                        {u.name}{u.selfOccupied ? ' (self-occupied)' : ''}
                                    </option>
                                ))}
                                <option value={BUILDING_SCOPE} className="bg-gray-900">
                                    The building itself
                                </option>
                            </select>
                            <p className="text-[11px] text-gray-500 mt-1.5">
                                {scope === BUILDING_SCOPE
                                    ? 'A cost for the whole property — tax on the structure, a shared repair'
                                    : 'This unit\'s rent, deposit or meter'}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">What is this?</label>
                        <select
                            name="kind"
                            value={formData.kind}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                        >
                            {kindOptions.map(([key, meta]) => (
                                <option key={key} value={key} className="bg-gray-900">{meta.label}</option>
                            ))}
                        </select>
                        <p className="text-[11px] mt-1.5" style={{ color: activeKind.color }}>
                            {activeKind.direction === 'income' ? 'Money received' : 'Money paid out'}
                            {activeKind.countsAsYield === false && ' · held on the tenant\'s behalf, not counted as return'}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                required
                            />
                        </div>
                        {kindHasPeriod(formData.kind) && (
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    {formData.kind === 'rent' ? 'Rent for month' : 'For month'}
                                </label>
                                <input
                                    type="month"
                                    name="period"
                                    value={formData.period}
                                    onChange={handleChange}
                                    placeholder="2026-08"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                />
                                {/* Confirmed back in words. In Safari this is a
                                    plain text box, so without an echo there is
                                    nothing to tell a typo from a valid month
                                    until the rent ledger quietly reports the
                                    month unpaid. */}
                                {formData.period ? (
                                    <p className={`text-[11px] mt-1 ${periodKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {periodKey
                                            ? `Counted against ${formatPeriod(periodKey)}`
                                            : 'Not a month I can read — try 2026-08 or August 2026'}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Which month this covers, not when it was paid
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                            <CurrencyInput
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    {/* Who actually carries this.
                        A bill you pay, a bill you pay and take back, and a bill
                        the tenant pays direct are three different things that
                        the amount alone cannot distinguish — and two of them
                        cost you nothing. */}
                    {asksWhoPays(formData.kind, isRealEstate) && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                            <label className="block text-sm font-medium text-gray-400 mb-2">Who pays this?</label>
                            <div className="space-y-1.5">
                                {Object.entries(BORNE_BY).map(([key, meta]) => {
                                    const active = (formData.borne || 'owner') === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setFormData((p) => ({ ...p, borne: key }))}
                                            className="w-full text-left px-3 py-2 rounded-lg border transition-all"
                                            style={{
                                                backgroundColor: active ? `${meta.color}1a` : 'rgba(255,255,255,0.02)',
                                                borderColor: active ? `${meta.color}59` : 'rgba(255,255,255,0.06)',
                                            }}
                                        >
                                            <span className="text-[12px] font-bold block"
                                                style={{ color: active ? meta.color : '#a1a1aa' }}>
                                                {meta.label}
                                            </span>
                                            <span className="text-[10px] text-gray-500">{meta.blurb}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {formData.borne === 'recovered' && (
                                <div className="mt-3">
                                    <label className="block text-[11px] font-medium text-gray-400 mb-1">
                                        How much has come back? Leave blank if all of it.
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        name="recoveredAmount"
                                        value={formData.recoveredAmount}
                                        onChange={handleChange}
                                        placeholder={formData.amount ? `${formData.amount} (all of it)` : 'all of it'}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            )}

                            {/* The consequence, in rupees, before it is saved. */}
                            {Number(formData.amount) > 0 && (
                                <p className="text-[11px] mt-2.5 font-mono"
                                    style={{ color: BORNE_BY[formData.borne || 'owner'].color }}>
                                    Costs you {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
                                        .format(netCost({ amount: formData.amount, borne: formData.borne, recoveredAmount: formData.recoveredAmount }))}
                                    {' '}of the {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
                                        .format(Math.abs(Number(formData.amount) || 0))} billed
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 h-20 resize-none"
                            placeholder="e.g., paid by UPI, meter reading 4821..."
                        />
                    </div>

                </form>

                {/* Outside the scroll area, so it is reachable however long the
                    form gets. Submits the form by id rather than by being
                    inside it. */}
                <div className="p-6 border-t border-white/10 flex gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-gray-300 font-medium hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        {initialData ? 'Update' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssetTransactionModal;
