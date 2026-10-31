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
import { calculateNetWorth, calculateGratuity, gratuityForYear } from '../../../src/utils/financeCalculators.js';
import { lentOutstanding, receivableLents, totalReceivable } from '../../../src/utils/lents.js';
import { disposalsForStocks, gainsLedger, unrealisedSummary, matchLots, fyFor } from '../../../src/utils/capitalGains.js';
import { readQuote, triggeredAlerts, atRangeEdges } from '../../../src/utils/priceRange.js';
import { normaliseSector } from '../../../src/utils/sectors.js';
import { riskOf, priorityOf, byPriority, riskCounts, priorityCounts } from '../../../src/utils/watchlistRisk.js';
import { resolveMarketCap, NIFTY_50_STOCKS, NIFTY_NEXT_50_STOCKS, SBI_SMALL_CAP_WEIGHTS, HDFC_FLEXI_CAP_WEIGHTS } from '../../../src/utils/nifty50Data.js';
import { rankedApplications, ipoSummary } from '../../../src/utils/ipoApplications.js';
import { rankedReturns, portfolioReturn } from '../../../src/utils/xirr.js';
import { incomeByYear, incomeByMonth, incomeSummary, dividendPayers, lapsedPayers, dividendCalendar, busiestMonths } from '../../../src/utils/dividendAnalytics.js';
import { dividendTaxSummary } from '../../../src/utils/dividendTax.js';
import { readComposition } from '../../../src/utils/fundComposition.js';
import { sectorFor, capFor } from '../../../src/utils/sectors.js';
import { ALL_BENCHMARK_STOCKS } from '../../../src/utils/nifty50Data.js';
import { analysePortfolio, symbolFor } from '../../../src/utils/stockAdvisor.js';
import { detectRecurring, applyOverrides } from '../../../src/utils/recurring.js';
import { buildForecast } from '../../../src/utils/cashflow.js';
import { netWorthSeries, contributionByYear } from '../../../src/utils/netWorthHistory.js';
import { spendingOverview, categoryMovers, categoryTrends, spendingOutliers, concentration, monthlySeries } from '../../../src/utils/spendingAnalytics.js';
import { KINDS as MF_KINDS, flowBreakdown, allTransactions, isDebit as mfIsDebit, kindFor as mfKindFor, defaultKindForCategory as mfDefault, isVagueCategory, averageMonthlySpend } from '../../../src/utils/transactionKind.js';
import { allCardProfiles, cardTotals } from '../../../src/utils/creditCards.js';
import { runHealthChecks } from '../../../src/utils/dataHealth.js';
import { summariseWarranties } from '../../../src/utils/warranty.js';
import { CATEGORY_MAP } from '../../../src/utils/categories.js';
import { calculateBudgetStatus } from '../../../src/utils/budgetUtils.js';
import { isWasteful, wasteSummary } from '../../../src/utils/wasteful.js';
import { matchesIssue } from '../../../src/utils/dataHealth.js';
import { recoveryRanking, freePositions, nearlyFree, recoveryTotals, cashlessHoldings } from '../../../src/utils/costRecovery.js';

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

// Watchlist.jsx: how each entry becomes a row, and the three orders it can be sorted into.
const rowsBody = slice('src/pages/Watchlist.jsx', 'const allRows = useMemo(() => (watchlist || []).map((w) => ({', '})), [watchlist]);');
const watchRows = new Function('watchlist', 'readQuote', 'triggeredAlerts', 'normaliseSector', 'riskOf', 'resolveMarketCap', 'priorityOf',
    `return (watchlist || []).map((w) => ({${rowsBody}}));`)(db.watchlist, readQuote, triggeredAlerts, normaliseSector, riskOf, resolveMarketCap, priorityOf);
const sortBody = slice('src/pages/Watchlist.jsx', 'const sorted = useMemo(() => {', '}, [allRows, sortBy]);');
const sortRows = new Function('allRows', 'sortBy', 'byPriority', sortBody);
const edges = atRangeEdges(db.watchlist);
const watchlistGolden = {
    rows: watchRows.map((r) => ({
        id: String(r.id), name: r.name, sectorKey: r.sectorKey, riskKey: r.riskKey, capKey: r.capKey, priorityKey: r.priorityKey,
        price: r.q.price, rangePct: r.q.rangePct, dayChange: r.q.dayChange, dayChangePct: r.q.dayChangePct,
        nearLow: r.q.nearLow, nearHigh: r.q.nearHigh, fired: r.fired.length,
    })),
    order: Object.fromEntries(['priority', 'range', 'name'].map((k) => [k, sortRows(watchRows, k, byPriority).map((r) => String(r.id))])),
    riskCounts: riskCounts(watchRows), priorityCounts: priorityCounts(watchRows),
    nearLow: edges.nearLow.map((r) => String(r.id)), nearHigh: edges.nearHigh.map((r) => String(r.id)),
    firedCount: watchRows.reduce((n, r) => n + r.fired.length, 0),
};

