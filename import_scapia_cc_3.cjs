const fs = require('fs');

const rawData = `24-Jul-25 | Jio | ₹706.82 | Utilities/Mobile Recharge
25-Jul-25 | Reddyvari Revathi | ₹84.00 | Personal Transfer
25-Jul-25 | Bill Payment | +₹10.00 | Credit Card Payment
25-Jul-25 | Amazon | ₹354.00 | Shopping
25-Jul-25 | Amazon Refund | +₹5,253.05 | Refund
25-Jul-25 | Sri Krishna Garden | ₹150.00 | Food/Dining
26-Jul-25 | Mrs Suvarna Reddypogu | ₹10.00 | Personal Transfer
26-Jul-25 | D N L N Srikar | ₹170.00 | Personal Transfer
26-Jul-25 | MSW KM Fashions Hyderabad | ₹15,599.00 | Shopping/Clothing
26-Jul-25 | Kashish Hyderabad | ₹7,035.00 | Shopping
26-Jul-25 | Myntra Refund | +₹1,479.00 | Refund
27-Jul-25 | SMSK Health Care Pvt Ltd | ₹2,000.00 | Healthcare
27-Jul-25 | Vigneshwara Silks Hyderabad | ₹21,463.00 | Shopping/Clothing
27-Jul-25 | Zomato | ₹1,493.35 | Food Delivery
28-Jul-25 | D N L N Srikar | ₹250.00 | Personal Transfer
28-Jul-25 | Bill Payment | +₹10.00 | Credit Card Payment
28-Jul-25 | Wow Momo | ₹110.00 | Food
28-Jul-25 | KFC | ₹658.35 | Food
28-Jul-25 | Bill Payment | +₹20,000.00 | Credit Card Payment
28-Jul-25 | Orra Hyderabad | ₹278,221.00 | Jewelry/Luxury Purchase
29-Jul-25 | Bill Payment | +₹500.00 | Credit Card Payment
29-Jul-25 | Amazon | ₹604.00 | Shopping
30-Jul-25 | Bill Payment | +₹1,000.00 | Credit Card Payment
30-Jul-25 | Bill Payment | +₹2,295.91 | Credit Card Payment
30-Jul-25 | Travel on Scapia | ₹282.27 | Travel
30-Jul-25 | Venkat Sri Nidhi Fuel Point | ₹100.00 | Fuel
31-Jul-25 | Bill Payment | +₹16,000.00 | Credit Card Payment
31-Jul-25 | Bill Payment | +₹14,000.00 | Credit Card Payment
31-Jul-25 | Bill Payment | +₹283.00 | Credit Card Payment
31-Jul-25 | Bill Payment | +₹100.00 | Credit Card Payment
31-Jul-25 | Venkat Sri Nidhi Fuel Point | ₹1.18 | Fuel
01-Aug-25 | Fuel Surcharge Waiver | +₹1.18 | Refund
02-Aug-25 | Mr Agolapu Harish | ₹170.00 | Personal Transfer
02-Aug-25 | Bill Payment | +₹170.00 | Credit Card Payment
03-Aug-25 | MakeMyTrip | ₹733.75 | Travel Booking
03-Aug-25 | Mr Suresh Kumar Tirumani | ₹72.00 | Personal Transfer
04-Aug-25 | Bill Payment | +₹72.00 | Credit Card Payment
04-Aug-25 | Netflix | ₹499.00 | Entertainment Subscription
04-Aug-25 | Bill Payment | +₹499.00 | Credit Card Payment
04-Aug-25 | MakeMyTrip Refund | +₹733.75 | Refund
05-Aug-25 | MakeMyTrip | ₹532.65 | Travel Booking
05-Aug-25 | Bill Payment | +₹533.00 | Credit Card Payment
06-Aug-25 | Bill Payment | +₹101.00 | Credit Card Payment`;

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
        
        const catStr = parts[3];
        const subCat = catStr;
        const mainCat = 'Others';
        
        let txCategory = subCat.toLowerCase();
        
        const tx = {
            id: `import_${Date.now()}_scapia_3_${i}`,
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
