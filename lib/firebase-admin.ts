import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (serviceAccountKey) {
            // Strip wrapping single quotes if present
            let keyContent = serviceAccountKey.trim();
            if (keyContent.startsWith("'") && keyContent.endsWith("'")) {
                keyContent = keyContent.substring(1, keyContent.length - 1);
            }

            // Fix common mangling: escaped double quotes or double-escaped newlines
            if (keyContent.includes('\\"')) {
                keyContent = keyContent.replace(/\\"/g, '"');
            }

            const serviceAccount = JSON.parse(keyContent);

            // Ensure private key has actual newlines
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            });
        } else {
            // Fallback: Application Default Credentials (Google Cloud environments)
            // This requires GOOGLE_APPLICATION_CREDENTIALS env var to be set,
            // or a service account JSON must be added as FIREBASE_SERVICE_ACCOUNT_KEY in .env.local
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'civiclens-dd80b',
            });
        }
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
        console.error(
            'To fix: Add FIREBASE_SERVICE_ACCOUNT_KEY to your .env.local file.\n' +
            '  1. Go to Firebase Console > Project Settings > Service Accounts\n' +
            '  2. Click "Generate new private key"\n' +
            '  3. Copy the JSON content and add it as:\n' +
            '     FIREBASE_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'\n'
        );
    }
}

const db = admin.apps.length ? admin.firestore() : (null as any);
export { db, admin };
