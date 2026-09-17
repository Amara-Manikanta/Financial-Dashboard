// Where a scheme stands for one family member, separate from document ticks:
// a scheme can be running with every paper collected and still not paid out.
// Stored as { [memberId]: { [scenarioId]: { status, date, note, updatedAt } } }.

export const SCHEME_STATUSES = [
    { id: 'not_started', label: 'Not started', chip: 'bg-white/5 text-slate-300 border-white/10' },
    { id: 'in_progress', label: 'Applied / In progress', chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    { id: 'active_unclaimed', label: 'Active – not claimed', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    { id: 'claimed', label: 'Claimed / Received', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    { id: 'not_applicable', label: 'Not applicable', chip: 'bg-white/5 text-slate-500 border-white/10' },
];

export const DEFAULT_STATUS = 'not_started';

export const statusMeta = (id) => SCHEME_STATUSES.find((s) => s.id === id) || SCHEME_STATUSES[0];

export function getSchemeStatus(statusMap, memberId, scenarioId) {
    return statusMap?.[memberId]?.[scenarioId] || { status: DEFAULT_STATUS, date: '', note: '' };
}

// Returns a new map. Setting a member back to "Not started" with no date or
// note removes the entry, so the stored map only holds what was recorded.
export function setSchemeStatus(statusMap, memberId, scenarioId, patch) {
    const current = getSchemeStatus(statusMap, memberId, scenarioId);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const memberMap = { ...(statusMap?.[memberId] || {}) };
    if (next.status === DEFAULT_STATUS && !next.date && !next.note) delete memberMap[scenarioId];
    else memberMap[scenarioId] = next;
    const out = { ...(statusMap || {}) };
    if (Object.keys(memberMap).length) out[memberId] = memberMap;
    else delete out[memberId];
    return out;
}

// Entries for a scenario across every member, for the "All family" view.
export function statusesForScenario(statusMap, members, scenarioId) {
    return members
        .map((m) => ({ member: m, entry: statusMap?.[m.id]?.[scenarioId] }))
        .filter((r) => r.entry && r.entry.status !== DEFAULT_STATUS);
}
