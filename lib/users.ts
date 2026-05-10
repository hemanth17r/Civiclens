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

/**
 * Fetch top contributors in a specific city based on XP.
 */
export const getTopContributorsByCity = async (cityName: string, limitCount: number = 5): Promise<UserProfile[]> => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('city', '==', cityName),
            orderBy('xp', 'desc'),
            limit(limitCount)
        );

        const snapshot = await withRetry(() => getDocs(q));
        return snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        } as UserProfile));
    } catch (error) {
        console.warn('Error fetching top contributors:', error);
        return [];
    }
};

/**
 * Get City Rank for a user based on XP
 */
export const getUserCityRank = async (cityName: string, userXp: number): Promise<number> => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('city', '==', cityName),
            where('xp', '>', userXp) // Rank is count of users with strictly more XP + 1
        );
        const snapshot = await withRetry(() => getCountFromServer(q));
        return snapshot.data().count + 1;
    } catch (error) {
        console.warn('Error fetching city rank:', error);
        return 0; // Return 0 or null if error
    }
};
