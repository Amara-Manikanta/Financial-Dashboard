const fs = require('fs');

const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));

// Let's inspect the first transaction in 2025 that is an income
let found = false;
Object.keys(data.expenses).forEach(year => {
    Object.keys(data.expenses[year]).forEach(month => {
        const monthData = data.expenses[year][month];
        if (monthData.transactions) {
            monthData.transactions.forEach(t => {
                if (['salary received', 'income'].includes((t.category || '').toLowerCase())) {
                    if (!found) {
                        console.log("Found income transaction:", t);
                        found = true;
                    }
                }
            });
        }
    });
});
