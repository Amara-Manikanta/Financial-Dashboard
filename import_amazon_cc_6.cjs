const fs = require('fs');

const rawData = `01-Apr-25 | The Derma Co | ₹664.24 | Debit | Health | Skincare/Personal Care
04-Apr-25 | Infinity Payment Received | ₹3081.24 | Credit | Savings | Credit Card Payment
11-Apr-25 | MakeMyTrip | ₹1232.44 | Debit | Travel | Travel Booking
11-Apr-25 | MakeMyTrip | ₹1408.98 | Debit | Travel | Travel Booking
16-Apr-25 | Amazon Pay India | ₹1500.82 | Debit | Shopping | Amazon/Online Shopping
17-Apr-25 | Vijaya Sai Traders | ₹7380.00 | Debit | Shopping | Household/General Purchase
19-Apr-25 | Amazon | ₹248.00 | Debit | Shopping | Amazon/Online Shopping
19-Apr-25 | Amazon | ₹588.00 | Debit | Shopping | Amazon/Online Shopping
19-Apr-25 | MakeMyTrip | ₹2842.97 | Debit | Travel | Travel Booking
19-Apr-25 | MakeMyTrip | ₹2724.97 | Debit | Travel | Travel Booking
25-Apr-25 | Amazon | ₹599.00 | Debit | Shopping | Amazon/Online Shopping
06-May-25 | More Ramagundam | ₹275.10 | Debit | Food | Groceries
07-May-25 | Toni and Guy Essensual | ₹4259.00 | Debit | Personal Care | Salon/Haircut
07-May-25 | Amazon | ₹5220.00 | Debit | Shopping | Amazon/Online Shopping
13-May-25 | Infinity Payment Received | ₹18525.18 | Credit | Savings | Credit Card Payment
15-May-25 | Amazon | ₹5249.00 | Debit | Shopping | Amazon/Online Shopping
16-May-25 | Amazon Refund | ₹649.00 | Credit | Refunds | Amazon Refund
16-May-25 | Amazon Refund | ₹419.00 | Credit | Refunds | Amazon Refund
16-May-25 | Amazon Refund | ₹585.00 | Credit | Refunds | Amazon Refund
18-May-25 | Amazon India CYBS | ₹402.80 | Debit | Shopping | Amazon Subscription/Purchase
19-May-25 | Amazon | ₹540.00 | Debit | Shopping | Amazon/Online Shopping
23-May-25 | MakeMyTrip | ₹2314.86 | Debit | Travel | Travel Booking
29-May-25 | Amazon | ₹5249.00 | Debit | Shopping | Amazon/Online Shopping
31-May-25 | Infinity Payment Received | ₹18525.18 | Credit | Savings | Credit Card Payment
07-Jun-25 | MakeMyTrip Refund | ₹2118.00 | Credit | Refunds | Travel Refund
08-Jun-25 | Amazon | ₹1354.00 | Debit | Shopping | Amazon/Online Shopping
16-Jun-25 | Amazon | ₹1624.00 | Debit | Shopping | Amazon/Online Shopping
18-Jun-25 | Amazon | ₹286.00 | Debit | Shopping | Amazon/Online Shopping
20-Jun-25 | AutoDebit Payment Received | ₹1213.58 | Credit | Savings | Credit Card Payment
09-Jul-25 | Infinity Payment Received | ₹3264.00 | Credit | Savings | Credit Card Payment
29-Jul-25 | Amazon Refund | ₹604.00 | Credit | Refunds | Amazon Refund
29-Jul-25 | Amazon | ₹604.00 | Debit | Shopping | Amazon Purchase
31-Jul-25 | Refund Transfer to Bank | ₹604.00 | Credit | Refunds | Refund Transfer to Bank Account
18-Aug-25 | Infinity Payment Received | ₹604.00 | Credit | Savings | Credit Card Payment
19-Aug-25 | Amazon Pay Grocery | ₹1849.00 | Debit | Food | Grocery Purchase
19-Aug-25 | Amazon Pay Grocery | ₹836.38 | Debit | Food | Grocery Purchase
23-Aug-25 | Amazon Grocery Refund | ₹89.00 | Credit | Refunds | Grocery Refund
25-Aug-25 | Amazon Grocery Refund | ₹456.25 | Credit | Refunds | Grocery Refund
28-Aug-25 | Amazon Pay India | ₹21963.38 | Debit | EMI/Shopping | Large Purchase (Likely EMI Conversion)
30-Aug-25 | Principal Amount Amortization <1/6> | ₹3540.51 | Debit | EMI | EMI Principal Installment
30-Aug-25 | Amazon Pay India Reversal | ₹21963.38 | Credit | EMI | EMI Conversion Adjustment
30-Aug-25 | Amazon Pay India | ₹199.00 | Debit | EMI | EMI Processing Charge
30-Aug-25 | IGST | ₹35.82 | Debit | Charges | GST on EMI
30-Aug-25 | IGST | ₹52.68 | Debit | Charges | GST on EMI
30-Aug-25 | Interest Amount Amortization <1/6> | ₹292.66 | Debit | EMI | EMI Interest Charge
04-Sep-25 | Infinity Payment Received | ₹6260.80 | Credit | Savings | Credit Card Payment
09-Sep-25 | Amazon Pay E-Commerce | ₹1942.00 | Debit | Shopping | Online Purchase
09-Sep-25 | Amazon Pay E-Commerce | ₹215.18 | Debit | Shopping | Online Purchase
22-Sep-25 | Amazon Pay E-Commerce | ₹4676.00 | Debit | Shopping | Online Purchase
30-Sep-25 | Principal Amount Amortization <2/6> | ₹3587.69 | Debit | EMI | EMI Principal Installment
30-Sep-25 | IGST | ₹44.19 | Debit | Charges | GST on EMI Interest
30-Sep-25 | Interest Amount Amortization <2/6> | ₹245.48 | Debit | EMI | EMI Interest Charge
30-Sep-25 | Lifestyle International | ₹5608.36 | Debit | Shopping | Clothing/Fashion
02-Oct-25 | Infinity Payment Received | ₹10605.00 | Credit | Savings | Credit Card Payment
03-Oct-25 | Principal Amount Amortization <3/6> | ₹3587.69 | Debit | EMI | EMI Principal Installment
03-Oct-25 | Interest Amount Amortization <3/6> | ₹197.92 | Debit | EMI | EMI Interest Charge
03-Oct-25 | IGST | ₹35.62 | Debit | Charges | GST on EMI Interest
06-Oct-25 | Amazon Pay India | ₹799.00 | Debit | Shopping | Amazon Purchase
08-Oct-25 | Blinkit | ₹462.00 | Debit | Food | Grocery / Quick Commerce
09-Oct-25 | Swiggy | ₹318.50 | Debit | Food | Food Delivery
11-Oct-25 | Airtel Payments / Airtel Black | ₹1499.00 | Debit | Bills | Internet / Mobile Bill
12-Oct-25 | Uber India | ₹287.00 | Debit | Travel | Cab Ride
14-Oct-25 | Amazon | ₹1299.00 | Debit | Shopping | Online Purchase
15-Oct-25 | Netflix India | ₹649.00 | Debit | Entertainment | OTT Subscription
17-Oct-25 | Zomato | ₹402.00 | Debit | Food | Food Delivery
19-Oct-25 | Amazon Grocery | ₹1124.00 | Debit | Food | Grocery Purchase
20-Oct-25 | BigBasket | ₹786.00 | Debit | Food | Grocery Purchase
22-Oct-25 | PVR Cinemas | ₹520.00 | Debit | Entertainment | Movie Tickets
25-Oct-25 | Amazon Refund | ₹299.00 | Credit | Refunds | Product Refund
27-Oct-25 | Principal Amount Amortization <4/6> | ₹3587.69 | Debit | EMI | EMI Principal Installment
27-Oct-25 | Interest Amount Amortization <4/6> | ₹150.33 | Debit | EMI | EMI Interest Charge
27-Oct-25 | IGST | ₹27.05 | Debit | Charges | GST on EMI Interest
02-Nov-25 | Infinity Payment Received | ₹5200.00 | Credit | Savings | Credit Card Payment
05-Nov-25 | Amazon | ₹899.00 | Debit | Shopping | Online Purchase
06-Nov-25 | Flipkart | ₹2199.00 | Debit | Shopping | Electronics / Online Purchase
09-Nov-25 | Swiggy Instamart | ₹675.00 | Debit | Food | Grocery Delivery
12-Nov-25 | Urban Company | ₹799.00 | Debit | Services | Home Service
16-Nov-25 | Uber India | ₹184.00 | Debit | Travel | Cab Ride
20-Nov-25 | Amazon | ₹399.00 | Debit | Shopping | Online Purchase
25-Nov-25 | Principal Amount Amortization <5/6> | ₹3587.69 | Debit | EMI | EMI Principal Installment
25-Nov-25 | Interest Amount Amortization <5/6> | ₹98.41 | Debit | EMI | EMI Interest Charge
25-Nov-25 | IGST | ₹17.71 | Debit | Charges | GST on EMI Interest
02-Dec-25 | Infinity Payment Received | ₹4100.00 | Credit | Savings | Credit Card Payment
05-Dec-25 | Amazon | ₹1499.00 | Debit | Shopping | Online Purchase
09-Dec-25 | Blinkit | ₹322.00 | Debit | Food | Grocery / Quick Commerce
12-Dec-25 | Spotify | ₹119.00 | Debit | Entertainment | Music Subscription
18-Dec-25 | Zomato | ₹288.00 | Debit | Food | Food Delivery
22-Dec-25 | Principal Amount Amortization <6/6> | ₹3587.69 | Debit | EMI | Final EMI Installment
22-Dec-25 | Interest Amount Amortization <6/6> | ₹49.10 | Debit | EMI | Final EMI Interest
22-Dec-25 | IGST | ₹8.84 | Debit | Charges | GST on EMI Interest
03-Jan-26 | Infinity Payment Received | ₹12500.00 | Credit | Savings | Credit Card Payment
04-Jan-26 | Amazon | ₹899.00 | Debit | Shopping | Online Purchase
05-Jan-26 | Blinkit | ₹385.00 | Debit | Food | Grocery Delivery
06-Jan-26 | Uber India | ₹241.00 | Debit | Travel | Cab Ride
08-Jan-26 | Airtel Black | ₹1499.00 | Debit | Bills | Broadband + Mobile Bill
09-Jan-26 | Swiggy | ₹272.00 | Debit | Food | Food Delivery
11-Jan-26 | Netflix India | ₹649.00 | Debit | Entertainment | OTT Subscription
12-Jan-26 | Amazon Pay Recharge | ₹399.00 | Debit | Bills | Mobile / Recharge
14-Jan-26 | BigBasket | ₹1098.00 | Debit | Food | Grocery Purchase
17-Jan-26 | PVR Cinemas | ₹430.00 | Debit | Entertainment | Movie Tickets
20-Jan-26 | Amazon | ₹2499.00 | Debit | Shopping | Electronics Purchase
24-Jan-26 | Spotify | ₹119.00 | Debit | Entertainment | Music Subscription
28-Jan-26 | Zomato | ₹355.00 | Debit | Food | Food Delivery
02-Feb-26 | Infinity Payment Received | ₹9200.00 | Credit | Savings | Credit Card Payment
03-Feb-26 | Amazon | ₹799.00 | Debit | Shopping | Online Purchase
04-Feb-26 | Blinkit | ₹542.00 | Debit | Food | Grocery Delivery
06-Feb-26 | Uber India | ₹189.00 | Debit | Travel | Cab Ride
08-Feb-26 | Swiggy | ₹416.00 | Debit | Food | Food Delivery
09-Feb-26 | Amazon Grocery | ₹1235.00 | Debit | Food | Grocery Purchase
12-Feb-26 | Myntra | ₹2199.00 | Debit | Shopping | Clothes Purchase
14-Feb-26 | Netflix India | ₹649.00 | Debit | Entertainment | OTT Subscription
17-Feb-26 | Airtel Black | ₹1499.00 | Debit | Bills | Internet Bill
19-Feb-26 | Zomato | ₹299.00 | Debit | Food | Food Delivery
22-Feb-26 | Amazon | ₹599.00 | Debit | Shopping | Online Purchase
25-Feb-26 | Urban Company | ₹699.00 | Debit | Services | Home Service
01-Mar-26 | Infinity Payment Received | ₹7500.00 | Credit | Savings | Credit Card Payment
03-Mar-26 | Amazon | ₹999.00 | Debit | Shopping | Online Purchase
05-Mar-26 | Blinkit | ₹462.00 | Debit | Food | Grocery Delivery
06-Mar-26 | Uber India | ₹148.00 | Debit | Travel | Cab Ride
08-Mar-26 | Swiggy | ₹399.00 | Debit | Food | Food Delivery
10-Mar-26 | Amazon Grocery | ₹842.00 | Debit | Food | Grocery Purchase
14-Mar-26 | Spotify | ₹119.00 | Debit | Entertainment | Music Subscription
17-Mar-26 | Zomato | ₹288.00 | Debit | Food | Food Delivery
21-Mar-26 | Amazon | ₹1599.00 | Debit | Shopping | Online Purchase
27-Mar-26 | PVR Cinemas | ₹520.00 | Debit | Entertainment | Movie Tickets
31-Mar-26 | Airtel Black | ₹1499.00 | Debit | Bills | Internet / Mobile Bill
01-Apr-23 | Amazon | ₹645.00 | Debit | Shopping | Online Purchase
02-Apr-23 | Infinity Payment Received | ₹8,500.00 | Credit | Savings | Credit Card Payment
03-Apr-23 | Adobe Creative Cloud | ₹2,394.22 | Debit | Subscriptions | Adobe Subscription
04-Apr-23 | Swiggy | ₹312.00 | Debit | Food | Food Delivery
05-Apr-23 | Uber India | ₹178.00 | Debit | Travel | Cab Ride
06-Apr-23 | Amazon Grocery | ₹1,185.00 | Debit | Food | Grocery Purchase
07-Apr-23 | Spotify | ₹119.00 | Debit | Entertainment | Music Subscription
08-Apr-23 | Airtel | ₹499.00 | Debit | Bills | Mobile Bill
09-Apr-23 | Amazon | ₹899.00 | Debit | Shopping | Online Purchase
10-Apr-23 | IRCTC | ₹1,420.00 | Debit | Travel | Train Tickets
11-Apr-23 | Zomato | ₹287.00 | Debit | Food | Food Delivery
12-Apr-23 | Netflix | ₹649.00 | Debit | Entertainment | OTT Subscription
13-Apr-23 | Amazon Pay Recharge | ₹249.00 | Debit | Bills | Recharge
14-Apr-23 | Reliance Retail | ₹2,799.00 | Debit | Shopping | Retail Purchase
15-Apr-23 | Uber India | ₹201.00 | Debit | Travel | Cab Ride
16-Apr-23 | BigBasket | ₹955.00 | Debit | Food | Grocery Purchase
18-Apr-23 | Amazon | ₹1,999.00 | Debit | Shopping | Electronics Purchase
19-Apr-23 | Google Play | ₹650.00 | Debit | Subscriptions | App Subscription
20-Apr-23 | PVR Cinemas | ₹420.00 | Debit | Entertainment | Movie Tickets
21-Apr-23 | Swiggy | ₹366.00 | Debit | Food | Food Delivery
22-Apr-23 | IKEA India | ₹1,250.00 | Debit | Shopping | Furniture / Home Purchase
23-Apr-23 | Infinity Payment Received | ₹12,300.00 | Credit | Savings | Credit Card Payment
24-Apr-23 | Amazon | ₹545.00 | Debit | Shopping | Online Purchase
25-Apr-23 | Zomato | ₹299.00 | Debit | Food | Food Delivery
26-Apr-23 | Metro | ₹60.00 | Debit | Travel | Metro Travel
27-Apr-23 | Uber India | ₹142.00 | Debit | Travel | Cab Ride
28-Apr-23 | Adobe Photography Plan | ₹797.68 | Debit | Subscriptions | Adobe Subscription
29-Apr-23 | Amazon Grocery | ₹899.00 | Debit | Food | Grocery Purchase
30-Apr-23 | Airtel Black | ₹1499.00 | Debit | Bills | Broadband Bill
01-May-23 | Amazon | ₹1,249.00 | Debit | Shopping | Online Purchase
02-May-23 | Spotify | ₹119.00 | Debit | Entertainment | Music Subscription
03-May-23 | Swiggy | ₹411.00 | Debit | Food | Food Delivery
04-May-23 | Uber India | ₹188.00 | Debit | Travel | Cab Ride
05-May-23 | Infinity Payment Received | ₹10,500.00 | Credit | Savings | Credit Card Payment`;

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
            id: `import_${Date.now()}_amazon_6_${i}`,
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
