const fs = require('fs');

const rawData = `10-Jan-24 | Reliance Trends | ₹3,408 | Debit | Shopping | Clothes
12-Jan-24 | Amazon | ₹1,299 | Debit | Shopping | Amazon/Online Shopping
14-Jan-24 | Swiggy | ₹356 | Debit | Food | Food Delivery
16-Jan-24 | EMI Principal Amount | ₹767 | Debit | Bills | EMI
16-Jan-24 | EMI Interest Amount | ₹80 | Debit | Bills | EMI Interest
18-Jan-24 | Google Play | ₹650 | Debit | Bills | Subscription
20-Jan-24 | APSP Fuel Station | ₹2,870 | Debit | Travel | Fuel
23-Jan-24 | Auto Debit Return Fee | ₹1,216 | Debit | Bills | Bank Charges
23-Jan-24 | IGST on Charges | ₹218 | Debit | Bills | Tax Charges
24-Jan-24 | Uber India | ₹142 | Debit | Travel | Cabs
25-Jan-24 | Amazon Recharge | ₹155 | Debit | Bills | Mobile Recharge
27-Jan-24 | Zomato | ₹285 | Debit | Food | Food Delivery
29-Jan-24 | Amazon | ₹899 | Debit | Shopping | Amazon/Online Shopping
31-Jan-24 | Airtel Payment | ₹470 | Debit | Bills | Internet Bill
02-Feb-24 | Interest Charges Credit Card | ₹4,050 | Debit | Bills | Credit Card Interest
02-Feb-24 | IGST on Interest | ₹729 | Debit | Bills | Tax Charges
03-Feb-24 | Blinkit | ₹612 | Debit | Food | Essentials
04-Feb-24 | Uber India | ₹96 | Debit | Travel | Cabs
06-Feb-24 | Amazon | ₹2,450 | Debit | Shopping | Amazon/Online Shopping
08-Feb-24 | EMI Principal Amount | ₹776 | Debit | Bills | EMI
08-Feb-24 | EMI Interest Amount | ₹71 | Debit | Bills | EMI Interest
09-Feb-24 | BookMyShow | ₹540 | Debit | Entertainment | Movies
10-Feb-24 | Reliance Trends | ₹2,699 | Debit | Shopping | Clothes
12-Feb-24 | IRCTC | ₹1,220 | Debit | Travel | Train Tickets
14-Feb-24 | Domino's | ₹620 | Debit | Food | Food Delivery
16-Feb-24 | Google Play | ₹650 | Debit | Bills | Subscription
18-Feb-24 | APSP Fuel Station | ₹3,245 | Debit | Travel | Fuel
20-Feb-24 | Amazon Grocery | ₹880 | Debit | Food | Groceries
24-Feb-24 | IKEA | ₹1,980 | Debit | Shopping | Furniture
27-Feb-24 | Uber India | ₹121 | Debit | Travel | Cabs
29-Feb-24 | Airtel Payment | ₹470 | Debit | Bills | Internet Bill
01-Mar-24 | Amazon Seller Services | ₹1,499 | Debit | Shopping | Amazon/Online Shopping
02-Mar-24 | Swiggy | ₹420 | Debit | Food | Food Delivery
03-Mar-24 | Spencer Retail | ₹1,285 | Debit | Food | Groceries
04-Mar-24 | Uber India | ₹88 | Debit | Travel | Cabs
05-Mar-24 | APSP Fuel Station | ₹2,955 | Debit | Travel | Fuel
06-Mar-24 | Amazon | ₹2,199 | Debit | Shopping | Amazon/Online Shopping
08-Mar-24 | EMI Principal Amount | ₹785 | Debit | Bills | EMI
08-Mar-24 | EMI Interest Amount | ₹62 | Debit | Bills | EMI Interest
09-Mar-24 | Google Play | ₹650 | Debit | Bills | Subscription
10-Mar-24 | Zomato | ₹310 | Debit | Food | Food Delivery
11-Mar-24 | Reliance Trends | ₹1,999 | Debit | Shopping | Clothes
12-Mar-24 | IRCTC | ₹845 | Debit | Travel | Train Tickets
13-Mar-24 | Amazon Recharge | ₹155 | Debit | Bills | Mobile Recharge
14-Mar-24 | Blinkit | ₹575 | Debit | Food | Essentials
15-Mar-24 | BookMyShow | ₹720 | Debit | Entertainment | Movies
16-Mar-24 | Uber India | ₹134 | Debit | Travel | Cabs
18-Mar-24 | APSP Fuel Station | ₹3,480 | Debit | Travel | Fuel
19-Mar-24 | Google Play | ₹650 | Debit | Bills | Subscription
20-Mar-24 | Auto Debit Payment Received | ₹6,065 | Credit | Savings | Credit Card Payment
21-Mar-24 | Amazon | ₹3,250 | Debit | Shopping | Electronics
22-Mar-24 | Airtel Payment | ₹470 | Debit | Bills | Internet Bill
23-Mar-24 | KFC | ₹890 | Debit | Food | Restaurants
24-Mar-24 | IKEA | ₹2,450 | Debit | Shopping | Furniture
25-Mar-24 | Uber India | ₹76 | Debit | Travel | Cabs
26-Mar-24 | Amazon Grocery | ₹640 | Debit | Food | Groceries
27-Mar-24 | Domino's | ₹560 | Debit | Food | Food Delivery
28-Mar-24 | APSP Fuel Station | ₹2,780 | Debit | Travel | Fuel
29-Mar-24 | Amazon | ₹899 | Debit | Shopping | Amazon/Online Shopping
30-Mar-24 | Reliance Trends | ₹2,850 | Debit | Shopping | Clothes
31-Mar-24 | Google Play | ₹650 | Debit | Bills | Subscription
02-Apr-23 | Interest Charges | ₹398.97 | Debit | Bills | Credit Card Interest
02-Apr-23 | SGST on Interest | ₹35.91 | Debit | Bills | Tax Charges
02-Apr-23 | CGST on Interest | ₹35.91 | Debit | Bills | Tax Charges
23-Apr-23 | Late Payment Fee | ₹500.00 | Debit | Bills | Late Payment Charges
23-Apr-23 | SGST on Late Fee | ₹45.00 | Debit | Bills | Tax Charges
23-Apr-23 | CGST on Late Fee | ₹45.00 | Debit | Bills | Tax Charges
28-Apr-23 | Infinity Payment Received | ₹17,625.89 | Credit | Savings | Credit Card Payment
02-May-23 | Interest Charges | ₹224.82 | Debit | Bills | Credit Card Interest
02-May-23 | SGST on Interest | ₹20.23 | Debit | Bills | Tax Charges
02-May-23 | CGST on Interest | ₹20.23 | Debit | Bills | Tax Charges
24-May-23 | Late Payment Fee | ₹900.00 | Debit | Bills | Late Payment Charges
24-May-23 | SGST on Late Fee | ₹81.00 | Debit | Bills | Tax Charges
24-May-23 | CGST on Late Fee | ₹81.00 | Debit | Bills | Tax Charges
26-May-23 | Infinity Payment Received | ₹19,774.82 | Credit | Savings | Credit Card Payment
02-Jun-23 | Interest Charges | ₹466.67 | Debit | Bills | Credit Card Interest
02-Jun-23 | SGST on Interest | ₹42.00 | Debit | Bills | Tax Charges
02-Jun-23 | CGST on Interest | ₹42.00 | Debit | Bills | Tax Charges
23-Jun-23 | Late Payment Fee | ₹900.00 | Debit | Bills | Late Payment Charges
23-Jun-23 | IGST on Charges | ₹162.00 | Debit | Bills | Tax Charges
24-Jun-23 | Infinity Payment Received | ₹18,944.46 | Credit | Savings | Credit Card Payment
20-Jul-23 | Auto Debit Payment Received | ₹3,176.31 | Credit | Savings | Credit Card Payment
21-Aug-23 | Auto Debit Payment Received | ₹2,169.72 | Credit | Savings | Credit Card Payment
20-Sep-23 | Auto Debit Return Fee | ₹1,223.08 | Debit | Bills | Bank Charges
20-Sep-23 | IGST on Charges | ₹220.15 | Debit | Bills | Tax Charges
02-Oct-23 | Interest Charges | ₹4,137.05 | Debit | Bills | Credit Card Interest
02-Oct-23 | IGST on Interest | ₹744.67 | Debit | Bills | Tax Charges
20-Oct-23 | Auto Debit Payment Received | ₹4,881.72 | Credit | Savings | Credit Card Payment
19-Dec-23 | Auto Debit Payment Received | ₹117,307.91 | Credit | Savings | Credit Card Payment
23-Jan-24 | Auto Debit Return Fee | ₹1,216.26 | Debit | Bills | Bank Charges
23-Jan-24 | IGST on Charges | ₹218.93 | Debit | Bills | Tax Charges
02-Feb-24 | Interest Charges | ₹4,050.54 | Debit | Bills | Credit Card Interest
02-Feb-24 | IGST on Interest | ₹729.10 | Debit | Bills | Tax Charges
20-Mar-24 | Auto Debit Payment Received | ₹6,065.60 | Credit | Savings | Credit Card Payment
08-Sep-23 | EMI Processing Fee | ₹199.00 | Debit | Bills | EMI Charges
08-Sep-23 | EMI Principal Amortization (1/12) | ₹730.11 | Debit | Bills | EMI
08-Sep-23 | EMI Interest Amortization (1/12) | ₹117.29 | Debit | Bills | EMI Interest
08-Oct-23 | EMI Principal Amortization (2/12) | ₹739.23 | Debit | Bills | EMI
08-Oct-23 | EMI Interest Amortization (2/12) | ₹108.17 | Debit | Bills | EMI Interest
08-Nov-23 | EMI Principal Amortization (3/12) | ₹748.47 | Debit | Bills | EMI
08-Nov-23 | EMI Interest Amortization (3/12) | ₹98.93 | Debit | Bills | EMI Interest
08-Dec-23 | EMI Principal Amortization (4/12) | ₹757.82 | Debit | Bills | EMI
08-Dec-23 | EMI Interest Amortization (4/12) | ₹89.58 | Debit | Bills | EMI Interest
08-Jan-24 | EMI Principal Amortization (5/12) | ₹767.28 | Debit | Bills | EMI
08-Jan-24 | EMI Interest Amortization (5/12) | ₹80.12 | Debit | Bills | EMI Interest`;

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
        
        const tx = {
            id: `import_${Date.now()}_amazon_2_${i}`,
            date: isoDate,
            title: title,
            amount: amount,
            category: subCat.toLowerCase(),
            mainCategory: mainCat,
            isCredited: isCredited,
            paymentMode: 'credit_card',
            creditCardName: 'Amazon Credit Card',
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
