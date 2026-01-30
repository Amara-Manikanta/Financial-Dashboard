const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const sliceAccount = db.savings.find(acc => acc.title === 'Slice Account');

if (!sliceAccount) {
    console.log("Slice Account not found!");
    process.exit(1);
}

const interestTx = sliceAccount.transactions.filter(t => t.type === 'interest');

const dateMap = {};
const duplicates = [];

interestTx.forEach(tx => {
    if (dateMap[tx.date]) {
        duplicates.push({
            date: tx.date,
            first: dateMap[tx.date],
            second: tx
        });
    } else {
        dateMap[tx.date] = tx;
    }
});

if (duplicates.length > 0) {
    console.log("Found duplicate interest entries:");
    duplicates.forEach(d => {
        console.log(`Date: ${d.date}`);
        console.log(`  - Amount: ${d.first.amount} (ID: ${d.first.id})`);
        console.log(`  - Amount: ${d.second.amount} (ID: ${d.second.id})`);
    });
} else {
    console.log("No duplicate interest entries found.");
}

const totalInterest = interestTx.reduce((sum, t) => sum + Number(t.amount), 0);
console.log(`Total Interest in JSON: ${totalInterest.toFixed(2)}`);
