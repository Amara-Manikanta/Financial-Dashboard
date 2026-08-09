// Schema for the SQLite mirror of db.json.
//
// Design rule: the migration must be LOSSLESS. Anything not modelled as a
// column is kept verbatim in an `extra` JSON column, and array order is kept in
// `ord`. That is what lets verify-sqlite.mjs rebuild db.json from the mirror
// and deep-compare it against the original — a far stronger check than
// comparing row counts, and the only one worth trusting for a database that
// cannot be regenerated.

export const SCHEMA = `
-- Transactions, the one collection that actually wants to be a table.
-- year/month are the source buckets in the expenses tree and are preserved so
-- the nested shape can be rebuilt exactly.
CREATE TABLE IF NOT EXISTS transactions (
    id                  TEXT    NOT NULL,
    year                TEXT    NOT NULL,
    month               TEXT    NOT NULL,
    ord                 INTEGER NOT NULL,
    date                TEXT,
    amount              REAL,
    title               TEXT,
    category            TEXT,
    sub_category        TEXT,
    payment_mode        TEXT,
    card_name           TEXT,
    transaction_type    TEXT,
    is_credited         INTEGER,
    deduct_from_salary  INTEGER,
    -- Fields not promoted to columns, kept verbatim.
    extra               TEXT    NOT NULL DEFAULT '{}',
    -- The original key list, in order. Without this an absent field and a null
    -- field both read back as null: 79 rows have no transactionType at all,
    -- while 29 have creditCardName explicitly set to null. They must not merge.
    key_order           TEXT    NOT NULL DEFAULT '[]',
    PRIMARY KEY (year, month, ord)
);

CREATE INDEX IF NOT EXISTS ix_tx_date     ON transactions(date);
CREATE INDEX IF NOT EXISTS ix_tx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS ix_tx_card     ON transactions(card_name);
CREATE INDEX IF NOT EXISTS ix_tx_id       ON transactions(id);

-- Each month node also carries a "categories" array alongside its
-- transactions, plus occasionally other keys. Kept verbatim.
CREATE TABLE IF NOT EXISTS month_meta (
    year    TEXT NOT NULL,
    month   TEXT NOT NULL,
    ord     INTEGER NOT NULL,
    rest    TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (year, month)
);

-- The other 12 collections. appData is a grab-bag of settings, savings/assets/
-- metals are nested item trees — none of them are queried by shape, so storing
-- them as JSON documents is honest rather than lazy. They can be normalised
-- later if a query ever needs it.
CREATE TABLE IF NOT EXISTS documents (
    name TEXT PRIMARY KEY,
    ord  INTEGER NOT NULL,
    body TEXT NOT NULL
);

-- Provenance, so a stale mirror is obvious.
CREATE TABLE IF NOT EXISTS mirror_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
`;

// Fields promoted to real columns. Everything else falls through to `extra`.
export const TX_COLUMNS = {
    id: 'id',
    date: 'date',
    amount: 'amount',
    title: 'title',
    category: 'category',
    subCategory: 'sub_category',
    paymentMode: 'payment_mode',
    creditCardName: 'card_name',
    transactionType: 'transaction_type',
    isCredited: 'is_credited',
    deductFromSalary: 'deduct_from_salary',
};

// SQLite has no boolean type, so these round-trip through 0/1. Any row whose
// stored type would not reconstruct exactly is sent to `extra` instead, so
// mixed types in the source data cannot silently change on the way back.
export const BOOLEAN_FIELDS = new Set(['isCredited', 'deductFromSalary']);
