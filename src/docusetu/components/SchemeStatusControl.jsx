import React from 'react';
import { SCHEME_STATUSES, statusMeta, getSchemeStatus } from '../utils/schemeStatus';

// Compact picker on a card; `detailed` adds the date and note fields.
export const SchemeStatusControl = ({ statusMap, member, scenarioId, onChange, detailed = false }) => {
    if (!member) return null;
    const entry = getSchemeStatus(statusMap, member.id, scenarioId);
    const meta = statusMeta(entry.status);
    const stop = (e) => e.stopPropagation();
    return (<div onClick={stop} className={detailed ? 'mt-3 p-3 rounded-xl border border-white/10 bg-white/[0.03]' : 'mb-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Status{detailed ? ` for ${member.name}` : ''}
        </span>
        <select value={entry.status} onChange={(e) => onChange(member.id, scenarioId, { status: e.target.value })} className={`text-xs font-bold rounded-lg border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${meta.chip}`}>
          {SCHEME_STATUSES.map((s) => (<option key={s.id} value={s.id} className="bg-[#14142e] text-slate-100">{s.label}</option>))}
        </select>
        {!detailed && entry.date && <span className="text-[11px] text-slate-400">since {entry.date}</span>}
      </div>
      {!detailed && entry.note && <p className="mt-1 text-[11px] text-slate-400 truncate">{entry.note}</p>}
      {detailed && (<div className="mt-2 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2">
          <input type="date" value={entry.date || ''} onChange={(e) => onChange(member.id, scenarioId, { date: e.target.value })} className="text-xs rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-slate-100" title="Date applied / started"/>
          <input type="text" value={entry.note || ''} onChange={(e) => onChange(member.id, scenarioId, { note: e.target.value })} placeholder="e.g. Applied at SBI branch, ref #1234 — awaiting first payout" className="text-xs rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-slate-100 placeholder-slate-500"/>
        </div>)}
    </div>);
};
