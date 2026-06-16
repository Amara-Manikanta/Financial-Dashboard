const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
let migratedCount = 0;

Object.keys(db.expenses || {}).forEach(year => {
    Object.keys(db.expenses[year] || {}).forEach(month => {
        const monthData = db.expenses[year][month];
        if (!monthData.categories) {
            monthData.categories = {};
        }

        Object.keys(monthData).forEach(key => {
            // Ignore reserved keys
            if (key === 'transactions' || key === 'categories') return;
            
            // If the value is a number, it's a legacy category total!
            if (typeof monthData[key] === 'number') {
                const lowerKey = key.toLowerCase();
                // Merge it into categories, but prefer the transaction-derived sum if it already exists, 
                // OR add it if it's missing. Wait! If my script already rebuilt categories from transactions,
                // the transaction sum is the "true" sum of transactions. But manual legacy entries didn't have transactions!
                // So if it's a manual entry, we should definitely include it!
                // Actually, if they had both, the manual root entry was their overall "sum".
                // Let's just add it to categories if it's not already in categories. 
                // Or wait, if we rebuilt from transactions, we wiped out their manual "sum".
                // The root `monthData[key]` was their intended sum. We should prioritize it!
                // Actually, it's safer to just set categories[lowerKey] to the root value if the root value is larger, 
                // or just take the root value. Since my scripts messed up the manually entered totals by rebuilding from transactions,
                // restoring the root values into the `categories` object will restore their intended manual totals!
                
                // Let's just restore the root value into categories.
                // If categories already has it (from transactions), the root value was usually the old truth.
                // Wait! For imported months, the transaction sum is the truth! But for imported months, the root values might be old manual placeholders.
                // But wait! Imported months didn't have root values usually, except the placeholder salaries which we just deleted!
                // Wait, if it's a manual month like 2025, the root value is the TRUTH.
                // So let's take the MAX of the root value and the current category value.
                
                const existingVal = monthData.categories[lowerKey] || 0;
                monthData.categories[lowerKey] = Math.max(existingVal, monthData[key]);
                
                // Then delete the root value
                delete monthData[key];
                migratedCount++;
            }
        });
    });
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log(`Migrated ${migratedCount} root categories!`);
