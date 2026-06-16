const fs = require('fs');

const raw = fs.readFileSync('categorized_transactions.csv', 'utf8').split('\n');
const mapping = {};

for (let i = 1; i < raw.length; i++) {
    if (!raw[i].trim()) continue;
    const parts = raw[i].split(',');
    if (parts.length >= 7) {
        const mainCategory = parts[3].trim();
        const subCategory = parts[4].trim();
        const title = parts[5].trim();
        
        if (mainCategory !== 'Miscellaneous' || subCategory !== 'Other') {
            if (!mapping[title]) {
                mapping[title] = { main: mainCategory, sub: subCategory };
            }
        }
    }
}

fs.writeFileSync('category_rules.json', JSON.stringify(mapping, null, 2));
console.log(`Saved ${Object.keys(mapping).length} rules to category_rules.json`);
