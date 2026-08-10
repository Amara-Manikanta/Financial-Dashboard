// Linking transactions to gadget EMI orders.
//
// The orders already exist: entries in `loans` with type 'gadget', carrying
// emiAmount, tenureMonths and startDate. What was missing is the connection
// between an EMI charge on a card and the order it belongs to.
//
// Two things about the real data shaped this:
//
// 1. The lender on an order ("Scapia", "ICICI-HP", "ICICI-Amazon") is not the
//    card name ("Scapia Credit Card", "HPCL", "Amazon Credit Card"), so they
//    are matched on tokens against both the card name and its issuing bank.
//
// 2. EMI charges are NOT reliably categorised. The five recorded instalments of
//    one order carry "family lent", "money received back", "family borrowed"
//    and "credit card bill" between them — not one says "emi". So the link is
//    offered based on the card, never on the category.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const tokens = (value) => String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);

// Words that appear on nearly every card and so carry no signal.
const NOISE = new Set(['credit', 'card', 'the', 'bank', 'pay', 'rupay', 'visa', 'mastercard']);

/**
 * Does this order's lender refer to this card?
 *
 * Scored rather than exact so "ICICI-HP" can match the HPCL card issued by
 * ICICI. A match on the card name is worth more than one on the bank, since
 * several cards share an issuer.
 */
export const lenderMatchesCard = (lender, card) => {
    if (!lender || !card) return 0;
    const want = tokens(lender).filter((t) => !NOISE.has(t));
    if (!want.length) return 0;

    const nameTokens = tokens(card.name).filter((t) => !NOISE.has(t));
    const bankTokens = tokens(card.bankName).filter((t) => !NOISE.has(t));

    let score = 0;
    for (const t of want) {
        // Prefix match both ways so "hp" matches "hpcl" and vice versa.
        const hitsName = nameTokens.some((n) => n.startsWith(t) || t.startsWith(n));
        const hitsBank = bankTokens.some((b) => b.startsWith(t) || t.startsWith(b));
        if (hitsName) score += 2;
        else if (hitsBank) score += 1;
    }
    return score;
};

/** The card an order is billed to, or null if nothing matches convincingly. */
export const cardForOrder = (order, creditCards = []) => {
    let best = null;
    let bestScore = 0;
    for (const card of creditCards) {
        const score = lenderMatchesCard(order.lender, card);
        if (score > bestScore) { bestScore = score; best = card; }
    }
    return bestScore > 0 ? best : null;
};

const monthsBetween = (fromISO, toISO) => {
    if (!fromISO || !toISO) return 0;
    const [fy, fm, fd] = String(fromISO).split('-').map(Number);
    const [ty, tm, td] = String(toISO).split('-').map(Number);
    if (!fy || !ty) return 0;
    let months = (ty - fy) * 12 + (tm - fm);
    if (td < fd) months -= 1;
    return months;
};

/**
 * Which instalment falls on this date: 1-based, the first being number 1 on the
 * start date itself. Returns a number past the tenure once the order has run
 * its course — deliberately NOT clamped, because clamping to the tenure makes a
 * finished order look like it is forever paying its last instalment, and it
 * would then never drop out of the dropdown.
 */
export const installmentNumber = (order, isoDate) => {
    const tenure = Number(order?.tenureMonths) || 0;
    if (!order?.startDate || !tenure) return null;
    const elapsed = monthsBetween(order.startDate, isoDate);
    if (elapsed < 0) return null;
    return elapsed + 1;
};

/** Is the order still running on this date? */
export const isActiveOn = (order, isoDate) => {
    const n = installmentNumber(order, isoDate);
    const tenure = Number(order?.tenureMonths) || 0;
    return n !== null && n >= 1 && n <= tenure;
};

/** Gadget EMI orders billed to a given card and still running on a date. */
export const activeOrdersForCard = (loans = [], creditCards = [], cardName, isoDate) => {
    if (!cardName) return [];
    const card = creditCards.find((c) => String(c.name).trim() === String(cardName).trim());
    if (!card) return [];

    return (loans || [])
        .filter((l) => l && l.type === 'gadget')
        .filter((l) => {
            const matched = cardForOrder(l, creditCards);
            return matched && String(matched.name) === String(card.name);
        })
        .filter((l) => isActiveOn(l, isoDate))
        .map((l) => ({
            ...l,
            installment: installmentNumber(l, isoDate),
            label: `${l.name} — ${installmentNumber(l, isoDate)}/${l.tenureMonths}`,
        }));
};

/** "Anith's iPhone EMI (EMI 5/24)" */
export const suggestTitle = (order, isoDate) => {
    const n = installmentNumber(order, isoDate);
    if (!n) return order?.name || '';
    return `${order.name} (EMI ${n}/${order.tenureMonths})`;
};

export { MONTHS };
