const fs = require('fs');

try {
    const dbPath = 'db.json';
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    const MONTHLY_EARNINGS_DEFAULT = ['basicSalary', 'hra', 'conveyanceAllowance', 'flexibleAllowance', 'performanceBonus'];
    const MONTHLY_DEDUCTIONS_DEFAULT = ['epf', 'profTax', 'incomeTax', 'otherRecoveries'];

    const customEarnings = data.appData?.customSalaryFields?.monthlyEarnings?.map(f => f.key) || [];
    const customDeductions = data.appData?.customSalaryFields?.monthlyDeductions?.map(f => f.key) || [];

    const hiddenFields = data.appData?.hiddenSalaryFields || [];

    const activeEarnings = [...MONTHLY_EARNINGS_DEFAULT, ...customEarnings].filter(k => !hiddenFields.includes(k));
    const activeDeductions = [...MONTHLY_DEDUCTIONS_DEFAULT, ...customDeductions].filter(k => !hiddenFields.includes(k));

    let modified = false;

    if (data.salaryDetails && Array.isArray(data.salaryDetails)) {
        data.salaryDetails.forEach(record => {
            if (record.month === 'Annual' || record.type === 'annual') return;
            const year = record.year;
            const month = record.month;

            let gross = 0;
            let deductions = 0;

            activeEarnings.forEach(k => gross += (Number(record[k]) || 0));
            activeDeductions.forEach(k => deductions += (Number(record[k]) || 0));

            const netSalary = gross - deductions;

            if (netSalary > 0) {
                if (!data.expenses) data.expenses = {};
                if (!data.expenses[year]) data.expenses[year] = {};
                if (!data.expenses[year][month]) data.expenses[year][month] = { transactions: [], categories: {} };
                
                const monthData = data.expenses[year][month];
                if (!monthData.categories) monthData.categories = {};

                const existingSalary = monthData.categories['salary received'] || monthData.categories['salary'] || 0;
                
                // Always trust salaryDetails if it's explicitly entered!
                // But only if the discrepancy is large (like 0 vs 90k) or just overwrite.
                if (Math.abs(existingSalary - netSalary) > 10) {
                    monthData.categories['salary received'] = netSalary;
                    modified = true;
                    console.log(`Updated ${year} ${month} salary received from ${existingSalary} to ${netSalary}`);
                }
            }
        });
    }

    if (modified) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log("Successfully restored salary received from salaryDetails.");
    } else {
        console.log("No modifications needed.");
    }
} catch(e) {
    console.error(e);
}