// Every sector string in the data, and every stock's market cap, as the web resolves them.
const sectorStrings = [...new Set([...db.watchlist.map((w) => w.sector), ...db.savings.flatMap((x) => (x.stocks || []).map((t) => t.sector)),
    ...[...NIFTY_50_STOCKS, ...NIFTY_NEXT_50_STOCKS, ...Object.values(SBI_SMALL_CAP_WEIGHTS)].map((t) => t.sector), 'IT', ' fmcg ', 'Oil and Gas', 'Nonsense', '', undefined])];
const sectorsGolden = sectorStrings.map((v) => ({ in: v === undefined ? null : v, out: normaliseSector(v) }));
const capsGolden = [...db.watchlist, ...db.savings.flatMap((x) => x.stocks || [])].map((t) => ({ id: String(t.id), name: t.name || '', symbol: t.symbol || '', cap: resolveMarketCap(t) }));
const benchmarkGolden = {
    nifty50: NIFTY_50_STOCKS, next50: NIFTY_NEXT_50_STOCKS, sbi: Object.values(SBI_SMALL_CAP_WEIGHTS),
    hdfc: Object.entries(HDFC_FLEXI_CAP_WEIGHTS).map(([symbol, weight]) => ({ symbol, weight })),
};

// IpoTracker.jsx: the page's own two calls, on the open stock account.
const ipoMarket = db.savings.find((x) => x.type === 'stock_market' && !x.isArchived);
const ipoGolden = { applications: rankedApplications(db.ipoApplications), summary: ipoSummary(db.ipoApplications, ipoMarket?.stocks || []) };

// Returns.jsx: its two calls on your own stocks and every fund, and its sort code cut from the source.
const retStocks = ownHoldings(account.stocks);
const retFunds = db.savings.filter((x) => x.type === 'mutual_fund');
const retRows = rankedReturns(retStocks, retFunds);
const retSortBody = slice('src/pages/Returns.jsx', 'const sorted = useMemo(() => {', '}, [rows, sort]);');
const retSort = new Function('rows', 'sort', retSortBody);
const returnsGolden = {
    rows: retRows, portfolio: portfolioReturn(retStocks, retFunds),
    order: Object.fromEntries(['xirr', 'simple', 'invested', 'profit'].map((k) => [k, retSort(retRows, k).map((r) => `${r.kind}:${r.id}`)])),
};

// DividendIncome.jsx: its calls on your own stocks in the open account, and its treemap code from the source.
const dvMarket = db.savings.find((x) => x.type === 'stock_market' && !x.isArchived);
const dvStocks = ownHoldings(dvMarket?.stocks);
const dvYears = incomeByYear(dvStocks);
const treemapBody = slice('src/pages/DividendIncome.jsx', 'const treemapData = useMemo(() => stocks', ', [stocks]);');
const dividendsGolden = {
    summary: incomeSummary(dvStocks), years: dvYears, payers: dividendPayers(dvStocks), lapsed: lapsedPayers(dvStocks).map((p) => String(p.id)),
    calendar: dividendCalendar(dvStocks), busiest: busiestMonths(dvStocks).map((m) => m.month),
    latestYear: dvYears.length ? dvYears[dvYears.length - 1].year : String(new Date().getFullYear()),
    months: incomeByMonth(dvStocks, dvYears.length ? dvYears[dvYears.length - 1].year : String(new Date().getFullYear())),
    tax: dividendTaxSummary(dvStocks),
    treemap: new Function('stocks', `return stocks${treemapBody};`)(dvStocks),
};

// FreeHoldings.jsx: its five calls on your own stocks in the open account.
const freeGolden = {
    free: freePositions(dvStocks), almost: nearlyFree(dvStocks), all: recoveryRanking(dvStocks),
    cashless: cashlessHoldings(dvStocks), totals: recoveryTotals(dvStocks),
};


// Nifty50Exposure.jsx: the overlap maths, cut from the page and run for every basis and fund focus.
const overlapBody = slice('src/pages/Nifty50Exposure.jsx', 'const activeSavings = useMemo', '// Top Stock & Metrics', false);
const runOverlap = new Function(
    'useMemo', 'savings', 'calculateItemCurrentValue', 'calculateItemInvestedValue', 'valuationMode', 'selectedFundView',
    'searchTerm', 'filterCap', 'filterHolding', 'selectedSector', 'sortBy', 'sortOrder',
    'ownHoldings', 'effectiveStockPosition', 'ALL_BENCHMARK_STOCKS', 'readComposition', 'sectorFor', 'capFor',
    `const activeSavings = useMemo${overlapBody}\nreturn { totalStockValue, totalEquityMfValue, totalPortfolioValue, nipponVal, iciciNext50Val, hdfcFlexiVal, sbiSmallCapVal, consolidatedExposures, marketCapDistribution, sectorAnalytics, allSectors, filteredStocks };`,
);
const overlapGolden = {};
for (const mode of ['current', 'invested']) {
    for (const view of ['all', 'nippon_nifty50', 'icici_next50', 'hdfc_flexicap', 'sbi_smallcap']) {
        overlapGolden[`${mode}/${view}`] = runOverlap((f) => f(), db.savings, calculateItemCurrentValue, calculateItemInvestedValue, mode, view,
            '', 'all', 'all', 'all', 'total_val', 'desc', ownHoldings, effectiveStockPosition, ALL_BENCHMARK_STOCKS, readComposition, sectorFor, capFor);
    }
}
const overlapFilters = [
    { search: 'bank', cap: 'all', holding: 'all', sector: 'all', sort: 'total_val', order: 'desc' },
    { search: '', cap: 'Small Cap', holding: 'all', sector: 'all', sort: 'name', order: 'asc' },
    { search: '', cap: 'all', holding: 'direct', sector: 'all', sort: 'direct_val', order: 'desc' },
    { search: '', cap: 'all', holding: 'indirect', sector: 'Financials', sort: 'indirect_val', order: 'asc' },
    { search: '', cap: 'all', holding: 'all', sector: 'all', sort: 'name', order: 'desc' },
].map((f) => ({
    ...f,
    ids: runOverlap((fn) => fn(), db.savings, calculateItemCurrentValue, calculateItemInvestedValue, 'current', 'all',
        f.search, f.cap, f.holding, f.sector, f.sort, f.order, ownHoldings, effectiveStockPosition, ALL_BENCHMARK_STOCKS, readComposition, sectorFor, capFor)
        .filteredStocks.map((r) => r.symbol),
}));

