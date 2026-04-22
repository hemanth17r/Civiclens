import { NextResponse } from 'next/server';
import { admin, db } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        // Guard: ensure Firebase Admin SDK is properly initialized
        if (!db) {
            console.error('[missions/increment] Firebase Admin SDK not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
            return NextResponse.json(
                { error: 'Server configuration error: Firebase Admin not initialized. See server logs.' },
                { status: 503 }
            );
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (e) {
            console.error('Token verification error in missions:', e);
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }

        const { userCity, action, metadata } = await req.json();
        const userId = decodedToken.uid;

        // Fetch active missions
        const now = admin.firestore.Timestamp.now();
        const missionsRef = db.collection('missions');

        const snap = await missionsRef
            .where('isActive', '==', true)
            .where('expiresAt', '>', now)
            .orderBy('expiresAt', 'asc')
            .limit(20)
            .get();

        const activeMissions = snap.docs
            .map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }))
            .filter((m: any) => m.city === 'global' || m.city === userCity);

        if (activeMissions.length === 0) {
            return NextResponse.json({ missionCompleted: false });
        }

        for (const mission of activeMissions as any[]) {
            const categoryMatch = mission.category === action || mission.category === 'mixed';
            const issueCategoryMatch = !mission.issueCategory || (metadata?.issueCategory && metadata.issueCategory === mission.issueCategory);

            if (!categoryMatch || !issueCategoryMatch) continue;
            if (mission.maxCompletions > 0 && (mission.completions || 0) >= mission.maxCompletions) continue;

            const progressRef = db.collection('missions').doc(mission.id).collection('progress').doc(userId);
            const progressSnap = await progressRef.get();

            if (progressSnap.exists) {
                const progress = progressSnap.data() as any;
                if (progress.completed) continue;

                const newCount = (progress.currentCount || 0) + 1;
                const completed = newCount >= mission.targetCount;

                const updateData: any = {
                    currentCount: newCount,
                    completed,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (completed) updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();

                await progressRef.update(updateData);

                if (completed) {
                    await db.collection('missions').doc(mission.id).update({
                        completions: admin.firestore.FieldValue.increment(1)
                    });
                    return NextResponse.json({ missionCompleted: true, completedMission: mission, xpReward: mission.xpReward });
                }
            } else {
                const completed = 1 >= mission.targetCount;
                const setData: any = {
                    missionId: mission.id,
                    userId,
                    currentCount: 1,
                    completed,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (completed) setData.completedAt = admin.firestore.FieldValue.serverTimestamp();

                await progressRef.set(setData);

                if (completed) {
                    await db.collection('missions').doc(mission.id).update({
                        completions: admin.firestore.FieldValue.increment(1)
                    });
                    return NextResponse.json({ missionCompleted: true, completedMission: mission, xpReward: mission.xpReward });
                }
            }
        }

        return NextResponse.json({ missionCompleted: false });
    } catch (error: any) {
        console.error('Failed to increment mission progress (API):', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
