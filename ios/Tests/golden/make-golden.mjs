/**
 * Runs the WEB app's own code over a database and writes the figures the Swift
 * port must reproduce. Usage (see Tests/run-parity.sh):
 *   node make-golden.mjs <db.json> <out.json> <project root>
 *
 * The Expenses page's grouping and FinanceContext's salary maths live inside
 * React components, so they are cut out of the source files at run time rather
 * than copied here — the golden numbers always come from the code that is
 * actually in the app. The output is a person's finances: keep it out of the repo.
 */
import fs from 'fs';
import { isDebit, kindFor, expenseBuckets, defaultKindForCategory } from '../../../src/utils/transactionKind.js';
import { effectiveStockPosition } from '../../../src/utils/investmentSync.js';
import { ownHoldings } from '../../../src/utils/holdingOwner.js';
import { totalAccruedValue, totalPrincipal } from '../../../src/utils/fdAccrual.js';
import { readHolding as readSgbHolding } from '../../../src/utils/sgb.js';
import { calculateNetWorth, calculateGratuity } from '../../../src/utils/financeCalculators.js';
import { lentOutstanding } from '../../../src/utils/lents.js';
import { disposalsForStocks, gainsLedger, unrealisedSummary, matchLots, fyFor } from '../../../src/utils/capitalGains.js';

// Fixed-deposit interest depends on today's date; freeze it so the Swift side can be given the same instant.
const RealDate = Date;
const frozenMs = RealDate.now();
globalThis.Date = class extends RealDate {
    constructor(...args) { if (args.length === 0) super(frozenMs); else super(...args); }
    static now() { return frozenMs; }
};

