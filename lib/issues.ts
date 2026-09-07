import { db } from "./firebase";
import { 
    checkViralThreshold, 
    notifyCitizenStatusUpdate, 
    notifyAuthorStatusUpdate,
    notifyAdminsOfNewIssue 
} from "./notifications";
import { awardXp } from "./gamification";
import { getVoteWeight, onConsensusReached, onReportResolved, TRUST_DEFAULT } from "./trust";
import { incrementMissionProgress } from "./missions";
import { canSubmitReport, canVoteOnStatus, logVote } from "./antiManipulation";
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
    Timestamp,
    documentId
} from "firebase/firestore";

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

export interface IssueData {
    title: string;
    category: string;
    description: string;
    location?: string; // Optional for now
    userId?: string; // Optional, placeholder
    imageUrl?: string; // Legacy URL from Firebase Storage
    mediaUrls?: string[]; // Array of media URLs (images/videos)

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
    statusData?: Record<string, {
        yesWeight: number;
        noWeight: number;
        score?: number;
        requiredThreshold?: number; // legacy compatibility
    }>;
}

export type IssueStatusState = 'Open' | 'Reported' | 'Verification Needed' | 'Verified' | 'Active' | 'Action Seen' | 'Resolved' | 'Under Review' | 'In Progress';

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
    approvedAt?: any;
    /** Immutable ordered log of every status transition for the public timeline */
    statusChangedLog?: Array<{ from: string; to: string; at: string }>;
}

// ── Fetch single issue by ID ───────────────────────────────────────────────
export const getIssueById = async (issueId: string): Promise<Issue | null> => {
    if (!issueId) return null;
    try {
        const issueRef = doc(db, 'issues', issueId);
        const snap = await withRetry(() => getDoc(issueRef));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Issue;
    } catch (error) {
        console.warn('Error fetching issue by ID:', error);
        return null;
    }
};

import { INDIAN_CITIES } from "@/data/cities";

// ── Module-level constant: aligns categories with ReportIssueDialog & departments ──
const CATEGORY_TO_DEPT: Record<string, string> = {
    // Current Form Categories
    'Road': 'Public Works',
    'Waste': 'Sanitation',
    'Water': 'Water Supply',
    'Safety': 'Public Safety',
    'Infrastructure': 'Public Works',
    'Environment': 'Pollution Control',
    'Other': 'General',

    // Legacy Aliases for backwards compatibility
    'Waste & Trash': 'Sanitation',
    'Water Flow': 'Water Supply',
    'Lighting': 'Electrical',
    'Roads & Transport': 'Public Works',
    'Flora': 'Horticulture',
    'Noise & Smell': 'Pollution Control',
    'Animals': 'Veterinary',
    'Security': 'Public Safety'
};

