const fs = require('fs');

const rawData = `23-May-25 | Travel on Scapia | ₹2823.00 | Debit | Travel | Travel Booking
23-May-25 | MakeMyTrip | ₹846.00 | Debit | Travel | Travel Booking
23-May-25 | Udemy | ₹160.00 | Debit | Education | Online Course Purchase
25-May-25 | Credit Card Bill Generated | ₹3829.00 | Bill | Bills | Scapia Credit Card Bill
26-May-25 | Star Bazaar | ₹2426.03 | Debit | Groceries | Supermarket
26-May-25 | DMart | ₹973.50 | Debit | Groceries | Supermarket
27-May-25 | Amazon | ₹799.00 | Debit | Shopping | Online Shopping
27-May-25 | Amazon | ₹1899.00 | Debit | Shopping | Online Shopping
29-May-25 | Amazon | ₹999.00 | Debit | Shopping | Online Shopping
30-May-25 | Hari Hara Fuels | ₹462.58 | Debit | Transport | Fuel
31-May-25 | Zepto | ₹369.00 | Debit | Groceries | Quick Commerce
31-May-25 | Amazon | ₹275.00 | Debit | Shopping | Online Shopping
31-May-25 | Metro Brands | ₹3495.00 | Debit | Shopping | Footwear / Fashion
31-May-25 | Tikka Kebab | ₹45.00 | Debit | Food | Restaurant
01-Jun-25 | The Souled Store | ₹3177.00 | Debit | Shopping | Clothing
02-Jun-25 | KPN FF | ₹1031.50 | Debit | Transport | Fuel
02-Jun-25 | Life Care Medical | ₹173.00 | Debit | Health | Medical Store
04-Jun-25 | Netflix | ₹649.00 | Debit | Entertainment | Subscription
07-Jun-25 | MakeMyTrip | ₹572.65 | Debit | Travel | Travel Booking
08-Jun-25 | Paytm | ₹1778.44 | Debit | Transfers | Wallet / Recharge
10-Jun-25 | Travel on Scapia | ₹1276.53 | Debit | Travel | Travel Booking
12-Jun-25 | Airtel | ₹1766.46 | Debit | Bills | Internet / Mobile Bill
15-Jun-25 | Cred | ₹1839.00 | Debit | Finance | Credit Card Payment / Finance App
16-Jun-25 | Prathibha T R | ₹10.00 | Debit | Transfers | Person Transfer
16-Jun-25 | Zomato | ₹578.80 | Debit | Food | Food Delivery
16-Jun-25 | LIC | ₹38334.54 | Debit | Insurance | Life Insurance Premium
17-Jun-25 | KPN FF | ₹367.03 | Debit | Transport | Fuel
17-Jun-25 | Onesta | ₹913.00 | Debit | Food | Restaurant
17-Jun-25 | Manjunath | ₹60.00 | Debit | Transfers | Person Transfer
17-Jun-25 | Mr Murugan P | ₹110.00 | Debit | Transfers | Person Transfer
18-Jun-25 | Zepto | ₹213.00 | Debit | Groceries | Quick Commerce
18-Jun-25 | Reddyvari Revathi | ₹35.00 | Debit | Transfers | Person Transfer
18-Jun-25 | DMart | ₹96.00 | Debit | Groceries | Supermarket
19-Jun-25 | Jio | ₹470.82 | Debit | Bills | Mobile Recharge
19-Jun-25 | KPN FF | ₹463.15 | Debit | Transport | Fuel
21-Jun-25 | Headz Zone Salon | ₹250.00 | Debit | Personal Care | Salon
22-Jun-25 | KPN FF | ₹86.25 | Debit | Transport | Fuel
22-Jun-25 | Travel on Scapia | ₹3694.00 | Debit | Travel | Travel Booking
22-Jun-25 | Myntra | ₹2810.00 | Debit | Shopping | Fashion`;

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
            id: `import_${Date.now()}_scapia_1_${i}`,
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
