import { db } from "./firebase";
import { checkViralThreshold, notifyCitizenStatusUpdate } from "./notifications";
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    orderBy,
    getDocs,
    limit,
    startAfter,
    DocumentSnapshot,
    doc,
    runTransaction,
    increment,
    where,
    deleteDoc,
    getDoc,
    collectionGroup,
    Timestamp
} from "firebase/firestore";

export interface IssueData {
    title: string;
    category: string;
    description: string;
    location?: string; // Optional for now
    userId?: string; // Optional, placeholder
    imageUrl?: string; // URL from Firebase Storage

    // Social V2 Fields
    userHandle?: string; // e.g. @civic_hero
    userAvatar?: string; // URL
    hypeCount?: number;
    commentCount?: number;
    savesCount?: number;
    sharesCount?: number;

    // Location V2 Fields
    cityName?: string;
    cityCoordinates?: {
        lat: number;
        lng: number;
    };

    // Crowdsourced Status V3 Fields
    statusData?: {
        under_review: { yesWeight: number, noWeight: number, requiredThreshold: number },
        in_progress: { yesWeight: number, noWeight: number, requiredThreshold: number },
        resolved: { yesWeight: number, noWeight: number, requiredThreshold: number }
    }
}

export type IssueStatusState = 'Open' | 'Under Review' | 'In Progress' | 'Resolved';

export interface Issue extends IssueData {
    id: string;
    status: IssueStatusState;
    votes: number;
    createdAt: any; // Timestamp
    // Official Resolution fields
    resolvedByUid?: string;
    resolvedByHandle?: string;
    resolvedByDepartment?: string;
    resolvedStatement?: string;
    afterImageUrl?: string;
    resolvedAt?: any;
}

// ── Fetch single issue by ID ───────────────────────────────────────────────
export const getIssueById = async (issueId: string): Promise<Issue | null> => {
    if (!issueId) return null;
    try {
        const issueRef = doc(db, 'issues', issueId);
        const snap = await getDoc(issueRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Issue;
    } catch (error) {
        console.error('Error fetching issue by ID:', error);
        return null;
    }
};

import { INDIAN_CITIES } from "@/data/cities";

// Helper: Calculate Distance (Haversine)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

export const getFeedIssues = async (
    userCityName: string | null = 'Delhi'
) => {
    try {
        // 1. Identify user city & 5 nearest neighbours (city + 5 = 6 total)
        const userCity = INDIAN_CITIES.find(c => c.name === userCityName) || INDIAN_CITIES[1];

        const neighbors = INDIAN_CITIES
            .filter(c => c.name !== userCity.name)
            .map(c => ({
                ...c,
                distance: getDistanceFromLatLonInKm(userCity.lat, userCity.lng, c.lat, c.lng)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5); // ← 5 nearest neighbours only

        const targetCities = [userCity.name, ...neighbors.map(n => n.name)];

        // 2. Query the local cluster (Firestore 'in' supports up to 10 values — we use 6)
        const localQuery = query(
            collection(db, 'issues'),
            where('cityName', 'in', targetCities),
            limit(50)
        );

        const localSnapshot = await getDocs(localQuery);
        let issues = localSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));

        // 3. Sort: user's exact city first, then by hype
        issues.sort((a, b) => {
            const aLocal = a.cityName === userCity.name ? 1 : 0;
            const bLocal = b.cityName === userCity.name ? 1 : 0;
            if (aLocal !== bLocal) return bLocal - aLocal;
            return (b.votes || 0) - (a.votes || 0);
        });

        // Return whatever exists — no artificial fallback
        return issues.slice(0, 20);

    } catch (error) {
        console.error('Error fetching feed:', error);
        return [];
    }
};


export const getTrendingIssues = async (category?: string) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Fetch recent issues (broader set for scoring)
        const q = query(
            collection(db, 'issues'),
            where('createdAt', '>', sevenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const querySnapshot = await getDocs(q);
        let issues = querySnapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        } as Issue));

        // Filter by category if provided
        if (category && category !== 'All') {
            issues = issues.filter(i => i.category === category);
        }

        // Trending score: (hypes*2 + comments*1.5 + saves) / timeFactor
        // timeFactor = hours since creation + 2 (gravity)
        const now = Date.now();
        const scored = issues.map(issue => {
            const createdMs = issue.createdAt?.toDate?.() ? issue.createdAt.toDate().getTime() : now;
            const hoursOld = (now - createdMs) / (1000 * 60 * 60);
            const timeFactor = hoursOld + 2; // gravity constant
            const engagement = (issue.votes || 0) * 2 + (issue.commentCount || 0) * 1.5 + (issue.savesCount || 0);
            const score = engagement / timeFactor;
            return { ...issue, _trendScore: score };
        });

        scored.sort((a, b) => b._trendScore - a._trendScore);
        return scored.slice(0, 20);
    } catch (error) {
        console.error("Error fetching trending issues:", error);
        return [];
    }
};