// ── Safely parse timestamps from Firestore Timestamp, plain serialized object, or Date ──
export const getIssueTimeMs = (val: any): number => {
    if (!val) return 0;
    const target = val.createdAt !== undefined ? val.createdAt : val;
    if (!target) return 0;
    if (typeof target.toMillis === 'function') return target.toMillis();
    if (typeof target.toDate === 'function') return target.toDate().getTime();
    if (typeof target === 'number') return target;
    if (target.seconds !== undefined) return target.seconds * 1000;
    const d = new Date(target);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

// ── Neighbour cache: expensive Haversine computation only runs once per city ─
// Key = city name, Value = array of 5 nearest city names (already computed)
const _neighborCache = new Map<string, string[]>();

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
    userCityName: string | null = 'Delhi',
    currentUserId?: string
) => {
    try {
        // 1. Identify user city & 5 nearest neighbours (case-insensitive & trimmed)
        const normalizedSearchCity = userCityName?.trim().toLowerCase();
        const userCity = INDIAN_CITIES.find(c => c.name.toLowerCase() === normalizedSearchCity) || INDIAN_CITIES[1];

        // Use cached neighbours if available — avoids 189 Haversine calculations on repeat calls
        let cachedNeighborNames = _neighborCache.get(userCity.name);
        if (!cachedNeighborNames) {
            const neighbors = INDIAN_CITIES
                .filter(c => c.name !== userCity.name)
                .map(c => ({
                    name: c.name,
                    distance: getDistanceFromLatLonInKm(userCity.lat, userCity.lng, c.lat, c.lng)
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 5);
            cachedNeighborNames = neighbors.map(n => n.name);
            _neighborCache.set(userCity.name, cachedNeighborNames);
        }

        const targetCities = [userCity.name, ...cachedNeighborNames];

        // 2. Query the local cluster (Firestore 'in' supports up to 10 values — we use 6)
        let issues: Issue[] = [];
        try {
            const orderedQuery = query(
                collection(db, 'issues'),
                where('cityName', 'in', targetCities),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
            const snapshot = await withRetry(() => getDocs(orderedQuery));
            issues = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        } catch {
            const localQuery = query(
                collection(db, 'issues'),
                where('cityName', 'in', targetCities),
                limit(50)
            );
            const localSnapshot = await withRetry(() => getDocs(localQuery));
            issues = localSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        }

        // 3. Security & Moderation filtering:
        //    - Exclude auto-hidden (flagged/spam) issues
        //    - Exclude 'Reported' (intake queue) issues unless authored by the current viewer
        let filtered = issues.filter(issue => {
            if ((issue as any).isHidden) return false;
            if (issue.status === 'Reported' && issue.userId !== currentUserId) return false;
            return true;
        });

        // 4. Smart Ranking:
        //    - Exact city first
        //    - Recency & Gravity engagement score with freshness boost for new verified issues
        const now = Date.now();
        filtered.sort((a, b) => {
            const aLocal = a.cityName === userCity.name ? 1 : 0;
            const bLocal = b.cityName === userCity.name ? 1 : 0;
            if (aLocal !== bLocal) return bLocal - aLocal;

            const tA = getIssueTimeMs(a);
            const tB = getIssueTimeMs(b);

            const hoursOldA = Math.max(0, (now - (tA || now)) / (1000 * 60 * 60));
            const hoursOldB = Math.max(0, (now - (tB || now)) / (1000 * 60 * 60));

            // Freshness bonus: newly approved issues (< 24h or in 'Verification Needed') get early visibility
            const freshBonusA = (hoursOldA < 24 || a.status === 'Verification Needed') ? 6 : 0;
            const freshBonusB = (hoursOldB < 24 || b.status === 'Verification Needed') ? 6 : 0;

            // Resolved issues get a demotion penalty so active actionable issues stay in front of citizens
            const resolvedPenaltyA = a.status === 'Resolved' ? 8 : 0;
            const resolvedPenaltyB = b.status === 'Resolved' ? 8 : 0;

            const engA = ((a.votes || 0) * 2 + (a.commentCount || 0) * 1.5 + (a.savesCount || 0) + freshBonusA - resolvedPenaltyA);
            const engB = ((b.votes || 0) * 2 + (b.commentCount || 0) * 1.5 + (b.savesCount || 0) + freshBonusB - resolvedPenaltyB);

            const scoreA = Math.max(0, engA) / Math.pow(hoursOldA + 2, 1.1);
            const scoreB = Math.max(0, engB) / Math.pow(hoursOldB + 2, 1.1);

            if (Math.abs(scoreB - scoreA) > 0.05) {
                return scoreB - scoreA;
            }
            return tB - tA;
        });

        // 5. Return real issues
        return filtered.slice(0, 20);

    } catch (error: any) {
        console.warn('Error fetching feed:', error.message);
        return [];
    }
};


export const getTrendingIssues = async (category?: string, currentUserId?: string) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let issues: Issue[] = [];
        const isCatSpecific = category && category !== 'All';

        if (isCatSpecific) {
            try {
                const qCat = query(
                    collection(db, 'issues'),
                    where('category', '==', category),
                    where('createdAt', '>', sevenDaysAgo),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                const snap = await withRetry(() => getDocs(qCat));
                issues = snap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
            } catch {
                // Fallback to broader query if composite index is pending
                const q = query(
                    collection(db, 'issues'),
                    where('createdAt', '>', sevenDaysAgo),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                const snap = await withRetry(() => getDocs(q));
                issues = snap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
                issues = issues.filter(i => i.category === category);
            }
        } else {
            const q = query(
                collection(db, 'issues'),
                where('createdAt', '>', sevenDaysAgo),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
            const snap = await withRetry(() => getDocs(q));
            issues = snap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        }

        // Security & Moderation filtering:
        // - Exclude auto-hidden (flagged/spam) issues
        // - Exclude unapproved 'Reported' issues unless authored by the current viewer
        issues = issues.filter(i => {
            if ((i as any).isHidden) return false;
            if (i.status === 'Reported' && i.userId !== currentUserId) return false;
            return true;
        });

        // Trending score: (hypes*2 + comments*1.5 + saves) / timeFactor
        // timeFactor = hours since creation + 2 (gravity)
        const now = Date.now();
        const scored = issues.map(issue => {
            const createdMs = getIssueTimeMs(issue) || now;
            const hoursOld = Math.max(0, (now - createdMs) / (1000 * 60 * 60));
            const timeFactor = hoursOld + 2; // gravity constant
            const engagement = (issue.votes || 0) * 2 + (issue.commentCount || 0) * 1.5 + (issue.savesCount || 0);
            const score = engagement / timeFactor;
            return { ...issue, _trendScore: score };
        });

        scored.sort((a, b) => b._trendScore - a._trendScore);

        return scored.slice(0, 20);
    } catch (error: any) {
        console.warn("Error fetching trending issues:", error.message);
        return [];
    }
};

export const getLeaderboardIssues = async (cityName: string | null) => {
    try {
        let q;
        if (cityName) {
            q = query(
                collection(db, 'issues'),
                where('status', 'in', ['Verification Needed', 'Active', 'Action Seen']),
                where('cityName', '==', cityName),
                limit(50)
            );
        } else {
            q = query(
                collection(db, 'issues'),
                where('status', 'in', ['Verification Needed', 'Active', 'Action Seen']),
                limit(50)
            );
        }

        const querySnapshot = await withRetry(() => getDocs(q));
        const issues = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Issue))
            .filter(i => !(i as any).isHidden && i.status !== 'Reported');

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
    } catch (error: any) {
        console.warn("Error fetching leaderboard issues:", error.message);
        return [];
    }
};

export const createIssue = async (data: IssueData) => {
    try {
        // Anti-manipulation: check if new account has exceeded daily limit
        if (data.userId) {
            const reportCheck = await canSubmitReport(data.userId);
            if (!reportCheck.allowed) {
                throw new Error(reportCheck.reason || 'Report submission blocked.');
            }
        }

        // --- Smart Triage: Category to Department Mapping ---
        const assignedDepartment = data.category ? (CATEGORY_TO_DEPT[data.category] || 'General') : 'General';

        const docRef = await addDoc(collection(db, "issues"), {
            ...data,
            status: "Reported",
            assignedDepartment, // Auto-triaged department
            createdAt: serverTimestamp(),
            votes: 0,
            statusData: {
                verification_needed: { yesWeight: 0, noWeight: 0, score: 0 },
                active: { yesWeight: 0, noWeight: 0, score: 0 },
                action_seen: { yesWeight: 0, noWeight: 0, score: 0 },
                resolved: { yesWeight: 0, noWeight: 0, score: 0 }
            }
        });
        console.log("Issue written with ID: ", docRef.id);

        // Award XP for submitting a report (fire-and-forget)
        if (data.userId) {
            awardXp(data.userId, 'REPORT_SUBMITTED', { category: data.category }).catch(() => { });
            // Track mission progress for report action
            incrementMissionProgress(data.userId, data.cityName || '', 'report', { issueCategory: data.category }).catch(() => { });
        }

        // Notify Admins of the new submission (needs review)
        notifyAdminsOfNewIssue(docRef.id, data.title, data.category).catch(() => { });

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
        const querySnapshot = await withRetry(() => getDocs(q));
        const rawIssues = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Issue));

        // Filter out hidden posts and unapproved 'Reported' posts unless owner
        const issues = rawIssues.filter(i => !(i as any).isHidden && (i.status !== 'Reported' || i.userId === userId));

        const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

        return { issues, lastVisible };
    } catch (error) {
        console.warn("Error fetching paginated issues:", error);
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
    const snap = await withRetry(() => getDoc(hypeRef));
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
    const snap = await withRetry(() => getDoc(saveRef));
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
    isAdmin?: boolean;
    department?: string;
    replyCount?: number;
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
    isAdmin?: boolean,
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

    // Verify isOfficial/isAdmin against the user's actual profile to prevent impersonation
    if (isOfficial || isAdmin) {
        try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                // Only set isOfficial if the user actually has the 'official' role
                if (isOfficial && userData.role === 'official') {
                    commentData.isOfficial = true;
                    commentData.department = userData.department || department || '';
                }
                // Only set isAdmin if the user is actually an admin (hardcoded email check as fallback)
                if (isAdmin && (userData.role === 'official' || userData.email === 'hemanthreddya276@gmail.com')) {
                    commentData.isAdmin = true;
                }
            }
        } catch (e) {
            console.warn('Failed to verify user role for comment:', e);
            // Fail-safe: do NOT set privileged flags if verification fails
        }
    }

    const docRef = await addDoc(collection(db, 'issues', issueId, 'comments'), commentData);

    // Increment comment count on issue
    try {
        await runTransaction(db, async (t) => {
            t.update(issueRef, { commentCount: increment(1) });
        });
    } catch (e) { console.error('Failed to increment commentCount', e); }

    // Award XP for commenting (fire-and-forget)
    awardXp(userId, 'COMMENT_ADDED').catch(() => { });
    // Track mission progress for comment action
    incrementMissionProgress(userId, '', 'comment').catch(() => { });

    return docRef.id;
};

