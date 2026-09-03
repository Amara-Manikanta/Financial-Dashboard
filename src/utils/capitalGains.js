/**
 * Capital gains, matched lot by lot.
 *
 * The portfolio pages carry an average cost per holding, which is the right
 * number for "am I up on this" and the wrong one for tax. Indian law matches
 * disposals **first in, first out**, and the holding period of the specific
 * lot sold decides whether the gain is short or long term. Average cost cannot
 * express that: it collapses a 2021 lot and a 2026 lot into one price and
 * loses the dates entirely.
 *
 * What this does model
 * --------------------
 *   FIFO lot matching across buy / IPO / bonus / demerger acquisitions
 *   Splits, by restating every open lot rather than creating a new one
 *   The 12-month line between short and long term, per lot
 *   The rate change of 23 July 2024 (STCG 15% -> 20%, LTCG 10% -> 12.5%)
 *   The s.112A exemption, and loss set-off and carry-forward over 8 years
 *   Buybacks on or after 1 Oct 2024, which are no longer a capital gain at all
 *
 * What it does NOT model, and why the number is an estimate
 * ---------------------------------------------------------
 *   Demerger cost apportionment. Splitting the parent's cost between the two
 *   companies needs a ratio the company publishes and this database does not
 *   hold, so the recorded price is taken at face value.
 *
 *   Surcharge and cess. Both depend on total income, which lives outside the
 *   portfolio.
 *
 *   Set-off against income from anywhere else.
 *
 * Grandfathering under s.112A — stepping cost up to the 31 January 2018 fair
 * market value — is not implemented because it cannot apply here: the earliest
 * transaction in this database is January 2021. If a pre-2018 holding is ever
 * entered, this file needs revisiting.
 *
 * This is a working estimate from your own records, not a tax return.
 */

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/** The day the rates and the exemption changed. */
const RATE_CHANGE = '2024-07-23';
/** From this date a buyback is taxed as dividend income, not as a capital gain. */
const BUYBACK_AS_DIVIDEND = '2024-10-01';

export const LONG_TERM_MONTHS = 12;

/** Indian financial year, April to March, as `2026-27`. */
export const fyFor = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const startYear = d.getMonth() >= 3 ? y : y - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

/** The FY a date falls in, as a sortable number, for ordering. */
const fyOrder = (fy) => Number(String(fy).slice(0, 4));

/**
 * Long term when more than twelve months separate purchase and sale.
 *
 * Anniversary arithmetic, not 365 days: a lot bought on 29 February and sold
 * the next 28 February has not completed twelve months, and a day-count would
 * say it had.
 */
export const isLongTerm = (boughtOn, soldOn) => {
    const b = new Date(boughtOn);
    const s = new Date(soldOn);
    if (Number.isNaN(b.getTime()) || Number.isNaN(s.getTime())) return false;
    const anniversary = new Date(b);
    anniversary.setFullYear(b.getFullYear() + 1);
    return s > anniversary;
};

const rates = (saleDate) => (String(saleDate) >= RATE_CHANGE
    ? { short: 0.20, long: 0.125 }
    : { short: 0.15, long: 0.10 });

/** The s.112A exemption for a financial year. Raised alongside the rates. */
export const exemptionFor = (fy) => (fyOrder(fy) >= 2024 ? 125000 : 100000);

const ACQUISITIONS = ['buy', 'ipo', 'bonus', 'demerger'];
const DISPOSALS = ['sell', 'buyback'];

/** Units on a transaction, however the row spells it. */
const qtyOf = (tx) => num(tx.quantity ?? tx.shares ?? tx.units);

/** Cost or proceeds per unit. */
const priceOf = (tx) => {
    const q = qtyOf(tx);
    if (num(tx.amount) && q) return num(tx.amount) / q;
    return num(tx.price ?? tx.nav);
};

/**
 * Walk one holding's transactions in date order and match every disposal
 * against the oldest open lots.
 *
 * Returns the disposals with their gains, the lots still open, and anything
 * the walk could not account for — a sale of more shares than were ever bought
 * is reported rather than silently clamped, because it means the transaction
 * history is incomplete and every figure downstream of it is suspect.
 */