// StockAnalyst.jsx: its one call into the analyst, with and without the fundamentals and index history the server supplies.
// Those two come from the network, so here they are made up — the same arrays are handed to the Swift side.
const analystMarket = db.savings.find((x) => x.type === 'stock_market' && !x.isArchived);
const analystStocks = ownHoldings(analystMarket?.stocks);
const analystCloses = {};
for (let t = RealDate.UTC(2015, 0, 1), i = 0; t <= frozenMs; t += 86400000, i += 1) {
    analystCloses[new RealDate(t).toISOString().slice(0, 10)] = Math.round((8000 + 6.5 * i + 450 * Math.sin(i / 45)) * 100) / 100;
}
const analystFundamentals = {};
[...analystStocks, ...(db.watchlist || [])].forEach((item, i) => {
    const key = symbolFor(item);
    if (!key || analystFundamentals[key]) return;
    const kind = i % 4;
    if (kind === 0) analystFundamentals[key] = { signal: { action: 'sell', label: 'Review for Exit', reasons: ['Debt is rising', 'Margins are shrinking'] }, healthScore: { total: 2, max: 5, checks: [{ name: 'Debt', status: 'bad', detail: 'Debt/equity 2.1' }, { name: 'Margins', status: 'caution', detail: 'Margin 4%' }, { name: 'Revenue', status: 'good', detail: 'Growing' }] } };
    else if (kind === 1) analystFundamentals[key] = { signal: { action: 'trim', label: 'Consider Trimming', reasons: ['Valuation stretched'] }, healthScore: { total: 3, max: 5, checks: [{ name: 'Valuation', status: 'caution', detail: 'P/E 60' }] } };
    else analystFundamentals[key] = { signal: { action: 'hold', label: 'Hold', reasons: [] }, healthScore: { total: 4, max: 5, checks: [] } };
});
const analystArgs = { stocks: analystStocks, watchlist: db.watchlist || [], sectorLimits: analystMarket?.sectorLimits || {}, pricesUpdatedAt: analystMarket?.pricesUpdatedAt || null, asOf: new RealDate(frozenMs) };
const analystGolden = {
    plain: analysePortfolio(analystArgs),
    rich: analysePortfolio({ ...analystArgs, fundamentals: analystFundamentals, indexCloses: analystCloses }),
    closes: analystCloses, fundamentals: analystFundamentals,
};

