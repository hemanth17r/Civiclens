/**
 * Flash Missions System for CivicLens
 *
 * Missions are city-scoped, time-limited civic challenges that grant
 * bonus XP for specific actions (e.g. "Verify 3 road issues in your city").
 * They drive focused engagement and help surface local priorities.
 */
import { db } from './firebase';
import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc,
    query, where, orderBy, Timestamp, addDoc, serverTimestamp, increment, limit
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type MissionCategory = 'report' | 'verify' | 'comment' | 'hype' | 'mixed';

export interface Mission {
    id: string;
    title: string;
    description: string;
    emoji: string;
    category: MissionCategory;
    /** Target count of actions to complete the mission */
    targetCount: number;
    /** XP reward on completion */
    xpReward: number;
    /** City scope (or 'global' for all cities) */
    city: string;
    /** Optional: specific issue category to target (e.g. 'Road', 'Drainage') */
    issueCategory?: string;
    /** Mission start time */
    startsAt: Timestamp;
    /** Mission end time */
    expiresAt: Timestamp;
    /** Whether the mission is currently active */
    isActive: boolean;
    /** Number of users who completed this mission */
    completions: number;
    /** Max completions (0 = unlimited) */
    maxCompletions: number;
    createdAt: Timestamp;
}

export interface MissionProgress {
    missionId: string;
    userId: string;
    currentCount: number;
    completed: boolean;
    completedAt?: Timestamp;
    lastUpdatedAt: Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════
// MISSION TEMPLATES — used for auto-generation
// ═══════════════════════════════════════════════════════════════════════

export const MISSION_TEMPLATES = [
    {
        title: 'Road Watch',
        description: 'Report {{count}} road issues in your city',
        emoji: '🛣️',
        category: 'report' as MissionCategory,
        issueCategory: 'Road',
        targetCount: 3,
        xpReward: 60,
        durationHours: 48,
    },
    {
        title: 'Verification Drive',
        description: 'Verify {{count}} issues in your area',
        emoji: '✅',
        category: 'verify' as MissionCategory,
        targetCount: 5,
        xpReward: 80,
        durationHours: 72,
    },
    {
        title: 'Community Voice',
        description: 'Comment on {{count}} issues to add context',
        emoji: '💬',
        category: 'comment' as MissionCategory,
        targetCount: 5,
        xpReward: 50,
        durationHours: 48,
    },
    {
        title: 'Rally Support',
        description: 'Hype {{count}} issues that need attention',
        emoji: '🔥',
        category: 'hype' as MissionCategory,
        targetCount: 10,
        xpReward: 40,
        durationHours: 24,
    },
    {
        title: 'Drainage Alert',
        description: 'Report {{count}} drainage problems',
        emoji: '🌊',
        category: 'report' as MissionCategory,
        issueCategory: 'Drainage',
        targetCount: 2,
        xpReward: 50,
        durationHours: 48,
    },
    {
        title: 'Civic Blitz',
        description: 'Complete {{count}} civic actions (report, verify, or comment)',
        emoji: '⚡',
        category: 'mixed' as MissionCategory,
        targetCount: 7,
        xpReward: 100,
        durationHours: 72,
    },
    {
        title: 'Waste Watchdog',
        description: 'Report {{count}} waste management issues',
        emoji: '🗑️',
        category: 'report' as MissionCategory,
        issueCategory: 'Waste',
        targetCount: 3,
        xpReward: 60,
        durationHours: 48,
    },
    {
        title: 'Power to the People',
        description: 'Report {{count}} electricity or infrastructure issues',
        emoji: '💡',
        category: 'report' as MissionCategory,
        issueCategory: 'Electricity',
        targetCount: 2,
        xpReward: 50,
        durationHours: 72,
    },
];

// ═══════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get active missions for a user's city.
 * Returns missions sorted by expiry (soonest first).
 */
export async function getActiveMissions(userCity: string): Promise<Mission[]> {
    try {
        const now = Timestamp.now();
        const missionsRef = collection(db, 'missions');

        // Get global + city-specific missions that haven't expired
        const q = query(
            missionsRef,
            where('isActive', '==', true),
            where('expiresAt', '>', now),
            orderBy('expiresAt', 'asc'),
            limit(20)
        );
        const snap = await getDocs(q);

        return snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Mission))
            .filter(m => m.city === 'global' || m.city === userCity);
    } catch (error) {
        console.warn('Failed to fetch missions:', error);
        return [];
    }
}

/**
 * Get a user's progress on all active missions.
 */
export async function getUserMissionProgress(
    userId: string,
    missionIds: string[]
): Promise<Record<string, MissionProgress>> {
    if (missionIds.length === 0) return {};

    try {
        const result: Record<string, MissionProgress> = {};

        // Batch fetch progress docs for each mission
        for (const mId of missionIds) {
            const progressRef = doc(db, 'missions', mId, 'progress', userId);
            const snap = await getDoc(progressRef);
            if (snap.exists()) {
                result[mId] = snap.data() as MissionProgress;
            }
        }

        return result;
    } catch (error) {
        console.warn('Failed to fetch mission progress:', error);
        return {};
    }
}

/**
 * Increment a user's mission progress via secure server-side API call.
 */
export async function incrementMissionProgress(
    userId: string,
    userCity: string,
    action: 'report' | 'verify' | 'comment' | 'hype',
    metadata?: { issueCategory?: string }
): Promise<{ missionCompleted: boolean; completedMission?: Mission; xpReward?: number }> {
    try {
        const { auth } = await import('./firebase');
        const user = auth.currentUser;
        if (!user || user.uid !== userId) return { missionCompleted: false };

        const token = await user.getIdToken();
        const res = await fetch('/api/missions/increment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userCity, action, metadata })
        });

        if (!res.ok) {
            console.error('Server failed to increment mission:', await res.text());
            return { missionCompleted: false };
        }
        return await res.json();
    } catch (error) {
        console.error('Failed to increment mission progress:', error);
        return { missionCompleted: false };
    }
}

/**
 * Create a new mission (admin/system function).
 */
export async function createMission(
    missionData: Omit<Mission, 'id' | 'completions' | 'createdAt'>
): Promise<string | null> {
    try {
        const docRef = await addDoc(collection(db, 'missions'), {
            ...missionData,
            completions: 0,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Failed to create mission:', error);
        return null;
    }
}

/**
 * Seed sample missions (dev utility).
 * Creates missions from templates for a given city.
 */
export async function seedMissionsForCity(city: string): Promise<number> {
    let count = 0;
    const now = new Date();

    for (const template of MISSION_TEMPLATES) {
        const expiresAt = new Date(now.getTime() + template.durationHours * 60 * 60 * 1000);

        await createMission({
            title: template.title,
            description: template.description.replace('{{count}}', String(template.targetCount)),
            emoji: template.emoji,
            category: template.category,
            targetCount: template.targetCount,
            xpReward: template.xpReward,
            city,
            issueCategory: template.issueCategory,
            startsAt: Timestamp.now(),
            expiresAt: Timestamp.fromDate(expiresAt),
            isActive: true,
            maxCompletions: 0,
        });
        count++;
    }

    return count;
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════

/** Format time remaining until expiry */
export function formatTimeRemaining(expiresAt: Timestamp): string {
    const now = Date.now();
    const expiry = expiresAt.toMillis();
    const diff = expiry - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h left`;
    }
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}
