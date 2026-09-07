import { admin, db } from '@/lib/firebase-admin';
import { CIVIC_LEVELS, XP_ACTIONS, BADGES, getLevelFromXp } from '@/lib/gamification';

/**
 * Check and record badge unlocks on the server.
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

    return unlocked;
}

/**
 * Updates daily streaks server-side.
 */
async function updateStreak(uid: string, updateData: Record<string, any>, currentData: any) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const lastActive = currentData.lastActiveDate;

    if (!lastActive) {
        updateData.currentStreak = 1;
        updateData.longestStreak = Math.max(currentData.longestStreak || 0, 1);
        updateData.lastActiveDate = todayStr;
        return;
    }

    if (lastActive === todayStr) {
        return;
    }

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

/**
 * Server-side function to award XP directly using Firebase Admin SDK.
 * Can be called by API routes or server actions without self-HTTP requests.
 */
export async function awardXpServer(
    uid: string,
    action: keyof typeof XP_ACTIONS,
    metadata?: { category?: string; hypeCount?: number }
) {
    if (!db) {
        console.error('[awardXpServer] Firebase Admin SDK not initialized');
        return null;
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        console.warn(`[awardXpServer] User ${uid} not found`);
        return null;
    }

    const data = userSnap.data() || {};
    const currentXp = data.xp || 0;
    const currentBadges = data.badges || [];
    const xpConfig = XP_ACTIONS[action];
    if (!xpConfig) return null;

    const xpAmount = xpConfig.xp;
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
    const newBadges = checkBadgeUnlocks(uid, action, data, updateData, metadata);

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

    return {
        success: true,
        xpAwarded: xpAmount,
        newXp,
        leveledUp,
        newLevel,
        newBadges,
    };
}
