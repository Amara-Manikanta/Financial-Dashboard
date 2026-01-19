async function testLentsUpdate() {
    const API_URL = 'http://127.0.0.1:3000';
    try {
        // 1. Fetch Lents
        console.log("Fetching lents...");
        const res = await fetch(`${API_URL}/lents`);
        const lents = await res.json();

        if (lents.length === 0) {
            console.log("No lents found to test.");
            return;
        }

        const item = lents[0];
        console.log(`Testing with Lent ID: ${item.id}, Name: ${item.name}`);
        console.log(`Initial Transactions Count: ${item.transactions ? item.transactions.length : 0}`);

        if (!item.transactions || item.transactions.length === 0) {
            console.log("No transactions to delete.");
            return;
        }

        // 2. Remove last transaction
        const originalTransactions = [...item.transactions];
        const txToDelete = originalTransactions.pop(); // Remove last
        const updatedItem = { ...item, transactions: originalTransactions };

        console.log(`Deleting Transaction ID: ${txToDelete.id}`);

        // 3. PUT update
        console.log("Sending PUT request...");
        const putRes = await fetch(`${API_URL}/lents/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedItem)
        });

        if (!putRes.ok) {
            console.error(`PUT failed with status: ${putRes.status}`);
            return;
        }

        const responseData = await putRes.json();
        console.log(`PUT Response Transactions Count: ${responseData.transactions.length}`);

        // 4. Verify fetch
        const verifyRes = await fetch(`${API_URL}/lents/${item.id}`);
        const verifyData = await verifyRes.json();
        console.log(`Verified Fetch Transactions Count: ${verifyData.transactions.length}`);

        if (verifyData.transactions.length === originalTransactions.length) {
            console.log("SUCCESS: Backend update worked.");

            // Restore (Optional, but good for idempotency if running locally)
            // console.log("Restoring original data...");
            // await fetch(`${API_URL}/lents/${item.id}`, {
            //     method: 'PUT',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(item)
            // });
        } else {
            console.error("FAILURE: Backend data mismatch.");
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

testLentsUpdate();
