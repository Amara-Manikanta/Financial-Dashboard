const fs = require('fs');
const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));

console.log("Salary details years:");
if (data.salaryDetails) {
    data.salaryDetails.forEach(s => {
        console.log(`Year: ${s.year}, Month: ${s.month}, basic: ${s.basicSalary}`);
    });
}
