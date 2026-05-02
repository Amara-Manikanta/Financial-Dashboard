const fs = require('fs');

function getCorrectBucket(tx) {
    const dateObj = new Date(tx.date);
    return {
        year: dateObj.getFullYear().toString(),
        month: dateObj.toLocaleString('default', { month: 'long' })
    };
}

const rawData = fs.readFileSync('db.json', 'utf8');
const data = JSON.parse(rawData);

let movedCount = 0;
const moves = [];

for (const year of Object.keys(data.expenses)) {
    for (const month of Object.keys(data.expenses[year])) {
        const monthData = data.expenses[year][month];
        if (!monthData.transactions) continue;
        
        for (let i = monthData.transactions.length - 1; i >= 0; i--) {
            const tx = monthData.transactions[i];
            const correct = getCorrectBucket(tx);
            if (correct.year !== year || correct.month !== month) {
                moves.push({
                    tx,
                    oldYear: year,
                    oldMonth: month,
                    newYear: correct.year,
                    newMonth: correct.month,
                    index: i
                });
            }
        }
    }
}

console.log(`Found ${moves.length} transactions to move.`);

for (const move of moves) {
    const { tx, oldYear, oldMonth, newYear, newMonth } = move;
    
    // 1. Remove from old
    const oldMonthData = data.expenses[oldYear][oldMonth];
    const txIndex = oldMonthData.transactions.findIndex(t => t.id === tx.id);
    if (txIndex !== -1) oldMonthData.transactions.splice(txIndex, 1);
    
    const oldTarget = oldMonthData.categories || oldMonthData;
    const oldCatKey = Object.keys(oldTarget).find(k => k.toLowerCase() === tx.category.toLowerCase());
    
    if (oldCatKey && tx.deductFromSalary !== false) {
        const isIncome = ['salary received', 'income'].includes(oldCatKey.toLowerCase());
        const oldEffective = isIncome
            ? (tx.isCredited ? tx.amount : -tx.amount)
            : (tx.isCredited ? -tx.amount : tx.amount);
        
        oldTarget[oldCatKey] = Math.max(0, (oldTarget[oldCatKey] || 0) - oldEffective);
    }
    
    // 2. Add to new
    if (!data.expenses[newYear]) data.expenses[newYear] = {};
    if (!data.expenses[newYear][newMonth]) data.expenses[newYear][newMonth] = { categories: {}, transactions: [] };
    
    const newMonthData = data.expenses[newYear][newMonth];
    const newTarget = newMonthData.categories || newMonthData;
    
    const newCatKey = Object.keys(newTarget).find(k => k.toLowerCase() === tx.category.toLowerCase()) || tx.category;
    const isIncome = ['salary received', 'income'].includes(newCatKey.toLowerCase());
    const newEffective = isIncome
        ? (tx.isCredited ? tx.amount : -tx.amount)
        : (tx.isCredited ? -tx.amount : tx.amount);

    if (tx.deductFromSalary !== false) {
        newTarget[newCatKey] = Math.max(0, (newTarget[newCatKey] || 0) + newEffective);
    }
    
    if (!newMonthData.transactions) newMonthData.transactions = [];
    newMonthData.transactions.push(tx);
    
    movedCount++;
}

for (const year of Object.keys(data.expenses)) {
    for (const month of Object.keys(data.expenses[year])) {
        const monthData = data.expenses[year][month];
        if (monthData.transactions) {
            monthData.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        }
    }
}

fs.writeFileSync('db.json', JSON.stringify(data, null, 2), 'utf8');
console.log(`Successfully moved ${movedCount} transactions.`);
