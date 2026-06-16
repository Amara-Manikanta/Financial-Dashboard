const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

Object.keys(db.expenses || {}).forEach(year => {
    Object.keys(db.expenses[year] || {}).forEach(month => {
        const monthData = db.expenses[year][month];
        if (monthData.transactions && monthData.transactions.length > 0) {
            const newCategories = {};
            monthData.transactions.forEach(t => {
                const cat = t.category || 'others';
                newCategories[cat] = (newCategories[cat] || 0) + t.amount;
            });
            monthData.categories = newCategories;
        }
    });
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Database categories rebuilt successfully!");
