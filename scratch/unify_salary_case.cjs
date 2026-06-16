const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

Object.keys(db.expenses || {}).forEach(year => {
    Object.keys(db.expenses[year] || {}).forEach(month => {
        const monthData = db.expenses[year][month];
        
        let needsRecalc = false;

        // 1. Rename in transactions
        if (monthData.transactions) {
            monthData.transactions.forEach(t => {
                if (t.category && t.category.toLowerCase() === 'salary') {
                    t.category = 'salary received';
                }
            });
        }

        // 2. Rename in categories object
        if (monthData.categories) {
            const keys = Object.keys(monthData.categories);
            keys.forEach(k => {
                if (k.toLowerCase() === 'salary') {
                    monthData.categories['salary received'] = (monthData.categories['salary received'] || 0) + monthData.categories[k];
                    delete monthData.categories[k];
                }
            });
        }
        
        // 3. Rename in root if any
        const rootKeys = Object.keys(monthData);
        rootKeys.forEach(k => {
            if (k.toLowerCase() === 'salary') {
                if (!monthData.categories) monthData.categories = {};
                monthData.categories['salary received'] = (monthData.categories['salary received'] || 0) + monthData[k];
                delete monthData[k];
            }
        });
    });
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Unified all salary cases to 'salary received'!");