// Salary.jsx: the memos behind the page, cut from the source, for every year with a record plus the current one.
const salConsts = slice('src/pages/Salary.jsx', 'const MONTHS', 'const MultiSelectDropdown');
const salFields = (key, defaults) => [...defaults, ...((db.appData?.customSalaryFields || {})[key] || [])].filter((f) => !(db.appData?.hiddenSalaryFields || []).includes(f.key));
const salC = new Function(`const MONTHS${salConsts}\nreturn { MONTHS, ANNUAL_FIELDS_DEFAULT, MONTHLY_EARNINGS_DEFAULT, MONTHLY_DEDUCTIONS_DEFAULT };`)();
const salAnnual = salFields('annual', salC.ANNUAL_FIELDS_DEFAULT), salEarn = salFields('monthlyEarnings', salC.MONTHLY_EARNINGS_DEFAULT), salDed = salFields('monthlyDeductions', salC.MONTHLY_DEDUCTIONS_DEFAULT);
const salMonthlyBody = slice('src/pages/Salary.jsx', 'const monthlyData = useMemo(() => {', '}, [salaryDetails, selectedYear, activeMonthlyEarnings, activeMonthlyDeductions]);');
const salAggBody = slice('src/pages/Salary.jsx', 'const monthlyAggregates = useMemo(() => {', '}, [monthlyData]);');
const salCmpBody = slice('src/pages/Salary.jsx', 'const comparisonData = useMemo(() => {', '}, [annualRecordForSelectedYear, monthlyData, activeMonthlyEarnings]);');
const salAnnualBody = slice('src/pages/Salary.jsx', 'const annualData = useMemo(() => {', '}, [salaryDetails, activeAnnualFields]);');
const salYearsBody = slice('src/pages/Salary.jsx', 'const years = useMemo(() => {', '}, [salaryDetails]);');
const salYears = new Function('salaryDetails', salYearsBody)(db.salaryDetails);
const salaryGolden = { years: salYears, annual: new Function('salaryDetails', 'activeAnnualFields', salAnnualBody)(db.salaryDetails, salAnnual), byYear: {} };
for (const year of salYears) {
    const monthlyData = new Function('MONTHS', 'salaryDetails', 'selectedYear', 'activeMonthlyEarnings', 'activeMonthlyDeductions', salMonthlyBody)(salC.MONTHS, db.salaryDetails, year, salEarn, salDed);
    const annualRecordForSelectedYear = db.salaryDetails.find((s) => s.year === year && s.month === 'Annual') || null;
    salaryGolden.byYear[year] = {
        monthly: monthlyData,
        aggregates: new Function('monthlyData', salAggBody)(monthlyData),
        comparison: new Function('annualRecordForSelectedYear', 'activeMonthlyEarnings', 'monthlyData', salCmpBody)(annualRecordForSelectedYear, salEarn, monthlyData),
        annualTotal: annualRecordForSelectedYear ? salAnnual.reduce((sum, f) => sum + (Number(annualRecordForSelectedYear[f.key]) || 0), 0) : 0,
        gratuity: calculateGratuity(db.appData?.employments || [], db.salaryDetails, new RealDate(frozenMs)).total,
        gratuityYear: gratuityForYear(db.salaryDetails, year),
    };
}

// TaxPlanningCalculator.jsx: its prefill effect and its arithmetic, cut from the source, for each financial year on record.
const taxEffect = slice('src/components/TaxPlanningCalculator.jsx', 'useEffect(() => {', '}, [selectedFy, salaryDetails, savings, taxes]);');
const taxCalc = slice('src/components/TaxPlanningCalculator.jsx', 'const grossIncome =', 'const newRefundOrPayable = Number(tdsPaid) - newTax;', true);
const taxSorted = [...(db.taxes || [])].sort((a, b) => (b.financialYear || '').localeCompare(a.financialYear || ''));
const taxPrefill = (fy) => {
    const out = { basic: 600000, hra: 250000, other: 350000, bonus: 100000, tds: 108302, sec80C: 150000 };
    new Function('sortedTaxRecords', 'latestTaxRecord', 'selectedFy', 'salaryDetails', 'savings', 'set',
        `const setTdsPaid = (v) => set.tds = v, setSec80C = (v) => set.sec80C = v, setBasicSalary = (v) => set.basic = v, setHra = (v) => set.hra = v, setOtherAllowances = (v) => set.other = v, setBonus = (v) => set.bonus = v;\n${taxEffect}`,
    )(taxSorted, taxSorted[0], fy, db.salaryDetails, db.savings, out);
    return out;
};
const taxCalcFn = new Function('basicSalary', 'hra', 'otherAllowances', 'bonus', 'tdsPaid', 'sec80C', 'sec80D', 'nps80CCD', 'homeLoanInterest', 'actualRentPaid', 'isMetroCity',
    `const grossIncome =${taxCalc}\nreturn { grossIncome, hraExemption, totalOldDeductions, oldTaxableIncome, newTaxableIncome, oldTax, newTax, taxDifference, isNewRegimeBetter, oldRefundOrPayable, newRefundOrPayable };`);
const taxGolden = { fys: taxSorted.map((t) => t.financialYear).concat(['2031-2032']), prefill: {}, calc: {}, cases: [] };
for (const fy of taxGolden.fys) {
    const pre = taxPrefill(fy);
    taxGolden.prefill[fy] = pre;
    taxGolden.calc[fy] = taxCalcFn(pre.basic, pre.hra, pre.other, pre.bonus, pre.tds, pre.sec80C, 25000, 50000, 0, 180000, true);
}
for (const c of [[600000, 250000, 350000, 100000, 108302, 150000, 25000, 50000, 0, 180000, true], [1500000, 600000, 300000, 200000, 250000, 150000, 75000, 50000, 200000, 360000, false],
    [3000000, 900000, 600000, 500000, 700000, 100000, 0, 0, 300000, 120000, true], [450000, 100000, 50000, 0, 10000, 0, 0, 0, 0, 0, false], [1300000, 500000, 200000, 100000, 0, 150000, 50000, 50000, 0, 240000, true]]) {
    taxGolden.cases.push({ in: c, out: taxCalcFn(...c) });
}

