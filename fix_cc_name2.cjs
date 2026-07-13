const fs = require('fs');

const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));

if (data.expenses["2025"]) {
    Object.keys(data.expenses["2025"]).forEach(month => {
        const md = data.expenses["2025"][month];
        if (md.transactions) {
            md.transactions.forEach(t => {
                if (t.paymentMode === 'credit_card' && t.creditCardName) {
                    console.log(t.creditCardName);
                }
            });
        }
    });
}
