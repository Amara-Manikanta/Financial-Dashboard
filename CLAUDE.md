# Working on this project

Read this before changing anything. Most rules here exist because the specific
mistake they describe has already happened once and destroyed real data.

This is a personal finance dashboard. The database holds one person's actual
financial records going back to 2017 — expenses, salary, investments, credit
cards. It is not seed data and it cannot be regenerated.

---

## 1. Data safety — the rules that matter most

### Always snapshot `db.json` before touching it

`db.json` is gitignored, so **git is not a recovery path**. If it is corrupted,
the only way back is a copy made beforehand. Before any work that could write to
the database — schema changes, migrations, testing write paths — copy it:

```bash
cp db.json "backups/db-SAFEPOINT-$(date +%Y%m%d-%H%M%S).json"
```

Use the `db-SAFEPOINT-` prefix. The rotation in `server.js` only deletes files
starting with `db-backup-`, so safepoints survive.

### Never test writes against the live database

Copy the data to a throwaway file and run an isolated server against it. The
database path and both ports are overridable — set all three, or the "isolated"
instance still reads and writes the real `db.json`:

```bash
DB_FILE=/tmp/test-db.json PROXY_PORT=4000 INTERNAL_PORT=4001 node server.js
```

**Check it actually started.** A busy port makes the instance die with
`EADDRINUSE` while a *different* server keeps answering on that port, so a
cheerful `HTTP 200` proves nothing about which database you just wrote to. This
already caused one wasted test run against port 5000, which was macOS
ControlCenter. Confirm the file, not the status code:

```bash
ps -eo args | grep "[j]son-server --watch"
```

### Testing the UI without touching the live records

`VITE_API_URL` repoints the whole client, so the real interface can be driven
against a throwaway copy. Two terminals:

```bash
cp db.json /tmp/sandbox-db.json && npm run server:sandbox
```

```bash
npm run dev:sandbox
```

That serves the app on **5174** against an API on **4000** reading
`/tmp/sandbox-db.json`. Saves, edits and deletes are all real — they just land
somewhere disposable. Use this for anything that writes; the alternative is
testing write paths against irreplaceable records.

### Never commit database exports

A 60 MB export (`db.json.nps.backup`) was once committed to a **public** GitHub
repo, exposing 7,082 transactions, salary history and account passwords. It had
to be purged from all 129 commits with `git filter-repo` and force-pushed.

`.gitignore` now blocks `db.json`, `db/`, `*.backup`, `db.json.*` and
`*db-backup*.json`. Do not add exceptions. If you create an export for
debugging, put it **outside** the repository.

---

## 2. Architecture

| Layer | What it is |
| --- | --- |
| UI | React 18 + React Router 6, Vite 5 |
| Styling | **Tailwind CSS 3** (see §3) |
| Icons | `lucide-react` |
| Charts | `recharts` |
| API | `json-server` 1.0 beta on port **3001** |
| Proxy | `server.js` on port **3000** — backups, write guard, uploads |
| Dev server | Vite on port **5173** |

The browser never talks to json-server directly. Everything goes through the
proxy on 3000, which is the single chokepoint for backups and write validation.

```bash
npm run server   # API + proxy (3000/3001)
npm run dev      # Vite (5173)
npm run build
```

### Run the pinned `json-server`, never one from `PATH`

`server.js` spawns `node_modules/.bin/json-server` by absolute path on purpose.
It used to spawn plain `json-server`, which resolved to a globally installed
**1.0.0-beta.5** instead of the pinned **1.0.0-beta.3**. beta.5 ships a body
parser that rejects any request body over **100 KB** with a 500.

Every write here sends a whole collection, and three are over that line —
`expenses` ~1.8 MB, `savings` ~168 KB, `appData` ~122 KB. So saving an expense
returned 500, `saveExpenses` swallowed it in `catch { console.error }`, the
change stayed in React state and looked saved, and it was gone on the next
reload. It presents as data mysteriously reverting, not as an error.

If writes start failing again, check which binary is actually running:

```bash
ps -eo args | grep json-server
```

`DB_FILE` is also env-overridable now, so an isolated instance really is
isolated — the guard, the backups and json-server all read that one value:

```bash
DB_FILE=/tmp/test-db.json PROXY_PORT=4000 INTERNAL_PORT=4001 node server.js
```

