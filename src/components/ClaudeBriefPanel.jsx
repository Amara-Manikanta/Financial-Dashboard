import React, { useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw, AlertTriangle, CheckCircle, CircleDot } from 'lucide-react';
import { API_URL } from '../utils/apiUrl';

const dateOf = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const rupees = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

/**
 * The rolling per-stock brief Claude keeps (claudeNews.js on the server).
 *
 * Every item cites the stored stories it rests on, so each claim can be traced
 * to a headline below. Figures Claude wrote that are not in those stories are
 * flagged. There is no buy/sell verdict by design — the page's own numbers
 * (cost, range, fundamentals) sit beside this, not inside it.
 */
const ClaudeBriefPanel = ({ symbol, name, stories, onStoriesChanged }) => {
    const [brief, setBrief] = useState(null);
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState('');
    const [note, setNote] = useState('');
    const q = `symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name || '')}`;

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/analyst/claude/brief?${q}`);
            if (!r.ok) throw new Error(r.status === 404 ? 'Restart npm run server to enable the Claude brief.' : `HTTP ${r.status}`);
            const body = await r.json();
            setBrief(body.brief);
            setStatus(body.status);
        } catch (err) {
            setNote(err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message);
        }
    }, [q]);

    useEffect(() => { load(); }, [load]);

    const toggle = async () => {
        setBusy('toggle');
        setNote('');
        try {
            const r = await fetch(`${API_URL}/api/analyst/claude/enabled?on=${status?.enabled ? '0' : '1'}`, { method: 'POST' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setStatus(await r.json());
        } catch (err) {
            setNote(`Could not switch: ${err.message}`);
        }
        setBusy('');
    };

    const refresh = async (rebuild) => {
        setBusy(rebuild ? 'rebuild' : 'update');
        setNote('');
        try {
            const r = await fetch(`${API_URL}/api/analyst/claude/brief?${q}${rebuild ? '&rebuild=1' : ''}`, { method: 'POST' });
            const body = await r.json();
            if (body.status) setStatus(body.status);
            const read = body.read?.analysed || 0;
            if (!body.ok) throw new Error(body.error || `HTTP ${r.status}`);
            if (body.brief) setBrief(body.brief);
            setNote(body.skipped
                ? `${read ? `${read} stories read. ` : ''}Brief unchanged: ${body.skipped}.`
                : `${read ? `${read} stories read, ` : ''}brief ${body.brief.mode === 'rebuild' ? 'rebuilt' : 'updated'} for ${rupees(body.brief.costInr)}.`);
            if (read) onStoriesChanged?.();
        } catch (err) {
            setNote(err.message === 'Failed to fetch' ? 'Could not reach the API server.' : err.message);
        }
        setBusy('');
    };

    const titleOf = (id) => (stories || []).find((s) => s.id === id);
    const canRun = status?.configured && status?.enabled && !busy;

    return (
        <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[13px] font-black text-white flex items-center gap-1.5">
                    <FileText size={14} className="text-violet-300" /> Running brief
                </h4>
                {brief && (
                    <span className="text-[10.5px] text-gray-400 font-bold">
                        as of {dateOf(brief.asOf)} · latest story {dateOf(brief.latestStory)} · {brief.mode === 'rebuild' ? 'rebuilt' : 'updated'} from {brief.storiesRead} {brief.storiesRead === 1 ? 'story' : 'stories'}
                    </span>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {status && (
                        <label className={`flex items-center gap-1.5 text-[11px] font-bold ${status.configured ? 'text-gray-300 cursor-pointer' : 'text-gray-600'}`} title={status.configured ? 'Let Claude read news and keep this brief' : 'Add ANTHROPIC_API_KEY to .env.local and restart the server'}>
                            <input type="checkbox" checked={!!status.enabled} disabled={!status.configured || !!busy} onChange={toggle} className="accent-violet-500" />
                            Claude reading
                        </label>
                    )}
                    <button type="button" onClick={() => refresh(false)} disabled={!canRun} title="Read unread stories from the last 30 days, then update the brief with what is new" className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-[11px] font-black flex items-center gap-1.5">
                        <RefreshCw size={12} className={busy === 'update' ? 'animate-spin' : ''} /> {busy === 'update' ? 'Reading…' : 'Update brief'}
                    </button>
                    <button type="button" onClick={() => refresh(true)} disabled={!canRun} title="Rebuild from every stored story, ignoring the previous brief (runs weekly on its own)" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-40 text-[11px] font-black">
                        {busy === 'rebuild' ? 'Rebuilding…' : 'Rebuild'}
                    </button>
                </div>
            </div>

            {status && !status.configured && (
                <p className="text-[11.5px] text-gray-500 mt-2">Off — add <code className="text-gray-300">ANTHROPIC_API_KEY</code> to <code className="text-gray-300">.env.local</code> and restart the server to use it.</p>
            )}
            {status?.configured && (
                <p className="text-[10.5px] text-gray-500 mt-1.5">
                    {status.model} · today {rupees(status.spentTodayInr)} of {rupees(status.dailyCapInr)} · last 30 days {rupees(status.spent30DaysInr)} over {status.calls30Days} calls
                    {status.lastDailyRun?.at && <> · daily run {dateOf(status.lastDailyRun.at)}{status.lastDailyRun.stopped ? ` (stopped: ${status.lastDailyRun.stopped})` : ''}</>}
                </p>
            )}
            {note && <p className="text-[11.5px] text-gray-300 mt-2">{note}</p>}

            {brief ? (
                <>
                    {brief.overview && <p className="text-[12.5px] text-gray-200 mt-3 leading-relaxed">{brief.overview}</p>}
                    {brief.overviewUnverified?.length > 0 && (
                        <p className="text-[10.5px] text-amber-300 mt-1 flex items-center gap-1"><AlertTriangle size={11} /> Figure not found in the stories: {brief.overviewUnverified.join(', ')}</p>
                    )}
                    <ol className="mt-3 space-y-3">
                        {brief.items.map((it, i) => (
                            <li key={i} className="border-t border-white/5 pt-3 first:border-0 first:pt-0">
                                <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-bold">
                                    {it.status === 'resolved'
                                        ? <span className="px-1.5 rounded bg-emerald-500/15 text-emerald-300 flex items-center gap-1"><CheckCircle size={10} /> resolved</span>
                                        : <span className="px-1.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-1"><CircleDot size={10} /> open</span>}
                                    {it.isNew && <span className="px-1.5 rounded bg-violet-500/20 text-violet-200">new</span>}
                                    <span className="text-gray-500">{it.firstDate === it.lastDate ? dateOf(it.firstDate) : `${dateOf(it.firstDate)} – ${dateOf(it.lastDate)}`}</span>
                                </div>
                                <p className="text-[12.5px] text-gray-100 font-bold mt-1">{it.whatChanged}</p>
                                {it.whyItMatters && <p className="text-[11.5px] text-gray-300 mt-1"><span className="text-gray-500 font-bold">Why it matters:</span> {it.whyItMatters}</p>}
                                {it.check && <p className="text-[11.5px] text-gray-300 mt-1"><span className="text-gray-500 font-bold">Check before acting:</span> {it.check}</p>}
                                {it.unverified?.length > 0 && (
                                    <p className="text-[10.5px] text-amber-300 mt-1 flex items-center gap-1"><AlertTriangle size={11} /> Figure not found in the cited stories: {it.unverified.join(', ')}</p>
                                )}
                                <p className="text-[10.5px] text-gray-500 mt-1 flex flex-wrap gap-x-2">
                                    <span>Sources:</span>
                                    {it.storyIds.map((id) => {
                                        const s = titleOf(id);
                                        const url = s?.url || s?.links?.[0]?.url;
                                        return s
                                            ? <a key={id} href={url} target="_blank" rel="noreferrer" title={s.title} className="hover:text-violet-200 underline decoration-dotted">{dateOf(s.published || s.firstSeen)}</a>
                                            : <span key={id} title="No longer in the archive">{id.slice(0, 8)}</span>;
                                    })}
                                </p>
                            </li>
                        ))}
                    </ol>
                    <p className="text-[10px] text-gray-600 mt-3">Written by {brief.model} from stored news only. It says what changed and what to check, never whether to buy or sell.</p>
                </>
            ) : status?.configured && (
                <p className="text-[11.5px] text-gray-500 mt-2">No brief yet. {status.enabled ? 'Update brief to write the first one.' : 'Switch Claude reading on, then Update brief.'}</p>
            )}
        </div>
    );
};

export default ClaudeBriefPanel;
