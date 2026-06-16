const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

Object.keys(db.expenses || {}).forEach(year => {
    Object.keys(db.expenses[year] || {}).forEach(month => {
        const monthData = db.expenses[year][month];
        
        // 1. Rename in transactions
        if (monthData.transactions) {
            monthData.transactions.forEach(t => {
                if (t.category === 'salary') {
                    t.category = 'salary received';
                }
            });
        }

        // 2. Rename in categories object
        if (monthData.categories && monthData.categories['salary'] !== undefined) {
            monthData.categories['salary received'] = monthData.categories['salary'];
            delete monthData.categories['salary'];
        }
        
        // 3. Just in case, if the old salary was floating around at the root, move it to categories
        if (monthData['salary received'] !== undefined) {
            if (!monthData.categories) monthData.categories = {};
            if (monthData.categories['salary received'] === undefined) {
                 monthData.categories['salary received'] = monthData['salary received'];
            }
        }
    });
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Salaries restored to 'salary received' successfully!");
