const fs = require('fs');

const raw = fs.readFileSync('categorized_transactions.csv', 'utf8').split('\n');
const headers = raw[0].split(',');

const transactions = [];

for (let i = 1; i < raw.length; i++) {
    if (!raw[i].trim()) continue;
    // Split by comma but handle cases carefully. Since we didn't quote in our previous generation, it's just basic split.
    const parts = raw[i].split(',');
    if (parts.length >= 7) {
        transactions.push({
            date: parts[0],
            amount: parts[1],
            type: parts[2],
            mainCategory: parts[3].trim(),
            subCategory: parts[4].trim(),
            title: parts[5].trim(),
            originalRemarks: parts.slice(6).join(',')
        });
    }
}

// Build mapping
const mapping = {};
transactions.forEach(t => {
    // If the user modified it away from the default, or if it has a specific subCategory, learn it!
    if (t.mainCategory !== 'Miscellaneous' || t.subCategory !== 'Other') {
        if (!mapping[t.title]) {
            mapping[t.title] = { main: t.mainCategory, sub: t.subCategory };
        }
    }
});

let updatedCount = 0;

// Apply mapping
transactions.forEach(t => {
    if (t.mainCategory === 'Miscellaneous' && t.subCategory === 'Other') {
        if (mapping[t.title]) {
            t.mainCategory = mapping[t.title].main;
            t.subCategory = mapping[t.title].sub;
            updatedCount++;
        }
    }
});

// Write it back
let csv = "Date,Amount,Type,Main Category,Sub Category,Generated Title,Original Description\n";
transactions.forEach(t => {
    csv += `${t.date},${t.amount},${t.type},${t.mainCategory},${t.subCategory},${t.title},${t.originalRemarks}\n`;
});

fs.writeFileSync('categorized_transactions.csv', csv);
console.log(`Learned ${Object.keys(mapping).length} title mappings.`);
console.log(`Auto-categorized ${updatedCount} transactions based on your manual edits!`);