export const getComments = async (issueId: string): Promise<CommentData[]> => {
    if (!issueId) return [];
    const q = query(
        collection(db, 'issues', issueId, 'comments'),
        orderBy('createdAt', 'asc'),
        limit(50)
    );
    const snapshot = await withRetry(() => getDocs(q));
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
    const commentRef = doc(db, 'issues', issueId, 'comments', commentId);
    const replyData: any = {
        userId,
        userHandle: handle,
        text: text.trim(),
        likes: 0,
        createdAt: serverTimestamp()
    };
    if (avatarUrl) replyData.userAvatar = avatarUrl;

    let replyId: string | null = null;
    try {
        await runTransaction(db, async (t) => {
            // Firestore transactions require reads before writes
            const replyRef = doc(collection(db, 'issues', issueId, 'comments', commentId, 'replies'));
            t.set(replyRef, replyData);
            t.update(commentRef, {
                replyCount: increment(1)
            });
            replyId = replyRef.id;
        });
        return replyId;
    } catch (e) {
        console.error("Failed transaction to add reply:", e);
        // Fallback: write doc without incrementing count if transaction fails
        const docRef = await addDoc(
            collection(db, 'issues', issueId, 'comments', commentId, 'replies'),
            replyData
        );
        return docRef.id;
    }
};

