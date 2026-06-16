const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

const stockMarket = db.savings.find(s => s.type === 'stock_market');
if (stockMarket && stockMarket.stocks) {
    console.log(`Total stocks: ${stockMarket.stocks.length}`);
    const active = stockMarket.stocks.filter(s => s.shares > 0);
    console.log(`Active stocks: ${active.length}`);
    
    const missingValue = active.filter(s => !(s.currentPrice > 0));
    console.log(`Active stocks with 0 or missing currentPrice: ${missingValue.length}`);
    missingValue.forEach(s => console.log(` - ${s.name} (${s.ticker}): price=${s.currentPrice}`));

    const missingDividend = active.filter(s => {
        const div = s.dividends || {};
        const total = Object.values(div).reduce((a, b) => a + Number(b), 0);
        return total === 0;
    });
    console.log(`Active stocks with 0 total dividends: ${missingDividend.length}`);
} else {
    console.log("Stock market not found or no stocks.");
}
