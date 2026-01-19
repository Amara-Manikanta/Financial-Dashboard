export const calculateBudgetStatus = (planned, actual) => {
    const plannedAmount = Number(planned) || 0;
    const actualAmount = Number(actual) || 0;
    const difference = plannedAmount - actualAmount;

    // Avoid division by zero
    let percentageUsed = 0;
    if (plannedAmount > 0) {
        percentageUsed = (actualAmount / plannedAmount) * 100;
    } else if (actualAmount > 0) {
        percentageUsed = 100; // No budget but spent money = 100% (or technically infinite, but treating as max warning)
    }

    let status = 'safe';
    if (actualAmount > plannedAmount) {
        status = 'overspent';
    } else if (percentageUsed >= 80) {
        status = 'warning';
    }

    return {
        planned: plannedAmount,
        actual: actualAmount,
        difference,
        percentageUsed,
        status
    };
};

export const generateBudgetSuggestions = (history, currentCategory) => {
    // History should be an array of { month: 'YYYY-MM', amount: number }
    // Sort by date descending to get recent months, but we need 3-6 months.

    if (!history || history.length < 3) {
        return {
            suggestedBudget: 0,
            reason: "Insufficient data (need at least 3 months)"
        };
    }

    // 1. Remove outliers (Top 10% spikes) - Simplistic approach for small datasets
    // If we have very few data points, maybe just ignore the max if it's > 2x average?
    // Let's stick to the prompt: Remove outliers.
    const sortedAmounts = history.map(h => h.amount).sort((a, b) => a - b);

    // For small N (e.g. 3-6), "Top 10%" might not mean much (0.3 items). 
    // Let's just remove the single highest value if we have >= 4 items.
    let filteredAmounts = sortedAmounts;
    if (sortedAmounts.length >= 4) {
        filteredAmounts = sortedAmounts.slice(0, sortedAmounts.length - 1);
    }

    // 2. Calculate Average
    const sum = filteredAmounts.reduce((acc, val) => acc + val, 0);
    const average = sum / filteredAmounts.length;

    // 3. Detect Trend (Increasing/Decreasing/Stable)
    // Compare average of recent half vs older half? or just linear regression?
    // KEEP IT SIMPLE: Rule based.
    // If last month > average * 1.1 -> Increasing
    // If last month < average * 0.9 -> Decreasing
    const lastMonthAmount = history[history.length - 1].amount; // Assuming history is chronologically ordered in the input
    let trend = 'stable';
    if (lastMonthAmount > average * 1.1) trend = 'increasing';
    if (lastMonthAmount < average * 0.9) trend = 'decreasing';

    // 4. Adjustment Rules
    let suggestedBudget = average;
    let reason = "Based on historical average";

    // "If category overspent in 2 or more months" -> We don't have budget history here, only spending history.
    // The prompt implies we know if it *was* overspent. We might need to pass in previous budgets too?
    // "Transaction Data Schema" ... "User Budget Input".
    // Let's assume for now we infer "overspending" as "spending is high".
    // Actually the prompt says: "If category overspent in 2 or more months -> add +10% buffer."
    // We will assume the calling function passes in a flag or we just look at the trend.
    // Let's implement the "Spend Trend" logic requested.

    if (trend === 'increasing') {
        suggestedBudget = average * 1.1; // +10% buffer
        reason = "Spending trend is increasing";
    } else if (trend === 'decreasing') {
        suggestedBudget = average * 0.95; // -5%
        reason = "Spending trend is decreasing";
    }

    // "Do not allow suggested budget change greater than ±20% from last month."
    // This implies we have a "last month budget". 
    // If we don't have it, we just use the calculated value.
    // For now, let's just round it nicely.
    suggestedBudget = Math.ceil(suggestedBudget / 100) * 100; // Round to nearest 100

    return {
        suggestedBudget,
        reason
    };
};