// FinancialGoals.jsx: the computation above its render, cut from the source.
const goalsBody = slice('src/pages/FinancialGoals.jsx', 'const isItemActive = (item) => {', 'const filteredGoals');
const goalsTail = slice('src/pages/FinancialGoals.jsx', 'const overallProgress = totalTargetAmount > 0', '    return (', false);
const goalsRun = new Function('goals', 'savings', 'lents', 'calculateItemCurrentValue', 'lentOutstanding', 'receivableLents', 'totalReceivable',
    `const isItemActive = (item) => {${goalsBody}\nconst overallProgress = totalTargetAmount > 0${goalsTail}\nreturn { processedGoals, totalTargetAmount, totalAchievedAmount, overallProgress };`);
const goalsGolden = goalsRun(db.goals || [], db.savings, db.lents, calculateItemCurrentValue, lentOutstanding, receivableLents, totalReceivable);

// InsuranceAnalysis.jsx: the computation between its state and its handlers, for every tab with and without archived policies.
const insBody = slice('src/pages/InsuranceAnalysis.jsx', 'const DEFAULT_POLICIES = [', '    const handleSavePolicy');
const insRun = new Function('savings', 'showArchived', 'activeTab', 'annualIncome', 'liabilities', 'dependents',
    `const DEFAULT_POLICIES = [${insBody}\nreturn { policyItems, archivedCount, existingLifeCover, existingHealthCover, totalBikeIdv, totalCarIdv, totalHomeCover, totalAnnualPremiums, bikeVehicleList, recommendedLifeCover, recommendedHealthCover, lifeGap, healthGap, lifeCoveragePct, healthCoveragePct, filteredPolicies, expired: policyItems.map(isExpired) };`);
const insProfile = { age: 31, dependents: 2, annualIncome: 1800000, liabilities: 4300000 };
const insuranceGolden = { profile: db.appData?.insuranceProfile || null, today: new RealDate(frozenMs).toISOString().split('T')[0], cases: [] };
for (const showArchived of [false, true]) for (const tab of ['all', 'bike', 'life', 'health', 'home']) {
    for (const prof of [insProfile, { age: 40, dependents: 0, annualIncome: 600000, liabilities: 0 }]) {
        insuranceGolden.cases.push({ showArchived, tab, profile: prof, out: insRun(db.savings, showArchived, tab, prof.annualIncome, prof.liabilities, prof.dependents) });
    }
}

// recurring.js and cashflow.js, run as the Recurring and Cashflow pages call them.
const recOverrides = db.appData?.recurringOverrides || {};
const recDetected = detectRecurring(db.expenses, new RealDate(frozenMs));
const recurringGolden = { detected: recDetected.map(({ events, ...rest }) => ({ ...rest, eventCount: events.length, firstEvent: events[0], lastEvent: events[events.length - 1], cards: events.map((e) => e.card) })), overridden: applyOverrides(recDetected, recOverrides).map((x) => ({ key: x.key, status: x.status, active: x.active, overridden: x.overridden, chargedAfterCancel: x.chargedAfterCancel || false })) };
const cashflowGolden = {};
for (const days of [30, 60, 90]) {
    const f = buildForecast({ expenses: db.expenses, creditCards: db.creditCards || [], loans: db.loans || [], salaryDetails: db.salaryDetails || [], recurringOverrides: recOverrides, asOf: new RealDate(frozenMs), days });
    cashflowGolden[days] = f;
}

// netWorthHistory.js, and the steps memo from NetWorthHistory.jsx.
const nwSeries = netWorthSeries({ savings: db.savings, metals: db.metals, assets: db.assets, loans: db.loans, now: new RealDate(frozenMs) });
const nwStepsBody = slice('src/pages/NetWorthHistory.jsx', 'const bigSteps = useMemo(() => {', '}, [series]);');
const netWorthGolden = { series: nwSeries, byYear: contributionByYear(nwSeries.points), steps: new Function('series', nwStepsBody)(nwSeries) };

// spendingAnalytics.js, as Analytics.jsx calls it.
const spOverview = spendingOverview(db.expenses, categoryKinds, new RealDate(frozenMs));
const spLast = spOverview?.lastComplete?.month || null;
const spendingGolden = {
    overview: spOverview ? { ...spOverview, series: undefined, complete: spOverview.complete.map((m) => m.month) } : null,
    series: monthlySeries(db.expenses, categoryKinds),
    movers: categoryMovers(db.expenses, categoryKinds, { month: spLast, baselineMonths: 6 }),
    moversOlder: categoryMovers(db.expenses, categoryKinds, { month: (spOverview?.complete || []).slice(-8)[0]?.month, baselineMonths: 6 }),
    conc: Object.fromEntries([6, 12, 24].map((w) => [w, concentration(db.expenses, categoryKinds, w)])),
    trends: Object.fromEntries([6, 12, 24].map((w) => [w, categoryTrends(db.expenses, categoryKinds, w)])),
    outliers: Object.fromEntries([6, 12, 24].map((w) => [w, spendingOutliers(db.expenses, categoryKinds, { sinceMonths: w })])),
};

