const fs = require('fs');

const raw = fs.readFileSync('categorized_transactions.csv', 'utf8').split('\n');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

let addedCount = 0;

for (let i = 1; i < raw.length; i++) {
    if (!raw[i].trim()) continue;
    const parts = raw[i].split(',');
    if (parts.length >= 7) {
        // Date is DD/MM/YYYY
        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) continue;
        
        const day = dateParts[0].padStart(2, '0');
        const month = parseInt(dateParts[1], 10);
        const yearStr = dateParts[2];
        const monthName = MONTH_NAMES[month - 1];
        
        const dateIso = `${yearStr}-${String(month).padStart(2, '0')}-${day}`;
        
        const amount = parseFloat(parts[1]) || 0;
        const type = parts[2];
        const isCredit = type === 'Credit';
        const mainCategory = parts[3].trim();
        const subCategory = parts[4].trim();
        const title = parts[5].trim();
        
        const deductFromSalary = !isCredit && !subCategory.toLowerCase().includes('tax');
        
        const tx = {
            id: `import_${Date.now()}_${i}`,
            title: title,
            amount: amount,
            category: subCategory.toLowerCase(),
            date: dateIso,
            paymentMode: "direct",
            creditCardName: null,
            isCredited: isCredit,
            transactionType: isCredit ? 'credit' : 'debit',
            deductFromSalary: deductFromSalary,
            mainCategory: mainCategory,
            type: "monthly"
        };
        
        if (!db.expenses[yearStr]) db.expenses[yearStr] = {};
        if (!db.expenses[yearStr][monthName]) {
            db.expenses[yearStr][monthName] = { transactions: [] };
        }
        if (!db.expenses[yearStr][monthName].transactions) {
            db.expenses[yearStr][monthName].transactions = [];
        }
        
        // Prevent duplicates (simple heuristic: same date, amount, and title)
        const exists = db.expenses[yearStr][monthName].transactions.find(
            t => t.date === dateIso && t.amount === amount && t.title === title
        );
        
        if (!exists) {
            db.expenses[yearStr][monthName].transactions.push(tx);
            addedCount++;
        }
    }
}

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log(`Successfully merged ${addedCount} transactions into db.json`);