export const matchLots = (transactions = [], { name = '', id = null } = {}) => {
    const ordered = [...(transactions || [])]
        .filter((t) => t && t.date)
        .sort((a, b) => {
            const d = String(a.date).localeCompare(String(b.date));
            if (d !== 0) return d;
            // On the same day an acquisition must land before a disposal, or an
            // IPO allotment sold on listing day has nothing to match against.
            const rank = (t) => (ACQUISITIONS.includes(t.type) ? 0 : 1);
            return rank(a) - rank(b);
        });

    const lots = [];
    const disposals = [];
    const unmatched = [];

    ordered.forEach((tx) => {
        const type = String(tx.type || '').toLowerCase();

        if (type === 'split') {
            const from = num(tx.splitFrom) || 1;
            const to = num(tx.splitTo) || 1;
            if (from > 0 && to > 0 && from !== to) {
                const factor = to / from;
                lots.forEach((lot) => {
                    lot.quantity *= factor;
                    lot.costPerShare /= factor;
                });
            }
            return;
        }

        if (ACQUISITIONS.includes(type)) {
            const q = qtyOf(tx);
            if (q <= 0) return;
            lots.push({
                date: tx.date,
                quantity: q,
                // A bonus share costs nothing, and its holding period starts on
                // allotment rather than inheriting the parent lot's date.
                costPerShare: type === 'bonus' ? 0 : priceOf(tx),
                source: type,
                txId: tx.id,
            });
            return;
        }

        if (!DISPOSALS.includes(type)) return;

        let remaining = qtyOf(tx);
        if (remaining <= 0) return;
        const proceedsPerShare = priceOf(tx);
        // A buyback after 1 Oct 2024 is not a sale for tax: the whole amount is
        // dividend income, and the cost of the tendered shares becomes a capital
        // loss. The shares still leave the FIFO queue either way.
        const asDividend = type === 'buyback' && String(tx.date) >= BUYBACK_AS_DIVIDEND;

        while (remaining > 0.0000001 && lots.length > 0) {
            const lot = lots[0];
            const take = Math.min(remaining, lot.quantity);
            const cost = take * lot.costPerShare;
            const proceeds = asDividend ? 0 : take * proceedsPerShare;
            const long = isLongTerm(lot.date, tx.date);

            disposals.push({
                holding: name,
                holdingId: id,
                txId: tx.id,
                type,
                acquiredOn: lot.date,
                acquiredAs: lot.source,
                soldOn: tx.date,
                quantity: money(take),
                costPerShare: money(lot.costPerShare),
                salePerShare: money(asDividend ? 0 : proceedsPerShare),
                cost: money(cost),
                proceeds: money(proceeds),
                gain: money(proceeds - cost),
                term: long ? 'long' : 'short',
                fy: fyFor(tx.date),
                /** Buyback proceeds taxed as dividend rather than as a gain. */
                dividendIncome: asDividend ? money(take * proceedsPerShare) : 0,
                treatedAsDividend: asDividend,
            });

            lot.quantity -= take;
            remaining -= take;
            if (lot.quantity <= 0.0000001) lots.shift();
        }

        if (remaining > 0.0000001) {
            unmatched.push({
                holding: name,
                holdingId: id,
                txId: tx.id,
                soldOn: tx.date,
                quantity: money(remaining),
                reason: 'sold more units than the recorded purchases account for',
            });
        }
    });

    return {
        disposals,
        openLots: lots.map((l) => ({ ...l, quantity: money(l.quantity), costPerShare: money(l.costPerShare) })),
        unmatched,
    };
};

/** Every stock in the account, matched. Archived holdings included — the sale happened. */
export const disposalsForStocks = (stocks = []) => {
    const disposals = [];
    const unmatched = [];
    (stocks || []).forEach((s) => {
        if (!s) return;
        const r = matchLots(s.transactions, { name: s.name || s.ticker || 'Unnamed', id: s.id });
        disposals.push(...r.disposals);
        unmatched.push(...r.unmatched);
    });
    disposals.sort((a, b) => String(b.soldOn).localeCompare(String(a.soldOn)));
    return { disposals, unmatched };
};

/**
 * Roll disposals up into a financial year, then apply set-off in the order the
 * Act requires.
 *
 * A short-term loss may be set against either kind of gain; a long-term loss
 * only against a long-term gain. That asymmetry is why the two are tracked
 * separately rather than netted into one number.
 */
export const summariseYear = (disposals = [], fy) => {
    const rows = disposals.filter((d) => d.fy === fy && !d.treatedAsDividend);
    const dividendRows = disposals.filter((d) => d.fy === fy && d.treatedAsDividend);

    const shortGross = rows.filter((d) => d.term === 'short').reduce((s, d) => s + d.gain, 0);
    const longGross = rows.filter((d) => d.term === 'long').reduce((s, d) => s + d.gain, 0);

    // A buyback's cost is a capital loss of the lot's own term.
    const shortBuybackLoss = dividendRows.filter((d) => d.term === 'short').reduce((s, d) => s - d.cost, 0);
    const longBuybackLoss = dividendRows.filter((d) => d.term === 'long').reduce((s, d) => s - d.cost, 0);

    return {
        fy,
        short: money(shortGross + shortBuybackLoss),
        long: money(longGross + longBuybackLoss),
        buybackDividend: money(dividendRows.reduce((s, d) => s + d.dividendIncome, 0)),
        disposalCount: rows.length + dividendRows.length,
        proceeds: money(rows.reduce((s, d) => s + d.proceeds, 0)),
        cost: money(rows.reduce((s, d) => s + d.cost, 0)),
    };
};

