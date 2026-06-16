const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

Object.keys(db.expenses || {}).forEach(year => {
    Object.keys(db.expenses[year] || {}).forEach(month => {
        const monthData = db.expenses[year][month];
        if (!monthData.transactions) return;
        
        const salaries = monthData.transactions.filter(t => t.category === 'salary received');
        if (salaries.length > 1) {
            console.log(`\nDuplicate salaries in ${month} ${year}:`);
            salaries.forEach(s => console.log(` - ID: ${s.id}, Date: ${s.date}, Amount: ${s.amount}, Title: "${s.title}"`));
        }
    });
});
