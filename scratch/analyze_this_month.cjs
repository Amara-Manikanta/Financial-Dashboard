const fs = require('fs');

const dbPath = '/Users/manikantaamara/Desktop/Antigravity/Finance_Analyser/db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let expenses = db.expenses['2026'];

console.log("Analyzing 2026 Monthly Expenses strictly using ExpenseDetails.jsx logic...");

Object.entries(expenses || {}).forEach(([month, monthData]) => {
    let totalNetExpenses = 0;
    let totalGrossExpenses = 0;
    
    let categoryDeductibles = {};
    const activeTransactions = monthData.transactions || [];
    
    activeTransactions.forEach(t => {
        const cat = (t.category || 'others').toLowerCase();
        
        // Skip income categories
        if (['salary received', 'salary', 'income'].includes(cat)) return;
        
        const amt = Number(t.amount) || 0;
        const effective = t.isCredited ? -amt : amt;
        
        totalGrossExpenses += effective;

        if (t.deductFromSalary !== false && !t.isRewardPoints) {
            totalNetExpenses += effective;
            
            const targetKey = t.category || 'others';
            if (!categoryDeductibles[targetKey]) categoryDeductibles[targetKey] = 0;
            categoryDeductibles[targetKey] += effective;
        }
    });

    console.log(`\nMonth: ${month}`);
    console.log(`  - Total Net Expenses (App's main number): ₹${totalNetExpenses.toLocaleString('en-IN')}`);
    console.log(`  - Total Gross Expenses: ₹${totalGrossExpenses.toLocaleString('en-IN')}`);
    
    if (totalNetExpenses > 150000 && totalNetExpenses < 250000) {
        console.log("  Top Categories contributing to Net Expenses:");
        Object.entries(categoryDeductibles)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([cat, amt]) => {
                console.log(`    - ${cat}: ₹${amt.toLocaleString('en-IN')}`);
            });
            
        console.log("  Top 5 Transactions (deductFromSalary !== false):");
        activeTransactions
            .filter(t => {
                const cat = (t.category || 'others').toLowerCase();
                if (['salary received', 'salary', 'income'].includes(cat)) return false;
                if (t.deductFromSalary === false || t.isRewardPoints) return false;
                return true;
            })
            .sort((a, b) => {
                const effB = b.isCredited ? -Number(b.amount) : Number(b.amount);
                const effA = a.isCredited ? -Number(a.amount) : Number(a.amount);
                return effB - effA;
            })
            .slice(0, 10)
            .forEach(t => {
                const effective = t.isCredited ? -Number(t.amount) : Number(t.amount);
                console.log(`    - ${t.date} | ${t.title || t.description?.substring(0,30) || ''} | ${t.category} | ₹${effective.toLocaleString('en-IN')}`);
            });
    }
});
