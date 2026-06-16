const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

db.creditCards.forEach(card => {
    if (card.name === "Sodexo Pluxe Card" && card.autoCredit) {
        card.autoCredit.startYear = 2024;
        card.autoCredit.startMonth = 11;
    }
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Done");
