const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');

try {
    const data = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(data);

    if (!db.lents) {
        db.lents = [];
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        console.log('Successfully added "lents" key to db.json');
    } else {
        console.log('"lents" key already exists in db.json');
    }
} catch (error) {
    console.error('Error updating db.json:', error);
}
