const fs = require('fs');

const rawData = `24-Aug-25 | Previous Balance Carried Forward | ₹45,918.30 | Bills | Previous Statement Due
24-Aug-25 | Rewards Credited | +37,204 Coins | Rewards | Credit Card Rewards
24-Aug-25 | Statement Generated | ₹3,18,454.00 | Bills | Total Outstanding
24-Aug-25 | Minimum Due | ₹2,295.91 | Bills | Minimum Payment Due
24-Aug-25 | Available Credit Limit | ₹41,335.00 | Credit Limit | Remaining Limit
24-Aug-25 | Total Credit Limit | ₹3,60,000.00 | Credit Limit | Card Limit
-- High Value Purchase Breakdown --
28-Jul-25 | Orra Hyderabad | ₹278,221.00 | Shopping | Jewelry Purchase
27-Jul-25 | Vigneshwara Silks | ₹21,463.00 | Shopping | Clothing / Family Purchase
26-Jul-25 | MSW KM Fashions Hyderabad | ₹15,599.00 | Shopping | Clothing
09-Aug-25 | Air India | ₹12,927.00 | Travel | Flight Booking
07-Aug-25 | Indigo Airlines | ₹7,960.00 | Travel | Flight Booking
26-Jul-25 | Kashish Hyderabad | ₹7,035.00 | Shopping | Fashion / Accessories
10-Aug-25 | Travel on Scapia | ₹4,520.00 | Travel | Booking
19-Aug-25 | Indiejewel Fashions | ₹4,148.00 | Shopping | Fashion
17-Aug-25 | Travel on Scapia | ₹2,553.00 | Travel | Booking
11-Aug-25 | Meghana Foods | ₹2,235.00 | Food | Restaurant
27-Jul-25 | SMSK Health Care | ₹2,000.00 | Health | Medical
16-Aug-25 | Amazon | ₹2,499.00 | Shopping | Online Shopping
20-Aug-25 | Nykaa | ₹1,299.00 | Shopping | Personal Care
08-Aug-25 | Abhibus | ₹1,215.00 | Travel | Bus Booking
14-Aug-25 | Domino’s | ₹1,210.00 | Food | Restaurant
15-Aug-25 | DMart | ₹1,101.00 | Groceries | Supermarket
04-Aug-25 | Netflix | ₹499.00 | Entertainment | OTT Subscription`;

const API_URL = 'http://127.0.0.1:3000';
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function run() {
    console.log("Fetching expenses...");
    const res = await fetch(`${API_URL}/expenses`);
    const expenses = await res.json();
    
    const lines = rawData.split('\n').filter(l => l.trim().length > 0 && !l.includes('--'));
    
    let addedCount = 0;
    
    lines.forEach((line, i) => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 4) return;
        
        const title = parts[1];
        if (['Previous Balance Carried Forward', 'Rewards Credited', 'Statement Generated', 'Minimum Due', 'Available Credit Limit', 'Total Credit Limit'].includes(title)) {
            return;
        }
        
        const amtStr = parts[2];
        if (amtStr.includes('Coins')) return;
        
        const dateStr = parts[0]; 
        const dparts = dateStr.split('-'); 
        const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
        const monthNum = monthMap[dparts[1].toLowerCase()];
        const isoDate = `20${dparts[2]}-${monthNum}-${dparts[0].padStart(2, '0')}`;
        
        const isCredited = amtStr.includes('+');
        const amount = parseFloat(amtStr.replace(/[^\d.]/g, ''));
        
        const mainCat = parts[3];
        const subCat = parts[4] || parts[3];
        
        let txCategory = subCat.toLowerCase();
        
        const tx = {
            id: `import_${Date.now()}_scapia_4_${i}`,
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
            t => t.date === tx.date && t.amount === tx.amount && t.title.includes(tx.title)
        );
        
        // Looser matching for title because "SMSK Health Care Pvt Ltd" vs "SMSK Health Care"
        const existsLoose = expenses[yearStr][monthName].transactions.find(
            t => t.date === tx.date && t.amount === tx.amount
        );
        
        if (!existsLoose) {
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
