const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

let modified = false;

Object.keys(db.expenses).forEach(year => {
    Object.keys(db.expenses[year]).forEach(month => {
        if (db.expenses[year][month].transactions) {
            db.expenses[year][month].transactions.forEach(tx => {
                if (tx.id === "1780049857398" && tx.category === "tax payment") {
                    tx.isCredited = false;
                    tx.transactionType = "debit";
                    modified = true;
                    console.log(`Fixed ${tx.id} for ${month} ${year}`);
                }
            });
        }
    });
});

if (modified) {
    fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
    console.log("Database updated successfully.");
} else {
    console.log("Transaction not found.");
}
