const fs = require('fs');

const rawData = `20-Apr-20 | AutoDebit Payment Received | ₹6000.77 | Credit | Savings | Credit Card Payment
19-May-20 | AutoDebit Payment Received | ₹2486.00 | Credit | Savings | Credit Card Payment
22-Jun-20 | AutoDebit Payment Received | ₹9066.16 | Credit | Savings | Credit Card Payment
16-Apr-20 | Amazon | ₹598.00 | Debit | Shopping | Amazon/Online Shopping
17-Apr-20 | Amazon | ₹1000.00 | Debit | Shopping | Amazon/Online Shopping
21-Apr-20 | Storytel Subscription | ₹299.00 | Debit | Entertainment | Subscriptions
23-Apr-20 | Amazon | ₹599.00 | Debit | Shopping | Amazon/Online Shopping
04-May-20 | Amazon | ₹155.00 | Debit | Shopping | Amazon/Online Shopping
05-May-20 | Amazon | ₹499.00 | Debit | Shopping | Amazon/Online Shopping
05-May-20 | Excell Media | ₹581.42 | Debit | Bills | Subscription
06-May-20 | Amazon | ₹399.00 | Debit | Shopping | Amazon/Online Shopping
08-May-20 | Amazon | ₹249.00 | Debit | Shopping | Amazon/Online Shopping
08-May-20 | Amazon Refund | ₹249.00 | Credit | Miscellaneous | Refund
09-May-20 | Amazon | ₹249.00 | Debit | Shopping | Amazon/Online Shopping
13-May-20 | Sri Sai Datta Dhanalakshmi | ₹252.95 | Debit | Food | Essentials
14-May-20 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
16-May-20 | Spencer Retail | ₹1344.50 | Debit | Food | Groceries
19-May-20 | Amazon | ₹10115.00 | Debit | Shopping | Electronics
21-May-20 | Amazon Refund | ₹249.00 | Credit | Miscellaneous | Refund
22-May-20 | GoDaddy | ₹1589.46 | Debit | Bills | Domain/Hosting
23-May-20 | Vamsi Krishna Filling Station | ₹253.22 | Debit | Travel | Fuel
25-May-20 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
26-May-20 | IRCTC | ₹1295.51 | Debit | Travel | Train Tickets
26-May-20 | IRCTC | ₹1346.10 | Debit | Travel | Train Tickets
27-May-20 | Amazon | ₹1499.00 | Debit | Shopping | Amazon/Online Shopping
28-May-20 | Amazon Refund | ₹349.00 | Credit | Miscellaneous | Refund
29-May-20 | Amazon Refund | ₹545.00 | Credit | Miscellaneous | Refund
29-May-20 | Amazon | ₹650.00 | Debit | Shopping | Amazon/Online Shopping
29-May-20 | Amazon | ₹545.00 | Debit | Shopping | Amazon/Online Shopping
29-May-20 | Infinity Payment Received | ₹545.00 | Credit | Savings | Credit Card Payment
29-May-20 | Infinity Payment Received | ₹10000.00 | Credit | Savings | Credit Card Payment
01-Jun-20 | IRCTC Refund | ₹1180.00 | Credit | Travel | Ticket Refund
01-Jun-20 | IRCTC Refund | ₹1230.00 | Credit | Travel | Ticket Refund
04-Jun-20 | Amazon | ₹598.00 | Debit | Shopping | Amazon/Online Shopping
04-Jun-20 | Excell Media | ₹588.82 | Debit | Bills | Subscription
06-Jun-20 | Amazon Grocery | ₹699.00 | Debit | Food | Groceries
06-Jun-20 | Venkataramana Agencies | ₹151.50 | Debit | Food | Essentials
07-Jun-20 | Amazon | ₹999.00 | Debit | Shopping | Amazon/Online Shopping
07-Jun-20 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
08-Jun-20 | Amazon | ₹899.00 | Debit | Shopping | Amazon/Online Shopping
08-Jun-20 | Amazon Refund | ₹899.00 | Credit | Miscellaneous | Refund
08-Jun-20 | Amazon Refund | ₹577.00 | Credit | Miscellaneous | Refund
09-Jun-20 | Amazon | ₹3000.00 | Debit | Shopping | Electronics
10-Jun-20 | Amazon Grocery Refund | ₹699.00 | Credit | Food | Grocery Refund
11-Jun-20 | Krishna Digital Color | ₹4000.00 | Debit | Shopping | Electronics/Services
27-Jun-20 | Adobe Subscription | ₹420.00 | Debit | Bills | Subscription
05-Jul-20 | Excell Media | ₹588.82 | Debit | Bills | Subscription
16-Jul-20 | Microsoft India | ₹2.00 | Debit | Bills | Software Subscription
20-Jul-20 | AutoDebit Payment Received | ₹7669.32 | Credit | Savings | Credit Card Payment
23-Jul-20 | Amazon | ₹1050.00 | Debit | Shopping | Amazon/Online Shopping
27-Jul-20 | Adobe Subscription | ₹420.00 | Debit | Bills | Subscription
04-Aug-20 | Excell Media | ₹588.82 | Debit | Bills | Subscription
08-Aug-20 | Amazon | ₹999.00 | Debit | Shopping | Amazon/Online Shopping
08-Aug-20 | Amazon | ₹1749.00 | Debit | Shopping | Electronics
08-Aug-20 | Amazon | ₹1150.00 | Debit | Shopping | Amazon/Online Shopping
10-Aug-20 | Amazon | ₹499.00 | Debit | Shopping | Amazon/Online Shopping
11-Aug-20 | Amazon | ₹469.00 | Debit | Shopping | Amazon/Online Shopping
18-Aug-20 | Sri Balatripura Sundar | ₹3000.00 | Debit | Family | Family Expense
20-Aug-20 | AutoDebit Payment Received | ₹2060.82 | Credit | Savings | Credit Card Payment
21-Aug-20 | Microsoft Refund | ₹2.00 | Credit | Miscellaneous | Refund
23-Aug-20 | GoDaddy | ₹1589.46 | Debit | Bills | Domain/Hosting
27-Aug-20 | Adobe Subscription | ₹420.00 | Debit | Bills | Subscription
29-Aug-20 | Sri Radha Krishna Agencies | ₹290.88 | Debit | Food | Essentials
30-Aug-20 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
31-Aug-20 | Apollo Hospitals | ₹180.00 | Debit | Health | Medical
02-Sep-20 | Amazon | ₹1040.00 | Debit | Shopping | Amazon/Online Shopping
02-Sep-20 | Supercell Game | ₹399.00 | Debit | Entertainment | Gaming
08-Sep-20 | Sarvottam Health Care | ₹3490.00 | Debit | Health | Medical
09-Sep-20 | Sri Radha Krishna Agencies | ₹261.96 | Debit | Food | Essentials
10-Sep-20 | Excell Media | ₹588.82 | Debit | Bills | Subscription
10-Sep-20 | Sarvottam Health Care | ₹1825.00 | Debit | Health | Medical
10-Sep-20 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
18-Sep-20 | Infinity Payment Received | ₹18518.00 | Credit | Savings | Credit Card Payment
19-Sep-20 | Hotstar | ₹299.00 | Debit | Entertainment | Subscription
20-Sep-20 | Amazon | ₹349.00 | Debit | Shopping | Amazon/Online Shopping
23-Sep-20 | Supercell Game | ₹1599.00 | Debit | Entertainment | Gaming
23-Sep-20 | Amazon | ₹528.00 | Debit | Shopping | Amazon/Online Shopping
24-Sep-20 | Amazon Refund | ₹349.00 | Credit | Miscellaneous | Refund
26-Sep-20 | Spencer Retail | ₹375.00 | Debit | Food | Groceries
26-Sep-20 | Spencer Retail | ₹3533.50 | Debit | Food | Groceries
26-Sep-20 | eFulfilment Market | ₹479.20 | Debit | Shopping | Online Shopping
27-Sep-20 | Adobe Subscription | ₹420.00 | Debit | Bills | Subscription
28-Sep-20 | Venkataramana Agencies | ₹151.50 | Debit | Food | Essentials
29-Sep-20 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
02-Oct-20 | Amazon | ₹598.00 | Debit | Shopping | Amazon/Online Shopping
02-Oct-20 | Vijetha Supermarket | ₹2856.89 | Debit | Food | Groceries
03-Oct-20 | Amazon | ₹16194.00 | Debit | Shopping | Electronics
03-Oct-20 | Infinity Payment Received | ₹7375.00 | Credit | Savings | Credit Card Payment
06-Oct-20 | Amazon | ₹999.00 | Debit | Shopping | Amazon/Online Shopping
06-Oct-20 | Infinity Payment Received | ₹19649.00 | Credit | Savings | Credit Card Payment
17-Oct-20 | Sri Radha Krishna Agencies | ₹292.83 | Debit | Food | Essentials
19-Oct-20 | Hotstar | ₹299.00 | Debit | Entertainment | Subscription
01-Nov-20 | Amazon Grocery | ₹311.00 | Debit | Food | Groceries
01-Nov-20 | More Retail | ₹1898.99 | Debit | Food | Groceries
04-Nov-20 | Bharat Petroleum | ₹303.24 | Debit | Travel | Fuel
05-Nov-20 | Ex-Gratia Payment | ₹33.85 | Credit | Income | Bonus/Adjustment
10-Nov-20 | Amazon | ₹349.00 | Debit | Shopping | Amazon/Online Shopping
15-Nov-20 | Venkataramana Agencies | ₹353.37 | Debit | Food | Essentials
19-Nov-20 | Hotstar | ₹299.00 | Debit | Entertainment | Subscription
20-Nov-20 | AutoDebit Payment Received | ₹3737.00 | Credit | Savings | Credit Card Payment
24-Nov-20 | GoDaddy | ₹1271.57 | Debit | Bills | Domain/Hosting
29-Nov-20 | Amazon | ₹998.00 | Debit | Shopping | Amazon/Online Shopping
29-Nov-20 | Amazon | ₹509.00 | Debit | Shopping | Amazon/Online Shopping
30-Nov-20 | Amazon | ₹499.00 | Debit | Shopping | Amazon/Online Shopping
05-Dec-20 | Amazon | ₹998.00 | Debit | Shopping | Amazon/Online Shopping
06-Dec-20 | Venkataramana Agencies | ₹383.80 | Debit | Food | Essentials
07-Dec-20 | Amazon Pay | ₹2.00 | Debit | Bills | Wallet/Recharge
12-Dec-20 | Spencer Retail | ₹2538.00 | Debit | Food | Groceries
21-Dec-20 | AutoDebit Payment Received | ₹4572.18 | Credit | Savings | Credit Card Payment
24-Dec-20 | Facebook India | ₹200.00 | Debit | Bills | Ads/Online Services
26-Dec-20 | Amazon | ₹598.00 | Debit | Shopping | Amazon/Online Shopping
02-Jan-21 | Adobe Subscription | ₹797.68 | Debit | Bills | Subscription
03-Jan-21 | Aditya Birla Fashion | ₹799.00 | Debit | Shopping | Clothes
03-Jan-21 | Aditya Birla Fashion | ₹1797.00 | Debit | Shopping | Clothes
03-Jan-21 | Aditya Birla Fashion | ₹4395.00 | Debit | Shopping | Clothes
03-Jan-21 | Venkataramana Agencies | ₹353.50 | Debit | Food | Essentials
03-Jan-21 | Spykar Jeans | ₹6098.00 | Debit | Shopping | Clothes
04-Jan-21 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
17-Jan-21 | Subway | ₹30.00 | Debit | Food | Dining Out
17-Jan-21 | Subway | ₹30.00 | Debit | Food | Dining Out
17-Jan-21 | Subway | ₹180.00 | Debit | Food | Dining Out
17-Jan-21 | Subway | ₹60.00 | Debit | Food | Dining Out
19-Jan-21 | AutoDebit Payment Received | ₹4709.80 | Credit | Savings | Credit Card Payment
22-Jan-21 | Amazon | ₹2999.00 | Debit | Shopping | Electronics
22-Jan-21 | Amazon | ₹990.00 | Debit | Shopping | Amazon/Online Shopping
25-Jan-21 | GoDaddy | ₹1665.36 | Debit | Bills | Domain/Hosting
25-Jan-21 | Infinity Payment Received | ₹18529.18 | Credit | Savings | Credit Card Payment
01-Feb-21 | Adobe Subscription | ₹797.68 | Debit | Bills | Subscription
06-Feb-21 | M & N Motors | ₹3248.00 | Debit | Travel | Vehicle Service
22-Feb-21 | AutoDebit Payment Received | ₹2463.04 | Credit | Savings | Credit Card Payment
25-Feb-21 | GoDaddy | ₹1589.46 | Debit | Bills | Domain/Hosting
27-Feb-21 | Amazon | ₹147.00 | Debit | Shopping | Amazon/Online Shopping
01-Mar-21 | Adobe Subscription | ₹797.68 | Debit | Bills | Subscription
03-Mar-21 | VIT University | ₹6102.66 | Debit | Education | Course/Fees
06-Mar-21 | Amazon Grocery | ₹360.00 | Debit | Food | Groceries
07-Mar-21 | Amazon Standing Instruction | ₹199.00 | Debit | Bills | Subscription
12-Mar-21 | Amazon Grocery | ₹270.00 | Debit | Food | Groceries
15-Mar-21 | IRCTC | ₹5167.88 | Debit | Travel | Train Tickets
18-Mar-21 | Infinity Payment Received | ₹17881.68 | Credit | Savings | Credit Card Payment
19-Mar-21 | Amazon | ₹598.00 | Debit | Shopping | Amazon/Online Shopping
29-Mar-21 | Amazon | ₹401.00 | Debit | Shopping | Amazon/Online Shopping
31-Mar-21 | Amazon | ₹1849.00 | Debit | Shopping | Amazon/Online Shopping
01-Apr-21 | Adobe Subscription | ₹797.68 | Debit | Bills | Subscription
04-Apr-21 | Amazon | ₹1639.00 | Debit | Shopping | Amazon/Online Shopping
05-Apr-21 | Amazon | ₹491.00 | Debit | Shopping | Amazon/Online Shopping
05-Apr-21 | Amazon | ₹566.00 | Debit | Shopping | Amazon/Online Shopping
05-Apr-21 | Amazon | ₹449.00 | Debit | Shopping | Amazon/Online Shopping
05-Apr-21 | Amazon | ₹1099.00 | Debit | Shopping | Amazon/Online Shopping
06-Apr-21 | Amazon | ₹335.00 | Debit | Shopping | Amazon/Online Shopping
06-Apr-21 | Amazon | ₹160.00 | Debit | Shopping | Amazon/Online Shopping
10-Apr-21 | P Kumarasamy & Sons | ₹537.27 | Debit | Miscellaneous | General Purchase
12-Apr-21 | Fuel Surcharge Reversal | ₹10.00 | Credit | Travel | Fuel Refund
12-Apr-21 | Lifestyle International | ₹299.00 | Debit | Shopping | Clothes
13-Apr-21 | IRCTC Refund | ₹500.00 | Credit | Travel | Ticket Refund
18-Apr-21 | Amazon | ₹3899.00 | Debit | Shopping | Electronics
19-Apr-21 | Amazon Refund | ₹3899.00 | Credit | Miscellaneous | Refund
19-Apr-21 | Amazon | ₹3899.00 | Debit | Shopping | Electronics
23-Apr-21 | Late Payment Fee | ₹500.00 | Debit | Bills | Late Payment Charges
23-Apr-21 | SGST | ₹45.00 | Debit | Bills | Tax Charges
23-Apr-21 | CGST | ₹45.00 | Debit | Bills | Tax Charges
26-Apr-21 | Infinity Payment Received | ₹13199.95 | Credit | Savings | Credit Card Payment
02-May-21 | Spencer Retail | ₹646.00 | Debit | Food | Groceries
06-May-21 | Amazon | ₹598.00 | Debit | Shopping | Amazon/Online Shopping
06-May-21 | Amazon | ₹350.00 | Debit | Shopping | Amazon/Online Shopping
06-May-21 | Amazon | ₹747.00 | Debit | Shopping | Amazon/Online Shopping
21-May-21 | GoDaddy | ₹1589.46 | Debit | Bills | Domain/Hosting
21-May-21 | Amazon Refund | ₹747.00 | Credit | Miscellaneous | Refund
21-May-21 | Infinity Payment Received | ₹2340.00 | Credit | Savings | Credit Card Payment
24-May-21 | Amazon | ₹282.00 | Debit | Shopping | Amazon/Online Shopping
26-May-21 | Amazon | ₹14999.00 | Debit | Shopping | Electronics
28-May-21 | Amazon | ₹294.00 | Debit | Shopping | Amazon/Online Shopping
29-May-21 | Amazon Refund | ₹14999.00 | Credit | Miscellaneous | Refund
05-Jun-21 | IRCTC | ₹1244.92 | Debit | Travel | Train Tickets
05-Jun-21 | UPI Payment Received | ₹1230.00 | Credit | People Transfers | Received
05-Jun-21 | NEFT Payment Received | ₹8.00 | Credit | People Transfers | Received
11-Jun-21 | Amazon Recharge | ₹521.00 | Debit | Bills | Mobile Recharge
13-Jun-21 | Amazon | ₹1035.00 | Debit | Shopping | Amazon/Online Shopping
15-Jun-21 | UPI Payment Received | ₹188.46 | Credit | People Transfers | Received
18-Jun-21 | Amazon | ₹175.00 | Debit | Shopping | Amazon/Online Shopping
19-Jun-21 | IRCTC | ₹114.03 | Debit | Travel | Train Tickets
19-Jun-21 | IRCTC | ₹103.91 | Debit | Travel | Train Tickets
09-Jul-21 | Amazon | ₹1598.00 | Debit | Shopping | Amazon/Online Shopping
10-Jul-21 | UPI Payment Received | ₹3185.86 | Credit | People Transfers | Received
10-Jul-21 | NEFT Payment Received | ₹10.00 | Credit | People Transfers | Received
08-Aug-21 | Reliance Retail | ₹3827.52 | Debit | Shopping | Electronics
14-Aug-21 | Amazon Grocery | ₹319.00 | Debit | Food | Groceries
14-Aug-21 | Amazon | ₹999.00 | Debit | Shopping | Amazon/Online Shopping
15-Aug-21 | Amazon | ₹1095.00 | Debit | Shopping | Amazon/Online Shopping
15-Aug-21 | More Retail | ₹431.00 | Debit | Food | Groceries
21-Aug-21 | Spencer Retail | ₹365.00 | Debit | Food | Groceries
21-Aug-21 | Spencer Retail | ₹318.00 | Debit | Food | Groceries
22-Aug-21 | Amazon Recharge | ₹79.00 | Debit | Bills | Mobile Recharge
23-Aug-21 | GoDaddy | ₹1589.46 | Debit | Bills | Domain/Hosting
23-Aug-21 | Late Payment Fee | ₹500.00 | Debit | Bills | Late Payment Charges
23-Aug-21 | SGST | ₹45.00 | Debit | Bills | Tax Charges
23-Aug-21 | CGST | ₹45.00 | Debit | Bills | Tax Charges
27-Aug-21 | Netflix | ₹199.00 | Debit | Entertainment | Subscription
28-Aug-21 | PhonePe IRCTC | ₹794.67 | Debit | Travel | Train Tickets
29-Aug-21 | Amazon Recharge | ₹75.00 | Debit | Bills | Mobile Recharge
29-Aug-21 | Amazon | ₹974.00 | Debit | Shopping | Amazon/Online Shopping
01-Sep-21 | Adobe Subscription | ₹797.68 | Debit | Bills | Subscription
02-Sep-21 | Interest Charges | ₹334.41 | Debit | Bills | Credit Card Interest
02-Sep-21 | SGST | ₹30.10 | Debit | Bills | Tax Charges
02-Sep-21 | CGST | ₹30.10 | Debit | Bills | Tax Charges
02-Sep-21 | INOX | ₹268.80 | Debit | Entertainment | Movies
03-Sep-21 | Amazon Recharge | ₹346.00 | Debit | Bills | Mobile Recharge
04-Sep-21 | Amazon | ₹14490.00 | Debit | Shopping | Electronics
04-Sep-21 | Infinity Payment Received | ₹14705.00 | Credit | Savings | Credit Card Payment
07-Sep-21 | Infinity Payment Received | ₹14836.00 | Credit | Savings | Credit Card Payment
08-Sep-21 | IRCTC | ₹306.27 | Debit | Travel | Train Tickets
08-Sep-21 | IRCTC | ₹321.45 | Debit | Travel | Train Tickets
13-Sep-21 | IRCTC Refund | ₹120.00 | Credit | Travel | Ticket Refund
14-Sep-21 | IRCTC Refund | ₹105.00 | Credit | Travel | Ticket Refund
15-Sep-21 | Amazon Recharge | ₹98.00 | Debit | Bills | Mobile Recharge
15-Sep-21 | Udemy | ₹656.00 | Debit | Education | Online Course
19-Sep-21 | Samsung Store | ₹16659.00 | Debit | Shopping | Electronics
22-Sep-21 | Amazon | ₹1238.00 | Debit | Shopping | Amazon/Online Shopping
22-Sep-21 | Amazon | ₹1238.00 | Debit | Shopping | Amazon/Online Shopping
23-Sep-21 | Samsung Refund | ₹16659.00 | Credit | Miscellaneous | Refund
27-Sep-21 | Amazon | ₹821.00 | Debit | Shopping | Amazon/Online Shopping
28-Sep-21 | Amazon Recharge | ₹75.00 | Debit | Bills | Mobile Recharge
28-Sep-21 | Amazon Refund | ₹1238.00 | Credit | Miscellaneous | Refund
02-Oct-21 | Amazon | ₹9989.00 | Debit | Shopping | Electronics
06-Oct-21 | Amazon | ₹999.00 | Debit | Shopping | Amazon/Online Shopping
09-Oct-21 | Zomato | ₹89.50 | Debit | Food | Food Delivery
10-Oct-21 | Barbeque Nation | ₹3167.00 | Debit | Food | Restaurants
11-Oct-21 | Amazon | ₹399.00 | Debit | Shopping | Amazon/Online Shopping
11-Oct-21 | Amazon | ₹1151.00 | Debit | Shopping | Amazon/Online Shopping
11-Oct-21 | Amazon | ₹203.00 | Debit | Shopping | Amazon/Online Shopping
11-Oct-21 | Amazon | ₹14432.30 | Debit | Shopping | Electronics
11-Oct-21 | Infinity Payment Received | ₹13129.96 | Credit | Savings | Credit Card Payment
13-Oct-21 | Netflix | ₹199.00 | Debit | Entertainment | Subscription
14-Oct-21 | Paytm | ₹199.00 | Debit | Bills | Wallet/Recharge
27-Oct-21 | Amazon | ₹2349.00 | Debit | Shopping | Amazon/Online Shopping
29-Oct-21 | Amazon | ₹549.00 | Debit | Shopping | Amazon/Online Shopping
30-Oct-21 | Infinity Payment Received | ₹18833.87 | Credit | Savings | Credit Card Payment`;

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
            id: `import_${Date.now()}_amazon_3_${i}`,
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