export const getLeaderboardIssues = async (cityName: string | null) => {
    try {
        let q;
        if (cityName) {
            q = query(
                collection(db, 'issues'),
                where('status', '==', 'Open'),
                where('cityName', '==', cityName),
                limit(100) // we fetch 100 and sort in memory because firestore can't sort by sum of fields
            );
        } else {
            q = query(
                collection(db, 'issues'),
                where('status', '==', 'Open'),
                limit(100)
            );
        }

        const querySnapshot = await getDocs(q);
        const issues = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Issue));

        // Rank = (votes/hypes) + comments + shares + saves
        // Using "votes" as hypeCount here since the rest of the app uses it
        const rankedIssues = issues.map(issue => {
            const rank = (issue.votes || 0) + (issue.commentCount || 0) + (issue.sharesCount || 0) + (issue.savesCount || 0);
            return { ...issue, rank };
        });

        // Sort by rank descending
        rankedIssues.sort((a, b) => b.rank - a.rank);

        // Return top 5
        return rankedIssues.slice(0, 5);
    } catch (error) {
        console.error("Error fetching leaderboard issues:", error);
        return [];
    }
};

export const createIssue = async (data: IssueData) => {
    try {
        // --- Smart Triage: Category to Department Mapping ---
        let assignedDepartment = 'General';
        const categoryMap: Record<string, string> = {
            'Waste & Trash': 'Sanitation',
            'Water Flow': 'Water Supply',
            'Lighting': 'Electrical',
            'Roads & Transport': 'Public Works',
            'Flora': 'Horticulture',
            'Noise & Smell': 'Pollution Control',
            'Animals': 'Veterinary',
            'Security': 'Public Safety'
        };

        if (data.category) {
            assignedDepartment = categoryMap[data.category] || 'General';
        }

        const docRef = await addDoc(collection(db, "issues"), {
            ...data,
            status: "Open",
            assignedDepartment, // Auto-triaged department
            createdAt: serverTimestamp(),
            votes: 0,
            statusData: {
                under_review: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 },
                in_progress: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 },
                resolved: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 }
            }
        });
        console.log("Issue written with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
};

export const getPaginatedIssues = async (lastDoc: DocumentSnapshot | null = null, pageSize: number = 10, userId?: string) => {
    try {
        let baseQuery = collection(db, 'issues');
        let conditions: any[] = [];

        if (userId) {
            conditions.push(where('userId', '==', userId));
        }

        conditions.push(orderBy('createdAt', 'desc'));

        if (lastDoc) {
            conditions.push(startAfter(lastDoc));
        }

        conditions.push(limit(pageSize));

        const q = query(baseQuery, ...conditions);
        const querySnapshot = await getDocs(q);
        const issues = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Issue));

        const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

        return { issues, lastVisible };
    } catch (error) {
        console.error("Error fetching paginated issues:", error);
        return { issues: [], lastVisible: null };
    }
};

export const hypeIssue = async (issueId: string, userId: string) => {
    if (!issueId || !userId) return false;

    const issueRef = doc(db, 'issues', issueId);
    const hypeRef = doc(db, 'issues', issueId, 'hypes', userId);

    try {
        await runTransaction(db, async (transaction) => {
            const hypeDoc = await transaction.get(hypeRef);
            if (hypeDoc.exists()) {
                throw "User already hyped this issue";
            }

            transaction.set(hypeRef, {
                userId,
                issueId,
                createdAt: serverTimestamp()
            });

            transaction.update(issueRef, {
                votes: increment(1)
            });
        });
        // Fire-and-forget: check if this hype crossed the viral threshold
        checkViralThreshold(issueId).catch(() => { });
        return true;
    } catch (e) {
        console.log("Hype failed or already hyped:", e);
        return false;
    }
};

