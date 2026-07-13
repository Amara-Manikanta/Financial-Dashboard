const fs = require('fs');

const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// 1. Precompute salary for each year/month from salaryDetails
const salaryMap = {};

if (data.salaryDetails) {
    data.salaryDetails.forEach(s => {
        const year = s.year;
        if (!salaryMap[year]) salaryMap[year] = {};
        
        let total = 0;
        // Sum all numerical fields except year, month, type, id
        Object.keys(s).forEach(k => {
            if (!['id', 'year', 'month', 'type'].includes(k)) {
                total += (Number(s[k]) || 0);
            }
        });
        
        if (s.type === 'annual' || s.month.toLowerCase() === 'annual') {
            const monthly = total / 12;
            MONTHS.forEach(m => {
                // Only set if not already set by a specific month (specific overrides annual)
                if (!salaryMap[year][m]) {
                    salaryMap[year][m] = monthly;
                }
            });
        } else {
            salaryMap[year][s.month] = total;
        }
    });
}

// 2. Inject this salary into expenses[year][month].categories['salary received'] IF no manual transactions cover it
let updated = 0;
if (data.expenses) {
    Object.keys(data.expenses).forEach(year => {
        Object.keys(data.expenses[year]).forEach(month => {
            const md = data.expenses[year][month];
            if (!md.categories) md.categories = {};
            
            // Check if there's already an explicit income transaction
            let hasIncomeTx = false;
            if (md.transactions) {
                hasIncomeTx = md.transactions.some(t => ['salary received', 'salary', 'income'].includes((t.category || '').toLowerCase()));
            }
            
            if (!hasIncomeTx && salaryMap[year] && salaryMap[year][month]) {
                const calculatedSalary = salaryMap[year][month];
                md.categories['salary received'] = calculatedSalary;
                updated++;
            }
        });
    });
}

fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
console.log(`Updated ${updated} months with configured base salary.`);
