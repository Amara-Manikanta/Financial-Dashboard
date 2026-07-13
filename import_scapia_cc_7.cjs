const fs = require('fs');

const rawData = `24-Oct-25 | Travel on Scapia | ₹4,516.00 | Category: Travel Booking
24-Oct-25 | New Glass House Kakinada | ₹2,300.00 | Category: Shopping - Home/Glassware
25-Oct-25 | Rajesh Traders | ₹1,200.00 | Category: Local Merchant / Shopping
26-Oct-25 | Sri Radha Krishna Agencies | ₹100.00 | Category: Grocery / Local Store
26-Oct-25 | Bill Payment | +₹6,984.11 | Category: Credit Card Payment
26-Oct-25 | Bayyavarapu Valli Babji | ₹150.00 | Category: Personal Transfer/UPI
26-Oct-25 | Sri Radha Krishna Agencies Kakinada | ₹151.77 | Category: Grocery / Local Store
26-Oct-25 | Swiggy | ₹2,448.00 | Category: Food Delivery
27-Oct-25 | Sri Radha Krishna Agencies | ₹1.18 | Category: Grocery / Local Store
27-Oct-25 | More | ₹474.65 | Category: Grocery / Supermarket
27-Oct-25 | More | ₹286.00 | Category: Grocery / Supermarket
28-Oct-25 | Fuel Surcharge Waiver | +₹1.77 | Category: Refund / Cashback
28-Oct-25 | Fuel Surcharge Waiver | +₹1.18 | Category: Refund / Cashback
28-Oct-25 | Bill Payment | +₹286.00 | Category: Credit Card Payment
28-Oct-25 | Amazon | ₹1,33,449.00 | Category: Shopping - Online Purchase
29-Oct-25 | Amazon Refund | +₹1,33,449.00 | Category: Refund
31-Oct-25 | More | ₹93.40 | Category: Grocery / Supermarket
31-Oct-25 | Bill Payment | +₹95.00 | Category: Credit Card Payment
01-Nov-25 | Toni And Guy Essensual Ramagundam | ₹2,688.00 | Category: Personal Care / Salon
01-Nov-25 | Bill Payment | +₹2,688.00 | Category: Credit Card Payment
02-Nov-25 | Netflix | ₹499.00 | Category: Subscription - OTT
02-Nov-25 | Bill Payment | +₹500.00 | Category: Credit Card Payment
02-Nov-25 | Aroma Restaurant Adilabad | ₹3,476.00 | Category: Food - Restaurant
02-Nov-25 | Bill Payment | +₹3,415.11 | Category: Credit Card Payment
03-Nov-25 | Bill Payment | +₹22.00 | Category: Credit Card Payment
05-Nov-25 | Bill Payment | +₹8,500.00 | Category: Credit Card Payment
08-Nov-25 | Make My Trip | ₹2,998.25 | Category: Travel Booking
08-Nov-25 | Sai Surya Enterprises | ₹22.00 | Category: Local Merchant
08-Nov-25 | Bill Payment | +₹3,500.00 | Category: Credit Card Payment
09-Nov-25 | Srinivasa Auto Service Kakinada | ₹262.60 | Category: Vehicle Maintenance
09-Nov-25 | Bill Payment | +₹260.00 | Category: Credit Card Payment
09-Nov-25 | Sri Radha Krishna Agencies Kakinada | ₹344.01 | Category: Grocery / Local Store
09-Nov-25 | Bill Payment | +₹340.00 | Category: Credit Card Payment
09-Nov-25 | Kshatriya Foods Kakinada | ₹330.00 | Category: Food / Restaurant
09-Nov-25 | Bill Payment | +₹330.00 | Category: Credit Card Payment
11-Nov-25 | Fuel Surcharge Waiver | +₹4.01 | Category: Refund / Cashback
12-Nov-25 | Airtel | ₹1,790.06 | Category: Utility - Mobile/Internet Bill
12-Nov-25 | Bill Payment | +₹1,790.00 | Category: Credit Card Payment
12-Nov-25 | Fuel Surcharge Waiver | +₹2.60 | Category: Refund / Cashback
14-Nov-25 | DMart | ₹350.00 | Category: Grocery / Supermarket
15-Nov-25 | Travel on Scapia | ₹3,988.00 | Category: Travel Booking
15-Nov-25 | Jio | ₹824.82 | Category: Utility - Mobile Recharge/Bill
15-Nov-25 | Bill Payment | +₹840.00 | Category: Credit Card Payment
16-Nov-25 | Make My Trip | ₹469.35 | Category: Travel Booking
16-Nov-25 | Vakala Srinu | ₹60.00 | Category: Personal Transfer/UPI
16-Nov-25 | Vakala Srinu | ₹15.00 | Category: Personal Transfer/UPI
16-Nov-25 | Bill Payment | +₹100.00 | Category: Credit Card Payment
16-Nov-25 | Travel on Scapia | ₹1,338.03 | Category: Travel Booking
16-Nov-25 | Sri Sai Aravind Food | ₹25.00 | Category: Food / Snacks
16-Nov-25 | Bill Payment | +₹50.00 | Category: Credit Card Payment
17-Nov-25 | Bill Payment | +₹4,000.00 | Category: Credit Card Payment
17-Nov-25 | Amazon | ₹1,584.00 | Category: Shopping - Online Purchase
17-Nov-25 | Bill Payment | +₹1,584.00 | Category: Credit Card Payment
18-Nov-25 | Zepto | ₹311.00 | Category: Grocery / Quick Commerce
18-Nov-25 | Bill Payment | +₹311.00 | Category: Credit Card Payment
18-Nov-25 | Eureka Forbes | ₹11,300.00 | Category: Home Appliance Purchase
18-Nov-25 | KPN FF 3017 Hongasandra Bengaluru | ₹406.96 | Category: Transport / Travel
18-Nov-25 | Bill Payment | +₹410.00 | Category: Credit Card Payment
20-Nov-25 | KPN FF 3017 Hongasandra Bengaluru | ₹325.63 | Category: Transport / Travel
20-Nov-25 | Bill Payment | +₹326.00 | Category: Credit Card Payment
20-Nov-25 | Eureka Forbes | ₹11,299.00 | Category: Home Appliance Purchase
21-Nov-25 | Ofldev Bangalore | ₹69.00 | Category: Office / Miscellaneous
21-Nov-25 | Bill Payment | +₹69.00 | Category: Credit Card Payment
22-Nov-25 | Cinepolis | ₹280.00 | Category: Entertainment - Movies
22-Nov-25 | Rayalaseema Spice Bangalore | ₹314.00 | Category: Food - Restaurant
22-Nov-25 | Taco Bell | ₹407.00 | Category: Food - Fast Food
22-Nov-25 | Lulu Mall | ₹6,251.30 | Category: Shopping - Retail
22-Nov-25 | Bill Payment | +₹687.00 | Category: Credit Card Payment
23-Nov-25 | Bill Payment | +₹1,340.00 | Category: Credit Card Payment
23-Nov-25 | Bill Payment | +₹349.00 | Category: Credit Card Payment
24-Nov-25 | Bill Payment | +₹1,000.00 | Category: Credit Card Payment
24-Nov-25 | Bill Payment | +₹260.00 | Category: Credit Card Payment
25-Nov-25 | Amazon EMI | ₹8,434.36 | Category: EMI - Shopping Purchase`;

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
            id: `import_${Date.now()}_scapia_7_${i}`,
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
        
        // Since there could be intentional duplicates (multi swipes), we'll skip the exists check and just append, unless it gets messy. 
        // In the previous step I skipped the exists check and it added multiple correctly. 
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