/** Every FY that has at least one disposal, oldest first. */
export const yearsWithDisposals = (disposals = []) =>
    [...new Set(disposals.map((d) => d.fy).filter(Boolean))].sort();

const CARRY_FORWARD_YEARS = 8;

/**
 * The full ledger, year by year, carrying losses forward.
 *
 * Losses expire after eight assessment years. Tracking them by the year they
 * arose rather than as one pooled number is the only way to know which part of
 * a carried-forward loss is about to lapse — and a loss about to lapse is the
 * one piece of this whole calculation that is actionable.
 */
export const gainsLedger = (disposals = []) => {
    const years = yearsWithDisposals(disposals);
    if (years.length === 0) return { years: [], carried: { short: [], long: [] }, totals: null };

    // Fill the gaps: a year with no disposals still ages the carried losses.
    const first = fyOrder(years[0]);
    const last = fyOrder(years[years.length - 1]);
    const span = [];
    for (let y = first; y <= last; y += 1) span.push(`${y}-${String((y + 1) % 100).padStart(2, '0')}`);

    let carriedShort = [];   // [{ fy, amount }]
    let carriedLong = [];

    const rows = span.map((fy) => {
        const s = summariseYear(disposals, fy);
        const openingShort = carriedShort.reduce((a, c) => a + c.amount, 0);
        const openingLong = carriedLong.reduce((a, c) => a + c.amount, 0);

        let netShort = s.short;
        let netLong = s.long;

        // This year's own losses do not go into the carry pool until the year's
        // gains have absorbed what they can.
        const currentShortLoss = netShort < 0 ? -netShort : 0;
        const currentLongLoss = netLong < 0 ? -netLong : 0;
        if (netShort < 0) netShort = 0;
        if (netLong < 0) netLong = 0;

        // Brought-forward short-term loss: against short-term gain first,
        // then against long-term. It is the more flexible of the two, so
        // spending it on the head that only it can reach would waste it —
        // but there is no such head, so order by what arises first.
        const consume = (pool, amount) => {
            let left = amount;
            const next = [];
            pool.forEach((entry) => {
                if (left <= 0) { next.push(entry); return; }
                const used = Math.min(entry.amount, left);
                left -= used;
                const rest = entry.amount - used;
                if (rest > 0.005) next.push({ ...entry, amount: money(rest) });
            });
            return { pool: next, used: money(amount - left) };
        };

        const shortAgainstShort = consume(carriedShort, Math.min(openingShort, netShort));
        carriedShort = shortAgainstShort.pool;
        netShort = money(netShort - shortAgainstShort.used);

        const shortLeft = carriedShort.reduce((a, c) => a + c.amount, 0);
        const shortAgainstLong = consume(carriedShort, Math.min(shortLeft, netLong));
        carriedShort = shortAgainstLong.pool;
        netLong = money(netLong - shortAgainstLong.used);

        const longAgainstLong = consume(carriedLong, Math.min(openingLong, netLong));
        carriedLong = longAgainstLong.pool;
        netLong = money(netLong - longAgainstLong.used);

        if (currentShortLoss > 0) carriedShort.push({ fy, amount: money(currentShortLoss) });
        if (currentLongLoss > 0) carriedLong.push({ fy, amount: money(currentLongLoss) });

        // Anything older than eight years lapses unused.
        const cutoff = fyOrder(fy) - CARRY_FORWARD_YEARS;
        const lapsedShort = carriedShort.filter((c) => fyOrder(c.fy) < cutoff);
        const lapsedLong = carriedLong.filter((c) => fyOrder(c.fy) < cutoff);
        carriedShort = carriedShort.filter((c) => fyOrder(c.fy) >= cutoff);
        carriedLong = carriedLong.filter((c) => fyOrder(c.fy) >= cutoff);

        const exemption = exemptionFor(fy);
        const exemptUsed = Math.min(netLong, exemption);
        const taxableLong = money(Math.max(0, netLong - exemption));

        // Rates are picked from the year, not per disposal: the exemption and
        // the set-off are annual, so a single pair of rates is the only thing
        // the annual figures can be multiplied by without double counting.
        const r = rates(`${fyOrder(fy)}-07-24`);
        const tax = money(netShort * r.short + taxableLong * r.long);

        return {
            fy,
            grossShort: s.short,
            grossLong: s.long,
            openingCarriedShort: money(openingShort),
            openingCarriedLong: money(openingLong),
            setOffShortAgainstShort: shortAgainstShort.used,
            setOffShortAgainstLong: shortAgainstLong.used,
            setOffLongAgainstLong: longAgainstLong.used,
            netShort: money(netShort),
            netLong: money(netLong),
            exemption,
            exemptUsed: money(exemptUsed),
            taxableShort: money(netShort),
            taxableLong,
            shortRate: r.short,
            longRate: r.long,
            estimatedTax: tax,
            buybackDividend: s.buybackDividend,
            disposalCount: s.disposalCount,
            proceeds: s.proceeds,
            cost: s.cost,
            lapsed: money(
                lapsedShort.reduce((a, c) => a + c.amount, 0) + lapsedLong.reduce((a, c) => a + c.amount, 0),
            ),
            closingCarriedShort: money(carriedShort.reduce((a, c) => a + c.amount, 0)),
            closingCarriedLong: money(carriedLong.reduce((a, c) => a + c.amount, 0)),
        };
    });

    return {
        years: rows,
        carried: {
            short: carriedShort.map((c) => ({ ...c, expiresAfter: `${fyOrder(c.fy) + CARRY_FORWARD_YEARS}-${String((fyOrder(c.fy) + CARRY_FORWARD_YEARS + 1) % 100).padStart(2, '0')}` })),
            long: carriedLong.map((c) => ({ ...c, expiresAfter: `${fyOrder(c.fy) + CARRY_FORWARD_YEARS}-${String((fyOrder(c.fy) + CARRY_FORWARD_YEARS + 1) % 100).padStart(2, '0')}` })),
        },
        totals: {
            realised: money(rows.reduce((s, r) => s + r.grossShort + r.grossLong, 0)),
            short: money(rows.reduce((s, r) => s + r.grossShort, 0)),
            long: money(rows.reduce((s, r) => s + r.grossLong, 0)),
            tax: money(rows.reduce((s, r) => s + r.estimatedTax, 0)),
            disposals: rows.reduce((s, r) => s + r.disposalCount, 0),
        },
    };
};

