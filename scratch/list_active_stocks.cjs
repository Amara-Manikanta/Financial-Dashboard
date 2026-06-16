const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const stockMarket = db.savings.find(s => s.type === 'stock_market');
if (stockMarket && stockMarket.stocks) {
    const active = stockMarket.stocks.filter(s => s.shares > 0);
    console.log(`Active stocks (${active.length}):`);
    active.forEach(s => {
        const val = s.shares * (s.currentPrice || 0);
        console.log(` - ${s.ticker}: ${s.name} (Value: ${val})`);
    });
}