export const unhypeIssue = async (issueId: string, userId: string) => {
    if (!issueId || !userId) return false;
    const issueRef = doc(db, 'issues', issueId);
    const hypeRef = doc(db, 'issues', issueId, 'hypes', userId);
    try {
        await runTransaction(db, async (transaction) => {
            const hypeDoc = await transaction.get(hypeRef);
            if (!hypeDoc.exists()) throw "Not hyped";
            transaction.delete(hypeRef);
            transaction.update(issueRef, { votes: increment(-1) });
        });
        return true;
    } catch (e) {
        console.log("Unhype failed:", e);
        return false;
    }
};

export const hasUserHyped = async (issueId: string, userId: string) => {
    if (!issueId || !userId) return false;
    const hypeRef = doc(db, 'issues', issueId, 'hypes', userId);
    const snap = await getDoc(hypeRef);
    return snap.exists();
};

// ── Save / Unsave ──────────────────────────────────────────────────────────
export const saveIssue = async (issueId: string, userId: string) => {
    if (!issueId || !userId) return false;
    const issueRef = doc(db, 'issues', issueId);
    const saveRef = doc(db, 'issues', issueId, 'saves', userId);
    try {
        await runTransaction(db, async (transaction) => {
            const saveDoc = await transaction.get(saveRef);
            if (saveDoc.exists()) throw "Already saved";
            transaction.set(saveRef, { userId, issueId, createdAt: serverTimestamp() });
            transaction.update(issueRef, { savesCount: increment(1) });
        });
        return true;
    } catch (e) {
        console.log("Save failed:", e);
        return false;
    }
};

export const unsaveIssue = async (issueId: string, userId: string) => {
    if (!issueId || !userId) return false;
    const issueRef = doc(db, 'issues', issueId);
    const saveRef = doc(db, 'issues', issueId, 'saves', userId);
    try {
        await runTransaction(db, async (transaction) => {
            const saveDoc = await transaction.get(saveRef);
            if (!saveDoc.exists()) throw "Not saved";
            transaction.delete(saveRef);
            transaction.update(issueRef, { savesCount: increment(-1) });
        });
        return true;
    } catch (e) {
        console.log("Unsave failed:", e);
        return false;
    }
};

export const hasUserSaved = async (issueId: string, userId: string) => {
    if (!issueId || !userId) return false;
    const saveRef = doc(db, 'issues', issueId, 'saves', userId);
    const snap = await getDoc(saveRef);
    return snap.exists();
};

// ── Comments ───────────────────────────────────────────────────────────────
export interface CommentData {
    id: string;
    userId: string;
    userHandle: string;
    userAvatar?: string;
    text: string;
    createdAt: any;
    likes: number;
    isOfficial?: boolean;
    department?: string;
}

export interface ReplyData {
    id: string;
    userId: string;
    userHandle: string;
    userAvatar?: string;
    text: string;
    createdAt: any;
    likes: number;
}

export const addComment = async (
    issueId: string,
    userId: string,
    text: string,
    handle: string,
    avatarUrl?: string,
    isOfficial?: boolean,
    department?: string
) => {
    if (!issueId || !userId || !text.trim()) return null;
    const issueRef = doc(db, 'issues', issueId);
    const commentData: any = {
        userId,
        issueId,
        userHandle: handle,
        text: text.trim(),
        likes: 0,
        createdAt: serverTimestamp()
    };
    if (avatarUrl) commentData.userAvatar = avatarUrl;
    if (isOfficial) {
        commentData.isOfficial = true;
        commentData.department = department || '';
    }

    const docRef = await addDoc(collection(db, 'issues', issueId, 'comments'), commentData);

    // Increment comment count on issue
    try {
        await runTransaction(db, async (t) => {
            t.update(issueRef, { commentCount: increment(1) });
        });
    } catch (e) { console.error('Failed to increment commentCount', e); }

    return docRef.id;
};

