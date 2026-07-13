const fs = require('fs');

const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));

let updated = 0;
if (data.expenses) {
    Object.keys(data.expenses).forEach(year => {
        Object.keys(data.expenses[year]).forEach(month => {
            const md = data.expenses[year][month];
            if (md.transactions) {
                md.transactions.forEach(t => {
                    if (t.paymentMode === 'credit_card' && t.creditCardName === 'Scapia') {
                        t.creditCardName = 'Scapia Credit Card';
                        updated++;
                    }
                });
            }
        });
    });
}

fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
console.log(`Updated ${updated} transactions to Scapia Credit Card`);
