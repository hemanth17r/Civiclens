const admin = require('firebase-admin');

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: 'civiclens-dd80b',
            clientEmail: 'fake@fake.com',
            privateKey: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----\n'
        })
    });
    console.log('initializeApp SUCCESS');
    
    async function testFirestore() {
        try {
            const firestore = admin.firestore();
            await firestore.collection('users').limit(1).get();
            console.log('Firestore SUCCESS');
        } catch (e) {
            console.log('Firestore THREW:', e.message);
        }
    }
    testFirestore();

} catch (e) {
    console.log('initializeApp THREW:', e.message);
}
