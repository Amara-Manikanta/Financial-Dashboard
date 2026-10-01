/**
 * Copies to an external drive, kept deliberately simple and deliberately safe.
 *
 * `backups/` beside the database survives an app bug but not a dead disk, and
 * the iCloud copy survives a dead disk but is a sync — a corruption propagates
 * to it within seconds. An external drive is the tier neither covers: offline,
 * off-machine, and only written when asked.
 *
 * What goes: db.json, and db/images and db/documents. The database already has
 * two other copies; the photos, bills and policy scans have none, and they are
 * the only files here that cannot be reconstructed from anything else.
 *
 * Deleting is restricted to directories this module itself created, matched by
 * its own name pattern, inside its own folder. Nothing else on the drive is
 * ever touched — it is someone's drive, not ours.
 */
import fs from 'fs';
import path from 'path';

/** Overridable so a test run never points at the real drive. */
const ROOT = process.env.EXTERNAL_BACKUP_DIR || '/Volumes/AMKD/KuberaBackups';

/** A new copy is only taken once the last one is this old. */
export const MIN_AGE_DAYS = 30;

/** How many to keep: the previous month's and this one's. */
const KEEP = 2;

const PREFIX = 'kubera-';
const STAMP = /^kubera-\d{4}-\d{2}-\d{2}-\d{6}$/;

const volumeOf = (dir) => {
    const parts = dir.split(path.sep).filter(Boolean);
    return parts[0] === 'Volumes' && parts[1] ? `/${parts[0]}/${parts[1]}` : null;
};

/** Mounted, not merely a path that could exist. An unmounted /Volumes/X is absent. */
export const driveReady = () => {
    const vol = volumeOf(ROOT);
    return vol ? fs.existsSync(vol) : fs.existsSync(path.dirname(ROOT));
};

/** Copies that died before the rename. Ours by name, never a real backup. */
const unfinished = () => {
    if (!fs.existsSync(ROOT)) return [];
    return fs.readdirSync(ROOT).filter((n) => n.startsWith(PREFIX) && n.endsWith('.partial'));
};

const existing = () => {
    if (!fs.existsSync(ROOT)) return [];
    return fs.readdirSync(ROOT)
        .filter((n) => STAMP.test(n) && fs.statSync(path.join(ROOT, n)).isDirectory())
        .sort();
};

const dirSize = (dir) => {
    let total = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
    }
    return total;
};

const ageDays = (name) => {
    const [, y, m, d] = name.match(/^kubera-(\d{4})-(\d{2})-(\d{2})-/) || [];
    if (!y) return null;
    return Math.floor((Date.now() - new Date(`${y}-${m}-${d}`).getTime()) / 86400000);
};

/** What the UI shows before anyone presses anything. */
export const backupStatus = () => {
    const ready = driveReady();
    if (!ready) return { ready: false, root: ROOT, backups: [] };
    const names = existing();
    const last = names[names.length - 1] || null;
    return {
        ready: true,
        root: ROOT,
        backups: names.map((n) => ({ name: n, ageDays: ageDays(n) })),
        last,
        lastAgeDays: last ? ageDays(last) : null,
        due: !last || (ageDays(last) ?? 999) >= MIN_AGE_DAYS,
        minAgeDays: MIN_AGE_DAYS,
        unfinished: unfinished().length,
    };
};

const stamp = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${PREFIX}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-`
        + `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/**
 * Take a copy.
 *
 * Written to a `.partial` directory and renamed only once every file has
 * landed, so a drive pulled mid-copy leaves something obviously unfinished
 * rather than a backup that looks complete and is not.
 */
export const runExternalBackup = ({ dbFile, force = false } = {}) => {
    if (!driveReady()) {
        return { ok: false, reason: `The backup drive is not mounted (${volumeOf(ROOT) || ROOT}).` };
    }

    const names = existing();
    const last = names[names.length - 1] || null;
    const age = last ? ageDays(last) : null;
    if (last && !force && age !== null && age < MIN_AGE_DAYS) {
        return {
            ok: false, skipped: true, last, ageDays: age,
            reason: `The last backup is ${age} day${age === 1 ? '' : 's'} old. A new one is taken after ${MIN_AGE_DAYS}.`,
        };
    }

    fs.mkdirSync(ROOT, { recursive: true });

    // Clear anything a previous attempt left behind. A copy interrupted by the
    // drive being unplugged never reaches the rename, so its .partial sits
    // there taking up space and is never pruned — the retention sweep only
    // looks at finished copies. Only our own prefix, only inside our folder.
    const sweptPartials = unfinished();
    for (const stale of sweptPartials) {
        fs.rmSync(path.join(ROOT, stale), { recursive: true, force: true });
    }

    // The stamp resolves to the second, so two runs inside one second would
    // collide and rename onto a directory that already has files in it. Step
    // forward until the name is free rather than widening the pattern, which
    // the listing and pruning both match on.
    let when = new Date();
    let name = stamp(when);
    for (let i = 0; i < 60 && fs.existsSync(path.join(ROOT, name)); i += 1) {
        when = new Date(when.getTime() + 1000);
        name = stamp(when);
    }
    const partial = path.join(ROOT, `${name}.partial`);
    const final = path.join(ROOT, name);
    fs.rmSync(partial, { recursive: true, force: true });
    fs.mkdirSync(partial, { recursive: true });

    const copied = [];
    fs.copyFileSync(dbFile, path.join(partial, 'db.json'));
    copied.push({ what: 'db.json', bytes: fs.statSync(dbFile).size });

    const mediaRoot = path.join(path.dirname(dbFile), 'db');
    for (const folder of ['images', 'documents']) {
        const from = path.join(mediaRoot, folder);
        if (!fs.existsSync(from)) continue;
        const to = path.join(partial, 'db', folder);
        fs.cpSync(from, to, { recursive: true });
        copied.push({
            what: `db/${folder}`,
            files: fs.readdirSync(from).length,
            bytes: dirSize(to),
        });
    }

    fs.renameSync(partial, final);

    // Prune only our own, and only after the new one is safely in place.
    const removed = [];
    const all = existing();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
        fs.rmSync(path.join(ROOT, old), { recursive: true, force: true });
        removed.push(old);
    }

    return {
        ok: true,
        name,
        path: final,
        copied,
        totalBytes: copied.reduce((s, c) => s + c.bytes, 0),
        kept: existing(),
        removed,
        sweptPartials,
        previousAgeDays: age,
    };
};
