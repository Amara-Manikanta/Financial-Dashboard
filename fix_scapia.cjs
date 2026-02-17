const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let updatedCount = 0;

// Update expenses transactions
if (db.expenses) {
    Object.keys(db.expenses).forEach(year => {
        Object.keys(db.expenses[year]).forEach(month => {
            const expenseMonth = db.expenses[year][month];
            if (expenseMonth && expenseMonth.transactions) {
                expenseMonth.transactions.forEach(tx => {
                    if (tx.creditCardName === 'Scapia') {
                        tx.creditCardName = 'Scapia Credit Card';
                        updatedCount++;
                    }
                });
            }
        });
    });
}

// Update creditCards array if needed
if (db.creditCards) {
    db.creditCards.forEach(card => {
        if (card.name === 'Scapia') {
            card.name = 'Scapia Credit Card';
            // If there's already a "Scapia Credit Card" entry, merging might be needed but simple renaming is a start.
            // Since grep only showed "Scapia Credit Card" in definitions, this block might not run, but safe to have.
        }
    });
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log(`Updated ${updatedCount} transactions.`);
