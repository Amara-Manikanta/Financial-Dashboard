const fs = require('fs');

const rawData = `02-Nov-21 | Amazon | ₹1708.10 | Debit | Shopping | Amazon/Online Shopping
06-Nov-21 | MS Santhis Reload | ₹511.80 | Debit | Bills | Recharge/Service
06-Nov-21 | Amazon | ₹973.08 | Debit | Shopping | Amazon/Online Shopping
13-Nov-21 | Reliance Retail | ₹399.00 | Debit | Shopping | General Shopping
13-Nov-21 | Reliance Retail | ₹5099.00 | Debit | Shopping | Electronics
19-Nov-21 | Amazon | ₹1040.00 | Debit | Shopping | Amazon/Online Shopping
20-Nov-21 | More Retail | ₹666.00 | Debit | Food | Groceries
22-Nov-21 | Infinity Payment Received | ₹549.00 | Credit | Savings | Credit Card Payment
23-Nov-21 | Amazon | ₹539.00 | Debit | Shopping | Amazon/Online Shopping
25-Nov-21 | Amazon Recharge | ₹598.00 | Debit | Bills | Mobile Recharge
26-Nov-21 | Ibibo Group | ₹8318.00 | Debit | Travel | Hotel/Travel Booking
01-Dec-21 | GoDaddy | ₹1589.46 | Debit | Bills | Domain/Hosting
01-Dec-21 | Infinity Payment Received | ₹19840.18 | Credit | Savings | Credit Card Payment
02-Dec-21 | Puma | ₹7199.00 | Debit | Shopping | Clothes
02-Dec-21 | Croma | ₹1682.00 | Debit | Shopping | Electronics
04-Dec-21 | Directorate of Estates | ₹1600.00 | Debit | Housing | Government/Accommodation
04-Dec-21 | Shiva Dhaba | ₹512.00 | Debit | Food | Restaurants
04-Dec-21 | Veer Service Station | ₹3035.40 | Debit | Travel | Fuel
05-Dec-21 | Nalini Shimla | ₹614.00 | Debit | Food | Dining Out
08-Dec-21 | Hotel Castle Naggar | ₹1763.00 | Debit | Travel | Hotel Stay
23-Dec-21 | Infinity Payment Received | ₹1589.46 | Credit | Savings | Credit Card Payment
31-Dec-21 | Zomato | ₹84.00 | Debit | Food | Food Delivery
31-Dec-21 | Zomato | ₹781.99 | Debit | Food | Food Delivery
31-Dec-21 | Infinity Payment Received | ₹16375.35 | Credit | Savings | Credit Card Payment
02-Jan-22 | Spencer Retail | ₹2279.84 | Debit | Food | Groceries
09-Jan-22 | Reliance Trends | ₹1599.02 | Debit | Shopping | Clothes
09-Jan-22 | Reliance Trends | ₹4303.03 | Debit | Shopping | Clothes
12-Jan-22 | Amazon Recharge | ₹461.00 | Debit | Bills | Mobile Recharge
03-Sep-22 | Amazon | ₹1049.00 | Debit | Shopping | Amazon/Online Shopping
03-Sep-22 | Adobe Systems | ₹797.68 | Debit | Bills | Subscription
03-Sep-22 | GregMat | ₹416.14 | Debit | Education | Test Prep Subscription
04-Sep-22 | Spencer Retail | ₹4808.25 | Debit | Food | Groceries
07-Sep-22 | Spotify | ₹119.00 | Debit | Entertainment | Subscription
10-Sep-22 | Infinity Payment Received | ₹11302.53 | Credit | Savings | Credit Card Payment
13-Sep-22 | Adobe Premiere Pro | ₹1675.60 | Debit | Bills | Software Subscription
13-Sep-22 | Bharat Petroleum | ₹151.50 | Debit | Travel | Fuel
14-Sep-22 | Fuel Surcharge Reversal | ₹1.50 | Credit | Travel | Fuel Refund
16-Sep-22 | Amazon Recharge | ₹666.00 | Debit | Bills | Mobile Recharge
17-Sep-22 | Amazon Grocery | ₹1199.00 | Debit | Food | Groceries
18-Sep-22 | Krishnapatnam Kitchen | ₹5027.00 | Debit | Food | Restaurants
19-Sep-22 | Sri Venkateshwara Filling | ₹202.00 | Debit | Travel | Fuel
19-Sep-22 | Google Play | ₹650.00 | Debit | Bills | Subscription
22-Sep-22 | Amazon Grocery Refund | ₹1199.00 | Credit | Food | Grocery Refund
22-Sep-22 | Amazon Recharge | ₹542.00 | Debit | Bills | Mobile Recharge
23-Sep-22 | Amazon | ₹1499.00 | Debit | Shopping | Amazon/Online Shopping
24-Sep-22 | Sri Venkateshwara Filling | ₹202.36 | Debit | Travel | Fuel
26-Sep-22 | Subway | ₹799.00 | Debit | Food | Restaurants
01-Oct-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
02-Oct-22 | Amazon | ₹299.00 | Debit | Shopping | Amazon/Online Shopping
03-Oct-22 | Amazon | ₹931.00 | Debit | Shopping | Amazon/Online Shopping
03-Oct-22 | Reliance Retail Digital | ₹1799.00 | Debit | Shopping | Electronics
04-Oct-22 | Amazon | ₹219.00 | Debit | Shopping | Amazon/Online Shopping
04-Oct-22 | Amazon | ₹949.00 | Debit | Shopping | Amazon/Online Shopping
04-Oct-22 | Infinity Payment Received | ₹15235.64 | Credit | Savings | Credit Card Payment
05-Oct-22 | RedBus | ₹450.45 | Debit | Travel | Bus Tickets
07-Oct-22 | Spotify | ₹119.00 | Debit | Entertainment | Subscription
09-Oct-22 | Amazon | ₹805.00 | Debit | Shopping | Amazon/Online Shopping
09-Oct-22 | Amazon | ₹904.00 | Debit | Shopping | Amazon/Online Shopping
10-Oct-22 | Amazon Refund | ₹931.00 | Credit | Miscellaneous | Refund
10-Oct-22 | Amazon Refund | ₹949.00 | Credit | Miscellaneous | Refund
15-Oct-22 | Amazon | ₹188.00 | Debit | Shopping | Amazon/Online Shopping
16-Oct-22 | Amazon | ₹3179.00 | Debit | Shopping | Electronics
18-Oct-22 | Relief Foods | ₹1428.00 | Debit | Food | Groceries
19-Oct-22 | Google Play | ₹650.00 | Debit | Bills | Subscription
20-Oct-22 | RedBus | ₹2564.10 | Debit | Travel | Bus Tickets
26-Oct-22 | Adobe Creative Cloud | ₹1675.60 | Debit | Bills | Software Subscription
31-Oct-22 | Infinity Payment Received | ₹11251.15 | Credit | Savings | Credit Card Payment
01-Nov-22 | Zomato | ₹1081.50 | Debit | Food | Food Delivery
03-Nov-22 | Ostrich | ₹625.00 | Debit | Food | Dining Out
03-Nov-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
04-Nov-22 | Reliance Retail | ₹9292.00 | Debit | Shopping | Electronics
06-Nov-22 | Sri Mahatha Associates | ₹1628.00 | Debit | Housing | Repairs/Maintenance
06-Nov-22 | Amazon | ₹25.00 | Debit | Shopping | Amazon/Online Shopping
06-Nov-22 | Sri Radha Krishna Agencies | ₹211.80 | Debit | Food | Essentials
06-Nov-22 | Spencer Retail | ₹3364.28 | Debit | Food | Groceries
08-Nov-22 | INOX | ₹224.00 | Debit | Entertainment | Movies
10-Nov-22 | Amazon Recharge | ₹179.00 | Debit | Bills | Mobile Recharge
11-Nov-22 | Uengage | ₹656.25 | Debit | Bills | Online Service
11-Nov-22 | Amazon | ₹279.00 | Debit | Shopping | Amazon/Online Shopping
11-Nov-22 | Amazon Recharge | ₹91.00 | Debit | Bills | Mobile Recharge
14-Nov-22 | Infinity Payment Received | ₹18642.71 | Credit | Savings | Credit Card Payment
15-Nov-22 | Amazon Refund | ₹279.00 | Credit | Miscellaneous | Refund
16-Nov-22 | Adobe Creative Cloud | ₹1675.60 | Debit | Bills | Software Subscription
19-Nov-22 | Lepakashi Handicrafts | ₹1226.00 | Debit | Shopping | Home Decor
19-Nov-22 | Google Play | ₹650.00 | Debit | Bills | Subscription
22-Nov-22 | Amazon | ₹294.00 | Debit | Shopping | Amazon/Online Shopping
22-Nov-22 | Apple India | ₹1800.00 | Debit | Shopping | Electronics
25-Nov-22 | IRCTC | ₹4027.37 | Debit | Travel | Train Tickets
25-Nov-22 | Adobe Dublin | ₹2394.22 | Debit | Bills | Software Subscription
26-Nov-22 | RedBus | ₹1995.00 | Debit | Travel | Bus Tickets
26-Nov-22 | Adobe Refund | ₹982.24 | Credit | Miscellaneous | Refund
26-Nov-22 | IRCTC | ₹1388.90 | Debit | Travel | Train Tickets
27-Nov-22 | IRCTC Refund | ₹1175.00 | Credit | Travel | Ticket Refund
27-Nov-22 | RedBus Refund | ₹1695.75 | Credit | Travel | Ticket Refund
28-Nov-22 | IRCTC Refund | ₹3750.00 | Credit | Travel | Ticket Refund
03-Dec-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
06-Dec-22 | Infinity Payment Received | ₹8366.78 | Credit | Savings | Credit Card Payment
12-Dec-22 | Amazon Recharge | ₹406.00 | Debit | Bills | Mobile Recharge
14-Dec-22 | Amazon | ₹344.00 | Debit | Shopping | Amazon/Online Shopping
15-Dec-22 | Amazon Recharge | ₹719.00 | Debit | Bills | Mobile Recharge
15-Dec-22 | Spencer Retail | ₹2279.21 | Debit | Food | Groceries
15-Dec-22 | Reliance Retail | ₹10100.00 | Debit | Shopping | Electronics
17-Dec-22 | Amazon | ₹199.00 | Debit | Shopping | Amazon/Online Shopping
19-Dec-22 | Google Play | ₹650.00 | Debit | Bills | Subscription
26-Dec-22 | Adobe Creative Cloud | ₹2394.22 | Debit | Bills | Software Subscription
27-Dec-22 | Amazon | ₹599.00 | Debit | Shopping | Amazon/Online Shopping
30-Dec-22 | Amazon | ₹1922.00 | Debit | Shopping | Amazon/Online Shopping
30-Dec-22 | Home Town | ₹895.00 | Debit | Shopping | Furniture
30-Dec-22 | Infinity Payment Received | ₹17890.43 | Credit | Savings | Credit Card Payment
31-Dec-22 | Sathvisistini Endeavour | ₹1223.00 | Debit | Miscellaneous | General Purchase
01-Jan-23 | Amazon | ₹1681.00 | Debit | Shopping | Amazon/Online Shopping
02-Jan-23 | Amazon | ₹1527.00 | Debit | Shopping | Amazon/Online Shopping
03-Jan-23 | Sri Radha Krishna Agencies | ₹1011.80 | Debit | Food | Essentials
03-Jan-23 | Ram Pavan Filling Station | ₹1214.16 | Debit | Travel | Fuel
03-Jan-23 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
04-Jan-23 | Airtel | ₹486.16 | Debit | Bills | Mobile Recharge
06-Jan-23 | Uber | ₹179.77 | Debit | Travel | Cabs
06-Jan-23 | Uber | ₹93.65 | Debit | Travel | Cabs
07-Jan-23 | Lifestyle International | ₹2312.00 | Debit | Shopping | Clothes
07-Jan-23 | Lifestyle International | ₹5117.60 | Debit | Shopping | Clothes
07-Jan-23 | IKEA | ₹610.00 | Debit | Shopping | Furniture
07-Jan-23 | Uber | ₹79.33 | Debit | Travel | Cabs
10-Jan-23 | Uber | ₹203.87 | Debit | Travel | Cabs
12-Jan-23 | RedBus | ₹577.50 | Debit | Travel | Bus Tickets
15-Jan-23 | RedBus | ₹1050.00 | Debit | Travel | Bus Tickets
15-Jan-23 | Uber | ₹172.71 | Debit | Travel | Cabs
18-Jan-23 | Adobe Photography Plan | ₹398.84 | Debit | Bills | Subscription
18-Jan-23 | Infinity Payment Received | ₹2000.00 | Credit | Savings | Credit Card Payment
19-Jan-23 | Google Play | ₹650.00 | Debit | Bills | Subscription
21-Jan-23 | Burger King | ₹220.50 | Debit | Food | Restaurants
30-Jan-23 | Adobe Creative Cloud | ₹2394.22 | Debit | Bills | Software Subscription
01-Feb-23 | Infinity Payment Received | ₹19991.96 | Credit | Savings | Credit Card Payment
09-Feb-23 | MakeMyTrip | ₹1281.00 | Debit | Travel | Travel Booking
09-Feb-23 | IRCTC | ₹602.94 | Debit | Travel | Train Tickets
09-Feb-23 | IRCTC | ₹1052.29 | Debit | Travel | Train Tickets
14-Feb-23 | BookMyShow | ₹362.76 | Debit | Entertainment | Movies
14-Feb-23 | BookMyShow | ₹362.76 | Debit | Entertainment | Movies
14-Feb-23 | Sri Venkateshwara Filling | ₹303.00 | Debit | Travel | Fuel
15-Feb-23 | Uber | ₹199.05 | Debit | Travel | Cabs
15-Feb-23 | Uber | ₹391.59 | Debit | Travel | Cabs
15-Feb-23 | Uber | ₹258.94 | Debit | Travel | Cabs
19-Feb-23 | Metro Hyderabad | ₹364.00 | Debit | Travel | Metro
19-Feb-23 | Google Play | ₹650.00 | Debit | Bills | Subscription
28-Feb-23 | Infinity Payment Received | ₹18139.22 | Credit | Savings | Credit Card Payment
01-Mar-23 | Adobe Creative Cloud | ₹2394.22 | Debit | Bills | Software Subscription
07-Mar-23 | Amazon Gift Card | ₹5000.00 | Debit | Shopping | Gift Card
11-Mar-23 | Uber | ₹137.89 | Debit | Travel | Cabs
11-Mar-23 | Uber | ₹80.67 | Debit | Travel | Cabs
11-Mar-23 | Reliance Retail | ₹1899.00 | Debit | Shopping | General Shopping
19-Mar-23 | Google Play | ₹650.00 | Debit | Bills | Subscription
24-Mar-23 | Infinity Payment Received | ₹2549.21 | Credit | Savings | Credit Card Payment
31-Mar-23 | Amazon | ₹2990.00 | Debit | Shopping | Amazon/Online Shopping
13-Jan-22 | Kandukuri Family Shopping | ₹1185.00 | Debit | Family | Family Shopping
17-Jan-22 | Amazon Recharge | ₹679.00 | Debit | Bills | Mobile Recharge
22-Jan-22 | GoDaddy | ₹1194.54 | Debit | Bills | Domain/Hosting
23-Jan-22 | Late Payment Fee | ₹500.00 | Debit | Bills | Late Payment Charges
23-Jan-22 | SGST | ₹45.00 | Debit | Bills | Tax Charges
23-Jan-22 | CGST | ₹45.00 | Debit | Bills | Tax Charges
26-Jan-22 | Udemy | ₹455.00 | Debit | Education | Online Course
27-Jan-22 | Amazon | ₹2279.00 | Debit | Shopping | Amazon/Online Shopping
31-Jan-22 | Infinity Payment Received | ₹15891.42 | Credit | Savings | Credit Card Payment
02-Feb-22 | Backblaze | ₹545.87 | Debit | Bills | Cloud Storage Subscription
17-Feb-22 | PhonePe | ₹230.39 | Debit | People Transfers | Sent
18-Feb-22 | Amazon Recharge | ₹476.00 | Debit | Bills | Mobile Recharge
18-Feb-22 | PhonePe Refund | ₹230.39 | Credit | People Transfers | Refund
22-Feb-22 | Amazon | ₹1003.00 | Debit | Shopping | Amazon/Online Shopping
22-Feb-22 | Zomato | ₹423.25 | Debit | Food | Food Delivery
23-Feb-22 | GoDaddy | ₹1589.46 | Debit | Bills | Domain/Hosting
23-Feb-22 | Late Payment Fee | ₹100.00 | Debit | Bills | Late Payment Charges
25-Feb-22 | Amazon | ₹488.00 | Debit | Shopping | Amazon/Online Shopping
25-Feb-22 | Amazon | ₹3595.00 | Debit | Shopping | Electronics
26-Feb-22 | Amazon | ₹673.00 | Debit | Shopping | Amazon/Online Shopping
26-Feb-22 | Zomato | ₹747.45 | Debit | Food | Food Delivery
01-Mar-22 | PhonePe IRCTC | ₹240.50 | Debit | Travel | Train Tickets
01-Mar-22 | Adobe Subscription | ₹797.68 | Debit | Bills | Subscription
05-Mar-22 | Infinity Payment Received | ₹11217.95 | Credit | Savings | Credit Card Payment
16-Mar-22 | Amazon | ₹699.00 | Debit | Shopping | Amazon/Online Shopping
18-Mar-22 | Amazon | ₹1537.00 | Debit | Shopping | Amazon/Online Shopping
19-Mar-22 | Spencer Retail | ₹2796.00 | Debit | Food | Groceries
19-Mar-22 | Spencer Retail | ₹1484.40 | Debit | Food | Groceries
30-Mar-22 | INOX | ₹1236.00 | Debit | Entertainment | Movies
01-Apr-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
04-Apr-22 | Infinity Payment Received | ₹8550.08 | Credit | Savings | Credit Card Payment
06-Apr-22 | Zomato | ₹336.00 | Debit | Food | Food Delivery
07-Apr-22 | Amazon Recharge | ₹216.00 | Debit | Bills | Mobile Recharge
10-Apr-22 | Spencer Retail | ₹3613.85 | Debit | Food | Groceries
16-Apr-22 | INOX | ₹224.00 | Debit | Entertainment | Movies
25-Apr-22 | Zomato | ₹479.30 | Debit | Food | Food Delivery
30-Apr-22 | Infinity Payment Received | ₹7752.40 | Credit | Savings | Credit Card Payment
01-May-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
01-May-22 | Victory Bazars | ₹434.50 | Debit | Food | Groceries
08-May-22 | Jain Silk Palace | ₹1298.00 | Debit | Shopping | Clothes
11-May-22 | Amazon | ₹1122.00 | Debit | Shopping | Amazon/Online Shopping
12-May-22 | Amazon | ₹1092.00 | Debit | Shopping | Amazon/Online Shopping
12-May-22 | Amazon Recharge | ₹719.00 | Debit | Bills | Mobile Recharge
12-May-22 | Amazon Refund | ₹1122.00 | Credit | Miscellaneous | Refund
16-May-22 | Amazon | ₹379.00 | Debit | Shopping | Amazon/Online Shopping
16-May-22 | Reliance Trends | ₹2174.00 | Debit | Shopping | Clothes
16-May-22 | Amazon | ₹234.00 | Debit | Shopping | Amazon/Online Shopping
18-May-22 | SSP Private Ltd Bangalore | ₹7078.82 | Debit | Travel | Flights/Travel Booking
18-May-22 | Google Play | ₹2.00 | Debit | Bills | Subscription
20-May-22 | Venkataramana Agencies | ₹202.00 | Debit | Food | Essentials
24-May-22 | Amazon | ₹484.00 | Debit | Shopping | Amazon/Online Shopping
01-Jun-22 | Amazon | ₹1148.00 | Debit | Shopping | Amazon/Online Shopping
01-Jun-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
01-Jun-22 | Infinity Payment Received | ₹12007.75 | Credit | Savings | Credit Card Payment
02-Jun-22 | GoDaddy | ₹1766.46 | Debit | Bills | Domain/Hosting
07-Jun-22 | Amazon | ₹554.00 | Debit | Shopping | Amazon/Online Shopping
10-Jun-22 | Cleartrip | ₹9328.00 | Debit | Travel | Flights
10-Jun-22 | Amazon | ₹189.00 | Debit | Shopping | Amazon/Online Shopping
12-Jun-22 | Paytm | ₹330.12 | Debit | Bills | Wallet Payment
12-Jun-22 | Paytm | ₹660.24 | Debit | Bills | Wallet Payment
15-Jun-22 | Amazon | ₹166.00 | Debit | Shopping | Amazon/Online Shopping
16-Jun-22 | Paytm Movies | ₹377.64 | Debit | Entertainment | Movies
17-Jun-22 | Amazon | ₹598.00 | Debit | Shopping | Amazon/Online Shopping
19-Jun-22 | Subway | ₹1769.00 | Debit | Food | Restaurants
23-Jun-22 | Late Payment Fee | ₹500.00 | Debit | Bills | Late Payment Charges
23-Jun-22 | SGST | ₹45.00 | Debit | Bills | Tax Charges
23-Jun-22 | CGST | ₹45.00 | Debit | Bills | Tax Charges
26-Jun-22 | Amazon Recharge | ₹666.00 | Debit | Bills | Mobile Recharge
01-Jul-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
01-Jul-22 | Interest Charges | ₹467.73 | Debit | Bills | Credit Card Interest
03-Jul-22 | Infinity Payment Received | ₹20289.75 | Credit | Savings | Credit Card Payment
07-Jul-22 | Spotify | ₹2.00 | Debit | Entertainment | Subscription
08-Jul-22 | Amazon | ₹297.00 | Debit | Shopping | Amazon/Online Shopping
10-Jul-22 | Amazon Recharge | ₹50.00 | Debit | Bills | Mobile Recharge
10-Jul-22 | Amazon Recharge | ₹179.00 | Debit | Bills | Mobile Recharge
14-Jul-22 | Sri Radha Krishna Agencies | ₹211.80 | Debit | Food | Essentials
14-Jul-22 | Spencer Retail | ₹2681.00 | Debit | Food | Groceries
19-Jul-22 | Google Play | ₹650.00 | Debit | Bills | Subscription
20-Jul-22 | Udemy | ₹499.00 | Debit | Education | Online Course
23-Jul-22 | Amazon | ₹179.00 | Debit | Shopping | Amazon/Online Shopping
23-Jul-22 | Amazon | ₹716.00 | Debit | Shopping | Amazon/Online Shopping
28-Jul-22 | Amazon | ₹298.00 | Debit | Shopping | Amazon/Online Shopping
01-Aug-22 | Adobe Photography Plan | ₹797.68 | Debit | Bills | Subscription
04-Aug-22 | Amazon Recharge | ₹486.00 | Debit | Bills | Mobile Recharge
07-Aug-22 | Spotify | ₹119.00 | Debit | Entertainment | Subscription
08-Aug-22 | Amazon | ₹1327.00 | Debit | Shopping | Amazon/Online Shopping
09-Aug-22 | Infinity Payment Received | ₹7094.18 | Credit | Savings | Credit Card Payment
17-Aug-22 | Amazon | ₹18999.00 | Debit | Shopping | Electronics
17-Aug-22 | Infinity Payment Received | ₹1327.00 | Credit | Savings | Credit Card Payment
18-Aug-22 | Amazon | ₹458.00 | Debit | Shopping | Amazon/Online Shopping
19-Aug-22 | Google Play | ₹650.00 | Debit | Bills | Subscription
19-Aug-22 | Amazon | ₹2267.00 | Debit | Shopping | Electronics
19-Aug-22 | Infinity Payment Received | ₹18999.00 | Credit | Savings | Credit Card Payment`;

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
            id: `import_${Date.now()}_amazon_4_${i}`,
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
