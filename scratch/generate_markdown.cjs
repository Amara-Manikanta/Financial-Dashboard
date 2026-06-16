const fs = require('fs');

const raw = fs.readFileSync('categorized_transactions.csv', 'utf8').split('\n');
const transactions = [];

for (let i = 1; i < raw.length; i++) {
    if (!raw[i].trim()) continue;
    const parts = raw[i].split(',');
    if (parts.length >= 7) {
        transactions.push({
            date: parts[0],
            amount: parseFloat(parts[1]) || 0,
            type: parts[2],
            isCredit: parts[2] === 'Credit',
            mainCategory: parts[3].trim(),
            subCategory: parts[4].trim(),
            title: parts[5].trim()
        });
    }
}

const summary = {};
let totalDebit = 0;
let totalCredit = 0;

transactions.forEach(t => {
    if (!summary[t.mainCategory]) summary[t.mainCategory] = { debit: 0, credit: 0, items: [] };
    if (t.isCredit) {
        summary[t.mainCategory].credit += t.amount;
        totalCredit += t.amount;
    } else {
        summary[t.mainCategory].debit += t.amount;
        totalDebit += t.amount;
    }
    summary[t.mainCategory].items.push(t);
});

let md = `# Bank Statement Analysis (Updated with your Custom Rules!)\n\n`;
md += `**Total Income (Credits):** ₹${totalCredit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
md += `**Total Expenses (Debits):** ₹${totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n\n`;

md += `## Categorized Summary\n\n`;

const sortedCats = Object.keys(summary).sort((a, b) => summary[b].debit - summary[a].debit);

for (const cat of sortedCats) {
    md += `### ${cat}\n`;
    md += `- **Spends:** ₹${summary[cat].debit.toLocaleString()}\n`;
    md += `- **Income:** ₹${summary[cat].credit.toLocaleString()}\n\n`;
    
    md += `| Date | Description | Sub-Category | Amount | Type |\n`;
    md += `|---|---|---|---|---|\n`;
    
    const topItems = summary[cat].items.sort((a, b) => b.amount - a.amount).slice(0, 5);
    for (const item of topItems) {
        md += `| ${item.date} | ${item.title} | ${item.subCategory} | ₹${item.amount.toLocaleString()} | ${item.type} |\n`;
    }
    if (summary[cat].items.length > 5) {
        md += `| ... | *+ ${summary[cat].items.length - 5} more* | | | |\n`;
    }
    md += `\n`;
}

fs.writeFileSync('/Users/manikantaamara/.gemini/antigravity/brain/968ab96d-606d-4856-a1eb-8c5621de75cf/statement_analysis.md', md);
