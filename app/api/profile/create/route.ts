import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

// POST /api/profile/create
// Creates a new user profile document via Admin SDK (bypasses App Check / Firestore client rules)
export async function POST(req: NextRequest) {
    try {
        // 1. Verify the caller is authenticated via their Firebase ID token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.substring(7);
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const uid = decodedToken.uid;

        // 2. Parse request body
        const body = await req.json();
        const { handle } = body;

        if (!handle || typeof handle !== 'string') {
            return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
        }

        // 3. Validate handle format (server-side revalidation)
        const cleanHandle = handle.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(cleanHandle)) {
            return NextResponse.json(
                { error: '3–20 chars, letters, numbers and underscores only.' },
                { status: 400 }
            );
        }

        const prefixedHandle = `@${cleanHandle}`;

        // 4. Atomically check uniqueness + create profile using a Firestore transaction
        const firestore = admin.firestore();
        const userRef = firestore.doc(`users/${uid}`);

        try {
            await firestore.runTransaction(async (tx) => {
                // Check if profile already exists
                const existingDoc = await tx.get(userRef);
                if (existingDoc.exists && existingDoc.data()?.handle) {
                    throw new Error('ALREADY_HAS_HANDLE');
                }

                // Check handle uniqueness
                const handleSnapshot = await firestore
                    .collection('users')
                    .where('handle', '==', prefixedHandle)
                    .limit(1)
                    .get();

                if (!handleSnapshot.empty) {
                    throw new Error('HANDLE_TAKEN');
                }

                // Create the profile
                const profileData = {
                    uid,
                    email: decodedToken.email || '',
                    displayName: decodedToken.name || 'Anonymous',
                    photoURL: decodedToken.picture || null,
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
        } catch (txErr: any) {
            if (txErr.message === 'HANDLE_TAKEN') {
                return NextResponse.json({ error: 'That handle is already taken. Try another.' }, { status: 409 });
            }
            if (txErr.message === 'ALREADY_HAS_HANDLE') {
                // Profile already complete — return success so modal closes
                return NextResponse.json({ success: true, alreadyExists: true }, { status: 200 });
            }
            throw txErr;
        }

        return NextResponse.json({ success: true }, { status: 201 });

    } catch (err: any) {
        console.error('[/api/profile/create] Error:', err);
        return NextResponse.json(
            { error: 'Internal server error. Please try again.' },
            { status: 500 }
        );
    }
}
