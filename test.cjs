const fs = require('fs');
const d = JSON.parse(fs.readFileSync('db.json', 'utf8'));
console.log("2025 Jan salary received:", d.expenses["2025"]["January"].categories["salary received"]);
