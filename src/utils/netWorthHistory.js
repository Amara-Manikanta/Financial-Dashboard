/**
 * Net worth over time, rebuilt from the dated records rather than from
 * snapshots.
 *
 * ## Why the stored snapshots could not be used
 *
 * There are two of them: ₹34.16 lakh on 2025-12-31 and ₹3.62 crore on
 * 2026-05-25. Read as a series that is a tenfold rise in five months, and it is
 * nothing of the kind — most of the difference is property and metals that
 * were entered into the app during those months, not acquired during them.
 * Neither snapshot separates equities from anything else. Two points, one of
 * them an artefact of data entry, is not a history.
 *
 * ## What this series actually measures
 *
 * **Money contributed, not market value.** Every point is what had been put in
 * by that date: purchases at cost, deposits at face value, less debt still
 * owed. It is not what the portfolio was worth on that date, and it does not
 * pretend to be — this database stores today's price for each holding and no
 * price for any earlier day, so a historical market value would have to be
 * invented.
 *
 * That turns out to be the more useful line anyway. A market-value curve moves
 * mostly with the market; a contributed-capital curve moves only when you save,
 * so its slope is your savings rate. Today's market value is shown as a single
 * point at the end, and the gap between the two lines is the return.
 *
 * ## The undated
 *
 * 14 of 28 asset items and 16 of 73 metal items carry no purchase date. They
 * cannot be placed on a timeline at all. They are reported as a separate
 * figure rather than dropped silently or dumped at the start, either of which
 * would put a step in the chart on a date nobody chose.
 */

const num = (v) => Number(v) || 0;
const money = (v) => Math.round(num(v) * 100) / 100;

