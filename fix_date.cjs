const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const tx = db.expenses["2025"].May.transactions.find(t => t.id === "1781513692679");
if (tx) {
    tx.date = "2025-05-03";
    fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
    console.log("Fixed date to 2025-05-03");
}
