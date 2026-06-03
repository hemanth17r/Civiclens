const admin = require('firebase-admin');

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: 'civiclens-dd80b',
            clientEmail: 'fake@fake.com'
        })
    });
    console.log('initializeApp SUCCESS');
} catch (e) {
    console.log('initializeApp THREW:', e.message);
}
