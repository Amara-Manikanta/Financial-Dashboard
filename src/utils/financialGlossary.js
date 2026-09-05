/**
 * What each of these numbers actually means, in words.
 *
 * The Business Health panel is a wall of terms of art — forward P/E, D/E ratio,
 * operating margin, beta — every one of which is a compressed sentence. Someone
 * who does not already know the sentence learns nothing from the number, and a
 * dashboard that cannot be read is decoration.
 *
 * Each entry turns a value into a plain statement of fact about the business.
 * They explain; they do not advise. "You pay ₹9.70 for every ₹1 of profit"
 * is what the ratio says. Whether ₹9.70 is a good price depends on things no
 * ratio knows, and this file does not pretend otherwise.
 */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const rupees = (v) => `₹${v.toFixed(2)}`;

/**
 * Yahoo reports debtToEquity as a percentage — 82.3 means 0.82x — so every
 * reading of it has to divide by 100. Getting that wrong by a factor of a
 * hundred is the easiest mistake here.
 */
export const debtRatio = (raw) => (num(raw) === null ? null : raw / 100);

export const GLOSSARY = {
    operatingMargin: {
        term: 'Operating margin',
        plain: (pct) => (num(pct) === null
            ? 'Not reported.'
            : `Out of every ₹100 of sales, ${rupees(pct)} is left after the costs of running the business — before interest and tax.`),
    },
    netMargin: {
        term: 'Net margin',
        plain: (pct) => (num(pct) === null
            ? 'Not reported.'
            : `Of every ₹100 of sales, ${rupees(pct)} ends up as profit once everything is paid.`),
    },
    revenueGrowth: {
        term: 'Revenue growth',
        plain: (pct) => {
            if (num(pct) === null) return 'Not reported.';
            if (pct < 0) return `Sales are ${Math.abs(pct).toFixed(1)}% lower than the same period a year ago — the business is shrinking.`;
            return `Sales are ${pct.toFixed(1)}% higher than the same period a year ago.`;
        },
    },
    debtToEquity: {
        term: 'Debt to equity',
        plain: (ratio) => (num(ratio) === null
            ? 'Not reported. Banks and finance companies usually do not report this, because borrowing IS their business — it does not mean they have no debt.'
            : `For every ₹1 of the owners' own money in the business, it has borrowed ${rupees(ratio)}.`),
    },
    forwardPE: {
        term: 'Forward P/E',
        plain: (x) => (num(x) === null || x <= 0
            ? 'Not meaningful — the company is not expected to make a profit.'
            : `At today's price you pay ₹${x.toFixed(1)} for every ₹1 of profit the company is expected to earn next year.`),
    },
    priceToBook: {
        term: 'Price to book',
        plain: (x) => (num(x) === null
            ? 'Not reported.'
            : `The share price is ${x.toFixed(2)} times what the company's assets are worth on paper after its debts.`),
    },
    beta: {
        term: 'Beta',
        plain: (b) => {
            if (num(b) === null) return 'Not reported.';
            if (b > 1) return `When the market moves 10%, this has historically moved about ${(b * 10).toFixed(0)}% — swingier than the market.`;
            if (b < 1) return `When the market moves 10%, this has historically moved about ${(b * 10).toFixed(0)}% — steadier than the market.`;
            return 'It has historically moved roughly in step with the market.';
        },
    },
};

/** The one-line explanation for a check on the scorecard. */
export const CHECK_HELP = {
    'Revenue Growth': 'Is the company selling more than it did a year ago?',
    Profitability: 'Did it actually make money each quarter, and is that improving?',
    Margins: 'How much of each rupee of sales survives the cost of doing business?',
    'Debt Health': 'How much has it borrowed against the owners\' own money?',
    Valuation: 'How much are you paying for each rupee of its expected profit?',
};

/**
 * A caveat that belongs on the figure itself, not in a footnote.
 *
 * Yahoo does not report debt-to-equity for banks, and a missing value read as
 * zero says "no debt" about the most leveraged businesses there are — SBI and
 * HDFC Bank both scored a point for it. Saying so where the number appears is
 * the only place it can do any good.
 */
export const isMissingDebtData = (raw) => num(raw) === null || raw === 0;

export const explainRatio = (key, value) => GLOSSARY[key]?.plain(value) || '';
