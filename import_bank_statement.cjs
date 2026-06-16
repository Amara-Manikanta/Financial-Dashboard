const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Usage: node import_bank_statement.cjs <path_to_excel_file>

if (process.argv.length < 3) {
    console.error("Usage: node import_bank_statement.cjs <path_to_excel_file>");
    process.exit(1);
}

const excelPath = process.argv[2];
const dbPath = path.join(__dirname, 'db.json');
const rulesPath = path.join(__dirname, 'category_rules.json');

// Load dynamic rules
let categoryRules = {};
if (fs.existsSync(rulesPath)) {
    categoryRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
}

// Simple heuristic matching fallback
function guessCategory(remarks, isCredit) {
    const raw = remarks.toLowerCase();
    
    if (isCredit) {
        if (raw.includes('salary') || raw.includes('sal')) return { main: 'Income', sub: 'Salary' };
        if (raw.includes('int.pd') || raw.includes('interest')) return { main: 'Income', sub: 'Interest Income' };
        if (raw.includes('refund') || raw.includes('reversal')) return { main: 'Income', sub: 'Refund' };
        if (raw.includes('dividend') || raw.includes('div')) return { main: 'Income', sub: 'Dividend' };
        return { main: 'Transfers', sub: 'Bank Transfer' };
    }
    
    if (raw.includes('payment against loan') || raw.includes('loan account')) return { main: 'Finance', sub: 'Loan EMI' };
    if (raw.includes('icici bank credit ca') || raw.includes('credit card')) return { main: 'Finance', sub: 'Credit Card Payment' };
    if (raw.includes('rent')) return { main: 'Housing', sub: 'House Rent' };
    if (raw.includes('zomato') || raw.includes('swiggy') || raw.includes('food')) return { main: 'Food', sub: 'Food Delivery' };
    if (raw.includes('restaurant') || raw.includes('cafe')) return { main: 'Food', sub: 'Dining Out' };
    if (raw.includes('blinkit') || raw.includes('zepto') || raw.includes('instamart') || raw.includes('bigbasket') || raw.includes('grocery') || raw.includes('supermarket') || raw.includes('jiomart')) return { main: 'Essentials', sub: 'Groceries' };
    if (raw.includes('uber') || raw.includes('ola') || raw.includes('rapido') || raw.match(/\bcab\b/)) return { main: 'Travel', sub: 'Cab' };
    if (raw.includes('irctc') || raw.includes('train')) return { main: 'Travel', sub: 'Train' };
    if (raw.includes('makemytrip') || raw.includes('indigo') || raw.includes('flight')) return { main: 'Travel', sub: 'Flight' };
    if (raw.includes('petrol') || raw.includes('fuel') || raw.includes('hpcl') || raw.includes('iocl') || raw.includes('bpcl')) return { main: 'Travel', sub: 'Fuel' };
    if (raw.includes('amazon') || raw.includes('flipkart') || raw.includes('myntra')) return { main: 'Shopping', sub: 'Online Shopping' };
    if (raw.includes('jio') || raw.includes('airtel') || raw.includes('recharge')) return { main: 'Utilities', sub: 'Mobile Recharge' };
    if (raw.includes('electricity') || raw.includes('bescom')) return { main: 'Utilities', sub: 'Electricity' };
    if (raw.includes('netflix') || raw.includes('prime') || raw.includes('spotify')) return { main: 'Subscriptions', sub: 'OTT' };
    if (raw.includes('credbill') || raw.includes('sbi card') || raw.includes('hdfc bank cc')) return { main: 'Finance', sub: 'Credit Card Payment' };
    if (raw.includes('zerodha') || raw.includes('groww') || raw.includes('upstox') || raw.includes('mutual fund') || raw.includes('sip')) return { main: 'Investments', sub: 'Mutual Funds' };
    if (raw.includes('ppf') || raw.includes('nps')) return { main: 'Investments', sub: 'PPF' };
    if (raw.includes('iwish')) return { main: 'Investments', sub: 'Fixed Deposit' };
    if (raw.includes('atm') || raw.includes('cash')) return { main: 'Transfers', sub: 'Cash Reserve' };
    if (raw.includes('tax') || raw.includes('tds')) return { main: 'Finance', sub: 'Tax Payment' };
    if (raw.includes('lic') || raw.includes('insurance')) return { main: 'Finance', sub: 'Insurance Premium' };
    if (raw.includes('hospital') || raw.includes('clinic') || raw.includes('pharmacy') || raw.includes('apollo') || raw.includes('medical')) return { main: 'Health', sub: 'Medical' };

    return { main: 'Miscellaneous', sub: 'Other' };
}

