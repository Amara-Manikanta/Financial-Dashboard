const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

let deletedCount = 0;

Object.keys(db.expenses || {}).forEach(year => {
    Object.keys(db.expenses[year] || {}).forEach(month => {
        const monthData = db.expenses[year][month];
        if (!monthData.transactions) return;
        
        const manualSalaries = monthData.transactions.filter(t => t.category === 'salary received' && !String(t.id).startsWith('import_'));
        const importedSalaries = monthData.transactions.filter(t => t.category === 'salary received' && String(t.id).startsWith('import_'));
        
        manualSalaries.forEach(manual => {
            // Find an imported salary with the exact same amount in the same month
            const isDuplicate = importedSalaries.some(imp => Math.abs(imp.amount - manual.amount) < 1);
            if (isDuplicate) {
                console.log(`Deleting duplicate manual salary for ${month} ${year}: ${manual.amount}`);
                monthData.transactions = monthData.transactions.filter(t => t.id !== manual.id);
                deletedCount++;
            }
        });

        // Recalculate totals for the month to be safe
        if (monthData.transactions.length > 0) {
            const newCategories = {};
            monthData.transactions.forEach(t => {
                if (t.deductFromSalary !== false) {
                    const cat = t.category || 'others';
                    newCategories[cat] = (newCategories[cat] || 0) + t.amount;
                }
            });
            monthData.categories = newCategories;
        }
    });
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log(`Deleted ${deletedCount} duplicate manual salaries and recalculated totals!`);
