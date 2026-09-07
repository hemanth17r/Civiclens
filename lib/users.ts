import { db } from './firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs,
    getCountFromServer
} from 'firebase/firestore';

/**
 * Handle Firestore permission-denied errors by retrying after a short delay.
 * Useful for the split-second after login before auth tokens propagate.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
    try {
        return await fn();
    } catch (e: any) {
        if (retries > 0 && (e.code === 'permission-denied' || e.message?.includes('permissions'))) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return withRetry(fn, retries - 1);
        }
        throw e;
    }
};
import { UserProfile } from '@/context/AuthContext';
export type { UserProfile };

// ── Short-lived in-memory cache for city leaderboards (TTL = 3 mins) ──
const CITY_CONTRIBUTORS_CACHE_TTL_MS = 3 * 60 * 1000;
const _cityContributorsCache = new Map<string, { data: UserProfile[]; expiresAt: number }>();

/**
 * Fetch top contributors in a specific city based on XP.
 * Cached in memory for 3 minutes to eliminate redundant reads on repeat views.
 */
export const getTopContributorsByCity = async (cityName: string, limitCount: number = 5): Promise<UserProfile[]> => {
    const cacheKey = `${cityName}_${limitCount}`;
    const cached = _cityContributorsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('city', '==', cityName),
            orderBy('xp', 'desc'),
            limit(limitCount + 5)
        );

        const snapshot = await withRetry(() => getDocs(q));
        const result = snapshot.docs
            .filter(doc => !doc.data()?.isBlocked)
            .slice(0, limitCount)
            .map(doc => ({
                uid: doc.id,
                ...doc.data()
            } as UserProfile));

        _cityContributorsCache.set(cacheKey, { data: result, expiresAt: Date.now() + CITY_CONTRIBUTORS_CACHE_TTL_MS });
        return result;
    } catch (error) {
        console.warn('Error fetching top contributors:', error);
        return [];
    }
};

const _cityRankCache = new Map<string, { rank: number; expiresAt: number }>();

/**
 * Get City Rank for a user based on XP
 */
export const getUserCityRank = async (cityName: string, userXp: number): Promise<number> => {
    if (!cityName || userXp <= 0) return 0;
    const cacheKey = `${cityName}_${userXp}`;
    const cached = _cityRankCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.rank;
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('city', '==', cityName),
            where('xp', '>', userXp) // Rank is count of users with strictly more XP + 1
        );
        const snapshot = await withRetry(() => getCountFromServer(q));
        const rank = snapshot.data().count + 1;
        _cityRankCache.set(cacheKey, { rank, expiresAt: Date.now() + CITY_CONTRIBUTORS_CACHE_TTL_MS });
        return rank;
    } catch (error) {
        console.warn('Error fetching city rank:', error);
        return 0; // Return 0 or null if error
    }
};
