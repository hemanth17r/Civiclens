require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'civiclens-dd80b',
    });
}

const firestore = admin.firestore();
const uid = 'test-uid-123';
const prefixedHandle = '@test_agency';
const userRef = firestore.doc(users/ + uid);

async function testTransaction() {
    try {
        await firestore.runTransaction(async (tx) => {
            const existingDoc = await tx.get(userRef);
            
            const handleSnapshot = await firestore
                .collection('users')
                .where('handle', '==', prefixedHandle)
                .limit(1)
                .get();
                
            const profileData = {
                uid,
                email: 'test@example.com',
                displayName: 'Anonymous',
                photoURL: null,
                handle: prefixedHandle,
                role: 'citizen',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                trustScore: 0.3,
                trustStats: { resolvedReports: 0, accurateVotes: 0, flaggedReports: 0, wrongVotes: 0 },
                xp: 0,
                level: 1,
                levelTitle: 'Observer',
                badges: [],
                currentStreak: 0,
                longestStreak: 0,
                gamificationStats: { totalReports: 0, totalVerifications: 0, totalComments: 0, totalResolved: 0 },
                followersCount: 0,
                followingCount: 0,
            };

            tx.set(userRef, profileData);
        });
        console.log('Transaction SUCCESS');
    } catch (e) {
        console.error('Transaction FAILED:', e);
    }
}

testTransaction();
