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

// Emptying a nested list this long in a single write is treated as a bug rather
// than an edit. Clearing one or two entries is plausible housekeeping; clearing
// a whole payment history is what a broken form does.
const MIN_ENTRIES_TO_PROTECT_FROM_EMPTYING = 3;

/**
 * Find nested lists that a write would amputate from a record that survives it.
 *
 * This is the LIC-Jan failure. A form built its object from the seven fields it
 * knew about, so `installments`, `interestTransactions` and `tds` simply were
 * not in the payload. One record in, one record out — every count matched, and
 * eight months of ₹5,000 payments were gone.
 *
 * Deletion is deliberately not flagged. If a child record is absent from the
 * write, its own sub-lists are absent with it and that is what deleting means;
 * recursion simply stops there. Only a record that is still present, and has
 * lost a list it used to carry, is reported.
 */
const findAmputations = (before, after, path, problems, depth = 0) => {
    if (depth > 6 || !before || typeof before !== 'object') return problems;
    if (!after || typeof after !== 'object') return problems;

    for (const [key, value] of Object.entries(before)) {
        // Descend through plain objects as well as arrays. A list does not have
        // to be a direct property of a record to matter: `composition.holdings`
        // is a fund's entire portfolio nested one level inside an object, and
        // checking only top-level arrays would have walked straight past it.
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nested = after[key];
            if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
                findAmputations(value, nested, `${path}.${key}`, problems, depth + 1);
            }
            continue;
        }

        if (!Array.isArray(value) || value.length === 0) continue;

        const incoming = after[key];
        const at = `${path}.${key}`;

        if (incoming === undefined) {
            problems.push(`${at} (${value.length} entries) is missing from the write`);
            continue;
        }
        if (!Array.isArray(incoming)) {
            problems.push(`${at} (${value.length} entries) would be replaced by a ${typeof incoming}`);
            continue;
        }
        if (incoming.length === 0 && value.length >= MIN_ENTRIES_TO_PROTECT_FROM_EMPTYING) {
            problems.push(`${at} would be emptied (${value.length} entries)`);
            continue;
        }

        // Recurse only into children that are on both sides, matched by id.
        const byId = new Map();
        incoming.forEach((child) => {
            if (child && typeof child === 'object' && child.id !== undefined) {
                byId.set(String(child.id), child);
            }
        });
        value.forEach((child) => {
            if (!child || typeof child !== 'object' || child.id === undefined) return;
            const match = byId.get(String(child.id));
            if (!match) return; // deleted, which is a legitimate edit
            findAmputations(child, match, `${at}#${child.id}`, problems, depth + 1);
        });
    }
    return problems;
};

/** Parse "/expenses" or "/savings/12" into its parts. Ignores query strings. */
export const parseTarget = (url) => {
    const [pathOnly] = (url || '').split('?');
    const segments = pathOnly.split('/').filter(Boolean);
    return { collection: segments[0], recordId: segments[1] };
};

/**
 * Inspect a write aimed at one record inside a collection (`PUT /savings/12`).
 *
 * Only one question is asked: would this write remove a list the record
 * currently carries? Scalar fields are deliberately not checked — optional keys
 * come and go legitimately, and flagging them would produce noise that trains
 * everyone to ignore the guard. Lists are where the history lives.
 */
const inspectRecordWrite = ({ method, collection, recordId, body, dbFile }) => {
    let db;
    try {
        db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (err) {
        return { safe: false, reason: `cannot read db.json to validate write (${err.message})` };
    }

    const existing = db[collection];
    if (!Array.isArray(existing)) return { safe: true };

    const current = existing.find((r) => r && String(r.id) === String(recordId));
    if (!current) return { safe: true }; // creating a new record

    let incoming;
    try {
        incoming = JSON.parse(body);
    } catch (err) {
        return { safe: false, reason: `request body is not valid JSON (${err.message})` };
    }
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return { safe: true };

    // A PATCH only replaces the keys it carries, so judge the merged result.
    const resulting = method === 'PATCH' ? { ...current, ...incoming } : incoming;

    const problems = findAmputations(current, resulting, `${collection}#${recordId}`, []);
    if (problems.length > 0) {
        return {
            safe: false,
            reason: `${method} /${collection}/${recordId} would erase data that is not in the payload — `
                + `${problems.join('; ')}. This is usually a form that rebuilds the record from its own `
                + `fields instead of extending the stored one.`,
        };
    }

    return { safe: true };
};

/**
 * Decide whether a mutation is safe.
 * Returns { safe: true } or { safe: false, reason } — the caller rejects on false.
 */
export const inspectWrite = ({ method, url, body, dbFile }) => {
    const { collection, recordId } = parseTarget(url);
    if (!collection) return { safe: true };

    // Single-record writes were once waved through here, on the reasoning that
    // their blast radius is bounded. It is not. One `savings` record holds the
    // whole fixed-deposit portfolio, every stock and its transactions, and each
    // recurring deposit with its installments — a sub-database, not a row. A
    // PUT to one of these can destroy years of history while leaving the record
    // count untouched, which is exactly how eight LIC-Jan installments were lost
    // and why no existing rule caught it.
    //
    // Deletes stay bounded and are still allowed through.
    if (recordId) {
        if (method !== 'PUT' && method !== 'PATCH') return { safe: true };
        return inspectRecordWrite({ method, collection, recordId, body, dbFile });
    }

    // Both verbs replace the keys they carry, so either can shrink a collection
    // from within. (server.js merges PATCH into a full PUT before it gets here,
    // because json-server beta.3 does not merge PATCH itself — see the note on
    // mergePatchIntoPut. What arrives is therefore usually already a PUT.)
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

    // Rule 2: nothing may introduce a top-level "item" key.
    //
    // This is the signature of json-server 1.0.0-beta.3's broken PATCH, which
    // writes `{ item, ...body }` and so buries the entire existing collection
    // under a literal "item" key — one level deeper on every save. It is what
    // corrupted metals, and it silently doubled the size of expenses and
    // appData. server.js now merges PATCH itself so this should never arrive,
    // and if it does, something is bypassing that path.
    if (isPlainObject(incoming) && 'item' in incoming && isPlainObject(existing) && !('item' in existing)) {
        return {
            safe: false,
            reason: `${method} /${collection} would add a top-level "item" key — the signature of json-server's broken PATCH nesting the collection inside itself`,
        };
    }

    // Rule 3: a collection stored as a map of arrays (metals) must stay that
    // shape. Any value arriving where an array is expected is a malformed
    // write, not an edit.
    if (isPlainObject(existing) && isPlainObject(incoming)) {
        const existingValues = Object.values(existing);
        const isMapOfArrays = existingValues.length > 0 && existingValues.every(Array.isArray);
        if (isMapOfArrays) {
            const malformed = Object.entries(incoming)
                .filter(([, value]) => !Array.isArray(value))
                .map(([key]) => key);
            if (malformed.length > 0) {
                return {
                    safe: false,
                    reason: `${method} /${collection} sent non-array value(s) for: ${malformed.join(', ')} — every entry in this collection must be an array`,
                };
            }
        }
    }

    // Rule 4: a write must not shrink the collection beyond the threshold.
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
