const fs = require('fs');
const path = 'db.json';

try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    let updatedCount = 0;
    
    if (data.expenses) {
        for (const year in data.expenses) {
            for (const month in data.expenses[year]) {
                const monthData = data.expenses[year][month];
                if (monthData && monthData.transactions && Array.isArray(monthData.transactions)) {
                    for (const tx of monthData.transactions) {
                        if (tx.title && tx.title.toLowerCase().includes('kpn ff')) {
                            const oldCat = tx.category || 'fuel';
                            const newCat = 'groceries';
                            const newMain = 'Essentials';
                            
                            if (tx.category !== newCat) {
                                tx.mainCategory = newMain;
                                tx.category = newCat;
                                
                                // Also fix up the category totals if possible
                                if (monthData.categories) {
                                    const amount = Number(tx.amount) || 0;
                                    
                                    // Remove from old category
                                    if (monthData.categories[oldCat] !== undefined) {
                                        monthData.categories[oldCat] = Math.max(0, monthData.categories[oldCat] - amount);
                                    }
                                    
                                    // Add to new category
                                    monthData.categories[newCat] = (monthData.categories[newCat] || 0) + amount;
                                }
                                updatedCount++;
                            }
                        }
                    }
                }
            }
        }
    }
    
    if (updatedCount > 0) {
        fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Successfully updated ${updatedCount} KPN FF transactions to groceries.`);
    } else {
        console.log("No KPN FF transactions needed updating.");
    }
} catch (err) {
    console.error("Error:", err);
}
