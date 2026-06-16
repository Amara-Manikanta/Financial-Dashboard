const xlsx = require('xlsx');
const workbook = xlsx.readFile('OpTransactionHistory15-06-2026.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log("Rows 1 to 15:");
for (let i = 0; i < Math.min(15, data.length); i++) {
    console.log(data[i]);
}
