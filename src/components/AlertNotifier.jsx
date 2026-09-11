import { useEffect, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { collectAlerts } from '../utils/alerts';

/**
 * Raises the due-date alerts as real macOS notifications.
 *
 * Electron's renderer implements the ordinary web Notification API and macOS
 * shows the result natively, so nothing has to cross into the main process and
 * none of the date logic gets reimplemented there — `collectAlerts` stays the
 * only place that decides what is due.
 *
 * In a plain browser this simply does nothing useful: notifications are either
 * unsupported or blocked, and the app is unaffected either way.
 */

const SEEN_KEY = 'alertNotifications.seen';
const ENABLED_KEY = 'alertNotifications.enabled';
/** Re-check while the app is left open, for the day rolling over. */
const RECHECK_MS = 6 * 60 * 60 * 1000;
/** Forget an alert id long after the thing it referred to has passed. */
const FORGET_AFTER_DAYS = 120;
/** More than this at once is a digest, not a series of interruptions. */
const MAX_INDIVIDUAL = 2;

const readSeen = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        // A private window, cleared site data, or storage that throws on read.
        // Losing the record only means an alert could be repeated once.
        return {};
    }
};

const writeSeen = (seen) => {
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
        // Nothing to do: the notification has already been shown.
    }
};

const prune = (seen, now) => {
    const cutoff = now - FORGET_AFTER_DAYS * 86400000;
    const kept = {};
    Object.entries(seen).forEach(([id, at]) => {
        if (Number(at) > cutoff) kept[id] = at;
    });
    return kept;
};

const notificationsAllowed = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return localStorage.getItem(ENABLED_KEY) !== 'off';
};

const show = (title, body) => {
    const n = new Notification(title, { body, silent: false });
    // Clicking a notification should bring the app forward, which is the whole
    // reason for showing one.
    n.onclick = () => { try { window.focus(); } catch { /* not focusable */ } };
};

const AlertNotifier = () => {
    const { savings, assets, expenses, categoryKinds, loadError } = useFinance();
    // Guards against re-firing when React re-renders on unrelated state.
    const running = useRef(false);

    useEffect(() => {
        if (!notificationsAllowed()) return undefined;
        // Never alert off a failed or half-finished load: an empty savings list
        // would read as "nothing is due" when the truth is "nothing loaded".
        if (loadError) return undefined;
        if (!Array.isArray(savings) || savings.length === 0) return undefined;

        let cancelled = false;

        const run = async () => {
            if (running.current || cancelled) return;
            running.current = true;
            try {
                if (Notification.permission === 'default') {
                    await Notification.requestPermission();
                }
                if (Notification.permission !== 'granted') return;

                const alerts = collectAlerts({ savings, assets, expenses, categoryKinds });
                if (!alerts.length) return;

                const now = Date.now();
                const seen = prune(readSeen(), now);
                const fresh = alerts.filter((a) => !seen[a.id]);
                if (!fresh.length) return;

                if (fresh.length <= MAX_INDIVIDUAL) {
                    fresh.forEach((a) => show(a.title, a.body));
                } else {
                    // One summary rather than five banners in a row.
                    const overdue = fresh.filter((a) => a.severity === 'overdue').length;
                    show(
                        `${fresh.length} things need attention`,
                        [
                            overdue ? `${overdue} overdue.` : null,
                            fresh.slice(0, 3).map((a) => a.body).join('\n'),
                            fresh.length > 3 ? `…and ${fresh.length - 3} more.` : null,
                        ].filter(Boolean).join('\n')
                    );
                }

                fresh.forEach((a) => { seen[a.id] = now; });
                writeSeen(seen);
            } finally {
                running.current = false;
            }
        };

        run();
        const timer = setInterval(run, RECHECK_MS);
        return () => { cancelled = true; clearInterval(timer); };
    }, [savings, assets, expenses, categoryKinds, loadError]);

    return null;
};

export default AlertNotifier;