### Never import `db.json` into source code

```js
import initialDb from '../../db.json';   // NEVER DO THIS
```

Vite inlines a JSON import **at build time**, producing a snapshot that never
refreshes. `FinanceContext` used to seed React state from it and fall back to it
when a fetch failed. Because the API server restarts whenever code changes, that
fallback fired constantly, loading months-old records into state — and the next
save wrote them back over the live database. It silently reverted uploaded
photos to seed paths and deleted two entire metals categories.

It also shipped the whole 3.2 MB database inside the JS bundle; removing it cut
the bundle by 1.68 MB.

All data must be fetched from the API at runtime. When the initial load fails,
state stays empty, `loadError` is set, and `canWrite()` refuses saves — never
write state that was never successfully loaded.

### Use PATCH, not PUT, for collections — and know why it works

`PUT /appData` with a partial body returns **HTTP 200** and silently deletes
every key you did not send. So client code sends PATCH. All writes to `appData`,
`expenses` and `metals` use it, and send only what changed:

```js
await fetch(`${API_URL}/metals`, {
    method: 'PATCH',
    body: JSON.stringify({ gold: nextItems })   // silver is untouched
});
```

**The merge happens in `server.js`, not in json-server.** Do not assume the
database does it. json-server 1.0.0-beta.3 has a genuine bug in
`lib/service.js` — it writes

```js
db.data[name] = { item, ...body }     // meant: { ...item, ...body }
```

so the *entire existing collection* is buried under a literal `"item"` key while
the body replaces everything at the top level. The example above would have moved
silver into `metals.item` and left `metals.silver` gone. It nests one level
deeper on every save. **This is what corrupted the metals collection**, and it
had silently doubled `expenses` (1.8 MB → 3.6 MB) and `appData` before it was
found. beta.5 fixes the merge but rejects bodies over 100 KB, so no released
version behaves correctly on its own.

`mergePatchIntoPut()` in `server.js` therefore merges the body against the
current `db.json` and forwards it as a PUT, which beta.3 stores verbatim.
Requests carrying an id (`/savings/123`) are left alone — the per-item path
merges correctly.

If a collection ever grows an `item` key again, that is the signature of this
bug and something has bypassed the proxy.

### The write guard (`dbGuard.js`)

Every mutation is inspected before it reaches json-server and rejected with
**409** if it would drop a top-level key, introduce a stray `item` key, empty a
collection, delete a whole collection, shrink one by more than 20%, or carry
malformed JSON.

If a legitimate bulk edit is ever blocked, adjust `MAX_SHRINK_RATIO`
deliberately — do not bypass the guard.

### Writes carry the version they were based on

Every save sends a whole collection, so a client working from a stale copy
overwrites everything it never loaded. Two browser tabs was enough to lose a
whole evening's entries: each tab held its own snapshot, and whichever saved
last silently erased the other's rows.

`server.js` fingerprints each collection (`collectionVersion`, a sha1 of its
current JSON) and returns it as `X-DB-Version` on every request. A client that
sends that value back as `If-Match` may only write on top of that exact
version; if the database has moved, the write is refused with **409** and the
banner tells the user to reload.

Clients that send no `If-Match` are still accepted, so nothing breaks — but any
new whole-collection write path should send it. `FinanceContext` does this for
`expenses`, which is the collection that actually suffers.

### A failed write must never look like a successful one

`saveExpenses` used to swallow errors into `console.error`. React state had
already been updated, so the row sat on screen looking saved and was gone on
the next reload — which is why this presents as "the database keeps losing my
data" rather than as an error.

Failed and refused writes now set `saveError`, rendered as a red **NOT SAVED**
banner across the top of every page. Guest mode sets it too: guest saves are a
deliberate no-op, and that was previously invisible.

Any new write path must do the same. Never leave a `catch` that only logs.

---

## 3. Styling: Tailwind is required

**This project uses Tailwind CSS.** It was missing for a long time while the
code used ~1,949 Tailwind class names across 67 files. Someone had hand-written
~143 imitation utilities into `index.css`, so anything uncopied silently did
nothing — `bg-black/40` on a dark input fell through to the browser's white
default and rendered white text on a white field.

Rules:

