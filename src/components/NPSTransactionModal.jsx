import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText, Hash } from 'lucide-react';
import CurrencyInput from './CurrencyInput';
import { schemeName } from '../utils/nps';

const inputStyle = {
    backgroundColor: '#27272a',
    color: 'white',
    border: '1px solid #3f3f46',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    width: '100%',
    outline: 'none'
};

const iconStyle = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: '0.75rem',
    pointerEvents: 'none',
    color: '#9ca3af',
    width: '18px',
    height: '18px'
};

const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 1rem center',
    backgroundSize: '16px'
};

const NPSTransactionModal = ({ isOpen, onClose, onSave, initialData, holdings }) => {
    const [schemeId, setSchemeId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [nav, setNav] = useState('');
    const [units, setUnits] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setSchemeId(initialData.schemeId || (holdings && holdings.length > 0 ? holdings[0].id : ''));
                setDate(initialData.date);
                setDescription(initialData.description || initialData.remarks || '');
                setAmount(initialData.amount !== undefined ? initialData.amount : '');
                setNav(initialData.nav !== undefined ? initialData.nav : '');
                setUnits(initialData.units !== undefined ? initialData.units : '');
            } else {
                setSchemeId(holdings && holdings.length > 0 ? holdings[0].id : '');
                setDate(new Date().toISOString().split('T')[0]);
                setDescription('');
                setAmount('');
                setNav('');
                setUnits('');
            }
        }
    }, [isOpen, initialData, holdings]);

    /** NAV is amount ÷ units, so it never has to be typed if both are known. */
    const derivedNav = Number(units) > 0 ? Math.abs(Number(amount) || 0) / Number(units) : 0;

    const handleSubmit = (e) => {
        e.preventDefault();

        const parsedAmount = parseFloat(amount || 0);

        onSave({
            // Spread first. A stored row carries more than this form shows —
            // a fund transaction linked to an expense carries `expenseId` and
            // `adoptedByExpense`, and detachExpense deletes rather than releases
            // a row whose flag has gone missing. Rebuilding the object dropped
            // both and silently broke the link.
            ...(initialData || {}),
            id: initialData?.id || Date.now(),
            // Taken from the holding itself rather than Number(schemeId): the
            // select yields a string, and coercing an id that is not numeric
            // gives NaN, which then matches no holding and drops the line.
            schemeId: (holdings || []).find(h => String(h.id) === String(schemeId))?.id ?? schemeId,
            date,
            description,
            amount: parsedAmount,
            // Left blank means "work it out", not zero — a stored NAV of 0 is
            // what three existing rows carry and it makes the unit price
            // unrecoverable later.
            nav: nav === '' || nav === null || nav === undefined
                ? Math.round(derivedNav * 10000) / 10000
                : parseFloat(nav),
            units: parseFloat(units || 0),
            type: parsedAmount < 0 ? 'billing' : 'contribution'
        });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#18181b', border: '1px solid #27272a',
                borderRadius: '1rem', width: '100%', maxWidth: '400px',
                position: 'relative', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-lg font-bold text-white">{initialData ? 'Edit Statement Line' : 'Add Statement Line'}</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scheme</label>
                        <div className="relative">
                            <select required value={schemeId} onChange={e => setSchemeId(e.target.value)} style={selectStyle}>
                                <option value="" disabled>Select Scheme</option>
                                {holdings && holdings.map(h => (
                                    <option key={h.id} value={h.id}>{schemeName(h)}</option>
                                ))}
                            </select>
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
                            <div className="relative">
                                <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                                <Calendar style={iconStyle} />
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amount (₹)</label>
                            <div className="relative">
                                {/* Using regular input here because CurrencyInput doesn't easily support typing negative numbers like (-15) out of the box in some implementations, but we will allow it. */}
                                <input type="number" step="any" required value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">NAV</label>
                            <div className="relative">
                                {/* Optional: it is the amount divided by the
                                    units, and a statement does not always print
                                    it. Three rows on record have none. */}
                                <input type="number" step="any" value={nav} onChange={e => setNav(e.target.value)} style={inputStyle}
                                    placeholder={derivedNav ? derivedNav.toFixed(4) : '0.0000'} />
                                <div style={iconStyle}><span className="text-sm font-bold">₹</span></div>
                            </div>
                            {derivedNav > 0 && !nav && (
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Will be worked out as ₹{derivedNav.toFixed(4)}
                                </p>
                            )}
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Units</label>
                            <div className="relative">
                                <input type="number" step="any" required value={units} onChange={e => setUnits(e.target.value)} style={inputStyle} placeholder="0.0000" />
                                <Hash style={iconStyle} />
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Description</label>
                        <div className="relative">
                            {/* Not required.
                                It had been, and there was never a reason: a
                                contribution is identified by its scheme, date,
                                amount and units. Four of the 69 rows on record
                                carry a description and all four say some form of
                                "By Volunteer", so the rule blocked entry for the
                                other 65 to collect nothing. */}
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                style={inputStyle}
                                placeholder="Optional — e.g. By Voluntary Contribution"
                            />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors mt-2">
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default NPSTransactionModal;