export const getComments = async (issueId: string): Promise<CommentData[]> => {
    if (!issueId) return [];
    const q = query(
        collection(db, 'issues', issueId, 'comments'),
        orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CommentData));
};

export const addReply = async (
    issueId: string,
    commentId: string,
    userId: string,
    text: string,
    handle: string,
    avatarUrl?: string
) => {
    if (!issueId || !commentId || !userId || !text.trim()) return null;
    const replyData: any = {
        userId,
        userHandle: handle,
        text: text.trim(),
        likes: 0,
        createdAt: serverTimestamp()
    };
    if (avatarUrl) replyData.userAvatar = avatarUrl;
    const docRef = await addDoc(
        collection(db, 'issues', issueId, 'comments', commentId, 'replies'),
        replyData
    );
    return docRef.id;
};

export const getReplies = async (issueId: string, commentId: string): Promise<ReplyData[]> => {
    if (!issueId || !commentId) return [];
    const q = query(
        collection(db, 'issues', issueId, 'comments', commentId, 'replies'),
        orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReplyData));
};

export const likeComment = async (issueId: string, commentId: string, userId: string) => {
    const likeRef = doc(db, 'issues', issueId, 'comments', commentId, 'likes', userId);
    const commentRef = doc(db, 'issues', issueId, 'comments', commentId);
    try {
        await runTransaction(db, async (t) => {
            const likeDoc = await t.get(likeRef);
            if (likeDoc.exists()) throw "Already liked";
            t.set(likeRef, { userId, createdAt: serverTimestamp() });
            t.update(commentRef, { likes: increment(1) });
        });
        return true;
    } catch { return false; }
};

export const unlikeComment = async (issueId: string, commentId: string, userId: string) => {
    const likeRef = doc(db, 'issues', issueId, 'comments', commentId, 'likes', userId);
    const commentRef = doc(db, 'issues', issueId, 'comments', commentId);
    try {
        await runTransaction(db, async (t) => {
            const likeDoc = await t.get(likeRef);
            if (!likeDoc.exists()) throw "Not liked";
            t.delete(likeRef);
            t.update(commentRef, { likes: increment(-1) });
        });
        return true;
    } catch { return false; }
};

export const hasUserLikedComment = async (issueId: string, commentId: string, userId: string) => {
    if (!issueId || !commentId || !userId) return false;
    const likeRef = doc(db, 'issues', issueId, 'comments', commentId, 'likes', userId);
    const snap = await getDoc(likeRef);
    return snap.exists();
};

// --- Crowdsourced Status Methods ---
// The db string keys match the status options but formatted cleanly
export const STATUS_DB_KEYS: Record<string, string> = {
    'Under Review': 'under_review',
    'In Progress': 'in_progress',
    'Resolved': 'resolved',
};

// Maps the linear progression
const STATUS_PROGRESSION = ['Open', 'Under Review', 'In Progress', 'Resolved'];