export const getReplies = async (issueId: string, commentId: string): Promise<ReplyData[]> => {
    if (!issueId || !commentId) return [];
    const q = query(
        collection(db, 'issues', issueId, 'comments', commentId, 'replies'),
        orderBy('createdAt', 'asc'),
        limit(50)
    );
    const snapshot = await withRetry(() => getDocs(q));
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
    const snap = await withRetry(() => getDoc(likeRef));
    return snap.exists();
};

/**
 * Fetch the current user's vote for every votable stage on a given issue.
 * Returns a map of stageKey -> 'yes' | 'no' | null.
 * Uses individual getDoc calls (4 reads) which is cheaper than a query.
 */
export const getUserStatusVotes = async (
    issueId: string,
    userId: string
): Promise<Record<string, 'yes' | 'no' | null>> => {
    if (!issueId || !userId) return {};
    const stageKeys = ['Verification Needed', 'Active', 'Action Seen', 'Resolved'] as const;
    const result: Record<string, 'yes' | 'no' | null> = {};
    await Promise.all(
        stageKeys.map(async (stageKey) => {
            const voteDocId = `${userId}_${stageKey.replace(/ /g, '_').toLowerCase()}`;
            const voteRef = doc(db, 'issues', issueId, 'statusVotes', voteDocId);
            try {
                const snap = await getDoc(voteRef);
                result[stageKey] = snap.exists() ? (snap.data().vote as 'yes' | 'no') : null;
            } catch {
                result[stageKey] = null;
            }
        })
    );
    return result;
};

