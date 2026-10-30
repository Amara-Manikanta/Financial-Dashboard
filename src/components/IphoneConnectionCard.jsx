import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone, Wifi, Trash2, AlertTriangle } from 'lucide-react';
import { API_URL } from '../utils/apiUrl';

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : 'never');

/**
 * Connecting the iPhone app to this Mac over Wi-Fi.
 *
 * Off by default. While on, a phone needs the six-digit code shown here before
 * it can read or write anything; the Mac stays the only copy of the data
 * (see lanAccess.js). The code is shown here only — a paired phone cannot
 * request one, and the server refuses these controls from any other device.
 */
const IphoneConnectionCard = () => {
    const [status, setStatus] = useState(null);
    const [code, setCode] = useState(null);       // { code, expiresAt }
    const [left, setLeft] = useState(0);
    const [busy, setBusy] = useState('');
    const [note, setNote] = useState(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/lan/status`);
            if (!r.ok) throw new Error(r.status === 404 ? 'Restart the server to enable this.' : `HTTP ${r.status}`);
            setStatus(await r.json());
        } catch (err) {
            setNote({ bad: true, text: err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message });
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    // Paired phones appear and last-seen moves while this page is open.
    useEffect(() => {
        if (!status?.enabled) return undefined;
        const id = setInterval(load, 5000);
        return () => clearInterval(id);
    }, [status?.enabled, load]);

    useEffect(() => {
        if (!code) return undefined;
        const tick = () => {
            const s = Math.max(0, Math.round((Date.parse(code.expiresAt) - Date.now()) / 1000));
            setLeft(s);
            if (s === 0) setCode(null);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [code]);

    // A phone pairing successfully uses up the code, so drop it from view.
    useEffect(() => { if (code && status && !status.pairing) setCode(null); }, [status, code]);

    const call = async (path, method, label) => {
        setBusy(label);
        setNote(null);
        try {
            const r = await fetch(`${API_URL}/api/lan/${path}`, { method });
            const body = await r.json();
            if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
            return body;
        } catch (err) {
            setNote({ bad: true, text: err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message });
            return null;
        } finally {
            setBusy('');
        }
    };

    const toggle = async () => {
        const body = await call(`enabled?on=${status.enabled ? 0 : 1}`, 'POST', 'toggle');
        if (body) { setStatus(body); if (!body.enabled) setCode(null); }
    };

    const showCode = async () => {
        const body = await call('pair', 'POST', 'code');
        if (body) { setCode({ code: body.code, expiresAt: body.expiresAt }); setStatus(body); }
    };

    const unpair = async (d) => {
        if (!window.confirm(`Disconnect ${d.name}? It will need a new code to connect again.`)) return;
        const body = await call(`devices/${encodeURIComponent(d.id)}`, 'DELETE', 'unpair');
        if (body) setStatus(body);
    };

    return (
        <div className="card p-5 rounded-2xl border border-white/5 bg-[#18181b] mb-6">
            <h3 className="text-base font-black text-white m-0 flex items-center gap-2">
                <Smartphone size={16} className="text-sky-400" /> iPhone connection
            </h3>
            <p className="text-[11px] text-gray-500 mt-1 max-w-xl leading-relaxed">
                Lets the Kubera iPhone app use this Mac&apos;s data over your home Wi-Fi. Nothing is copied to the phone, so there is nothing to
                merge or lose. Your phone must be on the same Wi-Fi, and this Mac must be on.
            </p>

            {!status ? (
                <p className="text-[12px] text-gray-500 mt-3">Loading…</p>
            ) : (
                <>
                    <label className="mt-4 flex items-center gap-2 text-[12px] font-bold text-gray-200 cursor-pointer w-fit">
                        <input type="checkbox" checked={!!status.enabled} disabled={!!busy} onChange={toggle} className="accent-sky-500 w-4 h-4" />
                        iPhone connection {status.enabled ? 'on' : 'off'}
                    </label>

                    {status.enabled && (
                        <>
                            <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
                                <Wifi size={12} /> {status.listening ? `Listening as ${status.host}${status.address ? ` (${status.address})` : ''}, port ${status.port}` : 'Not listening — the port may be in use.'}
                            </p>

                            <div className="mt-4">
                                {code ? (
                                    <div className="inline-block rounded-xl border border-sky-500/30 bg-sky-500/5 px-5 py-3">
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-sky-300">Enter this on your iPhone</p>
                                        <p className="text-3xl font-black tracking-[0.3em] text-white mt-1 tabular-nums">{code.code.slice(0, 3)} {code.code.slice(3)}</p>
                                        <p className="text-[10.5px] text-gray-500 mt-1">Works once · expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
                                    </div>
                                ) : (
                                    <button type="button" onClick={showCode} disabled={!!busy || !status.listening} className="px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white text-[11px] font-black">
                                        {busy === 'code' ? 'Creating…' : 'Show pairing code'}
                                    </button>
                                )}
                            </div>

                            <div className="mt-4">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Connected devices</p>
                                {status.devices.length === 0 ? (
                                    <p className="text-[11.5px] text-gray-500 mt-1.5">None yet.</p>
                                ) : (
                                    <ul className="mt-1.5 space-y-1.5">
                                        {status.devices.map((d) => (
                                            <li key={d.id} className="flex items-center justify-between gap-3 text-[12px] rounded-lg bg-white/[0.03] px-3 py-2">
                                                <span className="text-gray-200 font-bold">{d.name}
                                                    <span className="text-gray-500 font-normal"> · paired {when(d.pairedAt)} · last seen {when(d.lastSeen)}</span>
                                                </span>
                                                <button type="button" onClick={() => unpair(d)} disabled={!!busy} title="Disconnect this device" className="text-gray-500 hover:text-rose-300 disabled:opacity-40">
                                                    <Trash2 size={13} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
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

export default IphoneConnectionCard;