export const voteOnStatus = async (
    issueId: string,
    userId: string,
    targetStatus: IssueStatusState,
    voteType: 'yes' | 'no'
) => {
    if (!issueId || !userId || !targetStatus || targetStatus === 'Open') return { success: false, error: 'Invalid parameters' };

    const issueRef = doc(db, 'issues', issueId);
    // User vote document path
    const voteRef = doc(db, 'issues', issueId, 'statusVotes', `${userId}_${targetStatus.replace(' ', '_').toLowerCase()}`);

    try {
        const result = await runTransaction(db, async (t) => {
            const issueDoc = await t.get(issueRef);
            if (!issueDoc.exists()) throw new Error("Issue not found");

            const voteDoc = await t.get(voteRef);
            if (voteDoc.exists()) throw new Error("User has already voted on this specific status for this issue");

            const issueData = issueDoc.data();
            const currentStatus = issueData.status;

            // Only allow voting on the *next* logical status in the timeline, or the current one to confirm it
            // For simplicity in this demo, we'll just allow voting on any future state and check consensus

            // Get user's trust score from users collection (mocked as 1.0 for now if missing)
            const userRef = doc(db, 'users', userId);
            const userDoc = await t.get(userRef);
            const userWeight = userDoc.exists() ? (userDoc.data().trustScore || 1.0) : 1.0;

            const dbKey = STATUS_DB_KEYS[targetStatus];
            if (!dbKey) throw new Error("Invalid status target");

            // Initialize statusData if old issue
            const statusData = issueData.statusData || {
                under_review: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 },
                in_progress: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 },
                resolved: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 }
            };

            const targetData = statusData[dbKey] || { yesWeight: 0, noWeight: 0, requiredThreshold: 3 };

            // Apply vote weight
            if (voteType === 'yes') {
                targetData.yesWeight += userWeight;
            } else {
                targetData.noWeight += userWeight;
            }

            // Calculate Dynamic Threshold (Math.max(3, 10% of total voters))
            const activeVotes = issueData.votes || 0;
            const dynamicThreshold = Math.max(3, Math.ceil(activeVotes * 0.1));
            targetData.requiredThreshold = dynamicThreshold;

            // Check if Consensus is Reached
            let newStatus = currentStatus;
            let consensusReached = false;

            const netScore = targetData.yesWeight - targetData.noWeight;
            if (netScore >= dynamicThreshold) {
                // Determine if this new status is strictly > current in timeline
                const currentIndex = STATUS_PROGRESSION.indexOf(currentStatus);
                const targetIndex = STATUS_PROGRESSION.indexOf(targetStatus);

                if (targetIndex > currentIndex) {
                    newStatus = targetStatus;
                    consensusReached = true;
                }
            }

            // Save the Vote Record
            t.set(voteRef, {
                userId,
                statusVotedFor: targetStatus,
                vote: voteType,
                weightApplied: userWeight,
                createdAt: serverTimestamp()
            });

            // Update Issue
            t.update(issueRef, {
                [`statusData.${dbKey}`]: targetData,
                ...(consensusReached && { status: newStatus }) // If we leveled up the status, save it
            });

            return {
                success: true,
                consensusReached,
                newStatus,
                currentStats: targetData
            };
        });

        return result;
    } catch (e: any) {
        console.error("Status vote transaction failed: ", e);
        return { success: false, error: e.message || String(e) };
    }
};

// ── Activity: Hyped / Commented / Saved Issues ─────────────────────────────

