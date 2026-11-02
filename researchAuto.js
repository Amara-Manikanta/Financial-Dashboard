/**
 * Imports files an outside agent drops into db/research/inbox/ — the same read the
 * Research tab does by hand, for a run that happens every hour.
 *
 * Only when switched on in the tab. A file is imported only if EVERY row names a
 * holding clearly: one that does not stays in the folder for a person to resolve,
 * so an unattended run can never file a call under the wrong company. A file still
 * being written (touched in the last few seconds) is left alone. Several files for
 * one day import oldest first, so the newest of the day is the one that stands.
 */
import fs from 'fs';
import path from 'path';
import { parseResearch, matchHoldings } from './src/utils/researchImport.js';
import { listInbox, readInboxFile, archiveInboxFile, saveSnapshot, readSettings, dateInName, inboxDirectory } from './strategy.js';

const SETTLE_MS = 8000;

const heldIn = (dbFile) => {
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const account = (db.savings || []).find((s) => s.type === 'stock_market' && !s.isArchived);
    return (account?.stocks || [])
        .filter((s) => !s.isArchived && (s.owner || 'self') === 'self' && Number(s.shares) > 0)
        .map((s) => ({ id: s.id, name: s.name }));
};

const localDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** One pass over the folder. Returns what happened, file by file. */
export const importWaiting = ({ dbFile, now = Date.now() } = {}) => {
    if (!readSettings().autoImport) return { skipped: 'auto-import is off', results: [] };
    const files = listInbox().filter((f) => now - Date.parse(f.modified) > SETTLE_MS).sort((a, b) => a.modified.localeCompare(b.modified));
    if (files.length === 0) return { results: [] };

    let holdings;
    try { holdings = heldIn(dbFile); } catch (err) { return { error: `Could not read holdings: ${err.message}`, results: [] }; }
    const { aliases } = readSettings();
    const results = [];

    files.forEach((f) => {
        const text = readInboxFile(f.name);
        if (text === null) { results.push({ name: f.name, status: 'unreadable' }); return; }
        const parsed = parseResearch(text);
        if (parsed.error) { results.push({ name: f.name, status: 'left', why: parsed.error }); return; }
        const rows = matchHoldings(parsed.rows, holdings, aliases);
        const unmatched = rows.filter((r) => !r.holdingId).map((r) => r.name);
        if (unmatched.length || parsed.skipped.length) {
            results.push({ name: f.name, status: 'left', why: [unmatched.length ? `not matched: ${unmatched.join(', ')}` : '', parsed.skipped.length ? `not read: ${parsed.skipped.map((s) => s.name).join(', ')}` : ''].filter(Boolean).join('; ') });
            return;
        }
        const date = dateInName(f.name) || localDay(new Date(Date.parse(f.modified)));
        const saved = saveSnapshot({ date, rows: rows.map(({ matchedBy, ambiguous, ...r }) => r), source: `auto:${f.name}`.slice(0, 60) });
        if (saved.error) { results.push({ name: f.name, status: 'left', why: saved.error }); return; }
        archiveInboxFile(f.name);
        results.push({ name: f.name, status: 'imported', date, rows: rows.length });
    });
    return { results };
};

export const startResearchImporter = ({ dbFile, everyMs = 30000 } = {}) => {
    if (!inboxDirectory()) return null;
    const timer = setInterval(() => {
        try {
            const out = importWaiting({ dbFile });
            out.results.filter((r) => r.status === 'imported').forEach((r) => console.log(`[research] imported ${r.name} → ${r.date} (${r.rows} calls)`));
        } catch (err) { console.error('[research] auto-import failed:', err.message); }
    }, everyMs);
    timer.unref?.();
    return timer;
};