// --- Crowdsourced Status Methods ---
// The db string keys match the status options but formatted cleanly
export const STATUS_DB_KEYS: Record<string, string> = {
    'Verification Needed': 'verification_needed',
    'Active': 'active',
    'Action Seen': 'action_seen',
    'Resolved': 'resolved',
    // Legacy aliases
    'Under Review': 'under_review',
    'In Progress': 'in_progress',
    'Verified': 'active', // Legacy: map old 'Verified' votes to 'active'
};

// Maps the linear progression (5-stage lifecycle — Verified removed as it was a dead-end)
const STATUS_PROGRESSION = ['Reported', 'Verification Needed', 'Active', 'Action Seen', 'Resolved'];

/** Normalize legacy statuses to the new lifecycle */
export function normalizeStatus(status: string): IssueStatusState {
    switch (status) {
        case 'Open':
        case 'Reported':
            return 'Reported';
        case 'Under Review':
        case 'Verification Needed':
            return 'Verification Needed';
        case 'Verified': // Legacy: Verified is now merged into Active
        case 'In Progress':
        case 'Active':
            return 'Active';
        case 'Action Seen':
            return 'Action Seen';
        case 'Resolved':
            return 'Resolved';
        default:
            return 'Reported';
    }
}

export type VoteOnStatusResult =
    | { success: true; deselected?: false; consensusReached: boolean; newStatus: IssueStatusState; currentStats: { yesWeight: number; noWeight: number; score: number } }
    | { success: true; deselected: true; consensusReached: false; newStatus: IssueStatusState; currentStats: { yesWeight: number; noWeight: number; score: number } }
    | { success: false; error: string };

export const voteOnStatus = async (
    issueId: string,
    userId: string,
    targetStatus: IssueStatusState,
    voteType: 'yes' | 'no'
): Promise<VoteOnStatusResult> => {
    if (!issueId || !userId || !targetStatus || targetStatus === 'Open' || targetStatus === 'Reported' || targetStatus === 'Resolved') {
        return { success: false, error: 'Voting is not available for this stage.' };
    }

    try {
        const { auth } = await import('./firebase');
        const user = auth.currentUser;
        if (!user) {
            return { success: false, error: 'You must be logged in to vote.' };
        }

        const token = await user.getIdToken();
        const res = await fetch('/api/issues/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                issueId,
                targetStageKey: targetStatus,
                voteType
            })
        });

        const data = await res.json();
        if (!res.ok) {
            return { success: false, error: data.error || 'Failed to record vote' };
        }

        return data as VoteOnStatusResult;
    } catch (e: any) {
        console.error("Status vote API request failed: ", e);
        return { success: false as const, error: e.message || String(e) };
    }
};

// ── Activity: Hyped / Commented / Saved Issues ─────────────────────────────

