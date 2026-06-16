const fs = require('fs');

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
const rules = JSON.parse(fs.readFileSync('category_rules.json', 'utf8'));

if (!db.appData) db.appData = {};
db.appData.categoryRules = rules;

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Successfully migrated rules to db.json");
