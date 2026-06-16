import * as XLSX from 'xlsx';

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function guessCategory(remarks, isCredit) {
    const raw = remarks.toLowerCase();
    
    if (isCredit) {
        if (raw.includes('salary') || raw.includes('sal')) return { main: 'Income', sub: 'Salary Received' };
        if (raw.includes('int.pd') || raw.includes('interest')) return { main: 'Income', sub: 'Interest Income' };
        if (raw.includes('refund') || raw.includes('reversal')) return { main: 'Income', sub: 'Refund' };
        if (raw.includes('dividend') || raw.includes('div')) return { main: 'Income', sub: 'Dividend' };
        return { main: 'Transfers', sub: 'Bank Transfer' };
    }
    
    if (raw.includes('payment against loan') || raw.includes('loan account')) return { main: 'Finance', sub: 'Loan EMI' };
    if (raw.includes('icici bank credit ca') || raw.includes('credit card')) return { main: 'Finance', sub: 'Credit Card Payment' };
    if (raw.includes('rent')) return { main: 'Housing', sub: 'House Rent' };
    if (raw.includes('zomato') || raw.includes('swiggy') || raw.includes('food')) return { main: 'Food', sub: 'Food Delivery' };
    if (raw.includes('restaurant') || raw.includes('cafe')) return { main: 'Food', sub: 'Dining Out' };
    if (raw.includes('blinkit') || raw.includes('zepto') || raw.includes('instamart') || raw.includes('bigbasket') || raw.includes('grocery') || raw.includes('supermarket') || raw.includes('jiomart')) return { main: 'Essentials', sub: 'Groceries' };
    if (raw.includes('uber') || raw.includes('ola') || raw.includes('rapido') || raw.match(/\bcab\b/)) return { main: 'Travel', sub: 'Cab' };
    if (raw.includes('irctc') || raw.includes('train')) return { main: 'Travel', sub: 'Train' };
    if (raw.includes('makemytrip') || raw.includes('indigo') || raw.includes('flight')) return { main: 'Travel', sub: 'Flight' };
    if (raw.includes('petrol') || raw.includes('fuel') || raw.includes('hpcl') || raw.includes('iocl') || raw.includes('bpcl')) return { main: 'Travel', sub: 'Fuel' };
    if (raw.includes('amazon') || raw.includes('flipkart') || raw.includes('myntra')) return { main: 'Shopping', sub: 'Online Shopping' };
    if (raw.includes('jio') || raw.includes('airtel') || raw.includes('recharge')) return { main: 'Utilities', sub: 'Mobile Recharge' };
    if (raw.includes('electricity') || raw.includes('bescom')) return { main: 'Utilities', sub: 'Electricity' };
    if (raw.includes('netflix') || raw.includes('prime') || raw.includes('spotify')) return { main: 'Subscriptions', sub: 'OTT' };
    if (raw.includes('credbill') || raw.includes('sbi card') || raw.includes('hdfc bank cc')) return { main: 'Finance', sub: 'Credit Card Payment' };
    if (raw.includes('zerodha') || raw.includes('groww') || raw.includes('upstox') || raw.includes('mutual fund') || raw.includes('sip')) return { main: 'Investments', sub: 'Mutual Funds' };
    if (raw.includes('ppf') || raw.includes('nps')) return { main: 'Investments', sub: 'PPF' };
    if (raw.includes('iwish')) return { main: 'Investments', sub: 'Fixed Deposit' };
    if (raw.includes('atm') || raw.includes('cash')) return { main: 'Transfers', sub: 'Cash Reserve' };
    if (raw.includes('tax') || raw.includes('tds')) return { main: 'Finance', sub: 'Tax Payment' };
    if (raw.includes('lic') || raw.includes('insurance')) return { main: 'Finance', sub: 'Insurance Premium' };
    if (raw.includes('hospital') || raw.includes('clinic') || raw.includes('pharmacy') || raw.includes('apollo') || raw.includes('medical')) return { main: 'Health', sub: 'Medical' };

    return { main: 'Miscellaneous', sub: 'Other' };
}