// MoneyFlow.jsx: its memos, for each period.
const mfBody = slice('src/pages/MoneyFlow.jsx', 'const scoped = useMemo(() => {', '    const spendPct');
const mfRun = new Function('useMemo', 'expenses', 'categoryKinds', 'period', 'now', 'onlyUnreviewed', 'saveCategoryKinds', 'allTransactions', 'flowBreakdown', 'isDebit', 'averageMonthlySpend', 'kindFor', 'defaultKindForCategory', 'isVagueCategory', 'KINDS',
    `const scoped = useMemo(() => {${mfBody}\nreturn { breakdown, naive, avg, categoryRows };`);
const moneyFlowGolden = {};
for (const period of ['12m', 'year', 'all']) {
    moneyFlowGolden[period] = mfRun((f) => f(), db.expenses, categoryKinds, period, new RealDate(frozenMs), false, () => {}, allTransactions, flowBreakdown, mfIsDebit, averageMonthlySpend, mfKindFor, mfDefault, isVagueCategory, MF_KINDS);
}

// creditCards.js, for the Cards and Card Intelligence pages.
const cardProfiles = allCardProfiles(db.creditCards || [], db.expenses, new RealDate(frozenMs));
const cardsGolden = { profiles: cardProfiles.map(({ history, ...rest }) => ({ ...rest, history })), totals: (({ idle, highestUtilisation, ...rest }) => ({ ...rest, idle: idle.map((p) => p.name), highestUtilisation: highestUtilisation?.name || null }))(cardTotals(cardProfiles)) };

// CreditCardDetails.jsx: spend, wallet, points and due, cut from the page.
const ccSpendSrc = slice('src/pages/CreditCardDetails.jsx', 'const cardSpendMap = useMemo(() => {', '    const handleSave');
const ccPointsSrc = slice('src/pages/CreditCardDetails.jsx', 'const getCardRewardPoints = (c) => {', '                    const totalPoints');
const ccDueSrc = slice('src/pages/CreditCardDetails.jsx', 'const totalDue = useMemo(() => creditCards.reduce((sum, card) => {', '}, 0), [creditCards, expenses]);');
const ccFns = new Function('useMemo', 'expenses', `const cardSpendMap = useMemo(() => {${ccSpendSrc}\nconst getCardRewardPoints = (c) => {${ccPointsSrc}\nreturn { getCardSpend, getWalletBalance, getCardRewardPoints };`)((f) => f(), db.expenses);
const ccDue = new Function('creditCards', 'getCardSpend', `return creditCards.reduce((sum, card) => {${ccDueSrc}}, 0);`)(db.creditCards || [], ccFns.getCardSpend);
const cardListGolden = { totalDue: ccDue, cards: (db.creditCards || []).map((c) => ({ id: String(c.id), spend: ccFns.getCardSpend(c), wallet: ccFns.getWalletBalance(c), points: ccFns.getCardRewardPoints(c), pending: (c.monthlyData || []).filter((m) => !m.isPaid).reduce((s, m) => s + (Number(m.billAmount) || 0), 0) })) };

// warranty.js and dataHealth.js.
const wSummary = summariseWarranties(db.assets || [], new RealDate(frozenMs));
const warrantyGolden = { total: wSummary.total, active: wSummary.active, expiring: wSummary.expiring, expired: wSummary.expired, unknown: wSummary.unknown, missingReceipt: wSummary.missingReceipt,
    rows: wSummary.rows.map((r) => ({ name: r.item.name, category: r.categoryName, state: r.status.state, daysLeft: r.status.daysLeft, expiry: r.status.expiryIso || null, extended: r.status.extended, services: r.services })) };
const healthGolden = runHealthChecks(db.expenses, db.salaryDetails || [], db.creditCards || [], db.assets || []).map(({ sample, ...c }) => ({ ...c, sample }));

// CategoryBudgets.jsx and the category-map merge in FinanceContext.jsx, for every month of the last two years.
const mapSrc = slice('src/context/FinanceContext.jsx', 'const mergedCategoryMap = useMemo(() => {', '}, [customCategoryMap, deletedCategories]);');
const budgetMap = new Function('CATEGORY_MAP', 'customCategoryMap', 'deletedCategories', mapSrc)(CATEGORY_MAP, db.appData?.customCategoryMap || {}, db.appData?.deletedCategories || []);
const budgetSpendSrc = slice('src/pages/CategoryBudgets.jsx', 'const actualSpending = useMemo(() => {', '}, [expenses, selectedYear, selectedMonth, mergedCategoryMap]);');
const budgetStatsSrc = slice('src/pages/CategoryBudgets.jsx', 'const stats = useMemo(() => {', '}, [displayMainCategories, mergedCategoryMap, localBudgets, actualSpending]);');
const budgetsGolden = { map: Object.entries(budgetMap), months: [], budgets: db.appData?.categoryBudgets || {} };
const excludedMain = ['Income', 'Transfers', 'Investments', 'Loans'];
const displayMain = Object.keys(budgetMap).filter((cat) => !excludedMain.includes(cat));
for (const year of Object.keys(db.expenses).sort().slice(-2)) {
    for (const month of Object.keys(db.expenses[year])) {
        const spend = new Function('expenses', 'selectedYear', 'selectedMonth', 'mergedCategoryMap', `${budgetSpendSrc}`.replace(/^/, 'return (() => {') + '})()')(db.expenses, year, month, budgetMap);
        const st = new Function('displayMainCategories', 'mergedCategoryMap', 'localBudgets', 'actualSpending', 'calculateBudgetStatus', budgetStatsSrc)(displayMain, budgetMap, budgetsGolden.budgets, spend, calculateBudgetStatus);
        budgetsGolden.months.push({ year, month, stats: st, sub: spend.subCatSpend, main: spend.mainCatSpend });
    }
}

