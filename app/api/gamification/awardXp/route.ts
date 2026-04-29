import { NextResponse } from 'next/server';
import { admin, db } from '@/lib/firebase-admin';
import { CIVIC_LEVELS, XP_ACTIONS, BADGES, getLevelFromXp } from '@/lib/gamification';

/**
 * Server-side mirror of Badge checking logic.
 * Reads user data directly and calculates unlocked badges.
 */
function checkBadgeUnlocks(
    uid: string,
    action: keyof typeof XP_ACTIONS,
    userData: any,
    updateData: any,
    metadata?: { category?: string; hypeCount?: number }
) {
    const existing: string[] = userData.badges || [];
    const stats = userData.gamificationStats || {};
    const unlocked: any[] = [];

    const addIfNew = (badgeId: string) => {
        if (!existing.includes(badgeId) && BADGES[badgeId]) {
            unlocked.push(BADGES[badgeId]);
        }
    };

    if (action === 'REPORT_SUBMITTED') {
        const total = (stats.totalReports || 0) + 1;
        if (total >= 1) addIfNew('first_report');
        if (total >= 5) addIfNew('five_reports');
        if (total >= 10) addIfNew('ten_reports');

        if (metadata?.category === 'Road') {
            const roadCount = (stats.roadReports || 0) + 1;
            if (roadCount >= 5) addIfNew('road_specialist');
        }

        const hour = new Date().getHours();
        if (hour >= 22 || hour < 5) addIfNew('night_owl');
    }

    if (action === 'VERIFICATION_VOTE') {
        const total = (stats.totalVerifications || 0) + 1;
        if (total >= 1) addIfNew('first_verify');
        if (total >= 10) addIfNew('ten_verifications');
    }

    if (action === 'REPORT_RESOLVED') {
        const total = (stats.totalResolved || 0) + 1;
        if (total >= 1) addIfNew('first_resolved');
        if (total >= 5) addIfNew('five_resolved');
    }

    if (action === 'COMMENT_ADDED') {
        const total = (stats.totalComments || 0) + 1;
        if (total >= 20) addIfNew('helpful_commenter');
    }

    if (metadata?.hypeCount && metadata.hypeCount >= 50) {
        addIfNew('viral_report');
    }

    const streak = updateData.currentStreak !== undefined ? updateData.currentStreak : (userData.currentStreak || 0);
    if (streak >= 7) addIfNew('streak_7');
    if (streak >= 30) addIfNew('streak_30');

    return unlocked;
}

async function updateStreak(uid: string, updateData: Record<string, any>, currentData: any) {
    const lastActive = currentData.lastActiveDate;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!lastActive) {
        updateData.currentStreak = 1;
        updateData.longestStreak = 1;
        updateData.lastActiveDate = todayStr;
        return;
    }
    if (lastActive === todayStr) return;

    const lastDate = new Date(lastActive + 'T00:00:00');
    const todayDate = new Date(todayStr + 'T00:00:00');
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        const newStreak = (currentData.currentStreak || 0) + 1;
        updateData.currentStreak = newStreak;
        updateData.longestStreak = Math.max(currentData.longestStreak || 0, newStreak);
    } else {
        updateData.currentStreak = 1;
    }
    updateData.lastActiveDate = todayStr;
}

export async function POST(req: Request) {
    try {
        // Guard: ensure Firebase Admin SDK is properly initialized
        if (!db) {
            console.error('[awardXp] Firebase Admin SDK not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
            return NextResponse.json(
                { error: 'Server configuration error: Firebase Admin not initialized. See server logs.' },
                { status: 503 }
            );
        }

        // Basic Authorization check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (e) {
            console.error('Token verification error in gamification:', e);
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }

        const { action, metadata } = await req.json();
        const uid = decodedToken.uid;

        if (!XP_ACTIONS[action as keyof typeof XP_ACTIONS]) {
            return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
        }

        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const data = userSnap.data() || {};
        const currentXp = data.xp || 0;
        const currentBadges = data.badges || [];
        const xpAmount = XP_ACTIONS[action as keyof typeof XP_ACTIONS].xp;
        const newXp = currentXp + xpAmount;

        const oldLevel = getLevelFromXp(currentXp);
        const newLevel = getLevelFromXp(newXp);
        const leveledUp = newLevel.level > oldLevel.level;
        const levelChanged = newLevel.level !== oldLevel.level;

        const updateData: Record<string, any> = {
            xp: admin.firestore.FieldValue.increment(xpAmount),
        };

        if (levelChanged) {
            updateData.level = newLevel.level;
            updateData.levelTitle = newLevel.title;
        }

        switch (action) {
            case 'REPORT_SUBMITTED':
                updateData['gamificationStats.totalReports'] = admin.firestore.FieldValue.increment(1);
                break;
            case 'VERIFICATION_VOTE':
                updateData['gamificationStats.totalVerifications'] = admin.firestore.FieldValue.increment(1);
                break;
            case 'VERIFICATION_VOTE_REVOKED':
                updateData['gamificationStats.totalVerifications'] = admin.firestore.FieldValue.increment(-1);
                break;
            case 'COMMENT_ADDED':
                updateData['gamificationStats.totalComments'] = admin.firestore.FieldValue.increment(1);
                break;
            case 'REPORT_RESOLVED':
                updateData['gamificationStats.totalResolved'] = admin.firestore.FieldValue.increment(1);
                break;
        }

        await updateStreak(uid, updateData, data);
        
        const newBadges = checkBadgeUnlocks(uid, action as any, data, updateData, metadata);

        if (newBadges.length > 0) {
            const allBadges = [...new Set([...currentBadges, ...newBadges.map(b => b.id)])];
            updateData.badges = allBadges;
            
            const batch = db.batch();
            for (const badge of newBadges) {
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    targetUid: uid,
                    type: 'badge_unlocked',
                    isUrgent: false,
                    title: 'Badge Unlocked! 🏆',
                    body: `You unlocked the ${badge.name} badge: ${badge.description}`,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            await batch.commit();
        }

        await userRef.update(updateData);

        return NextResponse.json({
            success: true,
            xpAwarded: xpAmount,
            newXp,
            leveledUp,
            newLevel,
            newBadges,
        });
    } catch (error: any) {
        console.error('Failed to award XP (API):', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
