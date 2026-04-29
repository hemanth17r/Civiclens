const fs = require('fs');
const admin = require('firebase-admin');

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split(/\r?\n/);
let saKeyStr = '';

for (const line of lines) {
  if (line.trim().startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
    saKeyStr = line.substring(line.indexOf('=') + 1).trim();
    break;
  }
}

let saKey;
try {
  // Remove wrapping quotes if present
  const keyStr = saKeyStr
    .replace(/\\n/g, '\n')
    .trim();

  const cleanKeyStr = (keyStr.startsWith("'") && keyStr.endsWith("'")) 
    ? keyStr.slice(1, -1) 
    : keyStr;

  saKey = JSON.parse(cleanKeyStr);

  if (saKey.private_key) {
    saKey.private_key = saKey.private_key.replace(/\\n/g, '\n');
  }
} catch (e) {
  console.error("Error parsing service account key:", e);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(saKey)
});

const db = admin.firestore();

async function run() {
  const notifs = await db.collection('notifications').get();
  console.log(`Found ${notifs.size} total notifications`);
  const userNotifs = [];
  notifs.forEach(doc => {
     const data = doc.data();
     if (data.userId === 'FyW3BjXcebZ0jqjP9ZXKMhROnWz1' || data.recipientId === 'FyW3BjXcebZ0jqjP9ZXKMhROnWz1') {
        userNotifs.push({id: doc.id, ...data});
     }
  });
  console.log(JSON.stringify(userNotifs, null, 2));
  
  process.exit(0);
}

run();
