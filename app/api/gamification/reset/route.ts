import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // Reset the user's gamification stats in Firestore back to 0
        const userRef = db.collection('users').doc(uid);
        await userRef.update({
            xp: 0,
            level: 1,
            badges: [],
            gamificationStats: {
                totalReports: 0,
                totalVerifications: 0,
                totalResolved: 0,
                totalComments: 0,
                roadReports: 0
            }
        });

        return NextResponse.json({ success: true, message: 'Gamification reset to 0' });
    } catch (e: any) {
        console.error('Error resetting gamification limit:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
