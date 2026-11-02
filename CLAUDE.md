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

**Single records are versioned the same way.** `GET /<collection>/<id>` returns
that record's own fingerprint (`itemVersion`, sha1 of the one row) as
`X-DB-Version`, and a `PATCH`/`PUT`/`DELETE` on that path carrying it as
`If-Match` is refused with 409 if the record changed since. The phone's record
editor depends on this; per-item writes still go through the queue, the
freshness check, the guard and the backups like every other write.

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

### json-server must never write from a stale copy

json-server keeps the whole database in memory and writes all of it back on
every save. It learns about per-row writes only through a file watcher, and
that watcher ignores changes landing while json-server is itself writing. The
per-row endpoint also used to run outside the mutation queue. Once one reload
was missed, every later save through json-server — of anything — wrote its old
copy back and erased the rows added since. Logging a stock purchase lost its
expense rows while the holding survived, and three older expenses went with
them.

So `/api/tx` now runs inside `runExclusive`, and `ensureJsonServerFresh()`
compares json-server's view against `db.json` before any write, waits for a
reload, restarts json-server if it never comes, and refuses the write (503)
if even that fails. To reproduce the old failure deterministically, start the
sandbox with `NODE_ENV=production`, which disables json-server's watcher.

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

## 7. Warranties, receipts and service history

Owned goods carry cover; land does not. Warranty fields live on the asset item
itself (`utils/warranty.js` derives everything from them) rather than in a
separate collection, so nothing can drift out of step with the item.

```
serialNumber, seller              what a manufacturer asks for on a claim
warrantyMonths | warrantyExpiry   manufacturer cover
extendedMonths | extendedExpiry   a second period bought on top
extendedCost                      what that cover cost
receipts[]                        { url, name, mimeType, kind }
services[]                        { id, date, description, cost, underWarranty, provider }
```

**Store months, not a computed expiry.** "24 months from purchase" stays correct
if the purchase date is later corrected; a stored date silently keeps the old
answer. An explicit date is still accepted for plans that do not start on the
purchase day, and wins when both are set.

**`unknown` is not `expired`.** An item nobody recorded a warranty for is a gap
in the records; an expired one is a fact. Collapsing the two would hide the 15
items actually worth filling in behind cover that has genuinely run out.

`coverExpiry` takes the **later** of the two periods. Extended cover usually
starts when the manufacturer's ends, but not always, so the maximum is the only
answer that is right either way.

Receipts go to `db/documents/`, not `db/images/` — §4 keeps documents at full
resolution so serial numbers and small print stay readable.

Real estate is excluded from every warranty view (`warrantable()`). Including
plots and apartments would bury 16 real gadgets among 12 rows that can never
have cover and make "not recorded" useless as a worklist.

### The nav bar is at its width limit

Grouping Assets into a `NavDropdown` added a chevron and pushed the row **6px**
past the bar at exactly 1280px, so the gap at `xl` is now `gap-2`. If another
nav item is ever added, re-run the check in §3 — there is no slack left:

```js
const n = document.querySelector('header nav');
n.scrollWidth <= n.clientWidth;   // was 1014 vs 1008 before the fix
```

That measurement depends on **Plus Jakarta Sans being installed**: nothing in
the repo loads it as a web font, so a machine without it falls back to a wider
sans-serif and the row overflows whatever the nav contains (1029 vs 975 in a
container with no copy of the font). Compare against the base commit on the
same machine before blaming a change.

---

## 8. The Stock Analyst

`/investments/analyst` reads the stock portfolio and says what is worth doing
about it. `src/utils/stockAdvisor.js` computes every suggestion; the page draws
them; an optional local model only rewords and orders them. Nothing in any of
it writes.

### It is the one place allowed to have an opinion — on three conditions

The rest of the app is deliberately descriptive ("a position in a range",
limits "entered, never suggested"). The analyst exists to turn facts into
suggestions, so instead it holds itself to:

1. **Your rules first.** Sector limits, price alerts and watchlist priority are
   the user's; crossing one is the strongest signal it raises.
2. **Outside rules are named.** The only market judgement is SEBI's 10%
   single-company cap for diversified funds. Every finding carries a `rule`
   saying what raised it, and every threshold lives in `RULES`.
3. **Tax comes from the Capital Gains ledger.** A suggested sale is run through
   `matchLots` and `gainsLedger` as if it had happened (`simulateSale`,
   `taxImpact`), so FIFO lots, set-off, carried losses and the ₹1.25L exemption
   apply exactly as on the Capital Gains page. **Never re-derive a tax rule in
   the analyst** — fix the ledger, and both pages move together.

Do not add a finding that predicts a price. "Down 30% and the scorecard fails"
is a reason to re-read a thesis, not a forecast.

### Owners and archived holdings

The page passes `ownHoldings(...)`, archived holdings included. Archived ones
are never suggested, but their sales are this year's disposals and the year's
tax is wrong without them. Family and paper holdings stay out entirely, as on
every portfolio page.

### Findings that share one allowance must say so

Trims and the exemption harvest both spend the same ₹1.25L. Each is computed
independently, so the harvest names the trims that would use part of it rather
than silently double-counting the allowance. Any new tax finding needs the same
treatment.

### The local model (LM Studio) never computes