const fetchIssuesByIds = async (ids: string[]): Promise<Issue[]> => {
    if (ids.length === 0) return [];
    // Firestore 'in' supports up to 30 values
    const uniqueIds = [...new Set(ids)].slice(0, 30);
    const q = query(
        collection(db, 'issues'),
        where(documentId(), 'in', uniqueIds)
    );
    const snapshot = await withRetry(() => getDocs(q));
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
        const snapshot = await withRetry(() => getDocs(q));
        const issueIds = snapshot.docs.map(d => d.data().issueId || d.ref.parent.parent?.id).filter(Boolean) as string[];
        const uniqueIds = [...new Set(issueIds)];
        const issues = await fetchIssuesByIds(uniqueIds);
        
        // Re-sort to match the chronological order of the 'hypes' collectionGroup query
        return uniqueIds.map(id => issues.find(i => i.id === id)).filter(Boolean) as Issue[];
    } catch (error) {
        console.warn("Error fetching hyped issues:", error);
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
        const snapshot = await withRetry(() => getDocs(q));
        // Validate: only include docs that are real comments with text content
        const issueIds: string[] = [];
        for (const d of snapshot.docs) {
            const data = d.data();
            if (!data.text || typeof data.text !== 'string' || data.text.trim().length === 0) continue;
            const parentIssueId = data.issueId || d.ref.parent.parent?.id;
            if (parentIssueId) issueIds.push(parentIssueId);
        }
        const uniqueIds = [...new Set(issueIds)];
        const issues = await fetchIssuesByIds(uniqueIds);
        
        // Re-sort to match the chronological order of the 'comments' collectionGroup query
        return uniqueIds.map(id => issues.find(i => i.id === id)).filter(Boolean) as Issue[];
    } catch (error) {
        console.warn("Error fetching commented issues:", error);
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
        const snapshot = await withRetry(() => getDocs(q));
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
        const snapshot = await withRetry(() => getDocs(q));
        const issueIds = snapshot.docs.map(d => d.data().issueId || d.ref.parent.parent?.id).filter(Boolean) as string[];
        const uniqueIds = [...new Set(issueIds)];
        const issues = await fetchIssuesByIds(uniqueIds);
        
        // Re-sort to match the chronological order of the 'saves' collectionGroup query
        return uniqueIds.map(id => issues.find(i => i.id === id)).filter(Boolean) as Issue[];
    } catch (error) {
        console.warn("Error fetching saved issues:", error);
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
    try {
        const q = query(
            collection(db, 'users'),
            limit(200)
        );
        const snapshot = await withRetry(() => getDocs(q));
        const allUsers = snapshot.docs.map(d => {
            const data = d.data();
            return {
                uid: d.id,
                displayName: data.displayName || '',
                handle: data.handle || '',
                photoURL: data.photoURL || ''
            };
        });

        const cleanQuery = searchQuery.trim().toLowerCase();
        // Extract search term without '@' prefix to match on either handle or display name
        const cleanQueryNoAt = cleanQuery.startsWith('@') ? cleanQuery.slice(1) : cleanQuery;

        return allUsers.filter(u => {
            const handleNoAt = u.handle.startsWith('@') ? u.handle.slice(1) : u.handle;
            return (
                handleNoAt.toLowerCase().includes(cleanQueryNoAt) ||
                u.displayName.toLowerCase().includes(cleanQueryNoAt)
            );
        }).slice(0, 10);
    } catch (error) {
        console.warn("Error searching users:", error);
        return [];
    }
};

export const searchIssues = async (searchQuery: string, currentUserId?: string): Promise<Issue[]> => {
    if (!searchQuery || searchQuery.length < 2) return [];
    try {
        // Fetch recent issues and filter client-side for partial match
        const q = query(
            collection(db, 'issues'),
            orderBy('createdAt', 'desc'),
            limit(100)
        );
        const snapshot = await withRetry(() => getDocs(q));
        let all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));

        // Security & Moderation filtering:
        // - Exclude auto-hidden (flagged/spam) issues
        // - Exclude unapproved 'Reported' issues unless authored by the current searcher
        all = all.filter(i => {
            if ((i as any).isHidden) return false;
            if (i.status === 'Reported' && i.userId !== currentUserId) return false;
            return true;
        });

        const lower = searchQuery.toLowerCase().trim();
        return all.filter(i =>
            (i.title?.toLowerCase().includes(lower)) ||
            (i.description?.toLowerCase().includes(lower)) ||
            (i.location?.toLowerCase().includes(lower)) ||
            (i.cityName?.toLowerCase().includes(lower)) ||
            (i.category?.toLowerCase().includes(lower))
        ).slice(0, 20);
    } catch (error) {
        console.warn("Error searching issues:", error);
        return [];
    }
};

// ═══════════════════════════════════════════════════════════════════════
// CIVIC CRM — Official Portal Functions
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch issues matching an official's department (mapped to category) and jurisdiction (mapped to cityName).
 * Excludes already-resolved issues and hidden/spam issues.
 */
