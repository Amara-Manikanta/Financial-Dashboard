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

const account = db.savings.find((s) => s.type === 'stock_market');
const active = ownHoldings(account.stocks).filter((s) => !s.isArchived && Number(s.shares || 0) > 0);
const holdings = active.map((s) => {
    const { shares, avgCost } = effectiveStockPosition(s);
    return { id: String(s.id), value: Number(s.shares || 0) * Number(s.currentPrice || 0), invested: shares * avgCost, avgCost };
});

fs.writeFileSync(outPath, JSON.stringify({
    months,
    stocks: {
        count: holdings.length,
        value: holdings.reduce((a, h) => a + h.value, 0),
        invested: holdings.reduce((a, h) => a + h.invested, 0),
        holdings,
    },
}, null, 1));
console.log(`golden: ${months.length} months, ${holdings.length} holdings → ${outPath}`);