`analystLLM.js` relays to an OpenAI-compatible server on this machine —
LM Studio by default, Ollama or llama.cpp work too:

| Variable | Default |
| --- | --- |
| `LOCAL_LLM_URL` | `http://127.0.0.1:1234/v1` |
| `LOCAL_LLM_MODEL` | first chat model the server lists |
| `LOCAL_LLM_TIMEOUT_MS` | `180000` |
| `LOCAL_LLM_MAX_TOKENS` | `2000` |

Reasoning ("thinking") models spend the reply budget before writing the answer.
At 800 tokens a 4B one used all of it and returned an empty reply that was
logged as a success. An empty reply is now a failure that says so, and every
response carries `raw` — the model's content, its reasoning, the stop reason
and token usage — for the AI responses tab. Prefer an instruct model.

The JSON grammar can be the failure too: `google/gemma-4-12b-qat` ran 90s
under it and returned nothing but whitespace. A constrained brief that comes
back empty or unparseable is retried once without `response_format`; the first
attempt is kept as `firstAttempt`.

`RELAY_VERSION` in `analystLLM.js` must match `EXPECTED_RELAY` in
`AnalystBrief.jsx`. The panel warns when the server is older, because a server
started before `git pull` keeps running the old relay and looks exactly like
the bug that was just fixed. Bump both when the relay's behaviour changes.

The **Prompt** tab shows exactly what the model is sent, from the same
`promptMessages()` the relay uses, so the preview cannot drift from the real
request. Only the instructions (system message) are editable, saved in
`localStorage` (`kubera.analyst.prompts`) and sent as `systemPrompt`. The
facts stay generated and read-only — that is what keeps the model from being
handed figures it could have been told wrongly.

A 3–4B model is enough because it is given nothing to work out: `llmFacts()`
hands it findings with every figure already formatted, and it only orders and
explains them. Keep it that way — a small model rewords "₹80,835" reliably and
adds two such figures unreliably. The brief is requested as JSON whose `id` is
an enum of real finding ids, and ids are filtered again on the way back for
servers that ignore the schema. Prompts are sized for LM Studio's default
4,096-token context.

The brief and questions send stock holdings and the stock tax position only.
The **Your prompt** tab is where the owner writes their own question: it adds
mutual funds (`fundFacts`), and — only when its checkbox is ticked — a
whole-dashboard summary (`dashboardFacts` in `utils/portfolioFacts.js`: net
worth by asset class, loans, cards, median income and spending, income tax).
That box is off by default and must stay opt-in; nothing else may send
income, spending or debt. `dashboardFacts` drops the demo loans FinanceContext
shows when none are saved — never let demo rows reach an analysis. Answers there
are the model's opinion and the page labels them so.

A question that names a holding (by ticker or first word of its name,
`holdingsNamedIn`) also carries `averagingCase` for it: average cost and
break-even after buying 25/50/100% more, the weight against the 10% cap, the
52-week range, the fundamentals score and what selling instead would realise.
That is what lets the model answer "should I average?" without doing sums.

### News (`news.js`)

`GET /api/analyst/news?symbol=&name=` returns up to 12 headlines from the last
30 days, merged from Yahoo Finance search and Google News RSS (Indian edition),
deduplicated, cached 30 minutes per stock. Titles only: article bodies are
paywalled and scrapers break. A question naming a holding carries six of its
headlines; the Your prompt tab can add four each for the ten largest holdings;
the News tab lists them. The model is told headlines are unverified and unread.
Each source can fail on its own and says so in `errors` — a blocked source
must never look like "no news".

`&fresh=1` skips the server cache; the News tab's **Refresh news** and
per-stock refresh use it, and the client cache is replaced at the same time,
so the next question uses the fresh headlines. Watchlist names count for news
(not for averaging figures), and the Questions box says what a question will
carry before it is sent.