function processExcel() {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let processing = false;
    let newTransactions = [];
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.length === 0) continue;
        
        if (row.includes('S No.') && row.includes('Transaction Date')) {
            processing = true;
            continue; 
        }
        
        if (processing) {
            if (row[0] && typeof row[0] === 'string' && row[0].includes('Opening Balance')) break;
            if (row[1] && String(row[1]).includes('Page Total')) continue;
            
            const dateStr = row[3];
            const remarks = row[5];
            
            if (!dateStr || !remarks) continue;
            
            const debitStr = row[6] ? String(row[6]).replace(/,/g, '') : '0';
            const creditStr = row[7] ? String(row[7]).replace(/,/g, '') : '0';
            
            const debit = parseFloat(debitStr) || 0;
            const credit = parseFloat(creditStr) || 0;
            
            if (debit === 0 && credit === 0) continue;
            
            const isCredit = credit > 0;
            const amount = isCredit ? credit : debit;
            
            let title = remarks.split('/')[2] || remarks;
            if (title.length > 30) title = title.substring(0, 30) + '...';
            title = title.replace(/,/g, ' ').trim();
            
            // 1. Check custom dynamic rules first
            let cat = categoryRules[title];
            
            // 2. If no custom rule, use heuristic fallback
            if (!cat) {
                cat = guessCategory(remarks, isCredit);
                // We learn it immediately as a rule to speed up future runs if it's confident
                if (cat.main !== 'Miscellaneous') {
                    categoryRules[title] = cat;
                }
            }
            
            // Parse date DD/MM/YYYY to YYYY-MM-DD
            const dp = dateStr.split('/');
            if (dp.length !== 3) continue;
            const isoDate = `${dp[2]}-${String(parseInt(dp[1], 10)).padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
            
            const deductFromSalary = !isCredit && !cat.sub.toLowerCase().includes('tax');
            
            newTransactions.push({
                id: `import_${Date.now()}_${i}`,
                title: title,
                amount: amount,
                category: cat.sub.toLowerCase(),
                date: isoDate,
                paymentMode: "direct",
                creditCardName: null,
                isCredited: isCredit,
                transactionType: isCredit ? 'credit' : 'debit',
                deductFromSalary: deductFromSalary,
                mainCategory: cat.main,
                type: "monthly"
            });
        }
    }
    
    // Save updated rules back to file for next time
    fs.writeFileSync(rulesPath, JSON.stringify(categoryRules, null, 2));
    return newTransactions;
}

const newTxs = processExcel();

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let added = 0;

newTxs.forEach(tx => {
    const d = new Date(tx.date);
    const yearStr = String(d.getFullYear());
    const monthName = MONTH_NAMES[d.getMonth()];
    
    if (!db.expenses[yearStr]) db.expenses[yearStr] = {};
    if (!db.expenses[yearStr][monthName]) db.expenses[yearStr][monthName] = { transactions: [] };
    if (!db.expenses[yearStr][monthName].transactions) db.expenses[yearStr][monthName].transactions = [];
    
    const exists = db.expenses[yearStr][monthName].transactions.find(
        t => t.date === tx.date && t.amount === tx.amount && t.title === tx.title
    );
    
    if (!exists) {
        db.expenses[yearStr][monthName].transactions.push(tx);
        added++;
    }
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log(`Successfully parsed Excel and added ${added} new unique transactions into db.json`);
console.log(`Knowledge base now has ${Object.keys(categoryRules).length} active categorization rules.`);