const fetchIssuesByIds = async (ids: string[]): Promise<Issue[]> => {
    if (ids.length === 0) return [];
    // Firestore 'in' supports up to 30 values
    const uniqueIds = [...new Set(ids)].slice(0, 30);
    const q = query(
        collection(db, 'issues'),
        where('__name__', 'in', uniqueIds)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
};

export const getUserHypedIssues = async (userId: string): Promise<Issue[]> => {
    try {
        const q = query(
            collectionGroup(db, 'hypes'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(30)
        );
        const snapshot = await getDocs(q);
        const issueIds = snapshot.docs.map(d => d.data().issueId || d.ref.parent.parent?.id).filter(Boolean) as string[];
        return fetchIssuesByIds(issueIds);
    } catch (error) {
        console.error("Error fetching hyped issues:", error);
        return [];
    }
};

export const getUserCommentedIssues = async (userId: string): Promise<Issue[]> => {
    try {
        const q = query(
            collectionGroup(db, 'comments'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(30)
        );
        const snapshot = await getDocs(q);
        // Validate: only include docs that are real comments with text content
        const issueIds: string[] = [];
        for (const d of snapshot.docs) {
            const data = d.data();
            if (!data.text || typeof data.text !== 'string' || data.text.trim().length === 0) continue;
            const parentIssueId = data.issueId || d.ref.parent.parent?.id;
            if (parentIssueId) issueIds.push(parentIssueId);
        }
        const uniqueIds = [...new Set(issueIds)];
        return fetchIssuesByIds(uniqueIds);
    } catch (error) {
        console.error("Error fetching commented issues:", error);
        return [];
    }
};

/**
 * Delete all comment documents created by a specific user for a specific issue.
 * Used to clean up stale test data.
 */
export const deleteUserCommentsForIssue = async (issueId: string, userId: string): Promise<number> => {
    if (!issueId || !userId) return 0;
    try {
        const q = query(
            collection(db, 'issues', issueId, 'comments'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        let deleted = 0;
        for (const d of snapshot.docs) {
            await deleteDoc(d.ref);
            deleted++;
        }
        // Decrement commentCount on the issue
        if (deleted > 0) {
            const issueRef = doc(db, 'issues', issueId);
            await runTransaction(db, async (t) => {
                t.update(issueRef, { commentCount: increment(-deleted) });
            });
        }
        return deleted;
    } catch (error) {
        console.error("Error deleting user comments:", error);
        return 0;
    }
};

export const getUserSavedIssues = async (userId: string): Promise<Issue[]> => {
    try {
        const q = query(
            collectionGroup(db, 'saves'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(30)
        );
        const snapshot = await getDocs(q);
        const issueIds = snapshot.docs.map(d => d.data().issueId || d.ref.parent.parent?.id).filter(Boolean) as string[];
        return fetchIssuesByIds(issueIds);
    } catch (error) {
        console.error("Error fetching saved issues:", error);
        return [];
    }
};

// ── Search ─────────────────────────────────────────────────────────────────
export interface UserSearchResult {
    uid: string;
    displayName: string;
    handle: string;
    photoURL?: string;
}

export const searchUsers = async (searchQuery: string): Promise<UserSearchResult[]> => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const normalised = searchQuery.startsWith('@') ? searchQuery : `@${searchQuery}`;
    const end = normalised.slice(0, -1) + String.fromCharCode(normalised.charCodeAt(normalised.length - 1) + 1);
    try {
        const q = query(
            collection(db, 'users'),
            where('handle', '>=', normalised.toLowerCase()),
            where('handle', '<', end.toLowerCase()),
            limit(10)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                uid: d.id,
                displayName: data.displayName || '',
                handle: data.handle || '',
                photoURL: data.photoURL || ''
            };
        });
    } catch (error) {
        console.error("Error searching users:", error);
        return [];
    }
};

export const searchIssues = async (searchQuery: string): Promise<Issue[]> => {
    if (!searchQuery || searchQuery.length < 2) return [];
    try {
        // Fetch recent issues and filter client-side for partial match
        const q = query(
            collection(db, 'issues'),
            orderBy('createdAt', 'desc'),
            limit(100)
        );
        const snapshot = await getDocs(q);
        const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        const lower = searchQuery.toLowerCase();
        return all.filter(i =>
            (i.title?.toLowerCase().includes(lower)) ||
            (i.location?.toLowerCase().includes(lower)) ||
            (i.cityName?.toLowerCase().includes(lower)) ||
            (i.category?.toLowerCase().includes(lower))
        ).slice(0, 20);
    } catch (error) {
        console.error("Error searching issues:", error);
        return [];
    }
};

// ═══════════════════════════════════════════════════════════════════════
// CIVIC CRM — Official Portal Functions
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch issues matching an official's department (mapped to category) and jurisdiction (mapped to cityName).
 * Excludes already-resolved issues.
 */
export const getOfficialFeed = async (department: string, jurisdiction: string): Promise<Issue[]> => {
    try {
        // Fetch issues for this jurisdiction, sorted by newest first
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', jurisdiction),
            orderBy('createdAt', 'desc'),
            limit(200)
        );
        const snapshot = await getDocs(q);
        const issues = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => {
                // Match on assignedDepartment (set by smart triage in createIssue)
                const deptMatch = (i as any).assignedDepartment?.toLowerCase() === department.toLowerCase();
                // Fallback: also match raw category name for older issues
                const catMatch = i.category?.toLowerCase() === department.toLowerCase();
                return deptMatch || catMatch;
            });
        return issues;
    } catch (error) {
        console.error("Error fetching official feed:", error);
        return [];
    }
};

/**
 * Official resolves an issue: sets status to Resolved, writes resolution metadata.
 */
export const officialResolveIssue = async (
    issueId: string,
    officialUid: string,
    officialHandle: string,
    department: string,
    statement: string,
    afterImageUrl: string
): Promise<void> => {
    try {
        const issueRef = doc(db, 'issues', issueId);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(issueRef);
            if (!snap.exists()) throw new Error('Issue not found');
            transaction.update(issueRef, {
                status: 'Resolved',
                resolvedByUid: officialUid,
                resolvedByHandle: officialHandle,
                resolvedByDepartment: department,
                resolvedStatement: statement,
                afterImageUrl: afterImageUrl,
                resolvedAt: Timestamp.now()
            });
        });
        // Fire-and-forget: notify all citizens who hyped this issue
        const issueSnap = await getDoc(doc(db, 'issues', issueId));
        const issueTitle = issueSnap.data()?.title || 'An issue';
        notifyCitizenStatusUpdate(issueId, issueTitle, 'Resolved').catch(() => { });
    } catch (error) {
        console.error("Error resolving issue:", error);
        throw error;
    }
};

