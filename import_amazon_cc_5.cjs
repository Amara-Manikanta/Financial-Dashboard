const fs = require('fs');

const rawData = `01-Apr-24 | PVR Limited Bangalore | ₹510.00 | Debit | Entertainment | Movies
03-Apr-24 | Avenue Supermarts (DMart) | ₹426.16 | Debit | Food | Groceries
06-Apr-24 | Reliance Trends Vijayawada | ₹5507.00 | Debit | Shopping | Clothes
08-Apr-24 | IGST Charges | ₹9.18 | Debit | Bills | Tax Charges
08-Apr-24 | EMI Interest Amortization | ₹51.00 | Debit | Loans | EMI Interest
08-Apr-24 | EMI Principal Amortization | ₹796.40 | Debit | Loans | EMI Principal
08-Apr-24 | Crimsoune Club Kakinada | ₹6796.00 | Debit | Entertainment | Club/Leisure
13-Apr-24 | Centro Kakinada | ₹2499.01 | Debit | Shopping | Fashion/Clothing
16-Apr-24 | EMI Interest Amortization | ₹50.40 | Debit | Loans | EMI Interest
16-Apr-24 | IGST Charges | ₹9.07 | Debit | Bills | Tax Charges
16-Apr-24 | EMI Principal Amortization | ₹3782.74 | Debit | Loans | EMI Principal
19-Apr-24 | Avenue Supermarts (DMart) | ₹977.65 | Debit | Food | Groceries
21-Apr-24 | Amazon | ₹402.80 | Debit | Shopping | Amazon/Online Shopping
22-Apr-24 | Amazon Recharge | ₹653.00 | Debit | Bills | Mobile Recharge
22-Apr-24 | Auto Debit Payment Received | ₹2176.00 | Credit | Savings | Credit Card Payment
23-Apr-24 | Pizza Hut Bangalore | ₹381.45 | Debit | Food | Restaurants
25-Apr-24 | Croma Bangalore | ₹31428.80 | Debit | Shopping | Electronics
25-Apr-24 | Croma Bangalore | ₹9960.18 | Debit | Shopping | Electronics
25-Apr-24 | Jio Platforms | ₹9897.84 | Debit | Bills | Telecom/Internet
28-Apr-24 | Amazon | ₹100.00 | Debit | Shopping | Amazon/Online Shopping
28-Apr-24 | PVR Limited | ₹440.00 | Debit | Entertainment | Movies
28-Apr-24 | PVR Limited | ₹410.00 | Debit | Entertainment | Movies
29-Apr-24 | Avenue Supermarts | ₹629.44 | Debit | Food | Groceries
29-Apr-24 | Amazon | ₹1195.00 | Debit | Shopping | Amazon/Online Shopping
29-Apr-24 | Wakefit | ₹30186.58 | Debit | Shopping | Furniture/Home
01-May-24 | Amazon | ₹1195.00 | Debit | Shopping | Amazon/Online Shopping
02-May-24 | Amazon | ₹5396.00 | Debit | Shopping | Amazon/Online Shopping
03-May-24 | Infinity Payment Received | ₹40000.00 | Credit | Savings | Credit Card Payment
08-May-24 | IGST Charges | ₹7.39 | Debit | Bills | Tax Charges
08-May-24 | EMI Principal Amortization | ₹806.35 | Debit | Loans | EMI Principal
08-May-24 | EMI Interest Amortization | ₹41.05 | Debit | Loans | EMI Interest
08-May-24 | Infinity Payment Received | ₹40000.00 | Credit | Savings | Credit Card Payment
14-May-24 | Avenue Supermarts | ₹5273.93 | Debit | Food | Groceries
18-May-24 | Avenue Supermarts | ₹634.68 | Debit | Food | Groceries
21-May-24 | Star Studio Bangalore | ₹2280.00 | Debit | Entertainment | Photography/Studio
23-May-24 | Avenue Supermarts | ₹832.50 | Debit | Food | Groceries
26-May-24 | MakeMyTrip | ₹4182.00 | Debit | Travel | Travel Booking
30-May-24 | T Kanniappa Mudaliar | ₹2023.60 | Debit | Miscellaneous | General Purchase
31-May-24 | Fuel Surcharge Reversal | ₹20.03 | Credit | Travel | Fuel Refund
02-Jun-24 | Amazon Recharge | ₹650.00 | Debit | Bills | Mobile Recharge
03-Jun-24 | Infinity Payment Received | ₹4590.00 | Credit | Savings | Credit Card Payment
08-Jun-24 | EMI Interest Amortization | ₹30.98 | Debit | Loans | EMI Interest
08-Jun-24 | IGST Charges | ₹5.58 | Debit | Bills | Tax Charges
08-Jun-24 | EMI Principal Amortization | ₹816.42 | Debit | Loans | EMI Principal
13-Jun-24 | MakeMyTrip Refund | ₹7339.24 | Credit | Travel | Ticket Refund
13-Jun-24 | MakeMyTrip | ₹8220.79 | Debit | Travel | Travel Booking
16-Jun-24 | Reliance Trends | ₹2407.00 | Debit | Shopping | Clothes
16-Jun-24 | Nagas Bangalore | ₹878.00 | Debit | Food | Restaurants
17-Jun-24 | Skyrocket Beverages Hyderabad | ₹230.00 | Debit | Food | Beverages
20-Jun-24 | Lulu International Bangalore | ₹1345.00 | Debit | Shopping | Clothes/Fashion
20-Jun-24 | Lulu International Bangalore | ₹1749.00 | Debit | Shopping | Clothes/Fashion
20-Jun-24 | UTK Restaurant Bangalore | ₹2095.00 | Debit | Food | Restaurants
21-Jun-24 | Amazon | ₹1699.00 | Debit | Shopping | Amazon/Online Shopping
21-Jun-24 | Avenue Supermarts | ₹399.57 | Debit | Food | Groceries
21-Jun-24 | Auto Debit Return Fee | ₹826.23 | Debit | Bills | Bank Charges
21-Jun-24 | IGST Charges | ₹148.72 | Debit | Bills | Tax Charges
22-Jun-24 | Amazon Refund | ₹1699.00 | Credit | Shopping | Refund
25-Jun-24 | Crocs India | ₹2922.00 | Debit | Shopping | Footwear
05-Jul-24 | SK Foods Bangalore | ₹522.00 | Debit | Food | Restaurants
06-Jul-24 | Amazon Recharge | ₹650.00 | Debit | Bills | Mobile Recharge
08-Jul-24 | EMI Interest Amortization | ₹20.78 | Debit | Loans | EMI Interest
08-Jul-24 | IGST Charges | ₹3.74 | Debit | Bills | Tax Charges
08-Jul-24 | EMI Principal Amortization | ₹826.62 | Debit | Loans | EMI Principal
13-Jul-24 | Katha Silks Bengaluru | ₹9633.00 | Debit | Shopping | Clothes/Traditional Wear
13-Jul-24 | Infinity Payment Received | ₹6000.00 | Credit | Savings | Credit Card Payment
21-Jul-24 | Auto Debit Return Fee | ₹1206.54 | Debit | Bills | Bank Charges
21-Jul-24 | IGST Charges | ₹217.18 | Debit | Bills | Tax Charges
02-Aug-24 | Interest Charges | ₹2504.39 | Debit | Loans | Credit Card Interest
02-Aug-24 | IGST Charges | ₹450.79 | Debit | Bills | Tax Charges
04-Aug-24 | Infinity Payment Received | ₹6410.00 | Credit | Savings | Credit Card Payment
08-Aug-24 | EMI Interest Amortization | ₹10.45 | Debit | Loans | EMI Interest
08-Aug-24 | EMI Principal Amortization | ₹836.99 | Debit | Loans | EMI Principal
08-Aug-24 | IGST Charges | ₹1.88 | Debit | Bills | Tax Charges
08-Aug-24 | Infinity Payment Received | ₹6000.00 | Credit | Savings | Credit Card Payment
21-Aug-24 | Auto Debit Return Fee | ₹1279.04 | Debit | Bills | Bank Charges
21-Aug-24 | IGST Charges | ₹230.23 | Debit | Bills | Tax Charges
02-Sep-24 | Interest Charges | ₹2349.21 | Debit | Loans | Credit Card Interest
02-Sep-24 | IGST Charges | ₹422.86 | Debit | Bills | Tax Charges
12-Sep-24 | Infinity Payment Received | ₹40000.00 | Credit | Savings | Credit Card Payment
12-Sep-24 | Infinity Payment Received | ₹2000.00 | Credit | Savings | Credit Card Payment
18-Sep-24 | Infinity Payment Received | ₹5000.00 | Credit | Savings | Credit Card Payment
19-Sep-24 | Amazon India | ₹402.80 | Debit | Shopping | Amazon/Online Shopping
21-Sep-24 | Auto Debit Return Fee | ₹500.00 | Debit | Bills | Bank Charges
21-Sep-24 | IGST Charges | ₹90.00 | Debit | Bills | Tax Charges
21-Sep-24 | Infinity Payment Received | ₹402.00 | Credit | Savings | Credit Card Payment
28-Sep-24 | Amazon | ₹635.00 | Debit | Shopping | Amazon/Online Shopping
29-Sep-24 | Amazon | ₹299.00 | Debit | Shopping | Amazon/Online Shopping
30-Sep-24 | Infinity Payment Received | ₹635.00 | Credit | Savings | Credit Card Payment
01-Oct-24 | Interest Charges | ₹2145.66 | Debit | Loans | Credit Card Interest
01-Oct-24 | IGST Charges | ₹386.22 | Debit | Bills | Tax Charges
03-Oct-24 | Infinity Payment Received | ₹5000.00 | Credit | Savings | Credit Card Payment
05-Oct-24 | Amazon | ₹799.00 | Debit | Shopping | Amazon/Online Shopping
06-Oct-24 | Amazon Recharge | ₹666.00 | Debit | Bills | Mobile Recharge
08-Oct-24 | EMI Interest Amortization | ₹4.32 | Debit | Loans | EMI Interest
08-Oct-24 | EMI Principal Amortization | ₹843.12 | Debit | Loans | EMI Principal
08-Oct-24 | IGST Charges | ₹0.78 | Debit | Bills | Tax Charges
10-Oct-24 | Reliance Digital Hyderabad | ₹2499.00 | Debit | Shopping | Electronics
12-Oct-24 | Zomato | ₹342.00 | Debit | Food | Food Delivery
13-Oct-24 | PVR Cinemas Hyderabad | ₹520.00 | Debit | Entertainment | Movies
14-Oct-24 | Uber India | ₹186.00 | Debit | Travel | Cabs
15-Oct-24 | DMart Hyderabad | ₹2189.50 | Debit | Food | Groceries
18-Oct-24 | Swiggy | ₹410.00 | Debit | Food | Food Delivery
20-Oct-24 | Airtel Payments | ₹1499.00 | Debit | Bills | Internet/Mobile Bill
21-Oct-24 | Auto Debit Return Fee | ₹500.00 | Debit | Bills | Bank Charges
21-Oct-24 | IGST Charges | ₹90.00 | Debit | Bills | Tax Charges
22-Oct-24 | Infinity Payment Received | ₹10000.00 | Credit | Savings | Credit Card Payment
25-Oct-24 | Amazon | ₹1499.00 | Debit | Shopping | Amazon/Online Shopping
27-Oct-24 | IKEA Hyderabad | ₹3290.00 | Debit | Shopping | Furniture/Home
29-Oct-24 | BigBasket | ₹845.00 | Debit | Food | Groceries
30-Oct-24 | Metro Rail Hyderabad | ₹250.00 | Debit | Travel | Metro
01-Nov-24 | Interest Charges | ₹1898.77 | Debit | Loans | Credit Card Interest
02-Nov-24 | IGST Charges | ₹341.77 | Debit | Bills | Tax Charges
03-Nov-24 | Infinity Payment Received | ₹12000.00 | Credit | Savings | Credit Card Payment
04-Nov-24 | Amazon | ₹599.00 | Debit | Shopping | Amazon/Online Shopping
06-Nov-24 | Myntra | ₹1899.00 | Debit | Shopping | Clothes
08-Nov-24 | EMI Interest Amortization | ₹2.05 | Debit | Loans | EMI Interest
08-Nov-24 | EMI Principal Amortization | ₹845.39 | Debit | Loans | EMI Principal
08-Nov-24 | IGST Charges | ₹0.37 | Debit | Bills | Tax Charges
10-Nov-24 | Swiggy | ₹280.00 | Debit | Food | Food Delivery
12-Nov-24 | Reliance Fresh | ₹1230.00 | Debit | Food | Groceries
14-Nov-24 | Uber India | ₹220.00 | Debit | Travel | Cabs
16-Nov-24 | PVR Cinemas | ₹430.00 | Debit | Entertainment | Movies
18-Nov-24 | Amazon Recharge | ₹399.00 | Debit | Bills | Mobile Recharge
20-Nov-24 | Apollo Pharmacy | ₹765.00 | Debit | Health | Medical
21-Nov-24 | Auto Debit Return Fee | ₹500.00 | Debit | Bills | Bank Charges
24-Nov-24 | Zomato | ₹510.00 | Debit | Food | Food Delivery
26-Nov-24 | Amazon | ₹2499.00 | Debit | Shopping | Electronics
29-Nov-24 | Infinity Payment Received | ₹15000.00 | Credit | Savings | Credit Card Payment
02-Dec-24 | Interest Charges | ₹1720.54 | Debit | Loans | Credit Card Interest
03-Dec-24 | IGST Charges | ₹309.70 | Debit | Bills | Tax Charges
05-Dec-24 | Amazon | ₹799.00 | Debit | Shopping | Amazon/Online Shopping
07-Dec-24 | DMart | ₹1985.40 | Debit | Food | Groceries
09-Dec-24 | Uber India | ₹170.00 | Debit | Travel | Cabs
12-Dec-24 | PVR Cinemas | ₹390.00 | Debit | Entertainment | Movies
15-Dec-24 | Swiggy | ₹460.00 | Debit | Food | Food Delivery
18-Dec-24 | Reliance Trends | ₹2299.00 | Debit | Shopping | Clothes
20-Dec-24 | Infinity Payment Received | ₹8000.00 | Credit | Savings | Credit Card Payment
02-Jan-25 | Interest Charges | ₹1548.32 | Debit | Loans | Credit Card Interest
03-Jan-25 | IGST Charges | ₹278.70 | Debit | Bills | Tax Charges
04-Jan-25 | Infinity Payment Received | ₹10000.00 | Credit | Savings | Credit Card Payment
05-Jan-25 | Amazon | ₹699.00 | Debit | Shopping | Amazon/Online Shopping
06-Jan-25 | Airtel Payments | ₹1499.00 | Debit | Bills | Internet/Mobile Bill
07-Jan-25 | Swiggy | ₹320.00 | Debit | Food | Food Delivery
08-Jan-25 | EMI Interest Amortization | ₹1.22 | Debit | Loans | EMI Interest
08-Jan-25 | EMI Principal Amortization | ₹846.22 | Debit | Loans | EMI Principal
09-Jan-25 | Uber India | ₹245.00 | Debit | Travel | Cabs
10-Jan-25 | DMart Hyderabad | ₹2125.00 | Debit | Food | Groceries
12-Jan-25 | PVR Cinemas Hyderabad | ₹470.00 | Debit | Entertainment | Movies
14-Jan-25 | Amazon | ₹1199.00 | Debit | Shopping | Amazon/Online Shopping
15-Jan-25 | Reliance Trends | ₹2899.00 | Debit | Shopping | Clothes
18-Jan-25 | Zomato | ₹510.00 | Debit | Food | Food Delivery
20-Jan-25 | Apollo Pharmacy | ₹920.00 | Debit | Health | Medical
22-Jan-25 | Auto Debit Return Fee | ₹500.00 | Debit | Bills | Bank Charges
23-Jan-25 | IGST Charges | ₹90.00 | Debit | Bills | Tax Charges
24-Jan-25 | Infinity Payment Received | ₹12000.00 | Credit | Savings | Credit Card Payment
27-Jan-25 | IKEA Hyderabad | ₹1890.00 | Debit | Shopping | Furniture/Home
30-Jan-25 | Metro Rail Hyderabad | ₹300.00 | Debit | Travel | Metro
01-Feb-25 | Interest Charges | ₹1280.10 | Debit | Loans | Credit Card Interest
02-Feb-25 | IGST Charges | ₹230.41 | Debit | Bills | Tax Charges
03-Feb-25 | Amazon Recharge | ₹399.00 | Debit | Bills | Mobile Recharge
05-Feb-25 | Swiggy | ₹430.00 | Debit | Food | Food Delivery
06-Feb-25 | Amazon | ₹899.00 | Debit | Shopping | Amazon/Online Shopping
08-Feb-25 | EMI Principal Amortization | ₹847.44 | Debit | Loans | EMI Principal
08-Feb-25 | EMI Interest Amortization | ₹0.58 | Debit | Loans | EMI Interest
10-Feb-25 | Uber India | ₹160.00 | Debit | Travel | Cabs
12-Feb-25 | Reliance Fresh | ₹1650.00 | Debit | Food | Groceries
14-Feb-25 | PVR Cinemas | ₹520.00 | Debit | Entertainment | Movies
17-Feb-25 | Amazon | ₹2499.00 | Debit | Shopping | Electronics
20-Feb-25 | Infinity Payment Received | ₹15000.00 | Credit | Savings | Credit Card Payment
01-Mar-25 | Interest Charges | ₹980.00 | Debit | Loans | Credit Card Interest
02-Mar-25 | IGST Charges | ₹176.40 | Debit | Bills | Tax Charges
04-Mar-25 | Amazon | ₹599.00 | Debit | Shopping | Amazon/Online Shopping
05-Mar-25 | Zomato | ₹610.00 | Debit | Food | Food Delivery
07-Mar-25 | Airtel Payments | ₹1499.00 | Debit | Bills | Internet/Mobile Bill
09-Mar-25 | Uber India | ₹190.00 | Debit | Travel | Cabs
12-Mar-25 | DMart Hyderabad | ₹2450.00 | Debit | Food | Groceries
15-Mar-25 | Apollo Pharmacy | ₹650.00 | Debit | Health | Medical
18-Mar-25 | Reliance Trends | ₹1799.00 | Debit | Shopping | Clothes
20-Mar-25 | Infinity Payment Received | ₹10000.00 | Credit | Savings | Credit Card Payment
25-Mar-25 | Amazon | ₹1299.00 | Debit | Shopping | Amazon/Online Shopping
29-Mar-25 | Swiggy | ₹380.00 | Debit | Food | Food Delivery
31-Mar-25 | Balance Carried Forward | ₹0.00 | System | Miscellaneous | Closing Balance`;

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
            id: `import_${Date.now()}_amazon_5_${i}`,
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
