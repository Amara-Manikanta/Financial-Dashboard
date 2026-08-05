import fs from 'fs';

/**
 * Write guard for the finance DB.
 *
 * json-server answers a destructive PUT with 200 and no complaint, so a stale
 * or partially-built payload silently deletes records. Every mutation already
 * funnels through the proxy, which makes it the one place we can compare what
 * is about to be written against what is currently on disk and refuse writes
 * that look like data loss rather than an edit.
 */

// A write may not remove more than this fraction of a collection's records.
// Real edits touch a handful of rows; corruption drops most of them.
const MAX_SHRINK_RATIO = 0.2;

// Below this many records the ratio test is meaningless (losing 1 of 3 rows is
// 33%), so small collections are only checked for going completely empty.
const MIN_RECORDS_FOR_RATIO = 10;

/** Recursively count leaf records so nested trees (expenses/year/month) count fairly. */
export const countRecords = (node) => {
    if (Array.isArray(node)) {
        return node.reduce((sum, child) => sum + countRecords(child), 0) || node.length;
    }
    if (node && typeof node === 'object') {
        // An object carrying an id is itself one record.
        if (node.id !== undefined) return 1;
        return Object.values(node).reduce((sum, child) => sum + countRecords(child), 0);
    }
    return 0;
};

/** Parse "/expenses" or "/savings/12" into its parts. Ignores query strings. */
export const parseTarget = (url) => {
    const [pathOnly] = (url || '').split('?');
    const segments = pathOnly.split('/').filter(Boolean);
    return { collection: segments[0], recordId: segments[1] };
};

/**
 * Decide whether a mutation is safe.
 * Returns { safe: true } or { safe: false, reason } — the caller rejects on false.
 */
export const inspectWrite = ({ method, url, body, dbFile }) => {
    const { collection, recordId } = parseTarget(url);
    if (!collection) return { safe: true };

    // Single-record writes and deletes are bounded in blast radius by design.
    if (recordId) return { safe: true };

    // PATCH cannot drop sibling keys, but it replaces the keys it does send —
    // so it can still shrink a collection from within and must be checked.
    if (method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
        return { safe: true };
    }

    let db;
    try {
        db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (err) {
        // If the DB is unreadable we cannot judge, so fail closed.
        return { safe: false, reason: `cannot read db.json to validate write (${err.message})` };
    }

    const existing = db[collection];
    if (existing === undefined) return { safe: true }; // brand new collection

    if (method === 'DELETE') {
        return { safe: false, reason: `refusing to DELETE entire collection "${collection}"` };
    }

    let incoming;
    try {
        incoming = JSON.parse(body);
    } catch (err) {
        return { safe: false, reason: `request body is not valid JSON (${err.message})` };
    }

    const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

    // Rule 1: a whole-collection PUT must not drop top-level keys.
    // This is the appData failure mode: PUT {a:1} over {a,b,c,d} leaves only a.
    if (method === 'PUT' && isPlainObject(existing) && isPlainObject(incoming)) {
        const missing = Object.keys(existing).filter((key) => !(key in incoming));
        if (missing.length > 0) {
            return {
                safe: false,
                reason: `PUT /${collection} would delete top-level key(s): ${missing.join(', ')}`,
            };
        }
    }

    // Rule 2: a write must not shrink the collection beyond the threshold.
    // For PATCH, judge the merged result rather than the payload, because
    // json-server merges shallowly: keys that are sent replace what was there.
    const resulting = (method === 'PATCH' && isPlainObject(existing) && isPlainObject(incoming))
        ? { ...existing, ...incoming }
        : incoming;

    const before = countRecords(existing);
    const after = countRecords(resulting);

    if (before > 0 && after === 0) {
        return { safe: false, reason: `${method} /${collection} would empty the collection (${before} records lost)` };
    }

    if (before >= MIN_RECORDS_FOR_RATIO && after < before * (1 - MAX_SHRINK_RATIO)) {
        const lost = before - after;
        const pct = ((lost / before) * 100).toFixed(1);
        return {
            safe: false,
            reason: `${method} /${collection} would remove ${lost} of ${before} records (${pct}%), exceeding the ${MAX_SHRINK_RATIO * 100}% limit`,
        };
    }

    return { safe: true };
};

/**
 * Verify a file is structurally sound before it is trusted as a backup.
 * A backup of already-corrupt data is worse than none, because it looks valid.
 */
export const verifySnapshot = (filePath, expectedKeys = []) => {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const missing = expectedKeys.filter((key) => !(key in parsed));
        if (missing.length > 0) {
            return { ok: false, reason: `missing collection(s): ${missing.join(', ')}` };
        }
        return { ok: true, records: countRecords(parsed) };
    } catch (err) {
        return { ok: false, reason: `unparseable JSON (${err.message})` };
    }
};
