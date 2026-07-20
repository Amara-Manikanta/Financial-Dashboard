const fs = require('fs');

const dbPath = '/Users/manikantaamara/Desktop/Antigravity/Finance_Analyser/db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const monthData = db.expenses['2026']['July'] || {};
console.log("July 2026 Month Data Keys:", Object.keys(monthData));

// Find salary
const salaryDetails = db.salaryDetails || [];
const record = salaryDetails.find(r => r.year === '2026' && r.month === 'July');
console.log("Salary Details Record for July:", record);

// Find salary from categories or transactions
const categories = monthData.categories || {};
console.log("Categories:", categories);

const activeTransactions = monthData.transactions || [];
const salaryTxs = activeTransactions.filter(t => ['salary received', 'salary'].includes((t.category || '').toLowerCase()));
console.log("Salary Transactions:", salaryTxs);

// Check total income
const manualIncome = activeTransactions
    .filter(t => t.isCredited && (t.mainCategory === 'Income' || ['salary received', 'salary'].includes((t.category || '').toLowerCase())))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
console.log("Manual Income sum:", manualIncome);

// Calculate totals using logic we implemented
const SAVINGS_MAIN_CATEGORIES = ['Investments', 'Transfers', 'Loans'];
let totalNetExpenses = 0;
let totalInvestments = 0;
let totalOtherExpenses = 0;

activeTransactions.forEach(t => {
    const cat = (t.category || 'others').toLowerCase();
    if (['salary received', 'salary', 'income'].includes(cat)) return;
    
    const amt = Number(t.amount) || 0;
    const effective = t.isCredited ? -amt : amt;
    
    if (t.deductFromSalary !== false && !t.isRewardPoints) {
        const mainCat = t.mainCategory;
        if (SAVINGS_MAIN_CATEGORIES.includes(mainCat)) {
            totalInvestments += effective;
        } else {
            totalNetExpenses += effective;
        }
    } else {
        totalOtherExpenses += effective;
    }
});

console.log("Total Net Expenses (Deductible True Expenses):", totalNetExpenses);
console.log("Total Investments (Deductible Savings/Investments):", totalInvestments);
console.log("Total Other Expenses (Non-deductible):", totalOtherExpenses);

// Let's see what the salary is resolved to
let salary = 0;
const yr = '2026';
const mo = 'July';
// Mimic salary logic in ExpenseDetails
const MONTHS_EARNINGS_KEYS = ['basicSalary', 'hra', 'conveyanceAllowance', 'flexibleAllowance', 'performanceBonus', 'foodWallet',
    'holidayAllowance', 'compensatoryAllowance', 'engagementPb', 'annualFlexiBasket', 'internetAllowance', 'cfPfMonthly'];
const MONTHS_DEDUCTIONS_KEYS = ['epf', 'profTax', 'incomeTax', 'otherRecoveries', 'medicalPremRecoverable', 'cfPfMonthly'];

if (record) {
    let gross = 0;
    MONTHS_EARNINGS_KEYS.forEach(k => {
        if (k !== 'cfPfMonthly') gross += Number(record[k]) || 0;
    });
    Object.entries(record).forEach(([k, v]) => {
        if (!['id', 'year', 'month', 'type', ...MONTHS_EARNINGS_KEYS, ...MONTHS_DEDUCTIONS_KEYS].includes(k)) {
            const num = Number(v);
            if (!isNaN(num) && num > 0) gross += num;
        }
    });

    let deductions = 0;
    MONTHS_DEDUCTIONS_KEYS.forEach(k => {
        if (k !== 'cfPfMonthly') deductions += Math.abs(Number(record[k]) || 0);
    });

    salary = gross - deductions;
}
if (salary === 0) {
    salary = categories['salary received'] || categories['salary'] || categories['income'] || 0;
}
if (activeTransactions.length > 0) {
    const hasSalaryTx = activeTransactions.some(t => ['salary received', 'salary'].includes((t.category || '').toLowerCase()));
    const baseSalary = hasSalaryTx ? 0 : salary; 
    salary = baseSalary + manualIncome;
}

console.log("Resolved Salary:", salary);
console.log("Balance:", salary - totalNetExpenses - totalInvestments);

// Let's print all transactions to see credit card payments vs credit card spends
console.log("\nAll July Transactions:");
activeTransactions.forEach(t => {
    console.log(`- ${t.date} | ${t.description || t.title} | ${t.category} | ${t.mainCategory} | ${t.paymentMode} | ${t.creditCardName || ''} | ₹${t.amount} | deductFromSalary: ${t.deductFromSalary} | isCredited: ${t.isCredited}`);
});