const [dbPath, outPath, projectRoot] = process.argv.slice(2);
const root = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`;
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const categoryKinds = db.appData?.categoryKinds || {};

const slice = (file, from, to, inclusiveTo = false) => {
    const text = fs.readFileSync(root + file, 'utf8');
    const start = text.indexOf(from);
    const end = text.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error(`Could not find ${from} … ${to} in ${file}`);
    return text.slice(start + from.length, end + (inclusiveTo ? to.length : 0));
};

// Expenses.jsx: the month grouping.
const groupBody = slice('src/pages/Expenses.jsx', 'const expenseGroups = useMemo(() => {', '}, [expenses, categoryKinds]);');
const buildGroups = new Function('expenses', 'categoryKinds', 'isDebit', 'kindFor', 'expenseBuckets', 'defaultKindForCategory', groupBody);
const groups = buildGroups(db.expenses, categoryKinds, isDebit, kindFor, expenseBuckets, defaultKindForCategory);

// FinanceContext.jsx: payslip and income maths.
const salarySource = slice('src/context/FinanceContext.jsx', 'const MONTHLY_EARNINGS_KEYS', '// The complete set of metal categories');
const salaryStats = new Function(`const MONTHLY_EARNINGS_KEYS${salarySource}\nreturn calculateSalaryStats;`)()(db.expenses, db.salaryDetails);

const months = [];
for (const [year, byIndex] of Object.entries(groups)) {
    for (const [index, g] of Object.entries(byIndex)) {
        const name = g.name; // month name as the page prints it
        months.push({
            year: Number(year), index: Number(index),
            spent: g.total, invested: g.invested, count: g.count, investedCount: g.investedCount,
            income: salaryStats[year]?.months?.[name] ?? salaryStats[year]?.months?.[Object.keys(db.expenses[year] || {}).find((m) => new Date(`${m} 1, ${year}`).getMonth() === Number(index))] ?? 0,
        });
    }
}

// FinanceContext.jsx: how each account type is valued, and how metals get a value.
const policySource = slice('src/context/FinanceContext.jsx', 'export const isProtectionOnlyPolicy', 'export const METAL_CATEGORIES');
const { policyContributed, isProtectionOnlyPolicy } = new Function(`const isProtectionOnlyPolicy${policySource}\nreturn { policyContributed, isProtectionOnlyPolicy };`.replace(/export const/g, 'const'))();
const valuationSource = slice('src/context/FinanceContext.jsx', 'const calculateItemCurrentValue = (item) => {', 'const updateItem = async (type, item) => {');
const { calculateItemCurrentValue, calculateItemInvestedValue } = new Function(
    'ownHoldings', 'totalAccruedValue', 'totalPrincipal', 'readSgbHolding', 'policyContributed', 'effectiveStockPosition',
    `const calculateItemCurrentValue = (item) => {${valuationSource}\nreturn { calculateItemCurrentValue, calculateItemInvestedValue };`,
)(ownHoldings, totalAccruedValue, totalPrincipal, readSgbHolding, policyContributed, effectiveStockPosition);

const metalBody = slice('src/context/FinanceContext.jsx', 'const processedMetals = React.useMemo(() => {', '}, [metals, metalRates, manualMetalRates]);');
const manualMetalRates = db.appData?.manualMetalRates || { gold: 0, silver: 0 };
const metalRates = { gold: 0, silver: 0 };   // the live feed is not available here; manual rates, when set, win
const processedMetals = new Function('metals', 'metalRates', 'manualMetalRates', metalBody)(db.metals, metalRates, manualMetalRates);

// Dashboard.jsx: the stats block.
const statsBody = slice('src/pages/Dashboard.jsx', 'const stats = useMemo(() => {', '}, [savings, metals, assets, calculateItemCurrentValue, calculateItemInvestedValue]);');
const dashboard = new Function('savings', 'metals', 'assets', 'loans', 'calculateItemCurrentValue', 'calculateItemInvestedValue', 'calculateNetWorth', statsBody)(
    db.savings, processedMetals, db.assets, db.loans, calculateItemCurrentValue, calculateItemInvestedValue, calculateNetWorth,
);
const items = db.savings.map((i) => ({ id: String(i.id), type: i.type, current: Number(calculateItemCurrentValue(i)) || 0, invested: Number(calculateItemInvestedValue(i)) || 0 }));

// Savings.jsx: which accounts count, and the totals at the top of the page.
const savingsBody = slice('src/pages/Savings.jsx', 'const savingsOnly = savings.filter(item =>', 'const isTotalProfit = totalProfitLoss >= 0;');
const savingsPage = new Function('savings', 'calculateItemCurrentValue', 'calculateItemInvestedValue', 'isProtectionOnlyPolicy', 'calculateGratuity', 'employments', 'salaryDetails', 'useMemo',
    `const savingsOnly = savings.filter(item =>${savingsBody}\nreturn { activeSavings, archivedSavings, totalGratuityTillNow, totalPortfolioValue, totalPortfolioValueFromItems, totalInvestedValue, totalProfitLoss };`,
)(db.savings, calculateItemCurrentValue, calculateItemInvestedValue, isProtectionOnlyPolicy, calculateGratuity, db.appData?.employments || [], db.salaryDetails, (fn) => fn());
const savingsGolden = {
    active: savingsPage.activeSavings.map((i) => String(i.id)),
    archived: savingsPage.archivedSavings.map((i) => String(i.id)),
    gratuity: savingsPage.totalGratuityTillNow,
    totalValue: savingsPage.totalPortfolioValue,
    valueFromItems: savingsPage.totalPortfolioValueFromItems,
    invested: savingsPage.totalInvestedValue,
    profitLoss: savingsPage.totalProfitLoss,
};

// Investments.jsx: the three filters, the totals and the allocation.
const invA = slice('src/pages/Investments.jsx', 'const investments = savings.filter(item =>', 'const handleArchiveClick');
const invB = slice('src/pages/Investments.jsx', 'const totalPortfolioValue = activeInvestments', 'const isTotalProfit = totalProfitLoss >= 0;');
const invC = slice('src/pages/Investments.jsx', 'const pieData = React.useMemo(() => {', '}, [activeInvestments, calculateItemCurrentValue]);');
const invPage = new Function('savings', 'calculateItemCurrentValue', 'calculateItemInvestedValue',
    `const investments = savings.filter(item =>${invA}\nconst totalPortfolioValue = activeInvestments${invB}\nconst pieData = (() => {${invC}})();\nreturn { activeInvestments, archivedInvestments, totalPortfolioValue, totalInvestedValue, totalProfitLoss, pieData };`,
)(db.savings, calculateItemCurrentValue, calculateItemInvestedValue);
const investmentsGolden = {
    active: invPage.activeInvestments.map((i) => String(i.id)),
    archived: invPage.archivedInvestments.map((i) => String(i.id)),
    value: invPage.totalPortfolioValue, invested: invPage.totalInvestedValue, profitLoss: invPage.totalProfitLoss,
    allocation: invPage.pieData,
};

// LentsAndLoans.jsx: peer totals, loan totals and the figures on each loan card.
const peerBody = slice('src/pages/LentsAndLoans.jsx', 'const totalLent = lents.filter', 'const filteredLents');
const peer = new Function('lents', 'lentOutstanding', `const totalLent = lents.filter${peerBody}\nreturn { totalLent, totalBorrowed };`)(db.lents, lentOutstanding);
const debtBody = slice('src/pages/LentsAndLoans.jsx', "const isLent = item.type === 'lent';", 'const pendingAmount = amount + totalTransactions;');
const pendingOf = new Function('item', `const isLent = item.type === 'lent';${debtBody}\nconst pendingAmount = amount + totalTransactions;\nreturn pendingAmount;`);
const loanTotalsBody = slice('src/pages/LentsAndLoans.jsx', 'const activeLoanList = loans || [];', 'const getLoanTypeBadge');
const loanTotals = new Function('loans', `const activeLoanList = loans || [];${loanTotalsBody}\nreturn { totalPrincipal, totalMonthlyEmi, totalFeesGstPaid };`)(db.loans);
const cardBody = slice('src/pages/LentsAndLoans.jsx', 'const payments = loan.payments || [];', 'const isCurrentMonthPending = !isCurrentMonthPaid && (pendingBalance > 0);');
const cardOf = new Function('loan', 'getLoanTypeBadge', 'expandedHistory', `const payments = loan.payments || [];${cardBody}\nconst isCurrentMonthPending = !isCurrentMonthPaid && (pendingBalance > 0);\nreturn { totalPaid, estimatedTotalCost, pendingBalance, paidCount, progressPercent, pFee, gstAmt, isCurrentMonthPaid, isCurrentMonthPending };`);
const loansGolden = {
    peer: { ...peer, items: db.lents.map((l) => ({ id: String(l.id), pending: pendingOf(l), outstanding: lentOutstanding(l) })) },
    totals: loanTotals,
    cards: db.loans.map((l) => ({ id: String(l.id), ...cardOf(l, () => ({}), {}) })),
};

const account = db.savings.find((s) => s.type === 'stock_market');
const active = ownHoldings(account.stocks).filter((s) => !s.isArchived && Number(s.shares || 0) > 0);
const holdings = active.map((s) => {
    const { shares, avgCost } = effectiveStockPosition(s);
    return { id: String(s.id), value: Number(s.shares || 0) * Number(s.currentPrice || 0), invested: shares * avgCost, avgCost };
});

// CapitalGains.jsx: the page's own calls, and its fund classifier cut out of the source.
const cgStocks = ownHoldings(account.stocks);
const cgDisposals = disposalsForStocks(cgStocks);
const cgLedger = gainsLedger(cgDisposals.disposals);
const cgUnrealised = unrealisedSummary(cgStocks);
const classOf = new Function(`const DEBT_HINTS${slice('src/pages/CapitalGains.jsx', 'const DEBT_HINTS', 'const CapitalGains = () =>')}\nreturn classOf;`)();
const cgFunds = [];
db.savings.filter((x) => x.type === 'mutual_fund').forEach((f) => {
    const name = f.title || f.name || 'Unnamed fund';
    matchLots(f.transactions, { name, id: f.id }).disposals.forEach((d) => cgFunds.push({ ...d, assetClass: classOf(name) }));
});
cgFunds.sort((a, b) => String(b.soldOn).localeCompare(String(a.soldOn)));
const capitalGainsGolden = {
    currentFy: fyFor(new Date()),
    years: cgLedger.years, carried: cgLedger.carried, totals: cgLedger.totals,
    disposals: cgDisposals.disposals, unmatched: cgDisposals.unmatched,
    unrealised: { shortTerm: cgUnrealised.shortTerm, longTerm: cgUnrealised.longTerm, lots: cgUnrealised.lots, crossing: cgUnrealised.crossingWithin90Days.length },
    funds: cgFunds,
};

fs.writeFileSync(outPath, JSON.stringify({
    asOf: new RealDate(frozenMs).toISOString(),
    dashboard, items, savings: savingsGolden, investments: investmentsGolden, loans: loansGolden, capitalGains: capitalGainsGolden,
    months,
    stocks: {
        count: holdings.length,
        value: holdings.reduce((a, h) => a + h.value, 0),
        invested: holdings.reduce((a, h) => a + h.invested, 0),
        holdings,
    },
}, null, 1));
console.log(`golden: ${months.length} months, ${holdings.length} holdings, ${items.length} accounts, net worth ${dashboard.netWorth} → ${outPath}`);