- Write styling as Tailwind classes. Do not hand-write CSS that duplicates a
  Tailwind utility, and do not reintroduce copies into `index.css`.
- `index.css` holds only what Tailwind does not provide: design tokens in
  `:root`, base element styles, component classes (`.card`, `.bg-modal`) and
  the scrollbar helpers.
- Preflight is enabled. New form controls inherit dark styling from the
  `@layer base` rules — do not assume browser defaults are fine on a dark page.
- Prefer classes over inline `style={{}}`. Several older files use inline
  styles; that is legacy, not the pattern to copy.

**Restart Vite after changing `postcss.config.js` or `tailwind.config.js`.**
PostCSS config is read once at startup, so a running dev server will keep
serving un-compiled CSS and you will think your change did nothing.

### Header navigation

The nav fits a limited width. Adding a top-level item can push others
off-screen — this already happened and made the Cards, All Transactions, Assets
and Loans & Lents pages look "missing" when the pages were fine.

Group related destinations into a `NavDropdown` instead of adding top-level
items, and let labels hide below `xl` if more room is needed.

**Never put `overflow` on the `<nav>`.** The dropdown menus are absolutely
positioned below the bar, and CSS cannot clip one axis while leaving the other
visible — setting `overflow-x-auto` to stop horizontal clipping silently clips
the menus vertically too, making every grouped link unreachable. This was tried
and broke all dropdown navigation.

After changing the header, verify both that nothing is clipped and that a
dropdown still opens:

```js
const n = document.querySelector('header nav');
getComputedStyle(n).overflowY === 'visible';   // must stay true
n.scrollWidth <= n.clientWidth;                // must be true at 1280px
```

---

## 4. File uploads

Photos and bills are stored **as files**, never as base64 in `db.json`.
Embedding them bloated every read and write and made them collateral damage of
any bad write.

- `POST /api/upload` — accepts `{ dataUrl, name, folder }`, returns `{ url }`
- `GET /api/images/<file>` and `GET /api/documents/<file>` — serve them
- Two folders, both gitignored under `db/`: `db/images/` for item photos and
  bills, `db/documents/` for policy paperwork (receipts, RC copies, original
  insurance documents). `folder` defaults to `images`; anything other than
  those two names is rejected rather than turned into a path.
- Files are named after the item so the folders stay browsable
  (`diamond-necklace-1785922752366.png`)
- Document scans are stored at full resolution so small print stays readable;
  only item photos are downscaled
- Accepts JPEG, PNG, WebP, GIF, PDF; 10 MB limit
- Filenames are always built server-side from a slug — never trust client input
  in a path

Use `src/utils/uploadFile.js` from the client. Upload on **save**, not on file
selection, so the stored filename matches the item's final name.

Items may carry legacy photo fields: `images[]`, `imageUrl`, `image`, `photo`.
**Rewrite all of them together.** Clearing only some is why a deleted photo used
to reappear immediately.

---

## 5. The SQLite mirror (optional, off by default)

`db.json` is still the only source of truth. Alongside it there is an optional
SQLite mirror, `finance.sqlite`, derived from it.

```bash
npm run sqlite:refresh    # rebuild the mirror, then verify it
```

`scripts/verify-sqlite.mjs` is the important half. It checks row counts and
per-category sums, but the check that matters is the third: it **rebuilds
`db.json` from SQLite and compares field by field**. Counts and sums can both
agree while individual fields are quietly wrong; a full round-trip cannot. It
exits non-zero, so it can gate anything that depends on the mirror.

The migration is lossless by design. Fields not promoted to columns are kept in
an `extra` JSON column, array order in `ord`, and **the original key list per
row** — 79 transactions have no `transactionType` key at all while 29 have
`creditCardName` explicitly `null`, and without the key list both read back as
`null`.

`server.js` can serve reads from the mirror, controlled by `SQLITE_READS`:

| value | behaviour |
| --- | --- |
| `off` *(default)* | Nothing loads. `node:sqlite` is not even imported. |
| `shadow` | json-server still answers; each response is compared against SQLite and differences are logged. Zero risk. |
| `on` | SQLite answers whole-collection GETs. json-server still owns every write. |

The mirror is rebuilt automatically (~100 ms) whenever `db.json` changes, so it
cannot serve data older than the file json-server is writing.

