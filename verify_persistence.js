
const API_URL = 'http://127.0.0.1:3000';
const FUND_ID = 4;

async function verifyPersistence() {
    try {
        console.log('Fetching fund...');
        const res = await fetch(`${API_URL}/savings/${FUND_ID}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const fund = await res.json();
        console.log('Original transaction count:', fund.transactions.length);

        // Find the target transaction (2026-01-09)
        // Note: There might be multiple due to previous failed attempts or duplicates?
        // Let's delete ALL instances of this date to be sure.
        const txToDelete = fund.transactions.filter(t => t.date === '2026-01-09');
        if (txToDelete.length === 0) {
            console.log('Target transaction (2026-01-09) not found! Already deleted?');
            return;
        }
        console.log(`Found ${txToDelete.length} transactions to delete.`);

        const updatedTransactions = fund.transactions.filter(t => t.date !== '2026-01-09');
        const updatedFund = { ...fund, transactions: updatedTransactions };

        console.log('Sending PUT request...');
        const putRes = await fetch(`${API_URL}/savings/${FUND_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedFund)
        });

        console.log('PUT status:', putRes.status);
        const putData = await putRes.json();
        console.log('PUT response transaction count:', putData.transactions.length);

        // Wait a bit to ensure file write (json-server might be slow)
        await new Promise(r => setTimeout(r, 1000));

        console.log('Verifying with GET...');
        const verifyRes = await fetch(`${API_URL}/savings/${FUND_ID}`);
        const verifyData = await verifyRes.json();
        console.log('GET response transaction count:', verifyData.transactions.length);

        const check = verifyData.transactions.find(t => t.date === '2026-01-09');
        if (check) {
            console.error('FAILED: Transaction still exists!');
            process.exit(1);
        } else {
            console.log('SUCCESS: Transaction deleted persistently.');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

verifyPersistence();
