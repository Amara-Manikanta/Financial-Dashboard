const xlsx = require('xlsx');
const fs = require('fs');

// Simple heuristic matching
function guessCategory(remarks, isCredit) {
    remarks = remarks.toLowerCase();
    
    if (isCredit) {
        if (remarks.includes('salary') || remarks.includes('sal')) return { main: 'Income', sub: 'Salary' };
        if (remarks.includes('int.pd') || remarks.includes('interest')) return { main: 'Income', sub: 'Interest Income' };
        if (remarks.includes('refund') || remarks.includes('reversal')) return { main: 'Income', sub: 'Refund' };
        if (remarks.includes('dividend') || remarks.includes('div')) return { main: 'Income', sub: 'Dividend' };
        return { main: 'Transfers', sub: 'Bank Transfer' };
    }
    
    // Explicit user rules
    if (remarks.includes('payment against loan') || remarks.includes('loan account')) return { main: 'Finance', sub: 'Loan EMI' };
    if (remarks.includes('icici bank credit ca') || remarks.includes('credit card')) return { main: 'Finance', sub: 'Credit Card Payment' };
    if (remarks.includes('rent')) return { main: 'Housing', sub: 'House Rent' };

    // Expenses
    if (remarks.includes('zomato') || remarks.includes('swiggy') || remarks.includes('food')) return { main: 'Food', sub: 'Food Delivery' };
    if (remarks.includes('restaurant') || remarks.includes('cafe')) return { main: 'Food', sub: 'Dining Out' };
    if (remarks.includes('blinkit') || remarks.includes('zepto') || remarks.includes('instamart') || remarks.includes('bigbasket') || remarks.includes('grocery') || remarks.includes('supermarket') || remarks.includes('jiomart')) return { main: 'Essentials', sub: 'Groceries' };
    
    // Careful with short words like 'cab'
    if (remarks.includes('uber') || remarks.includes('ola') || remarks.includes('rapido') || remarks.match(/\bcab\b/)) return { main: 'Travel', sub: 'Cab' };
    
    if (remarks.includes('irctc') || remarks.includes('train')) return { main: 'Travel', sub: 'Train' };
    if (remarks.includes('makemytrip') || remarks.includes('indigo') || remarks.includes('flight')) return { main: 'Travel', sub: 'Flight' };
    if (remarks.includes('petrol') || remarks.includes('fuel') || remarks.includes('hpcl') || remarks.includes('iocl') || remarks.includes('bpcl')) return { main: 'Travel', sub: 'Fuel' };
    
    if (remarks.includes('amazon') || remarks.includes('flipkart') || remarks.includes('myntra')) return { main: 'Shopping', sub: 'Online Shopping' };
    if (remarks.includes('jio') || remarks.includes('airtel') || remarks.includes('recharge')) return { main: 'Utilities', sub: 'Mobile Recharge' };
    if (remarks.includes('electricity') || remarks.includes('bescom')) return { main: 'Utilities', sub: 'Electricity' };
    if (remarks.includes('netflix') || remarks.includes('prime') || remarks.includes('spotify')) return { main: 'Subscriptions', sub: 'OTT' };
    
    if (remarks.includes('credbill') || remarks.includes('sbi card') || remarks.includes('hdfc bank cc')) return { main: 'Finance', sub: 'Credit Card Payment' };
    if (remarks.includes('zerodha') || remarks.includes('groww') || remarks.includes('upstox') || remarks.includes('mutual fund') || remarks.includes('sip')) return { main: 'Investments', sub: 'Mutual Funds' };
    if (remarks.includes('ppf') || remarks.includes('nps')) return { main: 'Investments', sub: 'PPF' };
    if (remarks.includes('iwish')) return { main: 'Investments', sub: 'Fixed Deposit' };
    if (remarks.includes('atm') || remarks.includes('cash')) return { main: 'Transfers', sub: 'Cash Reserve' };
    if (remarks.includes('tax') || remarks.includes('tds')) return { main: 'Finance', sub: 'Tax Payment' };
    if (remarks.includes('lic') || remarks.includes('insurance')) return { main: 'Finance', sub: 'Insurance Premium' };
    if (remarks.includes('hospital') || remarks.includes('clinic') || remarks.includes('pharmacy') || remarks.includes('apollo') || remarks.includes('medical')) return { main: 'Health', sub: 'Medical' };

    return { main: 'Miscellaneous', sub: 'Other' };
}

function run() {
    const workbook = xlsx.readFile('OpTransactionHistory15-06-2026.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let transactions = [];
    let processing = false;
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.length === 0) continue;
        
        if (row.includes('S No.') && row.includes('Transaction Date')) {
            processing = true;
            continue; 
        }
        
        if (processing) {
            if (row[0] && typeof row[0] === 'string' && row[0].includes('Opening Balance')) break;
            if (row[1] && String(row[1]).includes('Page Total')) continue;
            
            const dateStr = row[3];
            const remarks = row[5];
            
            if (!dateStr || !remarks) continue;
            
            const debitStr = row[6] ? String(row[6]).replace(/,/g, '') : '0';
            const creditStr = row[7] ? String(row[7]).replace(/,/g, '') : '0';
            
            const debit = parseFloat(debitStr) || 0;
            const credit = parseFloat(creditStr) || 0;
            
            if (debit === 0 && credit === 0) continue;
            
            const isCredit = credit > 0;
            const amount = isCredit ? credit : debit;
            
            const cat = guessCategory(remarks, isCredit);
            
            // Generate clean title
            let title = remarks.split('/')[2] || remarks;
            if (title.length > 30) title = title.substring(0, 30) + '...';
            
            // Clean up commas for CSV
            const safeTitle = title.replace(/,/g, ' ');
            const safeRemarks = remarks.replace(/,/g, ' ').replace(/\n/g, ' ');
            
            transactions.push({
                date: dateStr,
                title: safeTitle,
                amount: amount,
                type: isCredit ? 'Credit' : 'Debit',
                mainCategory: cat.main,
                subCategory: cat.sub,
                originalRemarks: safeRemarks
            });
        }
    }
    
    // Create CSV
    let csv = "Date,Amount,Type,Main Category,Sub Category,Generated Title,Original Description\n";
    transactions.forEach(t => {
        csv += `${t.date},${t.amount},${t.type},${t.mainCategory},${t.subCategory},${t.title},${t.originalRemarks}\n`;
    });
    
    fs.writeFileSync('categorized_transactions.csv', csv);
    console.log(`Generated CSV with ${transactions.length} transactions.`);
}

run();
