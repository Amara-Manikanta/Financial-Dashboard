import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, ClipboardPaste, Trash2, ArrowUp, ArrowDown, Check, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';
import { CALLS, parseResearch, matchHoldings, compareCalls, latestCalls, callHistory, callRank } from '../utils/researchImport';
import { promptHoldings, dailyPrompt, deepDivePrompt } from '../utils/researchPrompt';

/**
 * Daily research from an outside run (Google Antigravity): copy the prompt, paste
 * the table it returns, and the calls are stored per day and compared with the
 * day before. Nothing here changes a holding or places an order — it is a record
 * of what was said, kept beside the database (db/strategy), not in it.
 */

const ALIAS_KEY = 'kubera.research.aliases';
const readAliases = () => { try { return JSON.parse(localStorage.getItem(ALIAS_KEY) || '{}') || {}; } catch { return {}; } };
const writeAliases = (a) => { try { localStorage.setItem(ALIAS_KEY, JSON.stringify(a)); } catch { /* private mode */ } };

const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CALL_STYLE = {
    BUY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    ACCUMULATE: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    HOLD: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    REVIEW: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    SELL: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const CallBadge = ({ call }) => (
    <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-black tracking-wide ${CALL_STYLE[call] || 'bg-white/5 text-gray-400 border-white/10'}`}>{call}</span>
);

const Change = ({ change, previousCall }) => {
    if (change === 'upgrade') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400"><ArrowUp size={11} /> from {previousCall}</span>;
    if (change === 'downgrade') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400"><ArrowDown size={11} /> from {previousCall}</span>;
    if (change === 'new') return <span className="text-[10px] font-bold text-sky-400">first call</span>;
    if (change === 'same') return <span className="text-[10px] text-gray-500">unchanged</span>;
    return null;
};

const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    }
};

const AnalystResearch = ({ stocks }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [loadError, setLoadError] = useState('');
    const [text, setText] = useState('');
    const [date, setDate] = useState(localToday());
    const [parsed, setParsed] = useState(null);
    const [aliases, setAliases] = useState(readAliases);
    const [saving, setSaving] = useState(false);
    const [note, setNote] = useState('');
    const [open, setOpen] = useState({});
    const [picked, setPicked] = useState({});

    const holdings = useMemo(() => (stocks || []).filter((s) => !s.isArchived && Number(s.shares) > 0), [stocks]);
    const holdingById = useMemo(() => new Map(holdings.map((h) => [String(h.id), h])), [holdings]);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/analyst/strategy?limit=120`);
            if (!r.ok) throw new Error(r.status === 404 ? 'Restart npm run server to store research.' : `HTTP ${r.status}`);
            setSnapshots((await r.json()).snapshots || []);
            setLoadError('');
        } catch (err) {
            setLoadError(err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const latest = useMemo(() => latestCalls(snapshots, localToday()), [snapshots]);
    const lastCallMap = useMemo(() => new Map([...latest].map(([id, r]) => [id, { call: r.call, date: r.date }])), [latest]);
    const promptRows = useMemo(() => promptHoldings(holdings, lastCallMap), [holdings, lastCallMap]);

    // Rows for the table of current calls, with what moved at the last change.
    const table = useMemo(() => holdings.map((h) => {
        const id = String(h.id);
        const call = latest.get(id) || null;
        const hist = callHistory(snapshots, id);
        const lastChange = [...hist].reverse().find((x) => x.changed && hist.indexOf(x) > 0);
        const before = lastChange ? hist[hist.indexOf(lastChange) - 1] : null;
        return { h, call, hist, lastChange, before };
    }).sort((a, b) => (b.call ? callRank(b.call.call) : -2) - (a.call ? callRank(a.call.call) : -2) || a.h.name.localeCompare(b.h.name)), [holdings, latest, snapshots]);

    // Pre-ticked for a deeper look: a call that moved at the latest snapshot, or REVIEW / SELL.
    const flagged = useMemo(() => {
        const newest = snapshots.length ? snapshots[snapshots.length - 1].date : null;
        return table.filter((t) => t.call && (['REVIEW', 'SELL'].includes(t.call.call) || (t.lastChange && t.lastChange.date === newest)));
    }, [table, snapshots]);

    const readTable = () => {
        setNote('');
        const result = parseResearch(text);
        if (result.error) { setParsed({ error: result.error, rows: [], skipped: [] }); return; }
        const matched = matchHoldings(result.rows, holdings.map((h) => ({ id: h.id, name: h.name })), aliases);
        // Compared with the newest snapshot dated before the one being saved.
        const prior = [...snapshots].filter((s) => s.date < date).pop();
        setParsed({ rows: compareCalls(prior ? prior.rows : [], matched), skipped: result.skipped, priorDate: prior ? prior.date : null });
    };

    const assign = (index, holdingId) => {
        setParsed((p) => {
            const rows = p.rows.map((r, i) => (i === index ? { ...r, holdingId: holdingId || null, matchedBy: holdingId ? 'picked' : null, ambiguous: undefined } : r));
            if (holdingId) {
                const next = { ...aliases, [String(p.rows[index].name).toLowerCase()]: holdingId };
                setAliases(next); writeAliases(next);
            }
            const prior = [...snapshots].filter((s) => s.date < date).pop();
            return { ...p, rows: compareCalls(prior ? prior.rows : [], rows.map(({ previousCall, change, ...r }) => r)) };
        });
    };

    const unmatched = parsed?.rows?.filter((r) => !r.holdingId) || [];
    const notMentioned = parsed?.rows ? holdings.filter((h) => !parsed.rows.some((r) => String(r.holdingId) === String(h.id))) : [];

    const save = async () => {
        if (!parsed?.rows?.length) return;
        setSaving(true); setNote('');
        try {
            const rows = parsed.rows.map(({ previousCall, change, matchedBy, ambiguous, ...r }) => r);
            const r = await fetch(`${API_URL}/api/analyst/strategy`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, rows, source: 'pasted' }),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
            setNote(`Saved ${rows.length} call${rows.length === 1 ? '' : 's'} for ${date}${rows.some((x) => !x.holdingId) ? ` (${rows.filter((x) => !x.holdingId).length} not matched to a holding)` : ''}.`);
            setParsed(null); setText('');
            await load();
        } catch (err) {
            setNote(`Not saved: ${err.message === 'Failed to fetch' ? 'could not reach the API server' : err.message}`);
        }
        setSaving(false);
    };

    const removeDay = async (d) => {
        if (!window.confirm(`Delete the research saved for ${d}?`)) return;
        await fetch(`${API_URL}/api/analyst/strategy?date=${encodeURIComponent(d)}`, { method: 'DELETE' });
        load();
    };

    const copyDaily = async () => setNote((await copy(dailyPrompt(promptRows))) ? 'Daily prompt copied. Paste it into Antigravity.' : 'Could not copy.');
    const copyDeep = async () => {
        const ids = Object.keys(picked).filter((k) => picked[k]);
        const chosen = ids.length ? ids : flagged.map((t) => String(t.h.id));
        const rows = promptRows.filter((r) => chosen.includes(r.id));
        if (!rows.length) { setNote('Tick the stocks to look at more closely first.'); return; }
        const reasons = Object.fromEntries(rows.map((r) => {
            const t = table.find((x) => String(x.h.id) === r.id);
            const why = t?.call ? (t.lastChange && t.lastChange.date === snapshots[snapshots.length - 1]?.date ? `call changed ${t.before.call} → ${t.call.call}` : `currently ${t.call.call}`) : 'no call yet';
            return [r.id, ids.length ? `chosen by me (${why})` : why];
        }));
        setNote((await copy(deepDivePrompt(rows, reasons))) ? `Deep-dive prompt for ${rows.length} stock${rows.length === 1 ? '' : 's'} copied.` : 'Could not copy.');
    };

    const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black transition-colors';

    return (
        <div className="space-y-5">
            <p className="text-[11px] text-gray-500 max-w-2xl leading-relaxed">
                Each day: copy the prompt, run it in Google Antigravity, paste the table it returns below. The calls are saved by date and compared with
                the day before. This records what the research said — it is a second opinion to read, not an instruction, and it never changes a holding.
            </p>

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={copyDaily} className={`${btn} bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25`}><ClipboardCopy size={13} /> Copy daily prompt</button>
                <button type="button" onClick={copyDeep} className={`${btn} bg-white/5 border-white/10 text-gray-300 hover:bg-white/10`}><ClipboardCopy size={13} /> Copy deep-dive prompt{Object.values(picked).some(Boolean) ? ' (ticked)' : ` (${flagged.length} flagged)`}</button>
                {note && <span className="text-[11px] text-gray-400">{note}</span>}
            </div>
            {loadError && <p className="text-[11px] text-rose-400">{loadError}</p>}

            {/* Paste */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Paste today's table</h3>
                    <label className="text-[11px] text-gray-500 flex items-center gap-2">For
                        <input type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value)} className="bg-black/40 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white" />
                    </label>
                </div>
                <textarea
                    value={text}
                    onChange={(e) => { setText(e.target.value); setParsed(null); }}
                    rows={6}
                    placeholder="| Stock | Recommendation | Reason | … paste the whole table, header row included"
                    className="w-full rounded-lg bg-black/40 border border-white/10 p-3 text-[11px] font-mono text-gray-200 placeholder:text-gray-600 outline-none focus:border-indigo-500/50"
                />
                <button type="button" onClick={readTable} disabled={!text.trim()} className={`${btn} bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-40`}><ClipboardPaste size={13} /> Read the table</button>

                {parsed?.error && <p className="text-[11px] text-rose-400">{parsed.error}</p>}
                {parsed?.rows?.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-[11px] text-gray-400">
                            {parsed.rows.length} calls read{parsed.priorDate ? `, compared with ${parsed.priorDate}` : ' (nothing earlier to compare with)'}.
                            {' '}{parsed.rows.filter((r) => r.change === 'upgrade' || r.change === 'downgrade').length} changed.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Holding</th><th className="pr-3">Call</th><th className="pr-3">Since last</th><th>Reason</th></tr></thead>
                                <tbody>
                                    {parsed.rows.map((r, i) => (
                                        <tr key={`${r.name}-${i}`} className="border-t border-white/5 align-top">
                                            <td className="py-1.5 pr-3 min-w-[170px]">
                                                {r.holdingId
                                                    ? <span className="text-white font-bold">{holdingById.get(String(r.holdingId))?.name || r.name}</span>
                                                    : (
                                                        <div>
                                                            <span className="text-amber-300 font-bold flex items-center gap-1"><AlertTriangle size={11} /> {r.name}</span>
                                                            <select value="" onChange={(e) => assign(i, e.target.value)} className="mt-1 bg-black/40 border border-white/10 rounded-md px-1.5 py-1 text-[11px] text-gray-300 max-w-[210px]">
                                                                <option value="">{r.ambiguous ? `Which? (${r.ambiguous.join(' / ')})` : 'Pick the holding…'}</option>
                                                                {holdings.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                            </td>
                                            <td className="pr-3"><CallBadge call={r.call} /></td>
                                            <td className="pr-3 whitespace-nowrap"><Change change={r.change} previousCall={r.previousCall} /></td>
                                            <td className="text-gray-400 max-w-xl">{r.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {parsed.skipped.length > 0 && (
                            <p className="text-[11px] text-amber-300">Not read ({parsed.skipped.length}): {parsed.skipped.map((s) => `${s.name} — ${s.why}`).join('; ')}</p>
                        )}
                        {notMentioned.length > 0 && (
                            <p className="text-[11px] text-gray-500">Not in this paste ({notMentioned.length}): {notMentioned.map((h) => h.name).join(', ')}. Their earlier calls stay, marked with their age.</p>
                        )}
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={save} disabled={saving} className={`${btn} bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40`}><Check size={13} /> Save {parsed.rows.length} call{parsed.rows.length === 1 ? '' : 's'} for {date}</button>
                            {unmatched.length > 0 && <span className="text-[11px] text-amber-300">{unmatched.length} not matched to a holding: saved as written, but left out of the comparison and the current-calls table.</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Current calls */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Current calls {snapshots.length ? `· latest ${snapshots[snapshots.length - 1].date}` : ''}</h3>
                {snapshots.length === 0 ? <p className="text-[11px] text-gray-500">Nothing saved yet. Paste your first table above.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead><tr className="text-left text-gray-500"><th className="w-6" /><th className="py-1 pr-3">Holding</th><th className="pr-3">Call</th><th className="pr-3">Last change</th><th className="pr-3">As of</th><th className="w-6" /></tr></thead>
                            <tbody>
                                {table.map(({ h, call, hist, lastChange, before }) => {
                                    const id = String(h.id);
                                    const isOpen = !!open[id];
                                    const isPicked = picked[id] !== undefined ? picked[id] : false;
                                    return (
                                        <React.Fragment key={id}>
                                            <tr className="border-t border-white/5 align-top cursor-pointer hover:bg-white/[0.02]" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
                                                <td className="py-1.5" onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" checked={isPicked} onChange={(e) => setPicked((p) => ({ ...p, [id]: e.target.checked }))} title="Include in the deep-dive prompt" />
                                                </td>
                                                <td className="py-1.5 pr-3 text-white font-bold">{h.name}</td>
                                                <td className="pr-3">{call ? <CallBadge call={call.call} /> : <span className="text-gray-600">no call yet</span>}</td>
                                                <td className="pr-3 text-gray-400">{lastChange ? <span>{before.call} → {lastChange.call} <span className="text-gray-600">· {lastChange.date}</span></span> : (call ? 'unchanged' : '')}</td>
                                                <td className={`pr-3 ${call && call.ageDays > 1 ? 'text-amber-400' : 'text-gray-500'}`}>{call ? (call.ageDays === 0 ? 'today' : `${call.ageDays}d old`) : ''}</td>
                                                <td className="text-gray-600">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                                            </tr>
                                            {isOpen && call && (
                                                <tr className="bg-black/20">
                                                    <td />
                                                    <td colSpan={5} className="py-2 pr-3 text-gray-300 space-y-1.5">
                                                        <p><span className="text-gray-500">Reason · </span>{call.reason || '—'}</p>
                                                        <p><span className="text-gray-500">News · </span>{call.news || '—'}</p>
                                                        <p><span className="text-gray-500">What would change it · </span>{call.trigger || '—'}</p>
                                                        <p className="text-gray-500">History: {hist.map((x) => `${x.date.slice(5)} ${x.call}`).filter((_, i) => hist[i].changed).join('  →  ') || '—'}</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {snapshots.length > 0 && (
                <div className="text-[11px] text-gray-500">
                    Saved days:{' '}
                    {[...snapshots].reverse().slice(0, 14).map((s) => (
                        <span key={s.date} className="inline-flex items-center gap-1 mr-3">
                            {s.date} ({s.rows.length})
                            <button type="button" onClick={() => removeDay(s.date)} className="text-gray-600 hover:text-rose-400" title="Delete this day"><Trash2 size={11} /></button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AnalystResearch;
