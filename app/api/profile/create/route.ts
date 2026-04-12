import { NextRequest, NextResponse } from 'next/server';
import { admin, db } from '@/lib/firebase-admin';

const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(req: NextRequest) {
    // Guard: ensure Firebase Admin SDK is properly initialized
    if (!db) {
        console.error('[profile/create] Firebase Admin SDK not initialized.');
        return NextResponse.json(
            { error: 'Server configuration error. Please contact support.' },
            { status: 503 }
        );
    }

    // Verify Firebase ID token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken: admin.auth.DecodedIdToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
        console.error('[profile/create] Token verification failed:', e);
        return NextResponse.json({ error: 'Invalid or expired session. Please sign in again.' }, { status: 401 });
    }

    const uid = decodedToken.uid;

    // Parse and validate body
    let body: { handle?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const rawHandle = (body.handle || '').trim().replace(/^@/, '');

    if (!HANDLE_REGEX.test(rawHandle)) {
        return NextResponse.json(
            { error: '3–20 chars, letters, numbers and underscores only.' },
            { status: 400 }
        );
    }

    const handle = `@${rawHandle}`;

    try {
        // Check if user already has a profile with a handle
        const userRef = db.collection('users').doc(uid);
        const existingDoc = await userRef.get();
        if (existingDoc.exists && existingDoc.data()?.handle) {
            return NextResponse.json({ error: 'Profile already set up.' }, { status: 409 });
        }

        // Check handle uniqueness (case-insensitive via lowercase storage)
        const handleQuery = await db.collection('users')
            .where('handle', '==', handle)
            .limit(1)
            .get();

        if (!handleQuery.empty) {
            return NextResponse.json({ error: 'That handle is already taken. Try another.' }, { status: 409 });
        }

        // Build the profile document
        const profileData: Record<string, any> = {
            uid,
            email: decodedToken.email || '',
            displayName: decodedToken.name || 'Anonymous',
            photoURL: decodedToken.picture || null,
            handle,
            role: 'citizen',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            // Trust & Reputation defaults
            trustScore: 0.3,
            trustStats: {
                resolvedReports: 0,
                accurateVotes: 0,
                flaggedReports: 0,
                wrongVotes: 0,
            },
            // Gamification defaults
            xp: 0,
            level: 1,
            levelTitle: 'Observer',
            badges: [],
            currentStreak: 0,
            longestStreak: 0,
            gamificationStats: {
                totalReports: 0,
                totalVerifications: 0,
                totalComments: 0,
                totalResolved: 0,
            },
            // Follower counts
            followersCount: 0,
            followingCount: 0,
        };

        // Use set() — Admin SDK bypasses security rules and App Check
        await userRef.set(profileData);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[profile/create] Firestore write error:', err);
        return NextResponse.json(
            { error: 'Failed to save profile. Please try again.' },
            { status: 500 }
        );
    }
}
