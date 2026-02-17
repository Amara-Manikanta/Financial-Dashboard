const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let updatedCount = 0;
let billPaymentFound = false;

// Update expenses transactions
if (db.expenses) {
    Object.keys(db.expenses).forEach(year => {
        Object.keys(db.expenses[year]).forEach(month => {
            const expenseMonth = db.expenses[year][month];
            if (expenseMonth && expenseMonth.transactions) {
                expenseMonth.transactions.forEach(tx => {
                    // Update Scapia Name
                    if (tx.creditCardName === 'Scapia') {
                        tx.creditCardName = 'Scapia Credit Card';
                        updatedCount++;
                    }

                    // Fix Bill Payment Transaction
                    if (tx.id === '1770631728033') {
                        console.log('Found Bill Payment Transaction:', tx);
                        tx.isCredited = true;
                        tx.transactionType = 'credit';
                        tx.deductFromSalary = false; // Treat as credit/refund to card balance
                        billPaymentFound = true;
                    }
                });
            }
        });
    });
}

// Ensure Credit Cards are consistent
if (db.creditCards) {
    db.creditCards.forEach(card => {
        if (card.name === 'Scapia') {
            card.name = 'Scapia Credit Card';
        }
    });
}

if (updatedCount > 0 || billPaymentFound) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`Updated ${updatedCount} transactions.`);
    if (billPaymentFound) console.log('Bill Payment transaction updated to Credited.');
} else {
    console.log('No changes needed.');
}