// FuelAnalytics.jsx: its memos, for a few filter combinations.
const fuelTxSrc = slice('src/pages/FuelAnalytics.jsx', 'const fuelTransactions = useMemo(() => {', '}, [expenses]);');
const fuelFilterSrc = slice('src/pages/FuelAnalytics.jsx', 'const filteredTransactions = useMemo(() => {', '}, [fuelTransactions, selectedVehicle, selectedYear, selectedMonth]);');
const fuelDataSrc = slice('src/pages/FuelAnalytics.jsx', 'const analyticsData = useMemo(() => {', '}, [filteredTransactions]);');
const fuelTx = new Function('expenses', fuelTxSrc)(db.expenses);
const fuelRun = (v, y, m) => {
    const filtered = new Function('fuelTransactions', 'selectedVehicle', 'selectedYear', 'selectedMonth', fuelFilterSrc)(fuelTx, v, y, m);
    const a = new Function('filteredTransactions', fuelDataSrc)(filtered);
    return { v, y, m, count: filtered.length, totalSpent: a.totalSpent, totalLiters: a.totalLiters, totalDistance: a.totalDistance, avgMileage: a.avgMileage, avgPrice: a.avgPrice, valid: a.validMileageData.length,
        rows: a.chartData.map((d) => ({ id: d.id, distance: d.distance, mileage: d.mileage, pricePerLiter: d.pricePerLiter, liters: d.liters })) };
};
const fuelYears = [...new Set(fuelTx.map((t) => t.year))].sort((a, b) => b - a);
const fuelGolden = { years: fuelYears, cases: [fuelRun('All', 'All', 'All'), fuelRun('scooty', 'All', 'All'), fuelRun('bike', 'All', 'All'), fuelRun('car', 'All', 'All'), ...fuelYears.slice(0, 2).map((y) => fuelRun('All', String(y), 'All'))] };

// GroceryAnalytics.jsx: its memos.
const grAllSrc = slice('src/pages/GroceryAnalytics.jsx', 'const allGroceries = useMemo(() => {', '}, [expenses]);');
const grOptSrc = slice('src/pages/GroceryAnalytics.jsx', 'const filterOptions = useMemo(() => {', '}, [allGroceries, selectedCategory, selectedItem, selectedBrand]);');
const grFilterSrc = slice('src/pages/GroceryAnalytics.jsx', 'const filteredData = useMemo(() => {', '}, [allGroceries, selectedCategory, selectedItem, selectedBrand, selectedFlavour]);');
const grStatsSrc = slice('src/pages/GroceryAnalytics.jsx', 'const stats = useMemo(() => {', '}, [filteredData]);');
const grAll = new Function('expenses', grAllSrc)(db.expenses);
const grRun = (c, i, b, f) => {
    const opts = new Function('allGroceries', 'selectedCategory', 'selectedItem', 'selectedBrand', grOptSrc)(grAll, c, i, b);
    const rows = new Function('allGroceries', 'selectedCategory', 'selectedItem', 'selectedBrand', 'selectedFlavour', grFilterSrc)(grAll, c, i, b, f);
    const st = new Function('filteredData', grStatsSrc)(rows);
    return { c, i, b, f, opts, count: rows.length, stats: st, ids: rows.slice(0, 40).map((r) => `${r.transactionId}|${r.name}|${r.price}`) };
};
const grCat = [...new Set(grAll.map((g) => g.subcategory))].sort()[1] || 'All';
const grItem = grAll.find((g) => g.subcategory === grCat)?.name || 'All';
const groceryGolden = { total: grAll.length, first: grAll.slice(0, 40).map((r) => `${r.transactionId}|${r.name}|${r.price}`), cases: [grRun('All', 'All', 'All', 'All'), grRun(grCat, 'All', 'All', 'All'), grRun(grCat, grItem, 'All', 'All'), grRun('All', grItem, 'All', 'All')] };

// GroceryMasterList.jsx: the item list for each category.
const gmDefaults = new Function(`return ${slice('src/context/FinanceContext.jsx', 'export const DEFAULT_GROCERY_CATEGORIES = ', '};', true).replace(/^/, '').replace(/$/, '')}`)();
const gmLoaded = db.appData?.groceryCategories && Object.keys(db.appData.groceryCategories).length > 0 ? db.appData.groceryCategories : {};
const gmCategories = { ...gmDefaults, ...gmLoaded };
const gmItemsSrc = slice('src/pages/GroceryMasterList.jsx', 'const currentItems = useMemo(() => {', '}, [groceryCategories, selectedCategory, customGroceryItems, expenses]);');
const groceryMasterGolden = { categories: Object.entries(gmCategories).map(([k, v]) => [k, v]), items: Object.fromEntries(Object.keys(gmCategories).map((c) => [c, new Function('groceryCategories', 'selectedCategory', 'customGroceryItems', 'expenses', gmItemsSrc)(gmCategories, c, db.appData?.customGroceryItems || {}, db.expenses)])) };

