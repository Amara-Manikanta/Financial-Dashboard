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

## 5. Restart checklist

Changes that need a restart, and which silently appear to do nothing otherwise:

| Changed | Restart |
| --- | --- |
| `server.js`, `dbGuard.js` | `npm run server` |
| `postcss.config.js`, `tailwind.config.js` | `npm run dev` |
| `vite.config.js` | `npm run dev` |

React/CSS source changes hot-reload normally.

---

## 6. Verifying your work

- `npm run build` must pass.
- For UI changes, actually open the page. Several bugs here were invisible in
  the code and obvious on screen.
- For data changes, check record counts before and after — never assume.
- After any write path change, confirm the guard still blocks a bad write and
  still allows a legitimate one.

## 7. Known gaps

- 19 of the original uploaded ornament photos were lost before any backup
  existed and are unrecoverable. Missing images render a labelled placeholder.
- Many older pages still use inline styles rather than Tailwind classes.
- Backups are frequency-based, so 100 rotating snapshots can cover only a few
  hours of heavy use. The daily and monthly tiers are the real safety net.
