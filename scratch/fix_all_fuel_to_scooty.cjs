const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db.json');
let rawData = fs.readFileSync(dbPath, 'utf-8');
let db = JSON.parse(rawData);

let updatedCount = 0;

for (const year in db.expenses) {
    for (const month in db.expenses[year]) {
        if (!db.expenses[year][month].transactions) continue;
        
        db.expenses[year][month].transactions.forEach(tx => {
            if (tx.category === 'fuel' && tx.vehicleType !== 'scooty') {
                tx.vehicleType = 'scooty';
                updatedCount++;
            }
        });
    }
}

if (updatedCount > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`Updated ${updatedCount} fuel transactions to scooty.`);
} else {
    console.log("No transactions needed updating.");
}
