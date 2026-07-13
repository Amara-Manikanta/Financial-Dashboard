const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));
    let modified = false;

    if (data.expenses) {
        Object.keys(data.expenses).forEach(year => {
            Object.keys(data.expenses[year]).forEach(month => {
                const monthData = data.expenses[year][month];
                if (monthData && monthData.transactions) {
                    const newCats = {};
                    monthData.transactions.forEach(tx => {
                        const subCat = (tx.category || '').toLowerCase().trim();
                        if (!subCat) return;

                        const isIncome = ['salary received', 'income', 'salary', 'bonus', 'interest income', 'dividend', 'refund'].includes(subCat) || tx.mainCategory === 'Income';
                        
                        let effectiveAmount = 0;
                        if (isIncome) {
                            effectiveAmount = tx.isCredited ? Number(tx.amount) : -Number(tx.amount);
                        } else {
                            effectiveAmount = tx.isCredited ? -Number(tx.amount) : Number(tx.amount);
                        }

                        if (tx.deductFromSalary !== false) {
                            newCats[subCat] = (newCats[subCat] || 0) + effectiveAmount;
                        }
                    });
                    
                    // Remove negatives
                    for (const k in newCats) {
                        if (newCats[k] < 0) newCats[k] = 0;
                    }

                    // To avoid destroying anything not in transactions (if any), merge with old?
                    // Actually, let's just force "salary received" to match transactions!
                    if (!monthData.categories) monthData.categories = {};
                    
                    if (newCats['salary received'] || newCats['salary']) {
                        monthData.categories['salary received'] = newCats['salary received'] || newCats['salary'] || 0;
                        modified = true;
                    }
                }
            });
        });
    }

    if (modified) {
        fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
        console.log("Successfully rebuilt salary totals in categories.");
    } else {
        console.log("No modifications needed.");
    }
} catch (e) {
    console.error("Error:", e);
}
