const fs = require('fs');

const rawData = `26-Sep-25 | District Movie Ticket | ₹1,064.28 | Category: Entertainment - Movies
28-Sep-25 | Bill Payment | +₹2,000.00 | Category: Credit Card Payment
28-Sep-25 | Tipsy Topsy Wear Kakinada | ₹3,999.00 | Category: Shopping - Clothing
29-Sep-25 | Travel on Scapia | ₹605.16 | Category: Travel Booking
30-Sep-25 | Bill Payment | +₹10,862.52 | Category: Credit Card Payment
30-Sep-25 | Zomato | ₹2,152.14 | Category: Food Delivery
30-Sep-25 | Zomato | ₹347.60 | Category: Food Delivery
01-Oct-25 | Bill Payment | +₹2,499.00 | Category: Credit Card Payment
01-Oct-25 | Memories Gift And Toy Shop | ₹2,500.00 | Category: Shopping - Gifts/Toys
01-Oct-25 | Bill Payment | +₹2,500.00 | Category: Credit Card Payment
01-Oct-25 | Manmadhaa Krishna | ₹549.00 | Category: Local Merchant
01-Oct-25 | Taco Bell | ₹135.00 | Category: Food - Fast Food
02-Oct-25 | Chandavat Bhanu | ₹10.00 | Category: Personal Transfer/UPI
03-Oct-25 | Bill Payment | +₹700.00 | Category: Credit Card Payment
05-Oct-25 | Blinkit | ₹2,301.00 | Category: Grocery / Quick Commerce
06-Oct-25 | Netflix | ₹499.00 | Category: Subscription - OTT
08-Oct-25 | Blinkit | ₹393.00 | Category: Grocery / Quick Commerce
08-Oct-25 | Bill Payment | +₹393.00 | Category: Credit Card Payment
08-Oct-25 | Bill Payment | +₹499.00 | Category: Credit Card Payment
08-Oct-25 | Make My Trip | ₹1,028.00 | Category: Travel Booking
08-Oct-25 | Bill Payment | +₹1,028.00 | Category: Credit Card Payment
10-Oct-25 | Hungerbox | ₹90.00 | Category: Food / Cafeteria
10-Oct-25 | Infinite Enterprises | ₹356.47 | Category: Local Merchant
10-Oct-25 | Bill Payment | +₹357.00 | Category: Credit Card Payment
11-Oct-25 | Infinite Enterprises | ₹4.20 | Category: Small Merchant Purchase
11-Oct-25 | District Movie Ticket Gurugram | ₹570.80 | Category: Entertainment - Movies
11-Oct-25 | Kpn Ff 3017 Hongasandra Bengaluru | ₹174.58 | Category: Transport / Local Merchant
11-Oct-25 | Zomato | ₹162.80 | Category: Food Delivery
13-Oct-25 | Airtel | ₹1,766.46 | Category: Utility - Mobile/Internet Bill
13-Oct-25 | Bill Payment | +₹1,766.00 | Category: Credit Card Payment
13-Oct-25 | Fuel Surcharge Waiver | +₹4.20 | Category: Refund / Cashback
17-Oct-25 | Swiggy | ₹1,725.00 | Category: Food Delivery
17-Oct-25 | Jio | ₹824.82 | Category: Utility - Mobile Recharge/Bill
18-Oct-25 | Bill Payment | +₹12.00 | Category: Credit Card Payment
24-Oct-25 | Bill Payment | +₹4,516.00 | Category: Credit Card Payment`;

const API_URL = 'http://127.0.0.1:3000';
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function run() {
    console.log("Fetching expenses...");
    const res = await fetch(`${API_URL}/expenses`);
    const expenses = await res.json();
    
    const lines = rawData.split('\n').filter(l => l.trim().length > 0);
    
    let addedCount = 0;
    
    lines.forEach((line, i) => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 4) return;
        
        const dateStr = parts[0]; 
        const dparts = dateStr.split('-'); 
        const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
        const monthNum = monthMap[dparts[1].toLowerCase()];
        const isoDate = `20${dparts[2]}-${monthNum}-${dparts[0].padStart(2, '0')}`;
        
        const title = parts[1];
        
        const amtStr = parts[2];
        const isCredited = amtStr.includes('+');
        const amount = parseFloat(amtStr.replace(/[^\d.]/g, ''));
        
        const rawCat = parts[3].replace('Category:', '').trim();
        const mainCat = 'Others';
        const subCat = rawCat;
        
        let txCategory = subCat.toLowerCase();
        if (title.toLowerCase().includes('bill payment')) {
            txCategory = 'credit card bill';
        }
        
        const tx = {
            id: `import_${Date.now()}_scapia_6_${i}`,
            date: isoDate,
            title: title,
            amount: amount,
            category: txCategory,
            mainCategory: mainCat,
            isCredited: isCredited,
            paymentMode: 'credit_card',
            creditCardName: 'Scapia Credit Card',
            transactionType: isCredited ? 'credit' : 'debit',
            type: 'monthly',
            deductFromSalary: true
        };
        
        const d = new Date(isoDate);
        const yearStr = String(d.getFullYear());
        const monthName = MONTH_NAMES[d.getMonth()];
        
        if (!expenses[yearStr]) expenses[yearStr] = {};
        if (!expenses[yearStr][monthName]) expenses[yearStr][monthName] = { transactions: [], categories: {} };
        if (!expenses[yearStr][monthName].transactions) expenses[yearStr][monthName].transactions = [];
        
        const exists = expenses[yearStr][monthName].transactions.find(
            t => t.date === tx.date && t.amount === tx.amount && t.title === tx.title
        );
        
        if (!exists) {
            expenses[yearStr][monthName].transactions.push(tx);
            addedCount++;
        }
    });
    
    Object.keys(expenses).forEach(year => {
        Object.keys(expenses[year]).forEach(month => {
            const monthData = expenses[year][month];
            if (monthData.transactions && monthData.transactions.length > 0) {
                const newCategories = {};
                monthData.transactions.forEach(t => {
                    if (t.deductFromSalary === false) return;
                    const cat = t.category || 'others';
                    const amt = Number(t.amount) || 0;
                    const isIncome = t.mainCategory === 'Income' ||
                        ['salary received', 'income', 'salary', 'bonus', 'interest income', 'dividend', 'refund'].includes(cat.toLowerCase()) || t.isCredited;
                    const effective = isIncome
                        ? (t.isCredited ? amt : -amt)
                        : (t.isCredited ? -amt : amt);
                    newCategories[cat] = (newCategories[cat] || 0) + effective;
                });
                Object.keys(newCategories).forEach(k => {
                    if (newCategories[k] <= 0) delete newCategories[k];
                });
                monthData.categories = newCategories;
            }
        });
    });
    
    console.log(`Added ${addedCount} new transactions. Saving...`);
    const putRes = await fetch(`${API_URL}/expenses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenses)
    });
    
    if (putRes.ok) {
        console.log("Successfully saved to database!");
    } else {
        console.error("Failed to save:", putRes.statusText);
    }
}

run();
