/**
 * Tax withheld on dividends, and where it should be expected.
 *
 * Since April 2020 a dividend is taxed in the shareholder's hands at slab rate,
 * and the company withholds part of it before paying. So the amount that lands
 * in the bank is not the dividend — it is the dividend minus TDS, and the
 * difference is recoverable against your tax liability. Recording only the
 * credited figure understates dividend income and loses a credit you are
 * entitled to claim.
 *
 * ## Two different rules, and this database has both
 *
 * **Ordinary shares (section 194).** TDS at 10%, but only once dividends from
 * that one company pass a threshold within a financial year. Below it, nothing
 * is withheld.
 *
 * **REITs and InvITs (section 194LBA).** A different section with **no
 * threshold at all**. A REIT distribution is not one payment — it is a bundle
 * of interest, rental income, dividend and return of capital, and the first
 * three are withheld on from the first rupee. That is why a small REIT payout
 * can show tax deducted while a far larger dividend from an ordinary company
 * shows none.
 *
 * ## What this file will not do
 *
 * It does not compute what your TDS "should" have been and present it as fact.
 * The split of a REIT distribution across its components is decided by the
 * trust and published per payout; nothing here knows it. The threshold check
 * below flags where withholding is *plausible* so an unrecorded deduction can
 * be found — the actual figure has to come off the statement.
 */

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

/** Section 194 threshold per company, per financial year. Raised for FY 2025-26. */
export const TDS_THRESHOLD = { 'pre-2025': 5000, current: 10000 };
export const TDS_RATE = 0.10;

/** Indian financial year, April to March. */
export const fyOf = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const start = d.getMonth() >= 3 ? y : y - 1;
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

export const thresholdFor = (fy) =>
    (Number(String(fy).slice(0, 4)) >= 2025 ? TDS_THRESHOLD.current : TDS_THRESHOLD['pre-2025']);

/**
 * Is this holding a REIT or InvIT?
 *
 * Matched on the name because nothing in the record says so. Deliberately
 * narrow: `reit`, `invit` and `trust` as whole words rather than substrings,
 * because "Industries" contains no such token but a loose match on "it" would
 * catch half the portfolio.
 */
export const isTrustUnit = (holding) => {
    const t = `${holding?.name || ''} ${holding?.ticker || ''}`.toLowerCase();
    return /\b(reit|riet|invit|inv-it)\b/.test(t);
};

/**
 * Gross, tax and net for one dividend row.
 *
 * The recorded figure is read as gross unless the row says otherwise. That is
 * the convention a company declares in and a REIT statement prints, and it is
 * also the only reading that leaves the 152 rows already in this database
 * untouched: with no `tds` recorded, gross, net and the stored amount are all
 * the same number.
 */
export const readDividend = (tx) => {
    const recorded = num(tx?.amount) || num(tx?.price);
    const tds = Math.max(0, num(tx?.tds));
    const recordedIsNet = tx?.amountIsNet === true;

    const gross = recordedIsNet ? recorded + tds : recorded;
    const net = recordedIsNet ? recorded : recorded - tds;

    return {
        date: tx?.date || null,
        fy: fyOf(tx?.date),
        gross: money(gross),
        tds: money(tds),
        net: money(net),
        hasTds: tds > 0,
        recordedIsNet,
        effectiveRate: gross > 0 ? (tds / gross) * 100 : 0,
    };
};

const dividendTxs = (holding) => (holding?.transactions || []).filter((t) => t?.type === 'dividend');

/**
 * Per company, per financial year: what was paid, what was withheld, and
 * whether withholding should have been expected.
 *
 * `expectsTds` is the useful column. A row where tax is expected but none is
 * recorded is either a payout below the line or, more likely, a deduction
 * nobody entered — and the second is money you can claim back.
 */
export const dividendTaxRows = (holdings = []) => {
    const rows = {};

    (holdings || []).forEach((h) => {
        if (!h) return;
        const trust = isTrustUnit(h);
        dividendTxs(h).forEach((tx) => {
            const d = readDividend(tx);
            if (!d.fy) return;
            const key = `${h.id}::${d.fy}`;
            rows[key] = rows[key] || {
                holdingId: h.id,
                name: h.name || h.ticker || 'Unnamed',
                ticker: h.ticker || '',
                fy: d.fy,
                isTrust: trust,
                gross: 0,
                tds: 0,
                net: 0,
                payments: 0,
                recorded: [],
            };
            const r = rows[key];
            r.gross = money(r.gross + d.gross);
            r.tds = money(r.tds + d.tds);
            r.net = money(r.net + d.net);
            r.payments += 1;
            r.recorded.push({ ...d, txId: tx.id });
        });
    });

    return Object.values(rows).map((r) => {
        const threshold = thresholdFor(r.fy);
        // A trust withholds from the first rupee; an ordinary company only
        // above the threshold. Conflating the two would either flag every small
        // equity dividend or miss every REIT payout — this database has both.
        const expectsTds = r.isTrust ? true : r.gross > threshold;
        return {
            ...r,
            threshold,
            expectsTds,
            /** Expected but nothing recorded — worth checking against the statement. */
            missingTds: expectsTds && r.tds === 0,
            effectiveRate: r.gross > 0 ? (r.tds / r.gross) * 100 : 0,
            /** How close an under-threshold company is to withholding starting. */
            headroom: r.isTrust ? null : money(Math.max(0, threshold - r.gross)),
        };
    }).sort((a, b) => String(b.fy).localeCompare(String(a.fy)) || b.gross - a.gross);
};

/** Totals per financial year, for the headline and for a return. */
export const dividendTaxByYear = (holdings = []) => {
    const years = {};
    dividendTaxRows(holdings).forEach((r) => {
        years[r.fy] = years[r.fy] || { fy: r.fy, gross: 0, tds: 0, net: 0, payments: 0, companies: 0, missing: 0 };
        const y = years[r.fy];
        y.gross = money(y.gross + r.gross);
        y.tds = money(y.tds + r.tds);
        y.net = money(y.net + r.net);
        y.payments += r.payments;
        y.companies += 1;
        if (r.missingTds) y.missing += 1;
    });
    return Object.values(years)
        .map((y) => ({ ...y, effectiveRate: y.gross > 0 ? (y.tds / y.gross) * 100 : 0 }))
        .sort((a, b) => String(b.fy).localeCompare(String(a.fy)));
};

/** Everything, at a glance. */
export const dividendTaxSummary = (holdings = [], now = new Date()) => {
    const rows = dividendTaxRows(holdings);
    const years = dividendTaxByYear(holdings);
    const currentFy = fyOf(now);
    const thisYear = years.find((y) => y.fy === currentFy) || null;

    return {
        rows,
        years,
        currentFy,
        thisYear,
        lifetimeGross: money(rows.reduce((s, r) => s + r.gross, 0)),
        lifetimeTds: money(rows.reduce((s, r) => s + r.tds, 0)),
        lifetimeNet: money(rows.reduce((s, r) => s + r.net, 0)),
        /** Rows where tax was expected and none is on record. */
        needsChecking: rows.filter((r) => r.missingTds),
        /** Under-threshold this year but close enough that a further payout crosses it. */
        approaching: rows.filter(
            (r) => r.fy === currentFy && !r.isTrust && !r.expectsTds && r.headroom !== null && r.headroom < r.threshold * 0.4,
        ),
        trustHoldings: [...new Set(rows.filter((r) => r.isTrust).map((r) => r.name))],
    };
};
