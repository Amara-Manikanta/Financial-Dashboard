import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Calendar, FileText, ClipboardPaste } from 'lucide-react';
import { readComposition, writeComposition, ASSET_CLASSES } from '../utils/fundComposition';

const inputStyle = {
    backgroundColor: '#27272a',
    color: 'white',
    border: '1px solid #3f3f46',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.625rem',
    width: '100%',
    outline: 'none',
    fontSize: '12px',
};

const blankRow = () => ({
    key: `r_${Math.random().toString(36).slice(2)}`,
    symbol: '', name: '', weight: '', sector: '', assetClass: 'equity', rating: '',
});

/**
 * Enter what a fund holds, from its monthly disclosure.
 *
 * Weights are never renormalised. A factsheet that lists holdings summing to
 * 74% is recorded as 74%, and the shortfall is shown as unmapped — inflating it
 * to 100% would invent precision the disclosure does not have, which is exactly
 * the failure the built-in tables had.
 */
const FundCompositionModal = ({ isOpen, onClose, onSave, fund }) => {
    const [asOf, setAsOf] = useState('');
    const [source, setSource] = useState('');
    const [rows, setRows] = useState([]);
    const [pasteMode, setPasteMode] = useState(false);
    const [pasteText, setPasteText] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const comp = readComposition(fund);
        setAsOf(comp.asOf || new Date().toISOString().split('T')[0]);
        // A built-in table is offered as a starting point but labelled as such,
        // so saving it becomes a deliberate act rather than a silent blessing.
        setSource(comp.stored ? comp.source : '');
        setRows(comp.holdings.length
            ? comp.holdings.map((h) => ({ ...blankRow(), ...h, weight: String(h.weight) }))
            : [blankRow()]);
        setPasteMode(false);
        setPasteText('');
    }, [isOpen, fund]);

    const update = (key, field, value) =>
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

    const coverage = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    const unmapped = Math.max(0, 100 - coverage);
    const overweight = coverage > 100.5;

    /**
     * Paste rows straight from a factsheet. Accepts "SYMBOL<sep>WEIGHT" or
     * "SYMBOL<sep>NAME<sep>WEIGHT" with tab, comma or multiple spaces between,
     * because that is what copying out of a PDF or a table actually produces.
     */
    const applyPaste = () => {
        const parsed = pasteText.split('\n').map((line) => {
            const parts = line.split(/\t|,|\s{2,}/).map((p) => p.trim()).filter(Boolean);
            if (parts.length < 2) return null;
            const weight = parseFloat(String(parts[parts.length - 1]).replace('%', ''));
            if (!Number.isFinite(weight)) return null;
            return {
                ...blankRow(),
                symbol: parts[0].toUpperCase(),
                name: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
                weight: String(weight),
            };
        }).filter(Boolean);
        if (parsed.length) {
            setRows(parsed);
            setPasteMode(false);
            setPasteText('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const holdings = rows
            .filter((r) => r.symbol.trim() && Number(r.weight) > 0)
            .map((r) => ({
                symbol: r.symbol.trim(),
                name: r.name.trim(),
                weight: Number(r.weight),
                sector: r.sector.trim() || 'Other',
                assetClass: r.assetClass,
                rating: r.rating.trim(),
            }));
        onSave(writeComposition({ asOf, source, holdings }));
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <div>
                        <h3 className="text-lg font-black text-white">Fund Composition</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                            {fund?.title || 'Mutual Fund'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><X size={20} className="text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-zinc-800">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">As of (disclosure date)</label>
                            <div className="relative">
                                <input type="date" required value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ ...inputStyle, paddingLeft: '2rem' }} />
                                <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Source</label>
                            <div className="relative">
                                <input type="text" value={source} onChange={(e) => setSource(e.target.value)}
                                    placeholder="AMC monthly factsheet" style={{ ...inputStyle, paddingLeft: '2rem' }} />
                                <FileText size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                        <div className="flex items-center gap-3 text-[11px] font-bold">
                            <span className={overweight ? 'text-red-400' : 'text-emerald-400'}>
                                Coverage {coverage.toFixed(2)}%
                            </span>
                            <span className="text-gray-500">Unmapped {unmapped.toFixed(2)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setPasteMode((v) => !v)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-[11px] font-bold hover:bg-white/10">
                                <ClipboardPaste size={13} /> Paste list
                            </button>
                            <button type="button" onClick={() => setRows((p) => [...p, blankRow()])}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 text-[11px] font-bold hover:bg-indigo-500/25">
                                <Plus size={13} /> Add holding
                            </button>
                        </div>
                    </div>

                    {overweight && (
                        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-[11px] font-bold text-red-300">
                            Weights total more than 100%. Check the figures before saving — this is recorded as entered, not scaled.
                        </div>
                    )}

                    {pasteMode && (
                        <div className="p-5 border-b border-zinc-800 space-y-2">
                            <p className="text-[11px] text-gray-400">
                                One holding per line: <span className="font-mono text-gray-300">SYMBOL, name, weight</span> —
                                tabs, commas or wide spaces all work. This replaces the rows below.
                            </p>
                            <textarea rows={6} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                                style={{ ...inputStyle, fontFamily: 'monospace' }}
                                placeholder={'HDFCBANK\tHDFC Bank Limited\t11.52\nRELIANCE\tReliance Industries\t9.78'} />
                            <button type="button" onClick={applyPaste}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">Parse rows</button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2">
                        {rows.map((r) => (
                            <div key={r.key} className="grid grid-cols-12 gap-2 items-center">
                                <input className="col-span-2" placeholder="SYMBOL" value={r.symbol}
                                    onChange={(e) => update(r.key, 'symbol', e.target.value.toUpperCase())} style={inputStyle} />
                                <input className="col-span-4" placeholder="Name" value={r.name}
                                    onChange={(e) => update(r.key, 'name', e.target.value)} style={inputStyle} />
                                <input className="col-span-2" placeholder="Sector" value={r.sector}
                                    onChange={(e) => update(r.key, 'sector', e.target.value)} style={inputStyle} />
                                <select className="col-span-2" value={r.assetClass}
                                    onChange={(e) => update(r.key, 'assetClass', e.target.value)} style={inputStyle}>
                                    {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <input className="col-span-1" type="number" step="any" placeholder="%" value={r.weight}
                                    onChange={(e) => update(r.key, 'weight', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                                <button type="button" onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                                    className="col-span-1 flex justify-center p-1.5 rounded-lg text-red-400 hover:bg-red-500/15">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-5 border-t border-zinc-800 flex items-center justify-between gap-3">
                        <p className="text-[10px] text-gray-500">
                            Weights are stored exactly as entered. A partial disclosure stays partial.
                        </p>
                        <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700">
                            Save composition
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default FundCompositionModal;
