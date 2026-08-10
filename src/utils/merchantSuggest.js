// Merchant suggestions built from your own history.
//
// Aimed at two measured problems: 503 transactions have no description at all
// (74 of them since July, so it is still accruing), and 1,218 sit in a vague
// category. Both are symptoms of entry being slower than the moment allows.
//
// A merchant you have used before already knows what it usually is — Zomato has
// been "food delivery" 88 times — so picking it can fill the category too, and
// the fastest path becomes the correctly-categorised one.

/**
 * Index every merchant name that has been used, with how often, how recently,
 * and the category it usually gets.
 */
export const buildMerchantIndex = (expenses) => {
    const index = new Map();

    Object.values(expenses || {}).forEach((months) => {
        if (!months || typeof months !== 'object') return;
        Object.values(months).forEach((node) => {
            (node?.transactions || []).forEach((t) => {
                const name = String(t?.title || '').trim();
                if (name.length < 2) return;

                const key = name.toLowerCase();
                if (!index.has(key)) {
                    index.set(key, {
                        name, count: 0, lastDate: '',
                        categories: new Map(), mains: new Map(), modes: new Map(),
                    });
                }
                const entry = index.get(key);
                entry.count += 1;

                const date = String(t.date || '').slice(0, 10);
                if (date > entry.lastDate) {
                    entry.lastDate = date;
                    entry.name = name;      // prefer the most recent spelling
                }

                const bump = (map, value) => {
                    if (!value) return;
                    map.set(value, (map.get(value) || 0) + 1);
                };
                bump(entry.categories, String(t.category || '').toLowerCase());
                bump(entry.mains, String(t.mainCategory || ''));
                bump(entry.modes, String(t.paymentMode || ''));
            });
        });
    });

    const pick = (map) => {
        let best = null; let bestN = 0;
        map.forEach((n, v) => { if (n > bestN) { bestN = n; best = v; } });
        return { value: best, count: bestN };
    };

    return [...index.values()].map((e) => {
        const cat = pick(e.categories);
        const main = pick(e.mains);
        const mode = pick(e.modes);
        return {
            name: e.name,
            count: e.count,
            lastDate: e.lastDate,
            category: cat.value || '',
            // How reliably this merchant maps to that category. A merchant used
            // 88 times as "food delivery" is worth auto-filling; one split
            // evenly across five categories is not.
            confidence: e.count ? cat.count / e.count : 0,
            mainCategory: main.value || '',
            paymentMode: mode.value || '',
        };
    });
};

/**
 * Best matches for what has been typed so far.
 *
 * Ranked on how well the text matches, then how often the merchant is used,
 * then how recently — so the everyday ones surface first without burying a
 * distinctive name you typed almost in full.
 */
export const suggestMerchants = (index, query, limit = 6) => {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];

    const scored = [];
    for (const entry of index) {
        const name = entry.name.toLowerCase();
        let score = 0;
        if (name === q) score = 100;
        else if (name.startsWith(q)) score = 60;
        else if (name.includes(q)) score = 30;
        else continue;

        // Frequency helps, but cannot outrank a better textual match.
        score += Math.min(20, Math.log2(entry.count + 1) * 4);
        if (entry.lastDate >= '2026-01-01') score += 4;
        scored.push({ ...entry, score });
    }

    return scored
        .sort((a, b) => b.score - a.score || b.count - a.count)
        .slice(0, limit);
};

// Below this, the merchant is too inconsistent for its category to be worth
// filling in automatically.
export const CONFIDENT_ENOUGH = 0.6;
