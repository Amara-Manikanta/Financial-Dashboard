const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

Object.keys(db.expenses).forEach(year => {
    Object.keys(db.expenses[year]).forEach(month => {
        if (db.expenses[year][month].transactions) {
            db.expenses[year][month].transactions.forEach(tx => {
                if (tx.amount === 2000 && tx.category === "food wallet" && tx.paymentMode === "direct") {
                    tx.paymentMode = "credit_card";
                    tx.creditCardName = "Sodexo Pluxe Card";
                    tx.deductFromSalary = false;
                    console.log(`Fixed transaction: ${tx.id} on ${tx.date}`);
                }
            });
        }
    });
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Done");
