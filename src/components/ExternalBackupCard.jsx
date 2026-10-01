import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { API_URL } from '../utils/apiUrl';

const kb = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

/**
 * A copy to the external drive, taken by hand.
 *
 * The backups folder beside the database survives an app bug but not a dead
 * disk, and the iCloud copy is a sync — a corruption reaches it in seconds.
 * This is the offline tier, and it only ever runs when this button is pressed.
 */
const ExternalBackupCard = () => {
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/backup/external`);
            setStatus(r.ok ? await r.json() : { ready: false });
        } catch {
            setStatus({ ready: false });
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const run = async (force) => {
        setBusy(true);
        setResult(null);
        try {
            const r = await fetch(`${API_URL}/api/backup/external${force ? '?force=1' : ''}`, { method: 'POST' });
            setResult(await r.json());
        } catch (err) {
            setResult({ ok: false, reason: err.message });
        } finally {
            setBusy(false);
            load();
        }
    };

    const ready = status?.ready;
    const last = status?.last;
    const age = status?.lastAgeDays;

    return (
        <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b] mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h3 className="text-base font-black text-white m-0 flex items-center gap-2">
                        <HardDrive size={16} className="text-indigo-400" /> External drive backup
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 max-w-xl leading-relaxed">
                        Copies your database and every photo, bill and policy scan to the drive.
                        A new copy is taken once the last is {status?.minAgeDays ?? 30} days old, and the
                        two most recent are kept.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        disabled={busy || !ready}
                        onClick={() => run(false)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 disabled:opacity-40"
                    >
                        {busy ? 'Copying…' : 'Back up now'}
                    </button>
                    <button
                        type="button"
                        onClick={load}
                        title="Re-check the drive"
                        className="px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            <div className="mt-4 text-xs">
                {status === null && <span className="text-gray-600">Checking the drive…</span>}

                {status && !ready && (
                    <span className="flex items-center gap-1.5 text-amber-400">
                        <AlertTriangle size={13} /> The drive is not connected. Plug it in and press refresh.
                    </span>
                )}

                {ready && !last && (
                    <span className="flex items-center gap-1.5 text-gray-400">
                        <Clock size={13} /> No backup on this drive yet.
                    </span>
                )}

                {ready && last && (
                    <span className="flex items-center gap-1.5 text-gray-400">
                        <Clock size={13} />
                        Last copy {age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}
                        {status.due ? ' — due' : ` · next due in ${status.minAgeDays - age} days`}
                    </span>
                )}

                {ready && status.unfinished > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-400/90">
                        <AlertTriangle size={12} />
                        {status.unfinished} earlier {status.unfinished === 1 ? 'copy' : 'copies'} did not finish — likely
                        the drive was unplugged. {status.unfinished === 1 ? 'It is' : 'They are'} not counted as a
                        backup and will be cleared on the next run.
                    </div>
                )}

                {ready && status.backups?.length > 0 && (
                    <div className="mt-2 text-[11px] text-gray-600 font-mono">
                        Kept: {status.backups.map((b) => b.name.replace('kubera-', '')).join(' · ')}
                    </div>
                )}
            </div>

            {result && (
                <div className={`mt-4 rounded-xl p-3 border text-xs ${
                    result.ok ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                    {result.ok ? (
                        <>
                            <p className="flex items-center gap-1.5 font-bold text-emerald-300 m-0">
                                <CheckCircle2 size={13} /> Copied {kb(result.totalBytes)} to the drive
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1 m-0">
                                {result.copied.map((c) => `${c.what}${c.files ? ` (${c.files} files)` : ''}`).join(' · ')}
                            </p>
                            {result.removed?.length > 0 && (
                                <p className="text-[11px] text-gray-500 mt-1 m-0">
                                    Removed the oldest: {result.removed.join(', ')}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="flex items-center gap-1.5 font-bold text-amber-300 m-0">
                                <AlertTriangle size={13} /> {result.skipped ? 'Not due yet' : 'Could not back up'}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1 m-0">{result.reason}</p>
                            {result.skipped && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => run(true)}
                                    className="mt-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/15 text-gray-300 hover:bg-white/5 disabled:opacity-40"
                                >
                                    Back up anyway
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExternalBackupCard;