const monthKey = (d) => {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** Every month from `first` to `last` inclusive, so gaps stay visible as flat runs. */
const monthRange = (first, last) => {
    const out = [];
    if (!first || !last) return out;
    let [y, m] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    while (y < ly || (y === ly && m <= lm)) {
        out.push(`${y}-${String(m).padStart(2, '0')}`);
        m += 1;
        if (m > 12) { m = 1; y += 1; }
    }
    return out;
};

/** A dated change to one component of net worth. */
const event = (date, component, amount) => {
    const key = monthKey(date);
    return key && amount ? { month: key, component, amount } : null;
};

const ACQUIRE = ['buy', 'ipo'];
const DISPOSE = ['sell', 'buyback'];
const cashOf = (tx) => num(tx.amount) || num(tx.quantity ?? tx.shares ?? tx.units) * num(tx.price ?? tx.nav);

/**
 * Outstanding principal on a loan, month by month.
 *
 * Amortised from the recorded payments rather than from the scheduled EMI: a
 * payment that was late, short or extra shows in the ledger and the schedule
 * would not know about it. Interest is charged on the balance at the time, so
 * the split between interest and principal falls out of the walk.
 */
export const loanBalances = (loan) => {
    const principal = num(loan?.principalAmount);
    if (principal <= 0) return {};

    const monthlyRate = num(loan?.interestRate) / 100 / 12;
    const payments = [...(loan?.payments || [])]
        .filter((p) => p && p.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const byMonth = {};
    let balance = principal;
    const startKey = monthKey(loan?.startDate) || monthKey(payments[0]?.date);
    if (startKey) byMonth[startKey] = money(balance);

    payments.forEach((p) => {
        const paid = num(p.amount);
        const interest = balance * monthlyRate;
        const toPrincipal = Math.max(0, paid - interest);
        balance = Math.max(0, balance - toPrincipal);
        const key = monthKey(p.date);
        if (key) byMonth[key] = money(balance);
    });

    return byMonth;
};

/**
 * Build the series.
 *
 * Every component is a running total of dated events, so a month with no
 * activity inherits the previous month's figure rather than dropping to zero.
 */
export const netWorthSeries = ({
    savings = [], metals = {}, assets = [], loans = [], now = new Date(),
} = {}) => {
    const events = [];
    const undated = { metals: 0, property: 0, items: [] };

    const push = (e) => { if (e) events.push(e); };

    (savings || []).forEach((item) => {
        if (!item) return;
        switch (item.type) {
            case 'stock_market':
                (item.stocks || []).forEach((s) => {
                    (s.transactions || []).forEach((tx) => {
                        const type = String(tx.type || '').toLowerCase();
                        const cash = cashOf(tx);
                        if (!cash) return;
                        if (ACQUIRE.includes(type)) push(event(tx.date, 'equities', cash));
                        else if (DISPOSE.includes(type)) push(event(tx.date, 'equities', -cash));
                    });
                });
                break;

            case 'mutual_fund':
                (item.transactions || []).forEach((tx) => {
                    const type = String(tx.type || '').toLowerCase();
                    const cash = cashOf(tx);
                    if (!cash) return;
                    if (type === 'sell' || type === 'withdraw') push(event(tx.date, 'equities', -cash));
                    else push(event(tx.date, 'equities', cash));
                });
                break;

            case 'fixed_deposit':
                // The principal is `originalAmount` on disk. Reading `principal`
                // or `amount` — neither of which any deposit carries — summed
                // ₹104,500 against ₹8.9 lakh actually on deposit. The same class
                // of mistake has hit SGB (`issuePrice` vs `purchasePrice`) and
                // PPF (`deposit` vs `amount`) in this codebase before.
                (item.deposits || []).forEach((d) => {
                    push(event(d.startDate || d.date, 'deposits',
                        num(d.originalAmount ?? d.principal ?? d.amount)));
                });
                break;

            case 'recurring_deposit':
                (item.recurringDeposits || []).forEach((rd) => {
                    (rd.installments || []).forEach((i) => push(event(i.date, 'deposits', num(i.amount))));
                });
                break;

            case 'ppf':
            case 'pf':
                (item.details || []).forEach((d) => {
                    // Interest is credited by the institution, not contributed —
                    // but it is still balance, so it counts once it lands.
                    push(event(d.date, 'retirement', num(d.amount)));
                });
                break;

            case 'nps':
                (item.holdings || []).forEach((h) => {
                    (h.transactions || []).forEach((tx) => {
                        if (String(tx.type).toLowerCase() === 'billing') return;
                        push(event(tx.date, 'retirement', num(tx.amount)));
                    });
                });
                break;

            case 'sgb':
                (item.holdings || []).forEach((h) => {
                    push(event(h.purchaseDate || h.issueDate, 'gold',
                        num(h.units ?? h.grams) * num(h.purchasePrice ?? h.issuePrice)));
                });
                break;

            case 'savings_account':
                (item.transactions || []).forEach((tx) => {
                    const type = String(tx.type || '').toLowerCase();
                    const amount = num(tx.amount);
                    if (type === 'withdraw') push(event(tx.date, 'cash', -amount));
                    else push(event(tx.date, 'cash', amount));
                });
                break;

            default:
                break;
        }
    });

    Object.values(metals || {}).forEach((list) => {
        (list || []).forEach((item) => {
            const cost = num(item?.purchasePrice);
            if (!cost) return;
            if (item.purchaseDate) push(event(item.purchaseDate, 'gold', cost));
            else {
                undated.metals += cost;
                undated.items.push({ name: item.name || 'Unnamed', amount: money(cost), kind: 'metal' });
            }
        });
    });

    (assets || []).forEach((category) => {
        (category?.items || []).forEach((item) => {
            const cost = num(item?.purchasePrice);
            if (!cost) return;
            if (item.purchaseDate) push(event(item.purchaseDate, 'property', cost));
            else {
                undated.property += cost;
                undated.items.push({ name: item.name || 'Unnamed', amount: money(cost), kind: category?.category || 'asset' });
            }
        });
    });

    const loanMonths = (loans || []).map((l) => ({ id: l?.id, balances: loanBalances(l) }));

    const months = events.map((e) => e.month).filter(Boolean);
    loanMonths.forEach((l) => months.push(...Object.keys(l.balances)));
    if (months.length === 0) return { points: [], undated, components: [] };

    const span = monthRange(months.sort()[0], monthKey(now));
    const COMPONENTS = ['equities', 'deposits', 'retirement', 'gold', 'property', 'cash'];

    const running = {};
    COMPONENTS.forEach((c) => { running[c] = 0; });
    const lastLoanBalance = {};

    const points = span.map((month) => {
        events.filter((e) => e.month === month).forEach((e) => {
            running[e.component] = (running[e.component] || 0) + e.amount;
        });
        loanMonths.forEach((l) => {
            if (l.balances[month] !== undefined) lastLoanBalance[l.id] = l.balances[month];
        });

        const debt = Object.values(lastLoanBalance).reduce((s, v) => s + v, 0);
        const gross = COMPONENTS.reduce((s, c) => s + Math.max(0, running[c] || 0), 0);

        return {
            month,
            ...COMPONENTS.reduce((o, c) => ({ ...o, [c]: money(Math.max(0, running[c] || 0)) }), {}),
            debt: money(debt),
            gross: money(gross),
            net: money(gross - debt),
        };
    });

    return {
        points,
        undated: {
            ...undated,
            metals: money(undated.metals),
            property: money(undated.property),
            total: money(undated.metals + undated.property),
            items: undated.items.sort((a, b) => b.amount - a.amount),
        },
        components: COMPONENTS,
    };
};

/**
 * Year-on-year change in contributed capital.
 *
 * The change between two December points is money saved that year, which is
 * exactly what a market-value series cannot tell you — there, a good year in
 * the market and a good year of saving look identical.
 */
export const contributionByYear = (points = []) => {
    const decembers = {};
    points.forEach((p) => {
        const [y, m] = p.month.split('-');
        if (!decembers[y] || m > decembers[y].m) decembers[y] = { m, net: p.net, gross: p.gross };
    });
    const years = Object.keys(decembers).sort();
    return years.map((y, i) => {
        const prev = i > 0 ? decembers[years[i - 1]].net : 0;
        return {
            year: y,
            net: decembers[y].net,
            added: money(decembers[y].net - prev),
        };
    });
};
