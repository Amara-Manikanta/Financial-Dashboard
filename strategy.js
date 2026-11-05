/**
 * Daily research snapshots, kept as files beside the database
 * (`db/strategy/YYYY-MM-DD.json`, gitignored with the rest of `db/`).
 *
 * One file per day: pasting again the same day replaces that day, so a
 * corrected paste does not leave two. Never in db.json — what a model wrote
 * about a stock is not a financial record, and a bad paste must not be able to
 * touch one. The server stores what it is given after trimming it; it does not
 * interpret calls (the client parses and matches them, `researchImport.js`).
 */
import fs from 'fs';
import path from 'path';

const CALLS = new Set(['BUY', 'ACCUMULATE', 'HOLD', 'REVIEW', 'SELL']);
const KEEP_DAYS = 400;
const MAX_ROWS = 200;
const FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

let dir = null;
let inbox = null;

export const configureStrategy = ({ strategyDir, inboxDir } = {}) => { dir = strategyDir || null; inbox = inboxDir || null; };

// ── The drop folder ──────────────────────────────────────────────────────────
// Antigravity can write a file into the project; the app picks it up from here.
// A file is only ever read as text and handed to the same parser as a paste —
// nothing in it is executed or saved without the person confirming the preview.

const INBOX_FILE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,100}\.(md|txt|csv|tsv)$/;
const MAX_INBOX_BYTES = 1024 * 1024;

export const inboxDirectory = () => inbox;

export const listInbox = () => {
    if (!inbox) return [];
    try {
        return fs.readdirSync(inbox)
            .filter((n) => INBOX_FILE.test(n))
            .map((n) => { const st = fs.statSync(path.join(inbox, n)); return { name: n, size: st.size, modified: st.mtime.toISOString(), isFile: st.isFile() }; })
            .filter((f) => f.isFile && f.size > 0 && f.size <= MAX_INBOX_BYTES)
            .map(({ isFile, ...f }) => f)
            .sort((a, b) => b.modified.localeCompare(a.modified));
    } catch { return []; }
};

/** The text of one waiting file, or null. The name must be a plain file name in the folder. */
export const readInboxFile = (name) => {
    if (!inbox || !INBOX_FILE.test(String(name || ''))) return null;
    const file = path.join(inbox, name);
    try {
        const st = fs.statSync(file);
        if (!st.isFile() || st.size > MAX_INBOX_BYTES) return null;
        return fs.readFileSync(file, 'utf8');
    } catch { return null; }
};

/** Moves an imported file to `done/` so it is not offered again. A name clash gets a timestamp. */
export const archiveInboxFile = (name) => {
    if (!inbox || !INBOX_FILE.test(String(name || ''))) return false;
    const from = path.join(inbox, name);
    if (!fs.existsSync(from)) return false;
    const doneDir = path.join(inbox, 'done');
    fs.mkdirSync(doneDir, { recursive: true });
    let to = path.join(doneDir, name);
    if (fs.existsSync(to)) to = path.join(doneDir, `${Date.now()}-${name}`);
    fs.renameSync(from, to);
    return true;
};

const text = (v, max) => String(v ?? '').replace(/\u0000/g, '').slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))
    && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

const cleanRow = (r) => {
    if (!r || typeof r !== 'object' || !CALLS.has(r.call)) return null;
    const name = text(r.name, 200).trim();
    if (!name) return null;
    return {
        name,
        holdingId: r.holdingId === null || r.holdingId === undefined ? null : text(r.holdingId, 80),
        call: r.call,
        confidence: ['HIGH', 'MEDIUM', 'LOW'].includes(r.confidence) ? r.confidence : '',
        reason: text(r.reason, 1500),
        news: text(r.news, 1500),
        trigger: text(r.trigger, 600),
        price: num(r.price),
        range: r.range && typeof r.range === 'object' ? { label: text(r.range.label, 12), pct: num(r.range.pct) } : null,
    };
};

const fileFor = (date) => (dir && validDate(date) ? path.join(dir, `${date}.json`) : null);

/** Stores (or replaces) one day. Returns the stored snapshot, or `{ error }`. */
export const saveSnapshot = ({ date, rows, source } = {}) => {
    if (!dir) return { error: 'Strategy storage is not configured' };
    if (!validDate(date)) return { error: 'A date like 2026-11-02 is required' };
    if (!Array.isArray(rows) || rows.length === 0) return { error: 'There are no rows to save' };
    if (rows.length > MAX_ROWS) return { error: `Too many rows (${rows.length}); the limit is ${MAX_ROWS}` };
    const clean = rows.map(cleanRow).filter(Boolean);
    if (clean.length === 0) return { error: 'None of the rows had a BUY / ACCUMULATE / HOLD / REVIEW / SELL call' };

    const snapshot = { date, pastedAt: new Date().toISOString(), source: text(source || 'pasted', 60), rows: clean };
    fs.mkdirSync(dir, { recursive: true });
    const file = fileFor(date);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 1));
    fs.renameSync(tmp, file);
    prune();
    return snapshot;
};

const prune = () => {
    try {
        const files = fs.readdirSync(dir).filter((f) => FILE.test(f)).sort();
        files.slice(0, Math.max(0, files.length - KEEP_DAYS)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
    } catch { /* nothing to prune */ }
};

/** Snapshots oldest first; `limit` keeps the newest N. A damaged file is skipped, not fatal. */
export const readSnapshots = ({ limit = 60 } = {}) => {
    if (!dir || !fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => FILE.test(f)).sort();
    const out = [];
    files.slice(-Math.max(1, limit)).forEach((f) => {
        try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { /* skip */ }
    });
    return out;
};

/** Changes whenever a saved day is added, replaced or removed — from file names and modified times alone, without reading any of them. */
export const snapshotsSignature = () => {
    if (!dir || !fs.existsSync(dir)) return '';
    return fs.readdirSync(dir).filter((f) => FILE.test(f)).sort()
        .map((f) => { try { return `${f}:${fs.statSync(path.join(dir, f)).mtimeMs}`; } catch { return f; } }).join('|');
};

export const deleteSnapshot = (date) => {
    const file = fileFor(date);
    if (!file || !fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
};

// ── Settings: auto-import and remembered name matches ───────────────────────
// Kept beside the inbox (db/research/settings.json) so a sandbox has its own.

const settingsFile = () => (inbox ? path.join(path.dirname(inbox), 'settings.json') : null);

export const readSettings = () => {
    const file = settingsFile();
    const base = { autoImport: false, aliases: {} };
    if (!file) return base;
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { autoImport: raw.autoImport === true, aliases: raw.aliases && typeof raw.aliases === 'object' && !Array.isArray(raw.aliases) ? raw.aliases : {} };
    } catch { return base; }
};

/** Merges a change into the settings. Only known keys are kept; aliases are capped. */
export const writeSettings = (change = {}) => {
    const file = settingsFile();
    if (!file) return { error: 'Strategy storage is not configured' };
    const cur = readSettings();
    const next = { autoImport: typeof change.autoImport === 'boolean' ? change.autoImport : cur.autoImport, aliases: { ...cur.aliases } };
    if (change.aliases && typeof change.aliases === 'object') {
        Object.entries(change.aliases).slice(0, 500).forEach(([k, v]) => { if (typeof v === 'string' && v.length < 80 && String(k).length < 200) next.aliases[String(k).toLowerCase()] = v; });
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 1));
    fs.renameSync(tmp, file);
    return next;
};

/** The first YYYY-MM-DD in a file name, if it is a real day. */
export const dateInName = (name) => {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(String(name || ''));
    return m && validDate(m[1]) ? m[1] : null;
};
