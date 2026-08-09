#!/usr/bin/env node
// Build a SQLite mirror of db.json.
//
//   node scripts/migrate-to-sqlite.mjs [--source db.json] [--out finance.sqlite]
//
// READ-ONLY with respect to db.json: this script opens the source for reading
// and never writes to it. The output is disposable — if anything looks wrong,
// delete the .sqlite file and run this again.
//
// Run scripts/verify-sqlite.mjs afterwards. That is the part that actually
// proves the migration is correct.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA, TX_COLUMNS, BOOLEAN_FIELDS } from './sqlite-schema.mjs';

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.resolve(ROOT, arg('source', 'db.json'));
const OUT = path.resolve(ROOT, arg('out', 'finance.sqlite'));

if (!fs.existsSync(SOURCE)) {
    console.error(`✖ source not found: ${SOURCE}`);
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

// Always rebuild from scratch: a mirror that accumulates state is a mirror that
// can silently drift from its source.
fs.rmSync(OUT, { force: true });
for (const suffix of ['-journal', '-wal', '-shm']) fs.rmSync(OUT + suffix, { force: true });

const sql = new DatabaseSync(OUT);
sql.exec('PRAGMA journal_mode = WAL');
sql.exec(SCHEMA);

const insertTx = sql.prepare(`
    INSERT INTO transactions
        (id, year, month, ord, date, amount, title, category, sub_category,
         payment_mode, card_name, transaction_type, is_credited,
         deduct_from_salary, extra, key_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const insertMonth = sql.prepare('INSERT INTO month_meta (year, month, ord, rest) VALUES (?,?,?,?)');
const insertDoc = sql.prepare('INSERT INTO documents (name, ord, body) VALUES (?,?,?)');
const insertMeta = sql.prepare('INSERT INTO mirror_meta (key, value) VALUES (?,?)');

const toStore = (field, value) => {
    if (value === undefined) return null;
    if (value === null) return null;
    if (BOOLEAN_FIELDS.has(field)) return value ? 1 : 0;
    return value;
};

let txCount = 0;
let monthCount = 0;

sql.exec('BEGIN');
try {
    // --- expenses: year -> month -> { transactions, categories, ... } ---
    const expenses = db.expenses && typeof db.expenses === 'object' ? db.expenses : {};
    for (const [year, months] of Object.entries(expenses)) {
        if (!months || typeof months !== 'object' || Array.isArray(months)) continue;

        let monthOrd = 0;
        for (const [month, node] of Object.entries(months)) {
            if (!node || typeof node !== 'object' || Array.isArray(node)) continue;

            // Everything on the month node except `transactions`, kept verbatim
            // so `categories` (and anything else) survives untouched.
            const { transactions, ...rest } = node;
            insertMonth.run(year, month, monthOrd, JSON.stringify(rest));
            monthOrd += 1;
            monthCount += 1;

            const list = Array.isArray(transactions) ? transactions : [];
            for (let ord = 0; ord < list.length; ord += 1) {
                const t = list[ord];
                if (!t || typeof t !== 'object' || Array.isArray(t)) {
                    // Not an object: stash it whole so nothing is lost.
                    insertTx.run(null, year, month, ord, null, null, null, null, null,
                        null, null, null, null, null, JSON.stringify({ __raw: t }), '[]');
                    txCount += 1;
                    continue;
                }

                const extra = {};
                for (const [k, v] of Object.entries(t)) {
                    if (!(k in TX_COLUMNS)) extra[k] = v;
                }

                insertTx.run(
                    toStore('id', t.id) === null ? null : String(t.id),
                    year, month, ord,
                    toStore('date', t.date),
                    toStore('amount', t.amount),
                    toStore('title', t.title),
                    toStore('category', t.category),
                    toStore('subCategory', t.subCategory),
                    toStore('paymentMode', t.paymentMode),
                    toStore('creditCardName', t.creditCardName),
                    toStore('transactionType', t.transactionType),
                    toStore('isCredited', t.isCredited),
                    toStore('deductFromSalary', t.deductFromSalary),
                    JSON.stringify(extra),
                    JSON.stringify(Object.keys(t)),
                );
                txCount += 1;
            }
        }
    }

    // --- every other collection, verbatim ---
    let docOrd = 0;
    for (const [name, value] of Object.entries(db)) {
        if (name === 'expenses') continue;
        insertDoc.run(name, docOrd, JSON.stringify(value));
        docOrd += 1;
    }

    const stat = fs.statSync(SOURCE);
    insertMeta.run('source', SOURCE);
    insertMeta.run('source_mtime', stat.mtime.toISOString());
    insertMeta.run('source_bytes', String(stat.size));
    insertMeta.run('built_at', new Date().toISOString());
    insertMeta.run('transaction_count', String(txCount));

    sql.exec('COMMIT');
} catch (err) {
    sql.exec('ROLLBACK');
    console.error('✖ migration failed, nothing written:', err.message);
    sql.close();
    process.exit(1);
}

sql.close();

const outSize = fs.statSync(OUT).size;
const srcSize = fs.statSync(SOURCE).size;
console.log(`✔ mirror built: ${path.relative(ROOT, OUT)}`);
console.log(`  ${txCount.toLocaleString('en-IN')} transactions across ${monthCount} month buckets`);
console.log(`  ${Object.keys(db).length - 1} other collections stored as documents`);
console.log(`  ${(srcSize / 1048576).toFixed(2)} MB JSON  ->  ${(outSize / 1048576).toFixed(2)} MB SQLite`);
console.log(`\n  Now run: node scripts/verify-sqlite.mjs`);
