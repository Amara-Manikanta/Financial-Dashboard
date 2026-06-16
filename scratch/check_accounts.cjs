const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const stockMarkets = db.savings.filter(s => s.type === 'stock_market');
console.log(`Found ${stockMarkets.length} stock market accounts.`);
stockMarkets.forEach(m => {
    console.log(`Account: ${m.title} (ID: ${m.id})`);
    const active = m.stocks.filter(s => s.shares > 0);
    console.log(` - Active stocks: ${active.length}`);
});