// AllTransactions.jsx: its flatten/sort and filter memos, for several filter sets.
const atAllSrc = slice('src/pages/AllTransactions.jsx', 'const allTransactions = useMemo(() => {', '}, [expenses]);');
const atFilterSrc = slice('src/pages/AllTransactions.jsx', 'const filteredTransactions = useMemo(() => {', '}, [allTransactions, searchTerm, typeFilter, yearFilter, monthFilter, issue, categoryFilter, subCategoryFilter, mergedCategoryMap, wasteFilter]);');
const atAll = new Function('expenses', atAllSrc)(db.expenses);
const atRun = (o) => {
    const rows = new Function('allTransactions', 'searchTerm', 'typeFilter', 'yearFilter', 'monthFilter', 'issue', 'categoryFilter', 'subCategoryFilter', 'mergedCategoryMap', 'wasteFilter', 'matchesIssue', 'isWasteful', atFilterSrc)(
        atAll, o.search || '', o.type || 'all', o.year || 'all', o.month || 'all', o.issue || null, o.cat || 'all', o.sub || 'all', budgetMap, o.waste || 'all', matchesIssue, isWasteful);
    const w = wasteSummary(rows);
    return { o, count: rows.length, first: rows.slice(0, 25).map((r) => `${r.id}|${r.date}`), waste: { total: w.total, count: w.count, byCategory: w.byCategory } };
};
const atYears = [...new Set(atAll.map((t) => t.year))].sort().reverse();
const allTxGolden = { total: atAll.length, years: atYears, first: atAll.slice(0, 25).map((r) => `${r.id}|${r.date}`), cases: [{}, { search: 'amazon' }, { type: 'credit' }, { type: 'debit', year: atYears[0] }, { year: atYears[0], month: 'March' }, { issue: 'vague-category' }, { issue: 'no-title' }, { cat: 'Food & Dining' }, { cat: Object.keys(budgetMap)[3] }, { waste: 'only' }].map(atRun) };


// Monthly page categories: the monthDetails memo, cut off before the buckets.
const monthCatSrc = slice('src/pages/ExpenseDetails.jsx', 'const monthData = expenses[year]?.[month] || {};', 'const buckets = expenseBuckets');
const monthCatFn = new Function('expenses', 'year', 'month', 'salaryStats', 'mergedCategoryMap', 'countsAsSpending',
    'const monthData = expenses[year]?.[month] || {};' + monthCatSrc + '\nreturn { items, mainItems, incomeItems, salary };');
const countsAsSpendingFn = (tx) => !tx || tx.deductFromSalary !== false;
const monthCategoriesGolden = [];
for (const year of Object.keys(db.expenses || {})) {
    for (const month of Object.keys(db.expenses[year] || {})) {
        const r = monthCatFn(db.expenses, year, month, salaryStats, budgetMap, countsAsSpendingFn);
        const pick = (i) => ({ category: i.category, mainCategory: i.mainCategory || i.category, amount: i.amount, deductibleAmount: i.deductibleAmount });
        monthCategoriesGolden.push({ year, month, salary: r.salary, items: r.items.map(pick), mainItems: r.mainItems.map(pick),
            income: r.incomeItems.map((i) => ({ category: i.category, amount: i.amount, percentage: i.percentage })) });
    }
}

fs.writeFileSync(outPath, JSON.stringify({
    asOf: new RealDate(frozenMs).toISOString(),
    dashboard, items, savings: savingsGolden, investments: investmentsGolden, loans: loansGolden, capitalGains: capitalGainsGolden,
    watchlist: watchlistGolden, sectors: sectorsGolden, caps: capsGolden, benchmark: benchmarkGolden, ipos: ipoGolden, returns: returnsGolden, dividends: dividendsGolden, freeHoldings: freeGolden, overlap: overlapGolden, analyst: analystGolden, salary: salaryGolden, taxes: taxGolden, goals: goalsGolden, insurance: insuranceGolden, recurring: recurringGolden, spending: spendingGolden, moneyFlow: moneyFlowGolden, cards: cardsGolden, warranty: warrantyGolden, health: healthGolden, budgets: budgetsGolden, fuel: fuelGolden, grocery: groceryGolden, groceryMaster: groceryMasterGolden, allTx: allTxGolden, cardList: cardListGolden, netWorthHistory: netWorthGolden, cashflow: cashflowGolden, overlapFilters, monthCategories: monthCategoriesGolden,
    months,
    stocks: {
        count: holdings.length,
        value: holdings.reduce((a, h) => a + h.value, 0),
        invested: holdings.reduce((a, h) => a + h.invested, 0),
        holdings,
    },
}, null, 1));
console.log(`golden: ${months.length} months, ${holdings.length} holdings, ${items.length} accounts, net worth ${dashboard.netWorth} → ${outPath}`);
