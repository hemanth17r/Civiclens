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
  const evaled = eval('(' + saKeyStr + ')');
  if (typeof evaled === 'string') {
    saKey = JSON.parse(evaled);
  } else {
    saKey = evaled;
  }
} catch (e) {
  if (saKeyStr.startsWith("'") || saKeyStr.startsWith('"')) {
     saKeyStr = saKeyStr.substring(1, saKeyStr.length - 1);
  }
  saKeyStr = saKeyStr.replace(/\\n/g, '\\n');
  saKey = JSON.parse(saKeyStr);
}

if (saKey.private_key) {
  saKey.private_key = saKey.private_key.replace(/\\n/g, '\n');
}

admin.initializeApp({
  credential: admin.credential.cert(saKey)
});

const db = admin.firestore();
const USER_ID = 'FyW3BjXcebZ0jqjP9ZXKMhROnWz1';

async function run() {
  // 1. Delete Notifications
  const notifs = await db.collection('notifications').where('targetUid', '==', USER_ID).get();
  let deletedCount = 0;
  for (const doc of notifs.docs) {
    await doc.ref.delete();
    deletedCount++;
  }
  console.log(`Deleted ${deletedCount} notifications for user.`);

  // 2. Delete missing issues by target user
  const issues = await db.collection('issues').where('userId', '==', USER_ID).get();
  deletedCount = 0;
  for (const doc of issues.docs) {
    await doc.ref.delete();
    deletedCount++;
  }
  console.log(`Deleted ${deletedCount} missed issues for user.`);

  process.exit(0);
}

run();