export const processBankStatement = async (file, categoryRules) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                let processing = false;
                let newTransactions = [];
                let updatedRules = { ...categoryRules };
                
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;
                    
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
                        
                        let title = remarks.split('/')[2] || remarks;
                        if (title.length > 30) title = title.substring(0, 30) + '...';
                        title = title.replace(/,/g, ' ').trim();
                        
                        // Check custom rules first
                        let cat = updatedRules[title];
                        
                        // Fallback
                        if (!cat) {
                            cat = guessCategory(remarks, isCredit);
                            if (cat.main !== 'Miscellaneous') {
                                updatedRules[title] = cat; // Learn it instantly
                            }
                        }
                        
                        // Parse DD/MM/YYYY
                        const dp = dateStr.split('/');
                        if (dp.length !== 3) continue;
                        const isoDate = `${dp[2]}-${String(parseInt(dp[1], 10)).padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
                        
                        const deductFromSalary = !cat.sub.toLowerCase().includes('tax');
                        
                        newTransactions.push({
                            id: `import_${Date.now()}_${i}`,
                            title: title,
                            amount: amount,
                            category: cat.sub.toLowerCase(),
                            date: isoDate,
                            paymentMode: "direct",
                            creditCardName: null,
                            isCredited: isCredit,
                            transactionType: isCredit ? 'credit' : 'debit',
                            deductFromSalary: deductFromSalary,
                            mainCategory: cat.main,
                            type: "monthly"
                        });
                    }
                }
                resolve({ newTransactions, updatedRules });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsArrayBuffer(file);
    });
};

export const mergeTransactionsIntoExpenses = (expenses, newTransactions) => {
    const updatedExpenses = JSON.parse(JSON.stringify(expenses));
    let addedCount = 0;
    
    newTransactions.forEach(tx => {
        const d = new Date(tx.date);
        const yearStr = String(d.getFullYear());
        const monthName = MONTH_NAMES[d.getMonth()];
        
        if (!updatedExpenses[yearStr]) updatedExpenses[yearStr] = {};
        if (!updatedExpenses[yearStr][monthName]) updatedExpenses[yearStr][monthName] = { transactions: [], categories: {} };
        if (!updatedExpenses[yearStr][monthName].transactions) updatedExpenses[yearStr][monthName].transactions = [];
        
        // Prevent dupes
        const exists = updatedExpenses[yearStr][monthName].transactions.find(
            t => t.date === tx.date && t.amount === tx.amount && t.title === tx.title
        );
        
        if (!exists) {
            updatedExpenses[yearStr][monthName].transactions.push(tx);
            addedCount++;
        }
    });

    // Rebuild categories using correct signed arithmetic (mirrors FinanceContext.addItem)
    Object.keys(updatedExpenses).forEach(year => {
        Object.keys(updatedExpenses[year]).forEach(month => {
            const monthData = updatedExpenses[year][month];
            if (monthData.transactions && monthData.transactions.length > 0) {
                const newCategories = {};
                monthData.transactions.forEach(t => {
                    if (t.deductFromSalary === false) return; // skip non-deductible (tax, etc)
                    const cat = t.category || 'others';
                    const amt = Number(t.amount) || 0;
                    const isIncome = t.mainCategory === 'Income' ||
                        ['salary received', 'income', 'salary', 'bonus', 'interest income', 'dividend', 'refund'].includes(cat.toLowerCase());
                    const effective = isIncome
                        ? (t.isCredited ? amt : -amt)
                        : (t.isCredited ? -amt : amt);
                    newCategories[cat] = (newCategories[cat] || 0) + effective;
                });
                // Remove zero or negative category entries from noise
                Object.keys(newCategories).forEach(k => {
                    if (newCategories[k] <= 0) delete newCategories[k];
                });
                monthData.categories = newCategories;
            }
        });
    });
    
    return { updatedExpenses, addedCount };
};
