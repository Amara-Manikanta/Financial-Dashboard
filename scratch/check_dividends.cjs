const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const stockMarket = db.savings.find(s => s.type === 'stock_market');
if (stockMarket && stockMarket.stocks) {
    const active = stockMarket.stocks.filter(s => s.shares > 0);
    console.log(`Dividend details for active stocks:`);
    active.forEach(s => {
        const div = s.dividends || {};
        const total = Object.values(div).reduce((a, b) => a + Number(b), 0);
        console.log(` - ${s.ticker}: ${total}`);
    });
}