export interface DepartmentStat {
    department: string;
    resolved: number;
    avgResolutionHours: number;
    recentResolved: number;  // last 7 days
    priorResolved: number;   // 7-14 days ago
}

/**
 * Aggregate department stats for the public scorecard.
 */
export const getDepartmentStats = async (jurisdiction?: string): Promise<DepartmentStat[]> => {
    try {
        const constraints: any[] = [
            where('status', '==', 'Resolved'),
            orderBy('resolvedAt', 'desc'),
            limit(500)
        ];
        const q = query(collection(db, 'issues'), ...constraints);
        const snapshot = await getDocs(q);
        const issues = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));

        // Filter by jurisdiction client-side if provided
        const filtered = jurisdiction
            ? issues.filter(i => i.cityName?.toLowerCase() === jurisdiction.toLowerCase())
            : issues;

        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const deptMap = new Map<string, { total: number; totalHours: number; recent: number; prior: number }>();

        for (const issue of filtered) {
            const dept = issue.resolvedByDepartment || issue.category || 'Other';
            if (!deptMap.has(dept)) deptMap.set(dept, { total: 0, totalHours: 0, recent: 0, prior: 0 });
            const entry = deptMap.get(dept)!;
            entry.total++;

            const createdMs = issue.createdAt?.toMillis?.() || now;
            const resolvedMs = issue.resolvedAt?.toMillis?.() || now;
            entry.totalHours += (resolvedMs - createdMs) / (1000 * 60 * 60);

            const resolvedAge = now - resolvedMs;
            if (resolvedAge < sevenDays) entry.recent++;
            else if (resolvedAge < sevenDays * 2) entry.prior++;
        }

        return Array.from(deptMap.entries()).map(([dept, d]) => ({
            department: dept,
            resolved: d.total,
            avgResolutionHours: d.total > 0 ? Math.round(d.totalHours / d.total) : 0,
            recentResolved: d.recent,
            priorResolved: d.prior
        })).sort((a, b) => b.resolved - a.resolved);
    } catch (error) {
        console.error("Error getting department stats:", error);
        return [];
    }
};

/**
 * Top N fastest-resolved issues (Wall of Fame).
 */
export const getFastestResolved = async (limitN: number = 5): Promise<Issue[]> => {
    try {
        const q = query(
            collection(db, 'issues'),
            where('status', '==', 'Resolved'),
            orderBy('resolvedAt', 'desc'),
            limit(100)
        );
        const snapshot = await getDocs(q);
        const issues = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));

        // Sort by resolution speed (fastest first)
        return issues
            .filter(i => i.resolvedAt && i.createdAt)
            .sort((a, b) => {
                const aTime = (a.resolvedAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
                const bTime = (b.resolvedAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
                return aTime - bTime;
            })
            .slice(0, limitN);
    } catch (error) {
        console.error("Error getting fastest resolved:", error);
        return [];
    }
};

/**
 * Top N most-hyped unresolved issues (Wall of Shame).
 */
export const getMostHypedUnresolved = async (limitN: number = 5): Promise<Issue[]> => {
    try {
        const q = query(
            collection(db, 'issues'),
            orderBy('votes', 'desc'),
            limit(100)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => i.status !== 'Resolved')
            .slice(0, limitN);
    } catch (error) {
        console.error("Error getting most hyped unresolved:", error);
        return [];
    }
};

