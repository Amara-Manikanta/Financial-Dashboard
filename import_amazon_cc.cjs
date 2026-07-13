const fs = require('fs');

const rawData = `03-Apr-23 | Amazon Seller Services | ₹299 | Debit | Shopping | Amazon/Online Shopping
05-Apr-23 | Amazon Pay | ₹149 | Debit | Bills | Mobile Recharge
08-Apr-23 | Spencer Retail | ₹181 | Debit | Food | Groceries
12-Apr-23 | APSP Fuel Station | ₹2,000 | Debit | Travel | Fuel
19-Apr-23 | Google Play | ₹650 | Debit | Bills | Subscription
23-Apr-23 | IndiGo Airlines | ₹11,874 | Debit | Travel | Flights
24-Apr-23 | Uber India | ₹212 | Debit | Travel | Cabs
27-Apr-23 | Airtel Payments | ₹470 | Debit | Bills | Internet Bill
27-Apr-23 | IRCTC | ₹377 | Debit | Travel | Train Tickets
29-Apr-23 | Amazon Grocery | ₹378 | Debit | Food | Groceries
30-Apr-23 | Barkaas Arabic Restaurant | ₹1,231 | Debit | Food | Restaurants
01-May-23 | AirAsia | ₹7,247 | Debit | Travel | Flights
03-May-23 | INOX Movies | ₹112 | Debit | Entertainment | Movies
07-May-23 | APSP Fuel Station | ₹3,136 | Debit | Travel | Fuel
11-May-23 | Amazon Seller Services | ₹699 | Debit | Shopping | Amazon/Online Shopping
13-May-23 | Reliance Trends | ₹2,499 | Debit | Shopping | Clothes
15-May-23 | Swiggy | ₹344 | Debit | Food | Food Delivery
18-May-23 | Blinkit | ₹588 | Debit | Food | Groceries
19-May-23 | KFC | ₹1,546 | Debit | Food | Restaurants
20-May-23 | Uber | ₹176 | Debit | Travel | Cabs
23-May-23 | Google Play | ₹650 | Debit | Bills | Subscription
27-May-23 | Amazon | ₹1,299 | Debit | Shopping | Amazon/Online Shopping
29-May-23 | BPCL Fuel | ₹1,800 | Debit | Travel | Fuel
31-May-23 | Airtel Payments | ₹470 | Debit | Bills | Internet Bill
03-Jun-23 | Zomato | ₹460 | Debit | Food | Food Delivery
04-Jun-23 | Uber | ₹125 | Debit | Travel | Cabs
07-Jun-23 | Amazon | ₹899 | Debit | Shopping | Amazon/Online Shopping
10-Jun-23 | IRCTC | ₹825 | Debit | Travel | Train Tickets
14-Jun-23 | Meghana Foods | ₹950 | Debit | Food | Restaurants
18-Jun-23 | Google Play | ₹650 | Debit | Bills | Subscription
22-Jun-23 | Amazon Seller Services | ₹349 | Debit | Shopping | Amazon/Online Shopping
28-Jun-23 | Zomato | ₹460 | Debit | Food | Food Delivery
30-Jun-23 | Airtel Payments | ₹470 | Debit | Bills | Internet Bill
02-Jul-23 | Uber India | ₹89 | Debit | Travel | Cabs
05-Jul-23 | Amazon | ₹799 | Debit | Shopping | Amazon/Online Shopping
08-Jul-23 | APSP Fuel Station | ₹2,700 | Debit | Travel | Fuel
11-Jul-23 | Blinkit | ₹422 | Debit | Food | Groceries
14-Jul-23 | Google Play | ₹650 | Debit | Bills | Subscription
16-Jul-23 | Cream Stone | ₹380 | Debit | Food | Restaurants
19-Jul-23 | Swiggy | ₹287 | Debit | Food | Food Delivery
21-Jul-23 | Reliance Trends | ₹3,199 | Debit | Shopping | Clothes
24-Jul-23 | Amazon Pay | ₹239 | Debit | Bills | Mobile Recharge
29-Jul-23 | BPCL Fuel | ₹1,650 | Debit | Travel | Fuel
31-Jul-23 | Airtel Payments | ₹470 | Debit | Bills | Internet Bill
03-Aug-23 | IRCTC | ₹1,120 | Debit | Travel | Train Tickets
05-Aug-23 | Amazon | ₹1,899 | Debit | Shopping | Amazon/Online Shopping
07-Aug-23 | Uber | ₹145 | Debit | Travel | Cabs
09-Aug-23 | Google Play | ₹650 | Debit | Bills | Subscription
12-Aug-23 | Zomato | ₹522 | Debit | Food | Food Delivery
15-Aug-23 | Barkaas Restaurant | ₹1,480 | Debit | Food | Restaurants
18-Aug-23 | Blinkit | ₹620 | Debit | Food | Groceries
20-Aug-23 | APSP Fuel Station | ₹2,900 | Debit | Travel | Fuel
22-Aug-23 | Amazon Seller Services | ₹599 | Debit | Shopping | Amazon/Online Shopping
24-Aug-23 | INOX Movies | ₹280 | Debit | Entertainment | Movies
27-Aug-23 | Uber India | ₹102 | Debit | Travel | Cabs
29-Aug-23 | Airtel Payments | ₹470 | Debit | Bills | Internet Bill
31-Aug-23 | Google Play | ₹650 | Debit | Bills | Subscription
02-Sep-23 | Swiggy | ₹410 | Debit | Food | Food Delivery
05-Sep-23 | Amazon | ₹2,499 | Debit | Shopping | Amazon/Online Shopping
08-Sep-23 | BPCL Fuel | ₹1,900 | Debit | Travel | Fuel
10-Sep-23 | BookMyShow | ₹692 | Debit | Entertainment | Movies
15-Sep-23 | IRCTC | ₹825 | Debit | Travel | Train Tickets
15-Sep-23 | IRCTC | ₹2,385 | Debit | Travel | Train Tickets
19-Sep-23 | Google Play | ₹650 | Debit | Bills | Subscription
21-Sep-23 | Amazon | ₹1,088 | Debit | Shopping | Amazon/Online Shopping
03-Oct-23 | Zomato | ₹222 | Debit | Food | Food Delivery
06-Oct-23 | Amazon | ₹1,499 | Debit | Shopping | Amazon/Online Shopping
08-Oct-23 | EMI Principal | ₹739 | Debit | Bills | EMI
08-Oct-23 | EMI Interest | ₹108 | Debit | Bills | EMI Interest
08-Oct-23 | Zomato | ₹395 | Debit | Food | Food Delivery
09-Oct-23 | Zomato | ₹315 | Debit | Food | Food Delivery
10-Oct-23 | IRCTC | ₹1,593 | Debit | Travel | Train Tickets
10-Oct-23 | Amazon | ₹6,499 | Debit | Shopping | Electronics
12-Oct-23 | IRCTC | ₹1,932 | Debit | Travel | Train Tickets
15-Oct-23 | Sobha Super Market | ₹660 | Debit | Food | Groceries
15-Oct-23 | Reliance Trends | ₹7,857 | Debit | Shopping | Clothes
18-Oct-23 | Amazon | ₹2,099 | Debit | Shopping | Amazon/Online Shopping
20-Oct-23 | Zomato | ₹241 | Debit | Food | Food Delivery
23-Oct-23 | JJA Multi Cuisine | ₹880 | Debit | Food | Restaurants
24-Oct-23 | Abhibus | ₹620 | Debit | Travel | Bus Tickets
24-Oct-23 | Reliance Trends | ₹6,907 | Debit | Shopping | Clothes
29-Oct-23 | NoBroker | ₹4,128 | Debit | Housing | House Rent / Service
05-Nov-23 | Honey Special Cake | ₹596 | Debit | Food | Dining Out
08-Nov-23 | Sai Silks | ₹39,999 | Debit | Shopping | Clothes
09-Nov-23 | Mebaz Kukatpally | ₹93,041 | Debit | Shopping | Clothes
10-Nov-23 | Lifestyle | ₹2,898 | Debit | Shopping | Clothes
10-Nov-23 | Aditya Birla Fashion | ₹3,304 | Debit | Shopping | Clothes
13-Nov-23 | Sai Silks | ₹4,999 | Debit | Shopping | Clothes
13-Nov-23 | Amazon | ₹16,999 | Debit | Shopping | Electronics
26-Nov-23 | IKEA | ₹23,779 | Debit | Shopping | Furniture
03-Dec-23 | Spencer Retail | ₹4,098 | Debit | Food | Groceries
13-Dec-23 | Sona Jewellery | ₹18,545 | Debit | Shopping | Accessories
22-Dec-23 | APSP Fuel Station | ₹4,285 | Debit | Travel | Fuel
26-Dec-23 | Redbus | ₹4,408 | Debit | Travel | Bus Tickets
28-Dec-23 | Dmart (Avenue Supermarts) | ₹13,485 | Debit | Food | Essentials
31-Dec-23 | Domino's (Jubilant Foodworks) | ₹1,110 | Debit | Food | Food Delivery
01-Jan-24 | Meghana Foods | ₹1,565 | Debit | Food | Restaurants
03-Jan-24 | Amazon | ₹2,988 | Debit | Shopping | Amazon/Online Shopping
09-Jan-24 | Toni & Guy | ₹5,915 | Debit | Health | Beauty
09-Jan-24 | Cream Stone | ₹342 | Debit | Food | Dining Out
09-Jan-24 | Reliance Trends | ₹3,408 | Debit | Shopping | Clothes`;

const API_URL = 'http://127.0.0.1:3000';
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function run() {
    console.log("Fetching expenses...");
    const res = await fetch(`${API_URL}/expenses`);
    const expenses = await res.json();
    
    const lines = rawData.split('\n').filter(l => l.trim().length > 0);
    
    let addedCount = 0;
    
    lines.forEach((line, i) => {
        // Example line: 03-Apr-23 | Amazon Seller Services | ₹299 | Debit | Shopping | Amazon/Online Shopping
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 5) return;
        
        const dateStr = parts[0]; // 03-Apr-23
        const dparts = dateStr.split('-'); // ["03", "Apr", "23"]
        const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
        const monthNum = monthMap[dparts[1].toLowerCase()];
        const isoDate = `20${dparts[2]}-${monthNum}-${dparts[0].padStart(2, '0')}`;
        
        const title = parts[1];
        const amount = parseFloat(parts[2].replace(/[^\d.]/g, ''));
        const type = parts[3].toLowerCase(); // debit
        const mainCat = parts[4];
        const subCat = parts[5] || 'Others';
        
        const isCredited = type === 'credit';
        
        const tx = {
            id: `import_${Date.now()}_amazon_${i}`,
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
    
    // Rebuild categories
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
