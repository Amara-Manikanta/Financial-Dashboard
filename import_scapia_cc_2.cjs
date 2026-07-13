const fs = require('fs');

const rawData = `24-Jun-25 | Jio | ₹706.82 | Debit | Bills | Mobile Recharge
24-Jun-25 | Bewakoof | ₹764.00 | Debit | Shopping | Clothing
25-Jun-25 | Amazon | ₹24994.00 | Debit | Shopping | Online Shopping
26-Jun-25 | KPN FF | ₹107.00 | Debit | Transport | Fuel
26-Jun-25 | DMart | ₹371.00 | Debit | Groceries | Supermarket
27-Jun-25 | KPN FF | ₹108.50 | Debit | Transport | Fuel
27-Jun-25 | Prathibha T R | ₹10.00 | Debit | Transfers | Person Transfer
28-Jun-25 | Reddyvari Revathi | ₹62.00 | Debit | Transfers | Person Transfer
28-Jun-25 | Girani | ₹132.00 | Debit | Food | Restaurant
28-Jun-25 | Mrs Sarita Agarwal | ₹1250.00 | Debit | Transfers | Person Transfer
28-Jun-25 | Vijaya Productions | ₹40.00 | Debit | Entertainment | Media
29-Jun-25 | Bangalore Metro | ₹200.00 | Debit | Transport | Metro
29-Jun-25 | BMRC Metro | ₹50.00 | Debit | Transport | Metro
29-Jun-25 | PhonePe | ₹1690.11 | Debit | Transfers | Wallet
29-Jun-25 | IKEA | ₹330.00 | Debit | Home | Furniture/Home
29-Jun-25 | IKEA | ₹4930.00 | Debit | Home | Furniture/Home
29-Jun-25 | BMRC Metro | ₹80.00 | Debit | Transport | Metro
29-Jun-25 | Siddaraju | ₹30.00 | Debit | Transfers | Person Transfer
29-Jun-25 | Eversub India | ₹314.00 | Debit | Food | Subscription/Food
30-Jun-25 | Pushpas Fuel Station | ₹303.00 | Debit | Transport | Fuel
30-Jun-25 | Madevi | ₹247.00 | Debit | Transfers | Person Transfer
30-Jun-25 | Reddyvari Revathi | ₹24.00 | Debit | Transfers | Person Transfer
30-Jun-25 | Pachaiyammal | ₹60.00 | Debit | Transfers | Person Transfer
30-Jun-25 | Priya P | ₹20.00 | Debit | Transfers | Person Transfer
01-Jul-25 | IRCTC | ₹2558.61 | Debit | Travel | Train Booking
01-Jul-25 | KPN FF | ₹106.16 | Debit | Transport | Fuel
01-Jul-25 | Prathibha T R | ₹10.00 | Debit | Transfers | Person Transfer
01-Jul-25 | Amazon | ₹2004.00 | Debit | Shopping | Online Shopping
02-Jul-25 | Netflix | ₹499.00 | Debit | Entertainment | Subscription
02-Jul-25 | Reddyvari Revathi | ₹35.00 | Debit | Transfers | Person Transfer
02-Jul-25 | Myntra | ₹707.00 | Debit | Shopping | Fashion
03-Jul-25 | KPN FF | ₹172.09 | Debit | Transport | Fuel
03-Jul-25 | Amazon | ₹4003.00 | Debit | Shopping | Online Shopping
03-Jul-25 | Manickam | ₹170.00 | Debit | Transfers | Person Transfer
03-Jul-25 | Amazon | ₹3903.00 | Debit | Shopping | Online Shopping
05-Jul-25 | Reddyvari Revathi | ₹24.00 | Debit | Transfers | Person Transfer
05-Jul-25 | Amazon | ₹444.00 | Debit | Shopping | Online Shopping
05-Jul-25 | BMRC Metro | ₹50.00 | Debit | Transport | Metro
05-Jul-25 | Eversub India | ₹481.00 | Debit | Food | Subscription/Food
05-Jul-25 | Lulu Mall | ₹172.20 | Debit | Shopping | Mall Purchase
05-Jul-25 | Lulu Mall | ₹5070.00 | Debit | Shopping | Mall Purchase
05-Jul-25 | Lulu Mall | ₹1912.00 | Debit | Shopping | Mall Purchase
05-Jul-25 | BMRC Metro | ₹50.00 | Debit | Transport | Metro
05-Jul-25 | BMRC Metro | ₹50.00 | Debit | Transport | Metro
06-Jul-25 | Prathibha T R | ₹10.00 | Debit | Transfers | Person Transfer
06-Jul-25 | SMVT PF | ₹40.00 | Debit | Travel | Railway
06-Jul-25 | IRCTC Autope | ₹950.16 | Debit | Travel | Train Booking
07-Jul-25 | Travel on Scapia | ₹3400.00 | Debit | Travel | Travel Booking
07-Jul-25 | Gurappa K | ₹20.00 | Debit | Transfers | Person Transfer
08-Jul-25 | N Sirisha | ₹20.00 | Debit | Transfers | Person Transfer
09-Jul-25 | Reddyvari Revathi | ₹107.00 | Debit | Transfers | Person Transfer
09-Jul-25 | Reddyvari Revathi | ₹70.00 | Debit | Transfers | Person Transfer
09-Jul-25 | KPN FF | ₹371.06 | Debit | Transport | Fuel
09-Jul-25 | DMart | ₹245.27 | Debit | Groceries | Supermarket
10-Jul-25 | R K R Enterprises | ₹505.00 | Debit | Misc | Local Purchase
10-Jul-25 | KPN FF | ₹145.75 | Debit | Transport | Fuel
11-Jul-25 | Bowring Service Station | ₹395.71 | Debit | Transport | Fuel
11-Jul-25 | Nidharshana Sarees | ₹7149.00 | Debit | Shopping | Clothing
11-Jul-25 | MakeMyTrip | ₹1109.00 | Debit | Travel | Travel Booking
11-Jul-25 | Travel on Scapia | ₹1122.00 | Debit | Travel | Travel Booking
12-Jul-25 | Amazon | ₹3753.00 | Debit | Shopping | Online Shopping
12-Jul-25 | Starbucks | ₹630.00 | Debit | Food | Cafe
12-Jul-25 | Asia Seven | ₹868.00 | Debit | Food | Restaurant
12-Jul-25 | Mall of Asia | ₹334.94 | Debit | Shopping | Mall Purchase
12-Jul-25 | Veg Land | ₹1166.66 | Debit | Food | Restaurant
13-Jul-25 | Manjunath | ₹60.00 | Debit | Transfers | Person Transfer
13-Jul-25 | DMart | ₹239.47 | Debit | Groceries | Supermarket
13-Jul-25 | Lakshmi Coconut | ₹190.00 | Debit | Food | Grocery/Food
13-Jul-25 | Pachaiyammal | ₹80.00 | Debit | Transfers | Person Transfer
13-Jul-25 | Renuka M | ₹10.00 | Debit | Transfers | Person Transfer
13-Jul-25 | Obireddy Nagi Reddy | ₹60.00 | Debit | Transfers | Person Transfer
13-Jul-25 | Mrs Hajira | ₹15.00 | Debit | Transfers | Person Transfer
13-Jul-25 | BMRC Metro | ₹140.00 | Debit | Transport | Metro
13-Jul-25 | Venkatesh V G | ₹129.00 | Debit | Transfers | Person Transfer
13-Jul-25 | Srivari Bengaluru | ₹269.00 | Debit | Shopping | Local Shopping
13-Jul-25 | Taco Bell | ₹238.00 | Debit | Food | Fast Food
13-Jul-25 | Amazon | ₹4798.00 | Debit | Shopping | Online Shopping
14-Jul-25 | Amazon | ₹8004.00 | Debit | Shopping | Online Shopping
14-Jul-25 | Amazon | ₹1384.00 | Debit | Shopping | Online Shopping
14-Jul-25 | Divya Bharathi | ₹40.00 | Debit | Transfers | Person Transfer
14-Jul-25 | Reddyvari Revathi | ₹56.00 | Debit | Transfers | Person Transfer
14-Jul-25 | Amazon | ₹372.00 | Debit | Shopping | Online Shopping
14-Jul-25 | Amazon | ₹619.00 | Debit | Shopping | Online Shopping
15-Jul-25 | Prathibha T R | ₹10.00 | Debit | Transfers | Person Transfer
15-Jul-25 | Airtel | ₹1766.46 | Debit | Bills | Internet/Mobile
16-Jul-25 | KPN FF | ₹562.35 | Debit | Transport | Fuel
16-Jul-25 | Lakshmi S J | ₹561.00 | Debit | Transfers | Person Transfer
16-Jul-25 | Deva Motors | ₹1749.00 | Debit | Vehicle | Service/Repair
17-Jul-25 | Rajashree Petroleum | ₹456.33 | Debit | Transport | Fuel
17-Jul-25 | DMart | ₹873.00 | Debit | Groceries | Supermarket
17-Jul-25 | KPN FF | ₹131.60 | Debit | Transport | Fuel
18-Jul-25 | Prathibha T R | ₹10.00 | Debit | Transfers | Person Transfer
18-Jul-25 | KPN FF | ₹400.38 | Debit | Transport | Fuel
18-Jul-25 | Amazon | ₹884.00 | Debit | Shopping | Online Shopping
19-Jul-25 | Jio | ₹824.82 | Debit | Bills | Mobile Recharge
19-Jul-25 | Zepto | ₹252.59 | Debit | Groceries | Quick Commerce
20-Jul-25 | Myntra | ₹1479.00 | Debit | Shopping | Fashion
21-Jul-25 | Prathibha T R | ₹10.00 | Debit | Transfers | Person Transfer
21-Jul-25 | Amazon | ₹6503.00 | Debit | Shopping | Online Shopping
21-Jul-25 | Myntra | ₹1462.00 | Debit | Shopping | Fashion
21-Jul-25 | Travel on Scapia | ₹939.00 | Debit | Travel | Travel Booking
21-Jul-25 | Indiejewel Fashions | ₹1599.00 | Debit | Shopping | Fashion
22-Jul-25 | Nykaa | ₹575.00 | Debit | Shopping | Personal Care`;

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
        if (parts.length < 5) return;
        
        const dateStr = parts[0]; 
        const dparts = dateStr.split('-'); 
        const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
        const monthNum = monthMap[dparts[1].toLowerCase()];
        const isoDate = `20${dparts[2]}-${monthNum}-${dparts[0].padStart(2, '0')}`;
        
        const title = parts[1];
        const amount = parseFloat(parts[2].replace(/[^\d.]/g, ''));
        const type = parts[3].toLowerCase(); 
        const mainCat = parts[4];
        const subCat = parts[5] || 'Others';
        
        const isCredited = type === 'credit';
        let txCategory = subCat.toLowerCase();
        if (type === 'bill') {
            txCategory = 'credit card bill';
        }
        
        const tx = {
            id: `import_${Date.now()}_scapia_2_${i}`,
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
                        ['salary received', 'income', 'salary', 'bonus', 'interest income', 'dividend', 'refund'].includes(cat.toLowerCase());
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
