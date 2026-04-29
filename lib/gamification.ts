/**
 * Gamification Engine for CivicLens
 * 
 * Manages XP, Levels, Badges, and Streaks for civic engagement.
 * XP is awarded for productive civic actions. Levels unlock progressively.
 * Badges are earned for specific achievements.
 */
import { db } from './firebase';
import {
    doc, getDoc, updateDoc, increment, serverTimestamp, Timestamp
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════
// LEVEL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

export const CIVIC_LEVELS = [
    { level: 1, title: 'Observer', minXp: 0, color: '#9CA3AF', emoji: '👁️' },
    { level: 2, title: 'Reporter', minXp: 100, color: '#3B82F6', emoji: '📝' },
    { level: 3, title: 'Advocate', minXp: 300, color: '#6366F1', emoji: '📢' },
    { level: 4, title: 'Watchdog', minXp: 600, color: '#8B5CF6', emoji: '🔍' },
    { level: 5, title: 'Changemaker', minXp: 1000, color: '#A855F7', emoji: '⚡' },
    { level: 6, title: 'Civic Hero', minXp: 1600, color: '#EC4899', emoji: '🦸' },
    { level: 7, title: 'Community Leader', minXp: 2500, color: '#F59E0B', emoji: '👑' },
    { level: 8, title: 'City Champion', minXp: 3500, color: '#F97316', emoji: '🏆' },
    { level: 9, title: 'Urban Sentinel', minXp: 5000, color: '#EF4444', emoji: '🛡️' },
    { level: 10, title: 'Urban Guardian', minXp: 7500, color: '#10B981', emoji: '🌟' },
] as const;

// ═══════════════════════════════════════════════════════════════════════
// XP AWARDS
// ═══════════════════════════════════════════════════════════════════════

export const XP_ACTIONS = {
    REPORT_SUBMITTED: { xp: 20, label: 'Report Submitted' },
    REPORT_RESOLVED: { xp: 50, label: 'Report Resolved' },
    VERIFICATION_VOTE: { xp: 10, label: 'Verified an Issue' },
    VERIFICATION_VOTE_REVOKED: { xp: -10, label: 'Revoked Verification Vote' },
    COMMENT_ADDED: { xp: 5, label: 'Commented' },
    FIRST_REPORT: { xp: 30, label: 'First Report Bonus' },
    DAILY_STREAK_BONUS: { xp: 15, label: 'Daily Streak Bonus' },
    HYPE_RECEIVED: { xp: 2, label: 'Hype Received' },
} as const;

// ═══════════════════════════════════════════════════════════════════════
// BADGE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

export interface Badge {
    id: string;
    name: string;
    description: string;
    emoji: string;
    color: string;
}

export const BADGES: Record<string, Badge> = {
    first_report: {
        id: 'first_report', name: 'First Step', description: 'Submit your first report',
        emoji: '🎯', color: '#3B82F6'
    },
    five_reports: {
        id: 'five_reports', name: 'Civic Voice', description: 'Submit 5 reports',
        emoji: '📣', color: '#6366F1'
    },
    ten_reports: {
        id: 'ten_reports', name: 'Town Crier', description: 'Submit 10 reports',
        emoji: '🔔', color: '#8B5CF6'
    },
    first_verify: {
        id: 'first_verify', name: 'Truth Seeker', description: 'Verify your first report',
        emoji: '✅', color: '#10B981'
    },
    ten_verifications: {
        id: 'ten_verifications', name: 'Fact Checker', description: 'Verify 10 reports',
        emoji: '🔬', color: '#059669'
    },
    first_resolved: {
        id: 'first_resolved', name: 'Problem Solver', description: 'Get your first report resolved',
        emoji: '🏅', color: '#F59E0B'
    },
    five_resolved: {
        id: 'five_resolved', name: 'Impact Maker', description: 'Get 5 reports resolved',
        emoji: '🌟', color: '#EAB308'
    },
    road_specialist: {
        id: 'road_specialist', name: 'Road Warrior', description: 'Report 5 road issues',
        emoji: '🛣️', color: '#7C3AED'
    },
    streak_7: {
        id: 'streak_7', name: 'Week Warrior', description: '7-day activity streak',
        emoji: '🔥', color: '#EF4444'
    },
    streak_30: {
        id: 'streak_30', name: 'Iron Will', description: '30-day activity streak',
        emoji: '💎', color: '#EC4899'
    },
    night_owl: {
        id: 'night_owl', name: 'Night Owl', description: 'Report an issue between 10 PM and 5 AM',
        emoji: '🦉', color: '#4338CA'
    },
    viral_report: {
        id: 'viral_report', name: 'Viral Voice', description: 'Get 50+ hypes on a report',
        emoji: '🚀', color: '#DC2626'
    },
    helpful_commenter: {
        id: 'helpful_commenter', name: 'Helpful Voice', description: 'Leave 20 comments',
        emoji: '💬', color: '#0EA5E9'
    },
};

// ═══════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/** Get level info from XP amount */
export function getLevelFromXp(xp: number): typeof CIVIC_LEVELS[number] {
    for (let i = CIVIC_LEVELS.length - 1; i >= 0; i--) {
        if (xp >= CIVIC_LEVELS[i].minXp) {
            return CIVIC_LEVELS[i];
        }
    }
    return CIVIC_LEVELS[0];
}

/** Get XP progress towards next level (0.0 - 1.0) */
export function getXpProgress(xp: number): { progress: number; currentLevelXp: number; nextLevelXp: number } {
    const current = getLevelFromXp(xp);
    const nextIndex = CIVIC_LEVELS.findIndex(l => l.level === current.level) + 1;

    if (nextIndex >= CIVIC_LEVELS.length) {
        return { progress: 1.0, currentLevelXp: current.minXp, nextLevelXp: current.minXp };
    }

    const next = CIVIC_LEVELS[nextIndex];
    const range = next.minXp - current.minXp;
    const earned = xp - current.minXp;
    return {
        progress: Math.min(1.0, earned / range),
        currentLevelXp: current.minXp,
        nextLevelXp: next.minXp,
    };
}

// ═══════════════════════════════════════════════════════════════════════
// XP AWARD FUNCTION
// ═══════════════════════════════════════════════════════════════════════

export interface XpAwardResult {
    success: boolean;
    xpAwarded: number;
    newXp: number;
    leveledUp: boolean;
    newLevel: typeof CIVIC_LEVELS[number];
    newBadges: Badge[];
}

/**
 * Award XP to a user and check for level-ups and badge unlocks.
 * Now acts as a client wrapper for the secure server action.
 */
export async function awardXp(
    uid: string,
    action: keyof typeof XP_ACTIONS,
    metadata?: { category?: string; hypeCount?: number }
): Promise<XpAwardResult | null> {
    try {
        const { auth } = await import('./firebase');
        const user = auth.currentUser;
        if (!user || user.uid !== uid) return null;

        const token = await user.getIdToken();
        const res = await fetch('/api/gamification/awardXp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action, metadata })
        });

        if (!res.ok) {
            console.error('Server failed to award XP:', await res.text());
            return null;
        }
        return await res.json();
    } catch (error) {
        console.error('Failed to award XP:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// BADGE UNLOCK LOGIC
// ═══════════════════════════════════════════════════════════════════════

function checkBadgeUnlocks(
    uid: string,
    action: keyof typeof XP_ACTIONS,
    userData: any,
    metadata?: { category?: string; hypeCount?: number }
): Badge[] {
    const existing: string[] = userData.badges || [];
    const stats = userData.gamificationStats || {};
    const unlocked: Badge[] = [];

    const addIfNew = (badgeId: string) => {
        if (!existing.includes(badgeId) && BADGES[badgeId]) {
            unlocked.push(BADGES[badgeId]);
        }
    };

    // Report-based badges
    if (action === 'REPORT_SUBMITTED') {
        const total = (stats.totalReports || 0) + 1; // +1 because hasn't been incremented yet
        if (total >= 1) addIfNew('first_report');
        if (total >= 5) addIfNew('five_reports');
        if (total >= 10) addIfNew('ten_reports');

        // Category specialist
        if (metadata?.category === 'Road') {
            const roadCount = (stats.roadReports || 0) + 1;
            if (roadCount >= 5) addIfNew('road_specialist');
        }

        // Night owl: check if current time is between 10 PM and 5 AM
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 5) {
            addIfNew('night_owl');
        }
    }

    // Verification badges
    if (action === 'VERIFICATION_VOTE') {
        const total = (stats.totalVerifications || 0) + 1;
        if (total >= 1) addIfNew('first_verify');
        if (total >= 10) addIfNew('ten_verifications');
    }

    // Resolution badges
    if (action === 'REPORT_RESOLVED') {
        const total = (stats.totalResolved || 0) + 1;
        if (total >= 1) addIfNew('first_resolved');
        if (total >= 5) addIfNew('five_resolved');
    }

    // Comment badges
    if (action === 'COMMENT_ADDED') {
        const total = (stats.totalComments || 0) + 1;
        if (total >= 20) addIfNew('helpful_commenter');
    }

    // Viral badge (checked externally when hypeCount reaches threshold)
    if (metadata?.hypeCount && metadata.hypeCount >= 50) {
        addIfNew('viral_report');
    }

    // Streak badges
    const streak = userData.currentStreak || 0;
    if (streak >= 7) addIfNew('streak_7');
    if (streak >= 30) addIfNew('streak_30');

    return unlocked;
}

// ═══════════════════════════════════════════════════════════════════════
// STREAK SYSTEM
// ═══════════════════════════════════════════════════════════════════════

/**
 * Updates streak data inline (adds to the updateData object).
 * Checks if user was active today; if this is a new day, increment streak.
 */
async function updateStreak(uid: string, updateData: Record<string, any>): Promise<void> {
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const lastActive = data.lastActiveDate;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // 'YYYY-MM-DD'

        if (!lastActive) {
            // First ever activity
            updateData.currentStreak = 1;
            updateData.longestStreak = 1;
            updateData.lastActiveDate = todayStr;
            return;
        }

        if (lastActive === todayStr) {
            // Already active today, no streak change
            return;
        }

        // Check if this is the next consecutive day
        const lastDate = new Date(lastActive + 'T00:00:00');
        const todayDate = new Date(todayStr + 'T00:00:00');
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            // Consecutive day — extend streak
            const newStreak = (data.currentStreak || 0) + 1;
            updateData.currentStreak = newStreak;
            updateData.longestStreak = Math.max(data.longestStreak || 0, newStreak);
        } else {
            // Streak broken — reset to 1
            updateData.currentStreak = 1;
        }

        updateData.lastActiveDate = todayStr;
    } catch (error) {
        console.error('Failed to update streak:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Get full gamification stats for a user (for profile display) */
export async function getUserGamificationStats(uid: string): Promise<{
    xp: number;
    level: typeof CIVIC_LEVELS[number];
    xpProgress: ReturnType<typeof getXpProgress>;
    badges: Badge[];
    currentStreak: number;
    longestStreak: number;
    stats: {
        totalReports: number;
        totalVerifications: number;
        totalComments: number;
        totalResolved: number;
    };
}> {
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            return {
                xp: 0,
                level: CIVIC_LEVELS[0],
                xpProgress: getXpProgress(0),
                badges: [],
                currentStreak: 0,
                longestStreak: 0,
                stats: { totalReports: 0, totalVerifications: 0, totalComments: 0, totalResolved: 0 },
            };
        }

        const data = snap.data();
        const xp = data.xp || 0;
        const badgeIds: string[] = data.badges || [];
        const gStats = data.gamificationStats || {};

        return {
            xp,
            level: getLevelFromXp(xp),
            xpProgress: getXpProgress(xp),
            badges: badgeIds.map(id => BADGES[id]).filter(Boolean),
            currentStreak: data.currentStreak || 0,
            longestStreak: data.longestStreak || 0,
            stats: {
                totalReports: gStats.totalReports || 0,
                totalVerifications: gStats.totalVerifications || 0,
                totalComments: gStats.totalComments || 0,
                totalResolved: gStats.totalResolved || 0,
            },
        };
    } catch {
        return {
            xp: 0,
            level: CIVIC_LEVELS[0],
            xpProgress: getXpProgress(0),
            badges: [],
            currentStreak: 0,
            longestStreak: 0,
            stats: { totalReports: 0, totalVerifications: 0, totalComments: 0, totalResolved: 0 },
        };
    }
}