/**
 * Unrealised gains on what is still held, split by how it would be taxed if
 * sold today — and, for short-term lots, when they cross into long term.
 *
 * This is reporting, not a recommendation. The date a lot turns long term is a
 * fact about the lot; what to do about it is not something this app decides.
 */
export const openLotPositions = (stocks = [], asOf = new Date()) => {
    const rows = [];
    (stocks || []).forEach((s) => {
        if (!s || s.isArchived) return;
        const price = num(s.currentPrice);
        const { openLots } = matchLots(s.transactions, { name: s.name || s.ticker, id: s.id });
        openLots.forEach((lot) => {
            if (lot.quantity <= 0) return;
            const long = isLongTerm(lot.date, asOf);
            const anniversary = new Date(lot.date);
            anniversary.setFullYear(anniversary.getFullYear() + 1);
            rows.push({
                holding: s.name || s.ticker,
                holdingId: s.id,
                acquiredOn: lot.date,
                acquiredAs: lot.source,
                quantity: lot.quantity,
                costPerShare: lot.costPerShare,
                cost: money(lot.quantity * lot.costPerShare),
                value: money(lot.quantity * price),
                gain: money(lot.quantity * (price - lot.costPerShare)),
                term: long ? 'long' : 'short',
                longTermFrom: anniversary.toISOString().slice(0, 10),
                daysToLongTerm: long
                    ? 0
                    : Math.ceil((anniversary - asOf) / 86400000),
            });
        });
    });
    return rows.sort((a, b) => a.daysToLongTerm - b.daysToLongTerm);
};

/** Headline unrealised split. */
export const unrealisedSummary = (stocks = [], asOf = new Date()) => {
    const lots = openLotPositions(stocks, asOf);
    const pick = (term) => lots.filter((l) => l.term === term);
    const sum = (arr, key) => money(arr.reduce((s, l) => s + l[key], 0));
    const shortLots = pick('short');
    return {
        lots,
        shortTerm: { count: shortLots.length, cost: sum(shortLots, 'cost'), value: sum(shortLots, 'value'), gain: sum(shortLots, 'gain') },
        longTerm: (() => {
            const l = pick('long');
            return { count: l.length, cost: sum(l, 'cost'), value: sum(l, 'value'), gain: sum(l, 'gain') };
        })(),
        crossingWithin90Days: shortLots.filter((l) => l.daysToLongTerm > 0 && l.daysToLongTerm <= 90),
    };
};