**Use `shadow` before `on`.** A wrong read is worse than a slow one here: the
client would load bad state and could then save it back over `db.json`. Shadow
mode proves equivalence against real traffic while json-server remains
authoritative.

`finance.sqlite` is gitignored — it holds the same data as `db.json`. An
isolated instance builds its own mirror beside its own database, so it never
touches the real one:

```bash
DB_FILE=/tmp/test-db.json PROXY_PORT=4000 INTERNAL_PORT=4001 \
  SQLITE_READS=on node server.js
```

Note that `on` returns compact JSON where json-server pretty-prints. The data is
identical — it is 37% fewer bytes over the wire.

### Per-row writes (`SQLITE_WRITES=on`, off by default)

This is the part that actually fixes the lost-update problem. Every existing
save ships a whole collection built from one tab's snapshot, which is why two
tabs could erase each other. These endpoints change one row:

```
POST   /api/tx          { "transaction": { ...one transaction... } }
PATCH  /api/tx/<id>     { ...fields to change... }
DELETE /api/tx/<id>
```

Each call runs inside a SQLite transaction: apply the row change, rebuild the
whole database from the mirror, put it through `inspectWrite` (the same guard
as every other write), then replace `db.json` **atomically** via a temp file and
a rename. Any failure rolls back and leaves `db.json` untouched.

`db.json` is still the durable artifact — SQLite is the transactional engine in
front of it, not a replacement.

A `PATCH` that changes the date moves the row to the right month bucket
automatically. After each write, the mirror records the new `db.json` mtime, so
it does not immediately declare itself stale.

Verified on isolated copies: two concurrent edits to different transactions both
survive (with whole-collection writes one would be lost), 25 concurrent creates
all landed with no duplicate ids, and the round-trip check still passes.

### The client uses them, and falls back when they are off

`addItem` (logging a transaction) now tries `POST /api/tx` first and falls back
to the whole-collection save when the server answers **503** (feature off) or
**404** (older server). `perRowWrites` in `FinanceContext` remembers the answer,
so the probe happens once.

That fallback is not optional. `SQLITE_WRITES` defaults to off, so the fallback
is the path most runs take — if you change this code, test both.

```bash
npm run server           # DEFAULT: SQLite reads + per-row writes
npm run server:shadow    # reads compared against SQLite, nothing depends on it
npm run server:json      # escape hatch: json-server owns everything, as before
```

**`npm run server` now runs with `SQLITE_READS=on SQLITE_WRITES=on`.** If
anything looks wrong, `npm run server:json` returns to the original path with no
code change and no data migration — `db.json` is still the durable artifact
either way, so switching back is just a restart.

`.claude/launch.json` starts both the API and Vite, so the launcher brings up
the whole stack.

### `categories` must be recomputed on every write

Each month node carries a `categories` aggregate derived from its transactions,
and five pages read it (Analytics, Budget Limits, the monthly view, Expenses,
and category renaming). 111 of 120 months have it populated.

The client builds it in `withRecomputedCategories`; the per-row path bypasses
that entirely, so `recomputeCategories()` in `sqliteWrites.js` reproduces the
same formula server-side — including the clamp to zero. **If one formula
changes, the other must change with it**, or the aggregate silently drifts and
every one of those pages reports wrong numbers with no error anywhere.

---

## 6. Logging an investment from the expenses page

A transaction under **Investments** can carry the holdings it funded, so a SIP
is entered once instead of on two pages that then disagree. Before this existed
the two sides had drifted badly: 44 mutual-fund expense rows against 99 fund
transactions, and 23 stock expense rows against 429 stock transactions.

### One expense, many legs

`investmentData` is `{ legs: [...] }`, **not** a single asset. One debit is
routinely several investments — a ₹200 row in this database is ₹100 into Nippon
and ₹100 into ICICI Next 50. Every leg becomes its own transaction on the
investment side.

Legs are linked back by `expenseId`, and their ids are `<expenseId>::<index>`.
The index matters: two legs sharing one id collide inside a single fund, and
deleting the expense would only remove one of them.

**Strip an expense's old legs once per savings row, never per leg.** Filtering
inside the leg loop makes the second SIP into a fund delete the first, because
both match the same `expenseId`. That is a silent half-save — the screen shows
two, the database keeps one. There is a test for it.

