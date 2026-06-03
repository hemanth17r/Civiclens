const admin = require('firebase-admin');
try {
    const ts = admin.firestore.FieldValue.serverTimestamp();
    console.log('Timestamp OK');
} catch (e) {
    console.error('Timestamp Error:', e);
}
