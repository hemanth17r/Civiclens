require('dotenv').config({ path: '.env.local' });
console.log('Key exists:', !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log('Key starts with quotes?', process.env.FIREBASE_SERVICE_ACCOUNT_KEY.startsWith("'"));
    console.log('First 20 chars:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY.substring(0, 20));
}