export const getOfficialFeed = async (department: string, jurisdiction: string): Promise<Issue[]> => {
    try {
        const normJurisdiction = jurisdiction.trim().toLowerCase();
        const normDept = department.trim().toLowerCase();

        // Fetch issues, sorted by newest first
        const q = query(
            collection(db, 'issues'),
            orderBy('createdAt', 'desc'),
            limit(200)
        );
        const snapshot = await withRetry(() => getDocs(q));
        const issues = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => {
                if ((i as any).isHidden) return false;

                // City / Jurisdiction matching: exact or substring match (e.g. "Delhi" in "Zone A, Delhi")
                const issueCity = (i.cityName || '').toLowerCase();
                const cityMatch = !normJurisdiction ||
                    issueCity === normJurisdiction ||
                    normJurisdiction.includes(issueCity) ||
                    issueCity.includes(normJurisdiction);

                if (!cityMatch) return false;

                // Match on assignedDepartment (set by smart triage in createIssue)
                const assignedDept = ((i as any).assignedDepartment || '').toLowerCase();
                const deptMatch = assignedDept === normDept ||
                    assignedDept.includes(normDept) ||
                    normDept.includes(assignedDept);

                // Fallback: also match raw category name for older issues
                const catMatch = (i.category || '').toLowerCase() === normDept;
                return deptMatch || catMatch;
            });
        return issues;
    } catch (error) {
        console.warn("Error fetching official feed:", error);
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
        const { auth } = await import('./firebase');
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        const token = await user.getIdToken();
        const res = await fetch('/api/issues/resolve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                issueId,
                department,
                statement,
                afterImageUrl
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to resolve issue');
        }
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
        const snapshot = await withRetry(() => getDocs(q));
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
        console.warn("Error getting department stats:", error);
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
        const snapshot = await withRetry(() => getDocs(q));
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
        console.warn("Error getting fastest resolved:", error);
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
        const snapshot = await withRetry(() => getDocs(q));
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => !(i as any).isHidden && i.status !== 'Resolved' && i.status !== 'Reported')
            .slice(0, limitN);
    } catch (error) {
        console.warn("Error getting most hyped unresolved:", error);
        return [];
    }
};

/**
 * Top N unresolved issues for a specific city.
 */
export const getTopIssuesByCity = async (cityName: string, limitN: number = 5): Promise<Issue[]> => {
    try {
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', cityName),
            limit(Math.max(limitN * 3, 15))
        );
        const snapshot = await withRetry(() => getDocs(q));
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => !(i as any).isHidden && i.status !== 'Resolved' && i.status !== 'Reported')
            .sort((a, b) => (b.votes || 0) - (a.votes || 0))
            .slice(0, limitN);
    } catch (error) {
        console.warn("Error getting top issues by city:", error);
        return [];
    }
};

/**
 * Top N In Progress issues for a specific city.
 */
// ── Short-lived in-memory caches for City Insights (TTL = 3 mins) ─
const CITY_CACHE_TTL_MS = 3 * 60 * 1000;

interface CityCacheEntry<T> {
    data: T;
    expiresAt: number;
}

const _cityInProgressCache = new Map<string, CityCacheEntry<Issue[]>>();
const _cityResolvedCache = new Map<string, CityCacheEntry<Issue[]>>();
const _cityPulseStatsCache = new Map<string, CityCacheEntry<CityPulseStats>>();

/**
 * Top N In Progress issues for a specific city.
 * Ranked primarily by community engagement (votes/hypes), secondarily by creation recency.
 * Cached in memory for 3 minutes to eliminate redundant Firestore reads on repeat views.
 */
