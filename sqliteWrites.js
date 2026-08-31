// Phase 3: per-row writes.
//
// The whole point. Today every save ships an entire collection built from one
// tab's snapshot, which is why two tabs could silently erase each other's work.
// Here a change touches exactly one row, so two tabs editing different
// transactions both succeed and neither can overwrite what it never loaded.
//
// db.json remains the durable artifact. Each change is applied to SQLite inside
// a transaction, the whole database is rebuilt from it, checked by the same
// guard that protects every other write, and only then does db.json get
// replaced — atomically, via a temp file and a rename, so a crash mid-write
// cannot leave a half-written database.
//
// Additive: nothing calls this unless the client opts in. The existing
// whole-collection path is untouched.

import fs from 'node:fs';
import path from 'node:path';
import { rebuildDatabase, rebuildTransaction } from './scripts/sqlite-rebuild.mjs';
import { TX_COLUMNS, BOOLEAN_FIELDS } from './scripts/sqlite-schema.mjs';
// The same predicate the client uses. CLAUDE.md §5 requires this formula and
// withRecomputedCategories to agree exactly; importing the one copy is what
// makes that true rather than merely intended.
import { countsAsSpending } from './src/utils/payrollDeductions.js';

export const MODE = (process.env.SQLITE_WRITES || 'off').toLowerCase();
export const isEnabled = MODE === 'on';

let DatabaseSync = null;
let buildMirror = null;
if (isEnabled) {
    ({ DatabaseSync } = await import('node:sqlite'));
    ({ buildMirror } = await import('./scripts/migrate-to-sqlite.mjs'));
}

let dbFile = null;
let mirrorFile = null;

export const init = (opts) => {
    dbFile = opts.dbFile;
    mirrorFile = opts.mirrorFile;
    if (isEnabled) console.log('[SQLite] per-row write path ENABLED (POST/PATCH/DELETE /api/tx)');
};

