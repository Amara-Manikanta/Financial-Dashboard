const fs = require('fs');

const rawData = `23-Nov-25 | Reliance Retail | ₹349.00 | Category: Shopping - Retail
24-Nov-25 | KPN FF Hongasandra Bengaluru | ₹121.96 | Category: Transport / Travel
24-Nov-25 | Ofldev Bangalore | ₹137.00 | Category: Office / Miscellaneous
25-Nov-25 | Bill Payment | +₹500.00 | Category: Credit Card Payment
26-Nov-25 | Bill Payment | +₹100.00 | Category: Credit Card Payment
26-Nov-25 | Girani Bengaluru | ₹2,348.00 | Category: Grocery / Food
27-Nov-25 | Bill Payment | +₹500.00 | Category: Credit Card Payment
27-Nov-25 | Tumbledry Solutions | ₹630.00 | Category: Laundry / Services
27-Nov-25 | KPN FF Hongasandra Bengaluru | ₹228.10 | Category: Transport / Travel
28-Nov-25 | Bill Payment | +₹9,468.73 | Category: Credit Card Payment
28-Nov-25 | Bill Payment | +₹29,152.97 | Category: Credit Card Payment
28-Nov-25 | KPN FF Hongasandra Bengaluru | ₹51.00 | Category: Transport / Travel
28-Nov-25 | Instamart Bangalore | ₹202.00 | Category: Grocery / Quick Commerce
29-Nov-25 | Lakshmi S J | ₹998.00 | Category: Personal Transfer / UPI
29-Nov-25 | Bill Payment | +₹11.00 | Category: Credit Card Payment
29-Nov-25 | Amazon | ₹4,184.95 | Category: Shopping - Online Purchase
29-Nov-25 | DMart | ₹685.87 | Category: Grocery / Supermarket
30-Nov-25 | Zomato | ₹242.07 | Category: Food Delivery
01-Dec-25 | KPN Farm Fresh | ₹130.44 | Category: Grocery
01-Dec-25 | Ofldev Bangalore | ₹150.00 | Category: Office / Miscellaneous
01-Dec-25 | Mohanlal Choudhary | ₹125.00 | Category: Personal Transfer / UPI
01-Dec-25 | Amazon Refund | +₹599.00 | Category: Refund
02-Dec-25 | Netflix | ₹499.00 | Category: Subscription - OTT
03-Dec-25 | KPN FF Hongasandra Bengaluru | ₹167.00 | Category: Transport / Travel
03-Dec-25 | Swiggy | ₹171.00 | Category: Food Delivery
03-Dec-25 | Rajashree Petroleum Bangalore | ₹470.88 | Category: Fuel / Petrol
04-Dec-25 | Swiggy | ₹508.00 | Category: Food Delivery
04-Dec-25 | Swiggy | ₹207.00 | Category: Food Delivery
04-Dec-25 | Hashboosh Designs Pvt Ltd | ₹2,450.00 | Category: Shopping / Lifestyle
05-Dec-25 | Zepto | ₹516.00 | Category: Grocery / Quick Commerce
05-Dec-25 | Amazon Refund | +₹179.55 | Category: Refund
05-Dec-25 | Savi Ruchi Bengaluru | ₹270.00 | Category: Food / Restaurant
06-Dec-25 | Fuel Surcharge Waiver | +₹4.66 | Category: Refund / Cashback
06-Dec-25 | Travel on Scapia | ₹7,870.00 | Category: Travel Booking
07-Dec-25 | Travel on Scapia | ₹7,870.00 | Category: Travel Booking
07-Dec-25 | Savi Ruchi Bengaluru | ₹530.00 | Category: Food / Restaurant
07-Dec-25 | Myntra | ₹1,050.00 | Category: Shopping - Fashion
07-Dec-25 | Airbnb | ₹7,874.12 | Category: Travel / Accommodation
08-Dec-25 | KPN FF Hongasandra Bengaluru | ₹60.63 | Category: Transport / Travel
09-Dec-25 | KPN FF Hongasandra Bengaluru | ₹509.30 | Category: Transport / Travel
09-Dec-25 | Ofldev Bangalore | ₹137.00 | Category: Office / Miscellaneous
10-Dec-25 | Myntra Refund | +₹464.41 | Category: Refund
11-Dec-25 | Amazon | ₹284.05 | Category: Shopping - Online Purchase
12-Dec-25 | KPN FF Hongasandra Bengaluru | ₹27.00 | Category: Transport / Travel
12-Dec-25 | Ofldev Bangalore | ₹290.00 | Category: Office / Miscellaneous
12-Dec-25 | Airtel | ₹1,772.36 | Category: Utility - Mobile/Internet Bill
12-Dec-25 | Bill Payment | +₹10.00 | Category: Credit Card Payment
13-Dec-25 | Zepto | ₹353.00 | Category: Grocery / Quick Commerce
13-Dec-25 | Amazon Refund | +₹284.05 | Category: Refund
13-Dec-25 | Savi Ruchi Bengaluru | ₹450.00 | Category: Food / Restaurant
14-Dec-25 | Amazon | ₹277.00 | Category: Shopping - Online Purchase
14-Dec-25 | DMart | ₹783.91 | Category: Grocery / Supermarket
14-Dec-25 | Instamart Bangalore | ₹185.00 | Category: Grocery / Quick Commerce
14-Dec-25 | Myntra Refund | +₹240.64 | Category: Refund
14-Dec-25 | Myntra Refund | +₹165.24 | Category: Refund
15-Dec-25 | KPN FF Hongasandra Bengaluru | ₹136.77 | Category: Transport / Travel
15-Dec-25 | Reliance Retail | ₹470.82 | Category: Shopping - Retail
17-Dec-25 | KPN FF Hongasandra Bengaluru | ₹95.53 | Category: Transport / Travel
17-Dec-25 | Ofldev Bangalore | ₹137.00 | Category: Office / Miscellaneous
18-Dec-25 | Lifestyle | ₹999.00 | Category: Shopping - Fashion
19-Dec-25 | Zepto | ₹549.00 | Category: Grocery / Quick Commerce
19-Dec-25 | Aditya Birla Fashion | ₹4,698.00 | Category: Shopping - Fashion
20-Dec-25 | Crepe In Touch | ₹2,300.00 | Category: Clothing / Fashion
21-Dec-25 | Qualita Foods Pondicherry | ₹3,044.00 | Category: Food / Restaurant
22-Dec-25 | Reliance Retail | ₹706.82 | Category: Shopping - Retail
22-Dec-25 | KPN FF Hongasandra Bengaluru | ₹125.28 | Category: Transport / Travel
22-Dec-25 | Bill Payment | +₹7,000.00 | Category: Credit Card Payment
23-Dec-25 | KPN FF Hongasandra Bengaluru | ₹78.59 | Category: Transport / Travel
23-Dec-25 | Myntra Refund | +₹171.79 | Category: Refund
25-Dec-25 | Amazon EMI | ₹6,837.96 | Category: EMI - Shopping Purchase`;

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
            id: `import_${Date.now()}_scapia_8_${i}`,
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
        
        // Skip exists check to handle intentional duplicate swipes cleanly, as we're injecting in batches
        expenses[yearStr][monthName].transactions.push(tx);
        addedCount++;
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
