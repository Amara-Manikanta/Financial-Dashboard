const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
const account = db.savings.find(acc => acc.title === 'Slice Account');

if (!account) {
    console.log("Slice Account not found");
    process.exit(1);
}

console.log("Account Interest Rate in DB:", account.interestRate);
console.log("Account ID:", account.id);
console.log("Transactions Count:", (account.transactions || []).length);
console.log("Account Amount in DB:", account.amount);

// Simulation Function
function calculateInterest(acc, rateOverride) {
    const transactions = [...(acc.transactions || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    const annualRate = rateOverride || acc.interestRate || 5.4;
    console.log(`Using Annual Rate: ${annualRate}%`);

    const ratePerDay = annualRate / 100 / 365;

    let currentDate = new Date(transactions[0].date);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(); // Today
    endDate.setHours(0, 0, 0, 0);

    let runningBalance = 0;
    let totalCalculatedInterest = 0;
    let existingInterestTotal = 0;

    const existingTxs = [...transactions];
    const newTransactions = [];

    // First sum existing interest
    transactions.forEach(t => {
        if (t.type === 'interest') existingInterestTotal += Number(t.amount);
    });
    console.log(`Existing Interest in DB: ${existingInterestTotal.toFixed(2)}`);
    const lastInterest = existingTxs.filter(t => t.type === 'interest').pop();
    if (lastInterest) console.log("Last Interest Date:", lastInterest.date);

    // Re-run simulation
    while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Process non-interest txs
        const daysTransactions = existingTxs.filter(t => t.date === dateStr && t.type !== 'interest');
        daysTransactions.forEach(tx => {
            const amount = Number(tx.amount);
            if (tx.type === 'deposit' || tx.type === 'monnies_redeemed') runningBalance += amount;
            else if (tx.type === 'withdraw') runningBalance -= amount;
        });

        // Check if interest exists
        const interestTx = existingTxs.find(t => t.date === dateStr && t.type === 'interest');

        if (interestTx) {
            runningBalance += Number(interestTx.amount);
        } else {
            if (runningBalance > 0) {
                const dailyInterest = runningBalance * ratePerDay;
                if (dailyInterest > 0.005) {
                    const amt = Number(dailyInterest.toFixed(2));
                    console.log(`[Missing] ${dateStr}: Bal ${runningBalance} -> Int ${amt}`);
                    totalCalculatedInterest += amt;
                    runningBalance += amt;
                }
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return existingInterestTotal + totalCalculatedInterest;
}

const total = calculateInterest(account);
console.log(`Final Simulated Total: ${total.toFixed(2)}`);