export const getTopInProgressByCity = async (cityName: string, limitN: number = 5): Promise<Issue[]> => {
    const cacheKey = `${cityName}_${limitN}`;
    const cached = _cityInProgressCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    try {
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', cityName),
            where('status', 'in', ['Active', 'Action Seen']),
            limit(Math.max(limitN * 10, 50))
        );
        const snapshot = await withRetry(() => getDocs(q));
        const issues = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => !(i as any).isHidden && i.status !== 'Reported');

        // Sort by community votes/hypes first, then newest
        const result = issues.sort((a, b) => {
            const voteDiff = (b.votes || 0) - (a.votes || 0);
            if (voteDiff !== 0) return voteDiff;
            const tA = getIssueTimeMs(a);
            const tB = getIssueTimeMs(b);
            return tB - tA;
        }).slice(0, limitN);

        _cityInProgressCache.set(cacheKey, { data: result, expiresAt: Date.now() + CITY_CACHE_TTL_MS });
        return result;
    } catch (error) {
        console.warn("Error getting in progress issues by city:", error);
        return [];
    }
};

/**
 * Top N Resolved issues for a specific city.
 * Sorted by resolution recency (resolvedAt, fallback to createdAt).
 * Cached in memory for 3 minutes to eliminate redundant Firestore reads on repeat views.
 */
export const getTopResolvedByCity = async (cityName: string, limitN: number = 5): Promise<Issue[]> => {
    const cacheKey = `${cityName}_${limitN}`;
    const cached = _cityResolvedCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    try {
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', cityName),
            where('status', '==', 'Resolved'),
            limit(Math.max(limitN * 10, 50))
        );
        const snapshot = await withRetry(() => getDocs(q));
        const issues = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => !(i as any).isHidden);

        // Sort newest resolved first using safe timestamp parsing
        const result = issues.sort((a, b) => {
            const tA = getIssueTimeMs(a.resolvedAt || a.createdAt);
            const tB = getIssueTimeMs(b.resolvedAt || b.createdAt);
            return tB - tA;
        }).slice(0, limitN);

        _cityResolvedCache.set(cacheKey, { data: result, expiresAt: Date.now() + CITY_CACHE_TTL_MS });
        return result;
    } catch (error) {
        console.error("Error getting resolved issues by city:", error);
        return [];
    }
};

/**
 * Top N Pending Posts for a specific city.
 */
export const getTopPendingByCity = async (cityName: string, limitN: number = 5): Promise<Issue[]> => {
    try {
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', cityName),
            where('status', 'in', ['Reported', 'Verification Needed', 'Under Review']),
            limit(Math.max(limitN * 3, 15))
        );
        const snapshot = await withRetry(() => getDocs(q));
        const issues = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => !(i as any).isHidden);
        // FIFO: Oldest first for pending approval
        return issues.sort((a, b) => {
            const tA = getIssueTimeMs(a);
            const tB = getIssueTimeMs(b);
            return tA - tB;
        }).slice(0, limitN);
    } catch (error) {
        console.error("Error getting pending issues by city:", error);
        return [];
    }
};

export interface CityPulseStats {
    activeCount: number;
    resolvedCount: number;
    totalCount: number;
    resolutionRate: number;
}

/**
 * Get high-level pulse stats for a city (Active, Resolved, Resolution Rate).
 * Uses lean sampling (60 docs max) and 3-minute in-memory caching to save 70%+ reads.
 */
export const getCityPulseStats = async (cityName: string): Promise<CityPulseStats> => {
    const cached = _cityPulseStatsCache.get(cityName);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    try {
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', cityName),
            limit(60)
        );
        const snapshot = await withRetry(() => getDocs(q));
        let activeCount = 0;
        let resolvedCount = 0;
        let totalCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (data.isHidden) continue;
            if (data.status === 'Reported') continue; // Don't count pending intake queue
            totalCount++;
            if (data.status === 'Resolved') {
                resolvedCount++;
            } else if (data.status === 'Active' || data.status === 'Action Seen' || data.status === 'Verification Needed') {
                activeCount++;
            }
        }

        const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
        const result = {
            activeCount,
            resolvedCount,
            totalCount,
            resolutionRate
        };

        _cityPulseStatsCache.set(cityName, { data: result, expiresAt: Date.now() + CITY_CACHE_TTL_MS });
        return result;
    } catch (error) {
        console.warn("Error getting city pulse stats:", error);
        return { activeCount: 0, resolvedCount: 0, totalCount: 0, resolutionRate: 0 };
    }
};
