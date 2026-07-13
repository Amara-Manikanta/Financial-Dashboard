const fs = require('fs');

const rawData = `24-Aug-25 | BMRC Namma Metro | ₹140.00 | Transport | Metro Travel
24-Aug-25 | BMRC Namma Metro | ₹70.00 | Transport | Metro Travel
27-Aug-25 | Zomato | ₹511.55 | Food | Online Food Order
31-Aug-25 | Suresh Productions Hyderabad | ₹885.00 | Entertainment | Movie / Event
31-Aug-25 | Suresh Productions Hyderabad | ₹170.00 | Entertainment | Movie / Event
02-Sep-25 | Netflix | ₹499.00 | Entertainment | OTT Subscription
02-Sep-25 | California Burrito Bangalore | ₹217.00 | Food | Restaurant
02-Sep-25 | KFC | ₹467.90 | Food | Restaurant
03-Sep-25 | KPN FF Bengaluru | ₹173.54 | Transport | Local Commute
03-Sep-25 | Swiggy | ₹751.00 | Food | Food Delivery
04-Sep-25 | DMart | ₹1,475.71 | Groceries | Supermarket Purchase
08-Sep-25 | KPN FF Bengaluru | ₹125.40 | Transport | Local Commute
12-Sep-25 | Airtel | ₹1,766.46 | Utilities | Mobile/Wifi Bill
13-Sep-25 | Myntra | ₹1,813.00 | Shopping | Fashion Purchase
13-Sep-25 | Myntra | ₹2,803.00 | Shopping | Fashion Purchase
13-Sep-25 | Rajanikant And Co Bangalore | ₹9,360.00 | Shopping | Major Purchase
14-Sep-25 | Meghana Foods Bangalore | ₹2,090.00 | Food | Restaurant
15-Sep-25 | BMRC Namma Metro | ₹70.00 | Transport | Metro Travel
15-Sep-25 | BMRC Namma Metro | ₹140.00 | Transport | Metro Travel
15-Sep-25 | DMart | ₹638.00 | Groceries | Supermarket Purchase
16-Sep-25 | Zomato | ₹174.75 | Food | Food Delivery
16-Sep-25 | Zomato | ₹219.95 | Food | Food Delivery
17-Sep-25 | Jio | ₹824.82 | Utilities | Mobile Recharge
17-Sep-25 | Zomato | ₹993.35 | Food | Food Delivery
19-Sep-25 | KPN FF Bengaluru | ₹143.01 | Transport | Local Commute
19-Sep-25 | Ofldev Bangalore | ₹66.00 | Miscellaneous | Small Purchase
19-Sep-25 | Ofldev Bangalore | ₹1,002.00 | Miscellaneous | Purchase
19-Sep-25 | Swiggy | ₹222.00 | Food | Food Delivery
21-Sep-25 | BMRC Namma Metro | ₹60.00 | Transport | Metro Travel
21-Sep-25 | BMRC Namma Metro | ₹60.00 | Transport | Metro Travel
21-Sep-25 | Ranjan C | ₹800.00 | Personal | Payment
21-Sep-25 | Nandi Selection | ₹280.00 | Shopping | Clothing / Retail
21-Sep-25 | Vidya Garments | ₹1,050.00 | Shopping | Clothing Purchase
21-Sep-25 | Mahadeva G V | ₹800.00 | Personal | Payment
21-Sep-25 | Eversub India Pvt Bangalore | ₹334.00 | Miscellaneous | Purchase
21-Sep-25 | Savi Ruchi Bengaluru | ₹195.00 | Food | Restaurant
22-Sep-25 | Zomato | ₹305.60 | Food | Food Delivery
23-Sep-25 | BMRC Namma Metro | ₹140.00 | Transport | Metro Travel
23-Sep-25 | BMRC Namma Metro | ₹70.00 | Transport | Metro Travel`;

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
        
        const title = parts[1];
        
        const dateStr = parts[0]; 
        const dparts = dateStr.split('-'); 
        const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
        const monthNum = monthMap[dparts[1].toLowerCase()];
        const isoDate = `20${dparts[2]}-${monthNum}-${dparts[0].padStart(2, '0')}`;
        
        const amtStr = parts[2];
        const isCredited = amtStr.includes('+');
        const amount = parseFloat(amtStr.replace(/[^\d.]/g, ''));
        
        const mainCat = parts[3];
        const subCat = parts[4] || parts[3];
        
        let txCategory = subCat.toLowerCase();
        
        const tx = {
            id: `import_${Date.now()}_scapia_5_${i}`,
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
        
        // Use a slightly looser match on ID to avoid duplicate filtering issues if there are multi-swipes in one day, but this can cause problems if they are identical. We'll use the ID index logic as well, or just append it.
        // In the user's data, there are literal duplicates: "24-Aug-25 | BMRC Namma Metro | ₹140.00 | Transport | Metro Travel" and "15-Sep-25 | BMRC Namma Metro | ₹70.00"
        // Wait, the user actually has multiple swipes in one day (e.g. 15-Sep-25 BMRC 140 and 70, or 21-Sep-25 BMRC 60 and 60).
        // Since my deduplication checks `t.date === tx.date && t.amount === tx.amount && t.title === tx.title`, it would skip the SECOND 60 swipe on 21-Sep-25!
        // To fix this, I will just append all from this raw list without checking for exists, or I check if the number of occurrences of this transaction in this current batch exceeds the ones in DB?
        // Let's just push them.
        
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
