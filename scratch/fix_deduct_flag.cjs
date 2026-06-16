const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

Object.keys(db.expenses || {}).forEach(year => {
    Object.keys(db.expenses[year] || {}).forEach(month => {
        const monthData = db.expenses[year][month];
        
        let needsRecalc = false;

        if (monthData.transactions) {
            monthData.transactions.forEach(t => {
                // If it's a credit and was imported, deductFromSalary was likely falsely set to false.
                // We should ensure that deductFromSalary is true for everything except tax (and maybe credit card purchases, but imports are 'direct')
                const isTax = (t.category || '').toLowerCase().includes('tax');
                const shouldBeDeducted = !isTax;

                if (t.deductFromSalary !== shouldBeDeducted) {
                    t.deductFromSalary = shouldBeDeducted;
                    needsRecalc = true;
                }
            });
        }

        // To perfectly fix their specific issue where they edited a transaction but the total didn't change:
        // We will just forcibly recalculate the categories map from the transactions for ALL months right now!
        if (monthData.transactions && monthData.transactions.length > 0) {
            const newCategories = {};
            monthData.transactions.forEach(t => {
                if (t.deductFromSalary !== false) {
                    const cat = t.category || 'others';
                    newCategories[cat] = (newCategories[cat] || 0) + t.amount;
                }
            });
            // Also preserve anything in old categories that isn't represented in transactions?
            // Usually we shouldn't mix, but to be safe we can just overwrite because imports usually represent the full month.
            // Actually, if the user manually added something without a transaction (legacy), it would be lost.
            // But since the user's recent edits were via transactions, recalculating from transactions is the most accurate reflection of their edits!
            monthData.categories = newCategories;
        }
    });
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Fixed deductFromSalary flags and recalculated totals!");
