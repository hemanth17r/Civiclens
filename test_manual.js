const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const keyMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.*?)'/s);
if (keyMatch) {
    const keyJson = keyMatch[1];
    const serviceAccount = JSON.parse(keyJson);
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('App initialized');
}

async function testTx() {
    const firestore = admin.firestore();
    const uid = 'test-uid-999';
    const prefixedHandle = '@test_agency999';
    const userRef = firestore.doc('users/' + uid);

    try {
        await firestore.runTransaction(async (tx) => {
            const existingDoc = await tx.get(userRef);
            
            const handleSnapshot = await firestore
                .collection('users')
                .where('handle', '==', prefixedHandle)
                .limit(1)
                .get();
                
            console.log('Inside tx, handleSnapshot empty?', handleSnapshot.empty);

            tx.set(userRef, {
                uid,
                handle: prefixedHandle,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        console.log('Transaction SUCCESS');
    } catch (e) {
        console.error('Transaction FAILED:', e);
    }
}
testTx();