### Adopt an existing transaction — never blindly create one

**This is the common case, not the exception.** The investment pages are the
more accurate record — 429 stock transactions against 23 stock expense rows —
so linking an expense usually points at a purchase that is *already* recorded on
the holding. Creating a transaction per leg would double the position.

So a leg first looks for an unlinked transaction on that holding with the same
date and figures (`findAdoptable`) and stamps the link onto it, keeping its
original id. Only when nothing matches is a new one created. The form does the
same thing when a holding is picked: it fills the leg from the existing
transaction, which is also what makes the figures match closely enough to be
adopted.

Adopted rows carry `adoptedByExpense: true`, and that flag decides what unlinking
does. `detachExpense` **removes** transactions the expense created but only
**releases** ones it adopted — deleting an adopted row would destroy an
investment record that existed before the link and has nothing to do with the
expense.

This was found the hard way: a real Coal India expense was linked to a holding
that already had its `2026-08-10 buy, 1 @ ₹412.80`, and without adoption the
position would have gone from 38 shares to 39.

### The formulas live in `utils/investmentSync.js` and are shared

`recomputeStockMetrics` and `recomputeFundUnits` are imported by `StockDetails`,
`MutualFundDetails` **and** the sync in `FinanceContext`. They were previously
duplicated, and the copies had already diverged: the sync handled only `buy` and
`sell`, while the real formula also replays `ipo`, `bonus`, `split`, `buyback`
and `demerger`. Syncing a leg onto a stock with a split in its history would
have rewritten `shares` using the wrong maths.

This is the same hazard as the `categories` aggregate above. Keep one copy.

### Actions are deliberately narrower here than on the investment pages

The stock page offers eight transaction types; this form offers five. `bonus`,
`split` and `demerger` change a share count without any money moving, so they
have no place on a form that records cash leaving an account — logging one there
would invent a payment that never happened. They stay on the stock page.

### Matching is a suggestion, never automatic

Amount and date alone cannot identify the fund: across the real rows that
resolves only 11 of 44, leaves 20 ambiguous and misses 13, because several SIPs
of the same amount run on the same day. Titles disambiguate 37 of 44, so
`suggestAsset` proposes a fund and the user confirms. It returns `null` below
`CONFIDENT_MATCH` rather than guessing — units in the wrong fund are worse than
a question.

### Failures must reach the screen

The expense and the holding are two writes, and they are not atomic. If the
second fails the pages disagree, so the sync returns a message and the caller
raises the **NOT SAVED** banner. The old code had a `catch` that only logged.
On delete, the holding is unwound only *after* the expense delete has persisted.

---

## 7. Restart checklist

Changes that need a restart, and which silently appear to do nothing otherwise:

| Changed | Restart |
| --- | --- |
| `server.js`, `dbGuard.js`, `sqliteReads.js` | `npm run server` |
| `postcss.config.js`, `tailwind.config.js` | `npm run dev` |
| `vite.config.js` | `npm run dev` |
| A new icon imported from `lucide-react` | `npm run dev` — Vite's pre-bundled dep chunk does not pick it up, which surfaces as `X is not defined` at runtime while `npm run build` passes |

React/CSS source changes hot-reload normally.

---

## 8. Verifying your work

- `npm run build` must pass.
- For UI changes, actually open the page. Several bugs here were invisible in
  the code and obvious on screen.
- For data changes, check record counts before and after — never assume.
- After any write path change, confirm the guard still blocks a bad write and
  still allows a legitimate one.

## 9. Known gaps

- 19 of the original uploaded ornament photos were lost before any backup
  existed and are unrecoverable. Missing images render a labelled placeholder.
- Many older pages still use inline styles rather than Tailwind classes.
- Per-mutation snapshots are frequency-based and now capped at **10**, not 100.
  Each is a full ~3.5 MB copy, and with per-row writes firing on every logged
  transaction the tier refilled in hours and reached 350 MB. A hundred snapshots
  of one busy afternoon is the same afternoon stored a hundred times. **The
  daily and monthly tiers are the real safety net**; the rolling window only
  exists to undo something you just did.
- `finance.sqlite` is **not** a backup. It is derived from `db.json` and is
  rebuilt from it whenever that file changes — including from a corrupted one.
  Recovery still comes from `backups/`.
