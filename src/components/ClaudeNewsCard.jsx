import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, KeyRound, Play, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { API_URL } from '../utils/apiUrl';

const rupees = (n) => `₹${(Number(n) || 0).toFixed(2)}`;
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '');

/**
 * Where the Claude news reader is configured and watched: the API key, the
 * on/off switch, today's spend against the daily limit and the last daily run.
 * The key is sent to the local server once, saved in .env.local, and never
 * shown again — only its last four characters come back.
 */
const ClaudeNewsCard = () => {
    const [status, setStatus] = useState(null);
    const [key, setKey] = useState('');
    const [busy, setBusy] = useState('');
    const [note, setNote] = useState(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/analyst/claude/status`);
            if (!r.ok) throw new Error(r.status === 404 ? 'Restart the server to enable this.' : `HTTP ${r.status}`);
            setStatus(await r.json());
        } catch (err) {
            setNote({ bad: true, text: err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message });
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    // While a daily run is going, keep the numbers moving.
    useEffect(() => {
        if (!status?.running) return undefined;
        const id = setInterval(load, 5000);
        return () => clearInterval(id);
    }, [status?.running, load]);

    const call = async (path, init, label) => {
        setBusy(label);
        setNote(null);
        try {
            const r = await fetch(`${API_URL}/api/analyst/claude/${path}`, init);
            const body = await r.json();
            if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
            setStatus(body);
            return true;
        } catch (err) {
            setNote({ bad: true, text: err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message });
            return false;
        } finally {
            setBusy('');
        }
    };

    const saveKey = async (e) => {
        e.preventDefault();
        const ok = await call('key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) }, 'key');
        if (ok) { setKey(''); setNote({ text: 'Key saved. Switch Claude reading on below.' }); }
    };

    const removeKey = async () => {
        if (!window.confirm('Remove the API key from this computer? Claude reading will switch off.')) return;
        const ok = await call('key', { method: 'DELETE' }, 'key');
        if (ok) setNote({ text: 'Key removed.' });
    };

    const toggle = () => call(`enabled?on=${status.enabled ? 0 : 1}`, { method: 'POST' }, 'toggle');
    const runNow = async () => {
        const ok = await call('run-daily', { method: 'POST' }, 'run');
        if (ok) setNote({ text: 'Started. It reads each held stock, then updates its brief; this takes a few minutes.' });
    };

    const last = status?.lastDailyRun;
    const pct = status ? Math.min(100, (status.spentTodayInr / status.dailyCapInr) * 100) : 0;

    return (
        <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b] mb-6">
            <h3 className="text-base font-black text-white m-0 flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" /> Claude news reading
            </h3>
            <p className="text-[11px] text-gray-500 mt-1 max-w-xl leading-relaxed">
                Claude reads your stocks&apos; news and keeps a short running brief for each one. Only company names and news text are sent,
                never your quantities, values or tax. Without a key, the local model reads the news as before.
            </p>

            {!status ? (
                <p className="text-[12px] text-gray-500 mt-3">Loading…</p>
            ) : (
                <>
                    <form onSubmit={saveKey} className="mt-4 flex flex-wrap items-center gap-2">
                        <KeyRound size={14} className="text-gray-500" />
                        {status.configured && (
                            <span className="text-[12px] text-emerald-300 font-bold flex items-center gap-1">
                                <CheckCircle2 size={13} /> Key saved ({status.keyHint})
                            </span>
                        )}
                        <input
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            autoComplete="off"
                            placeholder={status.configured ? 'Paste a new key to replace it' : 'Paste your Anthropic API key (sk-ant-…)'}
                            className="flex-1 min-w-[220px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white outline-none focus:border-violet-500/50"
                        />
                        <button type="submit" disabled={!key.trim() || !!busy} className="px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-[11px] font-black">
                            {busy === 'key' ? 'Saving…' : status.configured ? 'Replace key' : 'Save key'}
                        </button>
                        {status.configured && (
                            <button type="button" onClick={removeKey} disabled={!!busy} title="Remove the key from .env.local" className="px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-rose-300 disabled:opacity-40">
                                <Trash2 size={13} />
                            </button>
                        )}
                    </form>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                        <label className={`flex items-center gap-2 text-[12px] font-bold ${status.configured ? 'text-gray-200 cursor-pointer' : 'text-gray-600'}`}>
                            <input type="checkbox" checked={!!status.enabled} disabled={!status.configured || !!busy} onChange={toggle} className="accent-violet-500 w-4 h-4" />
                            Claude reading {status.enabled ? 'on' : 'off'}
                        </label>
                        <button type="button" onClick={runNow} disabled={!status.configured || !status.enabled || status.running || !!busy} title="Read every held stock's news and update its brief now, instead of waiting for tomorrow morning" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-40 text-[11px] font-black flex items-center gap-1.5">
                            <Play size={11} /> {status.running ? 'Running…' : 'Run daily reading now'}
                        </button>
                    </div>

                    {status.configured && (
                        <div className="mt-4">
                            <div className="flex flex-wrap justify-between gap-2 text-[11px] text-gray-400 font-bold">
                                <span>Today {rupees(status.spentTodayInr)} of {rupees(status.dailyCapInr)} limit</span>
                                <span>Last 30 days {rupees(status.spent30DaysInr)} · {status.calls30Days} calls · {status.model}</span>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className={`h-full ${pct >= 90 ? 'bg-rose-400' : 'bg-violet-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[11px] text-gray-500 mt-2">
                                {last
                                    ? `Last daily run ${when(last.at)}: ${last.stocks} stocks, ${last.read} stories read, ${last.briefs} briefs updated${last.stopped ? ` — stopped: ${last.stopped}` : ''}${last.errors?.length ? ` · ${last.errors.length} problem${last.errors.length === 1 ? '' : 's'}` : ''}.`
                                    : 'No daily run yet. It runs by itself each morning after 7 am while switched on.'}
                            </p>
                            {last?.errors?.length > 0 && (
                                <ul className="mt-1 text-[10.5px] text-amber-300 list-disc pl-4">
                                    {last.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            )}
                        </div>
                    )}
                </>
            )}
            {note && (
                <p className={`text-[11.5px] mt-3 flex items-center gap-1.5 ${note.bad ? 'text-rose-300' : 'text-gray-300'}`}>
                    {note.bad && <AlertTriangle size={12} />} {note.text}
                </p>
            )}
        </div>
    );
};

export default ClaudeNewsCard;
