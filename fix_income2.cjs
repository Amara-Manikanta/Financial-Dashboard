const fs = require('fs');
const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));
let foundIn2025 = false;
let foundCats = false;
if (data.expenses["2025"]) {
    Object.keys(data.expenses["2025"]).forEach(month => {
        const md = data.expenses["2025"][month];
        if (md.transactions) {
            md.transactions.forEach(t => {
                if (['salary received', 'income', 'salary'].includes((t.category || '').toLowerCase())) {
                    console.log(`2025 ${month} has transaction:`, t.title, t.amount);
                    foundIn2025 = true;
                }
            });
        }
        if (md.categories) {
             Object.keys(md.categories).forEach(cat => {
                 if (['salary received', 'income', 'salary'].includes(cat.toLowerCase())) {
                     console.log(`2025 ${month} has category:`, cat, md.categories[cat]);
                     foundCats = true;
                 }
             });
        }
    });
}
console.log("Found in tx:", foundIn2025);
console.log("Found in cats:", foundCats);