/** Rebuild the mirror if db.json has changed underneath us. */
const openFresh = () => {
    const stat = fs.statSync(dbFile);
    const meta = fs.existsSync(mirrorFile);
    if (!meta) {
        buildMirror({ source: dbFile, out: mirrorFile });
    } else {
        const probe = new DatabaseSync(mirrorFile, { readOnly: true });
        const row = probe.prepare("SELECT value FROM mirror_meta WHERE key='source_mtime'").get();
        probe.close();
        if (!row || row.value !== stat.mtime.toISOString()) {
            buildMirror({ source: dbFile, out: mirrorFile });
        }
    }
    return new DatabaseSync(mirrorFile);
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const bucketFor = (isoDate) => {
    const [y, m] = String(isoDate || '').split('-');
    const monthIndex = Number(m) - 1;
    if (!y || Number.isNaN(monthIndex) || !MONTH_NAMES[monthIndex]) return null;
    return { year: y, month: MONTH_NAMES[monthIndex] };
};

const columnValues = (tx) => {
    const extra = {};
    for (const [k, v] of Object.entries(tx)) if (!(k in TX_COLUMNS)) extra[k] = v;
    const store = (field) => {
        const v = tx[field];
        if (v === undefined || v === null) return null;
        return BOOLEAN_FIELDS.has(field) ? (v ? 1 : 0) : v;
    };
    return {
        id: tx.id === undefined || tx.id === null ? null : String(tx.id),
        date: store('date'),
        amount: store('amount'),
        title: store('title'),
        category: store('category'),
        sub_category: store('subCategory'),
        payment_mode: store('paymentMode'),
        card_name: store('creditCardName'),
        transaction_type: store('transactionType'),
        is_credited: store('isCredited'),
        deduct_from_salary: store('deductFromSalary'),
        extra: JSON.stringify(extra),
        key_order: JSON.stringify(Object.keys(tx)),
    };
};

// Each month node carries a `categories` aggregate derived from its
// transactions, and five pages read it (Analytics, Budget Limits, the monthly
// view, Expenses, and category renaming). The client recomputes it inside
// saveExpenses; a per-row write bypasses that, so it has to be recomputed here
// or the aggregate silently goes stale.
//
// This mirrors the formula in FinanceContext.saveExpenses exactly, including
// the clamp to zero. If that formula changes, this must change with it.
const INCOME_CATEGORIES = ['salary received', 'salary', 'income'];

const recomputeCategories = (handle, year, month) => {
    const rows = handle.prepare(
        'SELECT * FROM transactions WHERE year = ? AND month = ? ORDER BY ord',
    ).all(year, month);

    const totals = {};
    for (const row of rows) {
        const tx = rebuildTransaction(row);
        if (!tx || typeof tx !== 'object') continue;
        if (!countsAsSpending(tx)) continue;

        const cat = String(tx.category || '').toLowerCase();
        if (!cat) continue;

        const amount = Number(tx.amount) || 0;
        const isIncome = INCOME_CATEGORIES.includes(cat);
        const effective = isIncome
            ? (tx.isCredited ? amount : -amount)
            : (tx.isCredited ? -amount : amount);

        totals[cat] = (totals[cat] || 0) + effective;
    }
    for (const k of Object.keys(totals)) totals[k] = Math.max(0, totals[k]);

    const metaRow = handle.prepare('SELECT rest FROM month_meta WHERE year = ? AND month = ?')
        .get(year, month);
    const rest = metaRow ? JSON.parse(metaRow.rest || '{}') : {};
    rest.categories = totals;
    handle.prepare('UPDATE month_meta SET rest = ? WHERE year = ? AND month = ?')
        .run(JSON.stringify(rest), year, month);
};

const insertRow = (handle, year, month, ord, tx) => {
    const c = columnValues(tx);
    handle.prepare(`INSERT INTO transactions
        (id, year, month, ord, date, amount, title, category, sub_category,
         payment_mode, card_name, transaction_type, is_credited,
         deduct_from_salary, extra, key_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(c.id, year, month, ord, c.date, c.amount, c.title, c.category,
            c.sub_category, c.payment_mode, c.card_name, c.transaction_type,
            c.is_credited, c.deduct_from_salary, c.extra, c.key_order);
};

/**
 * Apply one row-level change and persist it.
 *
 * @param {'create'|'update'|'delete'} op
 * @param {object} params  { id, transaction, patch }
 * @param {Function} guard  inspectWrite from dbGuard, applied to the result
 * @returns {{ok:boolean, status:number, body:object}}
 */
export const applyChange = ({ op, id, transaction, patch }, guard) => {
    if (!isEnabled) return { ok: false, status: 503, body: { error: 'Per-row writes are disabled. Set SQLITE_WRITES=on.' } };

    let handle;
    try {
        handle = openFresh();
    } catch (err) {
        return { ok: false, status: 500, body: { error: `Could not open the mirror: ${err.message}` } };
    }

    // Month buckets whose transactions changed, so their `categories`
    // aggregate can be recomputed before db.json is written.
    const touched = new Set();
    let deletedCount = 0;
    const touch = (year, month) => touched.add(`${year}\u0000${month}`);

    try {
        handle.exec('BEGIN IMMEDIATE');

        if (op === 'delete-category') {
            // Removing a whole category for a month is genuinely many rows, so
            // it runs as one statement in one transaction rather than N
            // round-trips each rebuilding the entire database.
            const { year, month, category } = patch || {};
            if (!year || !month || !category) {
                throw new Error('delete-category needs year, month and category');
            }
            const wanted = String(category).toLowerCase();
            const rows = handle.prepare(
                'SELECT ord FROM transactions WHERE year = ? AND month = ? AND LOWER(COALESCE(category, \'\')) = ?',
            ).all(String(year), String(month), wanted);

            if (!rows.length) throw new Error(`no transactions in ${category} for ${month} ${year}`);

            handle.prepare(
                'DELETE FROM transactions WHERE year = ? AND month = ? AND LOWER(COALESCE(category, \'\')) = ?',
            ).run(String(year), String(month), wanted);

            touch(String(year), String(month));
            deletedCount = rows.length;
        } else if (op === 'create') {
            const tx = transaction || {};
            if (!tx.id) tx.id = String(Date.now());
            const bucket = bucketFor(tx.date);
            if (!bucket) throw new Error(`transaction has no usable date: ${JSON.stringify(tx.date)}`);

            const existing = handle.prepare('SELECT 1 FROM transactions WHERE id = ?').get(String(tx.id));
            if (existing) throw new Error(`a transaction with id ${tx.id} already exists`);

            // Make sure the month bucket exists before appending to it.
            const known = handle.prepare('SELECT 1 FROM month_meta WHERE year = ? AND month = ?')
                .get(bucket.year, bucket.month);
            if (!known) {
                const next = handle.prepare('SELECT COALESCE(MAX(ord), -1) + 1 n FROM month_meta WHERE year = ?')
                    .get(bucket.year).n;
                handle.prepare('INSERT INTO month_meta (year, month, ord, rest) VALUES (?,?,?,?)')
                    .run(bucket.year, bucket.month, next, JSON.stringify({ categories: [] }));
            }

            const nextOrd = handle.prepare(
                'SELECT COALESCE(MAX(ord), -1) + 1 n FROM transactions WHERE year = ? AND month = ?',
            ).get(bucket.year, bucket.month).n;

            insertRow(handle, bucket.year, bucket.month, nextOrd, tx);
            touch(bucket.year, bucket.month);
        } else {
            const row = handle.prepare('SELECT * FROM transactions WHERE id = ?').get(String(id));
            if (!row) throw new Error(`no transaction with id ${id}`);

            if (op === 'delete') {
                handle.prepare('DELETE FROM transactions WHERE year = ? AND month = ? AND ord = ?')
                    .run(row.year, row.month, row.ord);
                touch(row.year, row.month);
            } else {
                // Merge the patch onto the existing object, then rewrite the row.
                const current = rebuildTransaction(row);
                const merged = { ...current, ...(patch || {}) };
                const bucket = bucketFor(merged.date) || { year: row.year, month: row.month };

                handle.prepare('DELETE FROM transactions WHERE year = ? AND month = ? AND ord = ?')
                    .run(row.year, row.month, row.ord);

                touch(row.year, row.month);
                if (bucket.year === row.year && bucket.month === row.month) {
                    insertRow(handle, row.year, row.month, row.ord, merged);
                } else {
                    // The date moved it into another month bucket.
                    const known = handle.prepare('SELECT 1 FROM month_meta WHERE year = ? AND month = ?')
                        .get(bucket.year, bucket.month);
                    if (!known) {
                        const next = handle.prepare('SELECT COALESCE(MAX(ord), -1) + 1 n FROM month_meta WHERE year = ?')
                            .get(bucket.year).n;
                        handle.prepare('INSERT INTO month_meta (year, month, ord, rest) VALUES (?,?,?,?)')
                            .run(bucket.year, bucket.month, next, JSON.stringify({ categories: [] }));
                    }
                    const nextOrd = handle.prepare(
                        'SELECT COALESCE(MAX(ord), -1) + 1 n FROM transactions WHERE year = ? AND month = ?',
                    ).get(bucket.year, bucket.month).n;
                    insertRow(handle, bucket.year, bucket.month, nextOrd, merged);
                    touch(bucket.year, bucket.month);
                }
            }
        }

        for (const key of touched) {
            const [year, month] = key.split('\u0000');
            recomputeCategories(handle, year, month);
        }

        // Rebuild the whole database and let the existing guard judge it. The
        // guard is the same one protecting every other write path — a per-row
        // change is not a reason to skip it.
        const next = rebuildDatabase(handle);
        const payload = JSON.stringify(next, null, 2);

        const verdict = guard({ method: 'PUT', url: '/expenses', body: JSON.stringify(next.expenses), dbFile });
        if (!verdict.safe) throw new Error(`guard refused the result: ${verdict.reason}`);

        // Atomic replace: write beside the target, fsync, then rename. A crash
        // can leave the temp file behind but never a truncated db.json.
        const tmp = `${dbFile}.tmp-${process.pid}`;
        const fd = fs.openSync(tmp, 'w');
        try {
            fs.writeFileSync(fd, payload);
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tmp, dbFile);

        // The mirror now IS the source of this db.json, so record that. Without
        // it the mirror declares itself stale the instant it writes, forcing a
        // needless rebuild on the next read and making the freshness check
        // report a problem that does not exist.
        const written = fs.statSync(dbFile);
        handle.prepare("INSERT INTO mirror_meta (key, value) VALUES ('source_mtime', ?) "
            + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .run(written.mtime.toISOString());
        handle.prepare("INSERT INTO mirror_meta (key, value) VALUES ('source_bytes', ?) "
            + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .run(String(written.size));

        handle.exec('COMMIT');
        handle.close();
        return {
            ok: true,
            status: op === 'create' ? 201 : 200,
            body: {
                ok: true, op,
                id: id ?? transaction?.id,
                ...(op === 'delete-category' ? { deleted: deletedCount } : {}),
            },
        };
    } catch (err) {
        try { handle.exec('ROLLBACK'); } catch { /* transaction already gone */ }
        try { handle.close(); } catch { /* already closed */ }
        return { ok: false, status: 409, body: { error: 'Per-row write refused', reason: err.message } };
    }
};
