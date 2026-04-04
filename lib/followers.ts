import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDoc, getDocs, query, where, serverTimestamp, runTransaction, increment } from 'firebase/firestore';

export interface FollowStats {
    followersCount: number;
    followingCount: number;
}

// Check if current user follows target user
export const getFollowStatus = async (currentUid: string, targetUid: string): Promise<boolean> => {
    if (!currentUid || !targetUid) return false;
    try {
        const followDocId = `${currentUid}_${targetUid}`;
        const followRef = doc(db, 'follows', followDocId);
        const snap = await getDoc(followRef);
        return snap.exists();
    } catch (e) {
        console.error('Error getting follow status:', e);
        return false;
    }
};

// Get followers/following count for a user
export const getFollowStats = async (uid: string): Promise<FollowStats> => {
    if (!uid) return { followersCount: 0, followingCount: 0 };
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            return {
                followersCount: data.followersCount || 0,
                followingCount: data.followingCount || 0
            };
        }
        return { followersCount: 0, followingCount: 0 };
    } catch (e) {
        console.error('Error getting follow stats:', e);
        return { followersCount: 0, followingCount: 0 };
    }
};

// Follow a user
export const followUser = async (currentUid: string, targetUid: string): Promise<void> => {
    if (!currentUid || !targetUid || currentUid === targetUid) return;

    const followDocId = `${currentUid}_${targetUid}`;
    const followRef = doc(db, 'follows', followDocId);

    try {
        await runTransaction(db, async (transaction) => {
            const followSnap = await transaction.get(followRef);
            if (followSnap.exists()) return; // Already following

            // 1. Create the follow record
            transaction.set(followRef, {
                followerId: currentUid,
                followingId: targetUid,
                createdAt: serverTimestamp()
            });

            // 2. Increment target's followersCount
            const targetUserRef = doc(db, 'users', targetUid);
            transaction.update(targetUserRef, {
                followersCount: increment(1)
            });

            // 3. Increment current user's followingCount
            const currentUserRef = doc(db, 'users', currentUid);
            transaction.update(currentUserRef, {
                followingCount: increment(1)
            });
        });
    } catch (e) {
        console.error('Error following user:', e);
        throw e;
    }
};

// Unfollow a user
export const unfollowUser = async (currentUid: string, targetUid: string): Promise<void> => {
    if (!currentUid || !targetUid || currentUid === targetUid) return;

    const followDocId = `${currentUid}_${targetUid}`;
    const followRef = doc(db, 'follows', followDocId);

    try {
        await runTransaction(db, async (transaction) => {
            const followSnap = await transaction.get(followRef);
            if (!followSnap.exists()) return; // Not following

            // 1. Delete the follow record
            transaction.delete(followRef);

            // 2. Decrement target's followersCount
            const targetUserRef = doc(db, 'users', targetUid);
            transaction.update(targetUserRef, {
                followersCount: increment(-1)
            });

            // 3. Decrement current user's followingCount
            const currentUserRef = doc(db, 'users', currentUid);
            transaction.update(currentUserRef, {
                followingCount: increment(-1)
            });
        });
    } catch (e) {
        console.error('Error unfollowing user:', e);
        throw e;
    }
};

// Get list of followers for a user
export const getFollowers = async (uid: string): Promise<any[]> => {
    if (!uid) return [];
    try {
        const followsQuery = query(collection(db, 'follows'), where('followingId', '==', uid));
        const snap = await getDocs(followsQuery);

        if (snap.empty) return [];

        const followerIds = snap.docs.map(doc => doc.data().followerId);

        // Fetch user profiles for these IDs
        const usersFn = followerIds.map(async (id) => {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
                return { uid: id, ...userDoc.data() };
            }
            return null;
        });

        const users = await Promise.all(usersFn);
        return users.filter(u => u !== null);
    } catch (e) {
        console.error('Error getting followers:', e);
        return [];
    }
};

// Get list of users a user is following
export const getFollowing = async (uid: string): Promise<any[]> => {
    if (!uid) return [];
    try {
        const followsQuery = query(collection(db, 'follows'), where('followerId', '==', uid));
        const snap = await getDocs(followsQuery);

        if (snap.empty) return [];

        const followingIds = snap.docs.map(doc => doc.data().followingId);

        // Fetch user profiles for these IDs
        const usersFn = followingIds.map(async (id) => {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
                return { uid: id, ...userDoc.data() };
            }
            return null;
        });

        const users = await Promise.all(usersFn);
        return users.filter(u => u !== null);
    } catch (e) {
        console.error('Error getting following:', e);
        return [];
    }
};