**NewsAPI** is a third source when `NEWSAPI_KEY` is set. It carries article
descriptions, which are sent only for the stock a question names (ten
holdings' worth would crowd an 8K context). The key lives in `.env.local`
(gitignored; `server.js` loads it with `process.loadEnvFile`) — **never commit
it**. The free plan allows 100 requests in 24 hours: `news.js` keeps a rolling
log in `.newsapi-usage.json` beside the database (so restarts do not reset it
and a sandbox counts separately), skips NewsAPI once `NEWSAPI_DAILY_LIMIT`
(default 100) is reached, and the News tab shows the count. Check and record
happen in the same tick, so concurrent refreshes cannot overshoot.

**The news archive (`newsArchive.js`)** is one **CSV file per stock** in
`db/news/<SYMBOL>.csv` beside the database (gitignored, never in db.json) —
openable in a spreadsheet, a file per stock. One row per **story**, not per
headline: headlines from all three sources that share at least two
significant words and half of the shorter title within three days are one
story listing every outlet (`consolidate`; the company's own name is excluded
from the comparison or everything would merge). Rows keep a year, 400 max.

Columns: `id, date` (published), `first_seen` (collected), `company, theme,
title, outlets, sources, impact, key_points, why_it_matters, analysed_by,
analysed_at, analysis_basis, status, summary, links`. Cells starting with
`= + - @` get a leading apostrophe on write (spreadsheet formula injection —
headlines are text strangers wrote) and lose it on read.

**Articles are analysed, not stored.** `analyseLatest` downloads an article
(`linkedom` + `@mozilla/readability`, the Reader View engine — the Node
equivalent of LangChain's NewsURLLoader), has the local model return key
points, an impact label and why it matters (`analyseArticle`, JSON schema,
retry without it), stores those and drops the text. With no readable page the
publisher's description is used (`analysis_basis: description`); with
neither, `status` records why so it is not retried. A model failure is retried
once per server run. Google News links are redirects a server cannot follow.
Model calls run one at a time.

`startNewsCollector` fetches all your own held stocks every
`NEWS_COLLECT_HOURS` (default 6, `0` off), reading db.json but never writing
it, leaves 40 NewsAPI requests for questions, and analyses up to three new
stories per stock when LM Studio is running. A question naming a stock sends
`archiveDigest`: today's date, each story's date with "N days ago" (and when
it was collected, if later), counts by theme and impact for 7/30/90 days, the
latest stories with their stored key points, and older ones by theme —
everything counted and dated here so the model never works it out.

Each stock's page has a **News & analysis** card (`StockNewsCard`): fetch
latest, analyse up to five unread, download the CSV.

Every reply and every failure is logged on the page's **AI responses** tab,
raw JSON included, so runs and models can be compared. The log is kept in
`localStorage` (`kubera.analyst.responses`, last 50), deliberately not in
`db.json`: a model's wording is not a financial record.

`insightsEngine.js` and `AIChatInterface.jsx` are an older, unmounted attempt
with a model path hard-coded to one Mac. The analyst does not use them.

### Claude reads the news (`claudeNews.js`, off by default)

An alternative to the local model for reading stories, plus a **running brief**
per stock. Needs `ANTHROPIC_API_KEY` in `.env.local` (never commit it) **and**
the "Claude reading" switch on the stock page's News & analysis card. Without
both, nothing calls the API and `analyseLatest` uses LM Studio as before.

- **Model:** `claude-haiku-5-5` at effort `low`, structured output
  (`output_config.format`). Override with `CLAUDE_NEWS_MODEL`.
- **Story reading** fills the same CSV columns as the local model
  (`analysed_by` says which). Same contract as `analyseArticle`, so `news.js`
  just picks one.
- **The brief** (`db/news/briefs/<SYMBOL>.json`, never db.json) has at most 8
  items, each open/resolved, each citing story ids. Dates come from the cited
  stories, never from the model. Daily it is **updated** from the previous
  brief plus stories that arrived since; once a week it is **rebuilt** from the
  stored readings alone, ignoring the previous brief, so drift cannot compound.
- **Figures are checked.** A number Claude writes that is not in its source is
  flagged — `[unverified figure …]` on a key point, `unverified` on a brief
  item. A brief item is checked only against **the stories it cites**, never
  against the previous brief's text: otherwise one invented figure would be
  laundered by every update. There is a test for it.
- **What is sent:** company names, headlines, article text, stored key points.
  Never quantities, values, cost or tax. No buy/sell verdict — the page's own
  figures sit beside the brief, not inside it.
- **Spend** is logged per call from `response.usage` in `.claude-news.json`
  beside the database (gitignored; a sandbox counts separately) and capped per
  IST day by `CLAUDE_NEWS_DAILY_INR` (default 150; `USD_INR` default 90).
  The check happens before each call, so the last call can overshoot slightly.
- **Key and switch live on the Profile page** (`ClaudeNewsCard`), with today's
  spend, the last daily run and a "Run daily reading now" button. The key is
  posted once to `/api/analyst/claude/key`, written to `.env.local` (mode 600)
  and applied without a restart; only its last four characters ever come back.
  A sandbox (`DB_FILE` set) writes the key beside its own database instead, so
  testing it never rewrites the real `.env.local`.
- **Daily run** after 7 am IST: each held stock gets up to 30 unread stories
  from the last 30 days read, then its brief updated. Stops at the cap.
- `POST /api/analyst/claude/brief` refuses (503) when Claude is off — it must
  never fall through to the local reader and mark stories unreadable.

To test without a key or spend, point the SDK at a stub:
`ANTHROPIC_API_KEY=stub ANTHROPIC_BASE_URL=http://127.0.0.1:4999` on the
sandbox server, with a tiny HTTP server answering `/v1/messages`.

### Daily research from outside (`strategy.js`, `researchImport.js`, `researchPrompt.js`, Research tab)

The Analyst page's **Research** tab is a log of what an outside research run (Google Antigravity) said each day,
not a source of truth and never an instruction. The loop: **Copy daily prompt** (built from the database — name,
invested, average, quantity, stored price, gain %, sector, first buy, and the last call for each holding, using
`effectiveStockPosition` so a manual average cost is honoured), run it in Antigravity, **paste the table it returns**,
check the preview, **Save**.

- `parseResearch` reads the markdown table (or tab-separated text copied from a rendered one) by header names, takes
  the **first table only**, and normalises the call to BUY / ACCUMULATE / HOLD / REVIEW / SELL (STRONG BUY → BUY,
  EXIT → SELL). A row with no readable call is reported in "Not read", never guessed.
- `matchHoldings` pairs a row with a holding by shared words (`Adani Ports & SEZ` → `Adani Ports and Special
  Economic Zone Limited`); at least two thirds of the shorter name, and one clear winner. An unclear row is left for
  a person to pick (remembered in `localStorage` `kubera.research.aliases`) — a call filed under the wrong company is
  worse than a question.
- `server.js` stores one file per day in `db/strategy/YYYY-MM-DD.json` beside the database (gitignored with `db/`,
  **never in db.json**; a sandbox writes beside its own database). Pasting again the same day replaces that day.
  Routes: `GET/POST/DELETE /api/analyst/strategy`. The server trims and validates (call in the five words, ≤200 rows,
  text capped) but does not interpret.
- **Two prompts.** *Daily* (news, price position, one call + confidence per holding; the date window is filled in
  from today) and *weekly review* (fundamentals table first, then portfolio sections A–E and a final rating, with
  each holding's weight and the sector split computed here, not left to the model). Both put the importable table
  first. Calls are defined for someone who **already owns** the stock (BUY = add meaningfully, ACCUMULATE = add
  gradually). The importer also reads a `Confidence` column (HIGH / MEDIUM / LOW). Figures in the prompts use
  `effectiveStockPosition`, i.e. the app's own average cost — **`manualAvgCost` is set on nearly every holding and
  differs from the transaction replay on several (Wipro 96.82 vs 197.44, Adani Power 37.99 vs 6.77, Infosys,
  Adani Enterprises)**; check those two overrides against the broker before trusting gain %.
- The page shows each holding's latest call with its age (a holding left out of today's paste keeps its call, marked
  "Nd old"), what changed since the previous snapshot with direction, the history of changes, and a **deep-dive
  prompt** for ticked stocks (default: calls that just moved, plus REVIEW / SELL).
- **Drop folder.** `db/research/inbox/` (created on first ask; gitignored with `db/`). The daily prompt gives
  Antigravity the absolute path and asks it to save only the table there as `research-YYYY-MM-DD.md`. The tab lists
  waiting files (`.md .txt .csv .tsv`, ≤1 MB, plain names only — no paths, nothing else is read), **Read it** loads
  one into the same preview a paste gets, and only **Save** stores it; the file then moves to `inbox/done/`. A file
  is only ever read as text and parsed; nothing in it is executed, and nothing is saved without the preview.
  Routes: `GET /api/analyst/strategy/inbox`, `…/inbox/file?name=`, `POST …/inbox/done?name=`.
- **Auto-import (`researchAuto.js`, off by default).** A checkbox on the tab (stored in `db/research/settings.json`
  with remembered name matches) makes the server check the inbox every 30 s, so a run that repeats (hourly) needs no
  clicks and works with the tab closed. A file is imported only if **every** row matches a holding clearly and every row
  has a readable call; anything else stays in the inbox with the banner showing it — an unattended run must never
  file a call under the wrong company. Files still being written (touched <8 s ago) are skipped. The daily prompt
  asks for `research-YYYY-MM-DD-HHMM.md`; several files in one day import oldest first and the same-day replace rule
  means the newest stands. Intraday changes of mind are therefore not kept — only the day's last call is.
- **Scheduled runs (`scheduledPrompt`, `holdings.md`).** A repeating prompt cannot carry today's date, prices or
  "my last call" — they would be stale by the next run. So the server keeps `db/research/holdings.md` current
  (`writeHoldingsFile`, every 2 min, rewritten only when the content changes) and the **Copy scheduled prompt**
  button copies a prompt with no dates or figures: it names that file, tells the agent to read the date and time in
  India itself, and to change a call only when something new has happened since "My last call" (so hourly runs do
  not flap). It runs in NSE market hours only (9:15–15:30 IST), so the last run of the day is the day's stored
  call. `GET /api/analyst/strategy/holdings-file` writes it on demand and returns the path.
- Restart `npm run server` after pulling this (`server.js`, `strategy.js`, `researchAuto.js`).

### Testing it without touching real data

`npm test` covers the engine, the ledger and the relay's parsing. For the page,
the sandbox in §1 works as usual; Yahoo and the model can both be stubbed,
since only `server.js` talks to them. Without LM Studio running the page still
works — the brief panel says how to start one.

---

## 9. Restart checklist

Changes that need a restart, and which silently appear to do nothing otherwise:

| Changed | Restart |
| --- | --- |
| `server.js`, `strategy.js`, `researchAuto.js`, `dbGuard.js`, `sqliteReads.js`, `analystLLM.js`, `news.js`, `newsArchive.js`, `claudeNews.js`, `lanAccess.js`, `jsonServerLocal.mjs` | `npm run server` |
| `postcss.config.js`, `tailwind.config.js` | `npm run dev` |
| `vite.config.js` | `npm run dev` |
| A new icon imported from `lucide-react` | `npm run dev` — Vite's pre-bundled dep chunk does not pick it up, which surfaces as `X is not defined` at runtime while `npm run build` passes |

React/CSS source changes hot-reload normally.

---

## 10. Verifying your work

- `npm run build` must pass.
- `npm test` must pass. It runs Node's own test runner over `*.test.js`, so a
  util under test must import its neighbours with the `.js` extension — Vite
  resolves either form, Node only that one.
- For UI changes, actually open the page. Several bugs here were invisible in
  the code and obvious on screen.
- For data changes, check record counts before and after — never assume.
- After any write path change, confirm the guard still blocks a bad write and
  still allows a legitimate one.

## 11. Known gaps

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

---

## 12. The iPhone app (`ios/`) and the Wi-Fi gateway

### The API answers this Mac and nothing else

Until this was found, `server.js` (3000) and json-server (3001) listened on
**every interface** and had no login. Anyone on the same Wi-Fi could read all of
`expenses` (2 MB), `GET /users` (usernames **and plain-text passwords**), and
write through 3001 directly. Do not undo any of these:

- `server.js` answers `403` to any request whose `socket.remoteAddress` is not
  loopback (`isLoopback` in `lanAccess.js`; the Electron shell and Vite both
  reach it over 127.0.0.1, so nothing local changes).
- json-server starts through `jsonServerLocal.mjs`. beta.3 calls
  `app.listen(port, cb)` with no host, so **`--host` does nothing**; the
  launcher patches `listen` to bind `127.0.0.1` without touching `node_modules`.
- Another device gets in only through the **gateway** (`lanAccess.js`, port
  5181, `LAN_PORT`), which is **off until switched on** in Profile → iPhone
  connection.

### How a phone is let in

1. Mac shows a six-digit code (5 min, single use, dead after 5 wrong guesses).
2. `POST /pair {code}` returns a 32-byte token. Only its **sha256** is kept, in
   `.kubera-lan.json` beside the database (gitignored, mode 600) — reading that
   file does not let anyone in.
3. Every later request carries the token: a cookie for the web view, a bearer
   header for the app. `/ping` is the only unauthenticated route and leaks
   nothing.
4. The gateway serves the built UI and forwards `/_api/*` and `/api/*` to
   `server.js` over loopback with `x-kubera-lan: 1`, so **the write guard,
   backups and version checks apply to phone writes exactly as to the Mac's**.
5. `/api/lan/*` (mint codes, unpair, switch on/off) is **Mac-only**: the gateway
   refuses it and `server.js` refuses anything carrying `x-kubera-lan`. A paired
   phone must not be able to pair another device.

The page learns it is behind the gateway from `window.__KUBERA_API__ = "/_api"`
(injected into `index.html`), which `utils/apiUrl.js` prefers — same origin, so
the cookie rides along and no CORS is needed. Bonjour (`_kubera._tcp`) is
advertised with macOS's own `dns-sd`, so the phone finds the Mac without an IP.

Plain HTTP on the home network: there is no certificate for a `.local` name,
which is why pairing exists. The iOS app allows it with
`NSAllowsLocalNetworking`, not a blanket ATS exception.

### The native app

SwiftUI, iOS 17+, `ios/Kubera.xcodeproj` (a hand-written file-system-synchronised
project: **new files in `ios/Kubera/` are picked up automatically**).

| Folder | What it is |
| --- | --- |
| `Kubera/Core/` | Pure Foundation logic. No UI, so it is testable from the command line. `JSONValue` reads the database as loosely as JavaScript does (`Number("")` is 0, `"1,200"` is NaN). |
| `Kubera/Design/` | **The only place cards, figures and rows are styled** (`KCard`, `KStat`, `KRow`, `KList`, `KScreen`…). Build every screen from these; do not style a card inline. Multi-child content must sit inside the card's own `VStack`, or each child gets its own background. |
| `Kubera/Data/` | `API` (bearer-token requests through the gateway), `FinanceStore`, and `LocalMirror` (the phone's own copy, see "Offline" below). |
| `Kubera/Features/` | Screens. `Pages.swift` lists every page of the Mac app. |

**A page is either native or a web fallback.** Native pages move to their tab;
every other page in `Pages.groups` opens the Mac's own screen in a web view
(`html.native-ios` hides the web header and tab bar there). So the phone has all
features while native coverage grows. To port a page: add its logic to `Core/`,
write the parity test, build the screen, then set `native:` on its `AppPage`.

### Ported logic must match the web, and a test proves it

`Core/TransactionKind.swift`, `Expenses.swift` and `Stocks.swift` are ports of
`utils/transactionKind.js`, the Expenses page grouping, `calculateSalaryStats`
and `utils/investmentSync.js`. A port that is "close" is a wrong number on a
financial screen, so:

```bash
ios/Tests/run-parity.sh          # runs the WEB code on a copy of db.json, then checks Swift against it
cd ios && swift test             # the always-on unit tests (made-up data only)
ios/Tests/sandbox.sh start       # isolated server + iPhone gateway on a COPY of the data, prints a pairing code (stop: sandbox.sh stop)
node ios/Tests/generate-benchmark.mjs   # regenerate Core/BenchmarkData.swift if nifty50Data.js changes
```

`make-golden.mjs` cuts the Expenses grouping and the salary maths **out of the
source files at run time** rather than copying them, so the expected numbers
always come from the code actually in the app. It compares every month of every
year (spent, invested, income, category counts) and every stock holding. The
golden file is your finances: it is written to `/tmp`, never to the repo. If you
change a rule in the JS, this fails until the Swift matches.

To open one screen without tapping to it, launch the simulator app with `-screen <NativeScreen case>`:
`xcrun simctl launch <udid> com.kubera.finance.phone -screen budgets`.

### Building and running

```bash
xcodebuild -project ios/Kubera.xcodeproj -scheme Kubera \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Build **with** the default "Sign to Run Locally". `CODE_SIGNING_ALLOWED=NO`
produces an unsigned app whose Keychain writes fail, so the pairing is lost on
relaunch — the app now refuses to report a pairing it could not store. To test
against a sandbox, run it on `LAN_PORT=4002` (see §1) and pair with a code from
`POST 127.0.0.1:4000/api/lan/pair`. Running on a real iPhone needs the project's
signing team set in Xcode (not done: it needs an Apple ID chosen by the owner).

### Native so far, and the order the rest follows

Pages are rebuilt in the order of the More list (`Features/Pages.swift`), except that a module several
pages share is ported once, first: Capital Gains came before the Stock Analyst because the
analyst runs a sale through the same ledger (`simulateSale`), and XIRR, dividends and watchlist
risk each serve a page of their own as well as the analyst. To add a screen: `NativeScreen` case,
`NativeDestination`, and `native:` on its `AppPage`.


| Page | Native | Parity-tested |
| --- | --- | --- |
| Dashboard & net worth | yes | net worth, growth index, health, value and cost of all 33 accounts |
| Savings | yes (accounts open the Mac page) | active accounts in order, totals, gratuity |
| Investments (all accounts) | yes | accounts, totals, allocation slices in order |
| Stocks | yes | every holding's value and cost |
| Expenses (year, month, transactions) | yes | every month: spent, invested, income (one rule everywhere — `utils/monthIncome.js`: every income-type row, i.e. Income main category or a known income category, plus the payslip only when no row is a salary; the Mac's month page, the Mac's Expenses list and the app all use it, so a refund filed under Income reads the same on every screen); the month page's Categories and Income tabs (`MonthCategories`, a port of `monthDetails` in ExpenseDetails.jsx) for all 120 months |
| Loans & Lents (people, loans, EMI calculator) | yes | peer totals, per-debt balance, every loan's paid / pending / progress / due this month |
| Capital Gains (tax by year, losses carried, open lots, every sale, fund sales) | yes | all 136 disposals, every ledger figure for 6 years, 127 open lots, fund classes |
| Watchlist (sorting, filters, ranges, alerts) | yes | 25 entries, all three sort orders, risk/priority/sector/cap, alert counts |
| IPO Applications | yes | every application and the summary |
| Returns (XIRR) | yes | all 71 holdings in rank order, the portfolio rate, all four sort orders (XIRR within the solver's own tolerance) |
| Dividend Income (tax withheld, yield, consistency, by year and month, calendar) | yes | 30 payers, 96 company-by-year tax rows, the calendar, every income figure |
| Free Holdings (cost recovery) | yes | 37 ranked positions, free / nearly free / cashless, totals |
| Nifty 50 & fund overlap | yes | 105 companies, 12 sectors, ₹3,23,171.14 looked through; all 10 basis × fund views and 5 filter/sort combinations compared |
| Stock Analyst (findings, tax simulation, fundamentals and Nifty comparison loaded from the Mac) | yes | every finding's id, order, wording and figures, with and without fundamentals/index history (the network inputs are made up identically on both sides) |
| Salary (year totals, month by month, annual package vs received, gratuity, every year's package) | yes | all 10 years: every month's gross/deductions/net and each field, yearly totals, comparison, annual packages, gratuity |
| Taxes (ITR returns, Form 16 A and B, refunds awaited, old-vs-new regime calculator) | yes | the calculator's prefill for all 9 years plus 5 hand-picked cases (HRA, both slab sets, rebate edge), return order and totals |
| Financial Goals | yes | all 5 goals: saved from each linked account, progress, status, totals |
| Insurance Gap Analysis | yes | every tab with and without archived, two profiles: cover per kind, gaps, vehicles, expiry |
| Cashflow Forecast (and recurring-charge detection) | yes | all 79 detected series with cadence/typical/next date/overrides; every forecast event, cycle and total at 30/60/90 days |
| Net Worth Over Time | yes | all 113 months by component, debt, yearly additions, steps to check |
| Spending Analysis | yes | all 114 months, normal month/income/savings rate, every mover for two months, trends, outliers and concentration at 6/12/24 months |
| Money Flow | yes | three periods: breakdown by kind, unreviewed categories, every category's classification, average real month |
| Cards, Card Intelligence | yes | 6 cards, 178 card-months: utilisation, interest, revolving, idle, statement dates; list page's due, wallet and points |
| Budget Limits | yes | every month of the last two years: spend per main and sub category, over/near/within counts, health |
| Recurring & Subscriptions | yes | 79 detected series, overrides (cancelled/ignored/watching), still-charging |
| Fuel Analytics | yes | six filter sets: spend, litres, distance, mileage and every fill-up's figures |
| Grocery Analytics, Grocery Builder (read-only) | yes | 522 line items, four filter sets with their option lists; every category's item list |
| All Transactions | yes | 8,165 rows newest first, ten filter sets, the regret tally |
| Data Health, Warranties, Assets, Precious Metals | yes | Data Health's 9 checks and Warranties' 20 items; Assets and Metals reuse verified valuations |
| Profile (this iPhone only) | yes | not a port: password, backups, Claude key and iPhone pairing deliberately stay on the Mac |
| Account detail (fund, deposits, PF, PPF, NPS, SGB, savings account, policy, emergency fund) | yes, read-only ledgers | every account's value equals the verified valuation; 496 ledger rows build without error |
| Person/debt, asset category, metal and card detail pages | yes, read-only | card history reuses the parity-tested card profile; the rest read stored rows and verified valuations |
| Ornament Gallery | yes | photos are fetched from the Mac with the pairing token (`API.data`), cached in memory; files missing on the Mac are left out and counted |
| DocuSetu | web fallback | a 1,800-line checklist dataset with progress saved on the Mac; not rebuilt |
| everything after that in the More list | web fallback | |

A page is not "done" until its parity test passes against the web code on the
real database. Fixed-deposit interest depends on today's date, so the golden
script freezes `Date` and hands the same instant to the Swift side.

Known difference: gold and silver without a stored value are valued at the
manual rate in `appData.manualMetalRates`. Without one the web app uses a live
feed this phone does not fetch (it falls back to ₹7,600 / ₹95 per gram, as the
web does when the feed fails), so a database with no manual rate could differ.

### Writing from the phone

Three writes exist, all one row at a time: **Expenses → + → Add transaction**, and, from
**All Transactions**, tapping a row to **edit** it (only the changed fields go, as
`PATCH /api/tx/<id>`) or **delete** it (confirmation names the row; `DELETE /api/tx/<id>`).
Rows tied to a holding (`investmentData`/`expenseId`, 55 today), without an id, or sharing an
id are locked and say why — change those on the Mac so the holding stays in step.

Adding: It sends ONE row to `POST /api/tx` (never
a whole collection, so a stale phone cannot overwrite what it never loaded) shaped like the
Mac form's own rows (`NewTransaction`, unit-tested). Nothing is saved until Save; a refusal
(503/404 means the Mac runs `server:json` without per-row writes, 409 is the write guard)
shows its reason and changes nothing. There is no fallback to a whole-collection save. Test it only against `ios/Tests/sandbox.sh`; open the sheet
directly with `-addTransaction`.

**Editing records** (`RecordEditing` in Core, `RecordEditorView`): a pencil on account,
person, card and asset-category pages, and long-press → Edit on goals, loans, tax years,
salary months, IPO applications and watchlist entries. The sheet loads the record fresh with
its version, offers only plain fields (text, number, switch, date), and sends only what changed
as `PATCH /<collection>/<id>` with `If-Match`. Locked, with the reason shown: ids, `type`, links
(`expenseId`, `linkedStockId`, `itemId`), timestamps, photos/documents, anything a page derives
(a fund's or stock account's `amount`, NAV, units, watchlist `sectorKey`…), `users` entirely, and
the ledgers of stock, fund, NPS and SGB accounts (units are replayed from them on the Mac). Other
nested lists (a lent's transactions, a loan's payments, a card's months, asset items) are edited
or deleted a row at a time by re-sending that list under the record's version; rows linked to an
expense are locked. A record changed on the Mac since the sheet opened is refused, reloaded, and
the user is told to make the change again. `updatedAt` is stamped when the record has one. Not
editable yet: `metals` and `appData` (object collections — budgets, manual rates, overrides), and
creating or deleting whole records.

**Stock transactions** (`StockLedger`, `StockHoldingView`): a holding's page has a + to add a
transaction (buy, sell, dividend, bonus, split, IPO, buyback) and tap / long-press to change or delete
one. The account is loaded fresh with its version at the moment of saving, the change is applied to
that copy, the holding's `shares`, `avgCost` and `dividends` are replayed from the whole history
(`Stocks.replay`, the port of `recomputeStockMetrics` — a test compares the stored result with the
web's), and `PATCH /savings/<id> { stocks }` is sent with the version. Locked: a holding with a merger
in its history, merger/demerger rows, and rows linked to an expense. A sale larger than what was held on
that date is refused. The page also shows the dividend amount per payment, a five-year dividend chart,
and the Mac's fundamentals read (`/api/stock-financials`): Buy / Hold / Trim / Exit signal, the five
health checks and quarterly revenue and earnings. Mutual-fund and other account ledgers are still read-only.

**Deposits** (`DepositLedger`, `FixedDepositViews`, `RecurringDepositView`, `DepositForms`): the Savings tab
(beside Expenses) opens each account. A fixed-deposit account shows totals, an Active/Archived switch, a
filter by bank, and a card per deposit that opens its own page (terms, accrual, progress, interest credited).
Deposits can be added, edited, renewed, closed (archived with a final interest figure), restored and deleted;
interest rows can be added, changed and deleted. A recurring-deposit account shows totals and a card per
deposit; each deposit page adds, changes and deletes instalments and interest credits, and the deposit
itself can be edited or deleted. Every save loads the account fresh with its version, changes one row of one
list, and PATCHes `/savings/<id>` under that version. The account `amount` is recomputed as the web does
(live fixed deposits at today's accrual; recurring deposits at maturity) and a parity test checks accrual,
maturity and the amount for all 22 fixed deposits against `fdAccrual.js`.

**Other accounts** (`AccountLedger`, `AccountLedgerViews`): mutual-fund and emergency-fund transactions, PPF and PF
entries, savings-account transactions, policy premiums / claims / benefits, gold-bond holdings and interest, and
NPS schemes and their transactions can be added, changed and deleted from the account page; the Savings tab's +
adds a whole account (`POST /savings`, one record). Each save loads the account fresh, changes one row (a row that
no longer matches what the phone read is refused) and PATCHes the list together with what the Mac's page
recomputes: fund `amount` (units × NAV), PPF running balances, PF EPF/EPS balances, NPS units / invested / share,
premiums paid. A test replays every PPF, PF, fund, NPS and savings account through these recomputes and checks
they reproduce the stored figures. Rows linked to an expense are locked. Not on the phone: refreshing a fund's
NAV, fund composition, policy document upload, the savings account's automatic daily-interest credit, PPF's
"add yearly interest" helper, and mutual-fund creation (Invest page).

**People and loans** (`LoanLedger`, `LoanSheets`, `LentDetailView`, `LoansView`): a person's page has a + (and a
long-press "Add transaction" on the People list) for a repayment or lending/borrowing more; each loan card has
**Record EMI payment**, pre-filled as the Mac's form is (today, the loan's EMI, the next instalment number, the lender
as the card). Rows can be changed or deleted. Each is one row, by id, of `lents[].transactions` or `loans[].payments`
(`AccountOp.list`), so it is rebuilt against the Mac's record when sent and works offline like every other change.

**Assets** (`Rental`, `PropertyUnits`, `AssetEditing`/`AssetOp`, `AssetViews`, `AssetForms`): a category lists its items (add,
edit, delete); an item opens to its page. Goods show the warranty status, service history (log, change, delete) and receipts
(photo or PDF uploaded to the Mac's `db/documents`, viewable on the phone; uploading needs the Mac, everything else works
offline). Property shows its tenancy, rent due vs received month by month with arrears (escalation by percent or fixed amount),
bills by month with what the tenant repaid, deposit held, net return and yield; a property split into units shows the rent roll,
occupancy and arrears and each unit (add, edit, delete, "self-occupied"), and entries belong to a unit or the building and can
move between them. Rent, bill and cost entries ask who pays (you / tenant repays / tenant paid) as the Mac does. `Rental` and
`PropertyUnits` are ports of `utils/rental.js` and `utils/propertyUnits.js`; the golden test runs real items plus hand-made ones
(odd period spellings, part-recovered bills, every unit status, both escalation types) through the web code and compares
every ledger row. Entries stay on the asset and do not count in monthly income or spending. Not on the phone: the item photo
(`imageUrl`) and the ornament gallery's uploads.

**News** (`StockNewsView`, from a holding's page): the Mac's stored stories for that stock, its
Claude brief when Claude reading is on, and buttons that ask the Mac to fetch fresh headlines
(`fresh=1`) or analyse five unread stories. Nothing is kept on the phone.

### Offline (`LocalMirror`, `OfflineOp`, `SyncViews`)

The app opens and works with the Mac out of reach, and syncs when it is back.

- **Reads.** Every successful GET is stored on the phone (`Application Support/KuberaMirror/<hash of token>/`,
  complete file protection, excluded from backups; other pairings' folders and the whole folder on disconnect
  are deleted; `users` is never requested so passwords never reach the phone). `load()` first pings the
  gateway (`/ping`, 3 s). Unreachable → `LocalMirror.offline`, every read is served from the stored copy and a
  banner says how old it is. Photos are kept as thumbnails.
- **Writes.** `FinanceStore.perform` (records), `performTx` (transactions) and `createAccount` try the Mac
  first; when it cannot be reached they apply the change to the phone's copy (`LocalApply`) so the screens
  show it, and queue the **intent** (`AccountOp` / `OfflineOp`, stored as plain JSON in `pending.json`) — not the
  final patch. On sync each is **rebuilt against the Mac's record as it is then** with the same pure functions
  (`DepositLedger`, `AccountLedger`, `StockLedger`), and sent under that record's version. A change to a row
  that moved, was edited or no longer exists is *held* with the reason (banner → Sync sheet → Try again /
  Discard) and the Mac's record is left untouched; everything else still goes. Result: a PPF row added on the
  phone and another added on the Mac meanwhile both end up in the record (tested on the sandbox).
- **Sync triggers:** app comes to the foreground, pull-to-refresh, "Sync now".
- **Limits.** The queue is applied oldest first; the `categories` totals of a month are not updated on the
  phone's copy (the Mac recomputes them); news fetch/analyse, Claude brief refresh and NAV need the Mac.
  Disconnecting the phone deletes its queue — sync first.
- `FinanceStore.errorMessage` for "nothing saved yet" appears only on a phone that has never reached the Mac.

An isolated instance (`DB_FILE` set) no longer syncs to iCloud: the first sandbox write test
replaced the real off-machine copy with sandbox data (restored from `db.json`, which was
untouched — checked by hash).

### Not done yet

- Writes to mutual-fund/NPS/SGB ledgers, demergers and mergers, `metals`, `appData` settings, and creating or deleting whole records.
- Savings and Investments account pages (a fund, a deposit, a policy) still
  open the Mac's page; so does everything below Investments in the More list.
- The web layout for phones has 8 known rough spots (a few fixed-width dropdowns
  and button rows on Salary, Grocery Builder, Profile and others); they only
  matter in the fallback pages and in Safari.
