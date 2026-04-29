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
        const snap = await getDoc(issueRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Issue;
    } catch (error) {
        console.warn('Error fetching issue by ID:', error);
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
    userCityName: string | null = 'Delhi',
    currentUserId?: string
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

        const localSnapshot = await withRetry(() => getDocs(localQuery));
        let issues = localSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));

        // Filter out unapproved issues unless the user is the author
        issues = issues.filter(i => (i.status && i.status !== 'Reported') || (currentUserId && i.userId === currentUserId));

        // 3. Sort: user's exact city first, then by hype
        issues.sort((a, b) => {
            const aLocal = a.cityName === userCity.name ? 1 : 0;
            const bLocal = b.cityName === userCity.name ? 1 : 0;
            if (aLocal !== bLocal) return bLocal - aLocal;
            return (b.votes || 0) - (a.votes || 0);
        });

        // Return whatever exists — no artificial fallback
        return issues.slice(0, 20);

    } catch (error: any) {
        console.warn('Error fetching feed:', error.message);
        return [];
    }
};


export const getTrendingIssues = async (category?: string, currentUserId?: string) => {
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

        const querySnapshot = await withRetry(() => getDocs(q));
        let issues = querySnapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        } as Issue));

        // Filter out unapproved issues unless the user is the author
        issues = issues.filter(i => (i.status && i.status !== 'Reported') || (currentUserId && i.userId === currentUserId));

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
                limit(100) // we fetch 100 and sort in memory because firestore can't sort by sum of fields
            );
        } else {
            q = query(
                collection(db, 'issues'),
                where('status', 'in', ['Verification Needed', 'Verified', 'Active']),
                limit(100)
            );
        }

        const querySnapshot = await withRetry(() => getDocs(q));
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
        const issues = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Issue));

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
    isAdmin?: boolean;
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
        orderBy('createdAt', 'asc')
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
    const snap = await getDoc(likeRef);
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
    if (!issueId || !userId || !targetStatus || targetStatus === 'Open') return { success: false, error: 'Invalid parameters' };

    const issueRef = doc(db, 'issues', issueId);
    // User vote document path — replace ALL spaces to avoid collisions between multi-word statuses
    const voteRef = doc(db, 'issues', issueId, 'statusVotes', `${userId}_${targetStatus.replace(/ /g, '_').toLowerCase()}`);

    try {
        // ── Pre-flight: detect deselect BEFORE rate-limiting ────────────────
        // If the user already voted the same option, this is a deselect — skip the rate limit.
        let isLikelyDeselect = false;
        try {
            const existingVoteSnap = await getDoc(voteRef);
            if (existingVoteSnap.exists() && existingVoteSnap.data().vote === voteType) {
                isLikelyDeselect = true;
            }
        } catch { /* ignore — transaction will catch this */ }

        // Anti-manipulation: only rate-limit actual new/flipped votes
        if (!isLikelyDeselect) {
            const voteCheck = await canVoteOnStatus(userId);
            if (!voteCheck.allowed) {
                return { success: false, error: voteCheck.reason || 'Vote rate limit exceeded.' };
            }
        }

        const result = await runTransaction(db, async (t) => {
            const issueDoc = await t.get(issueRef);
            if (!issueDoc.exists()) throw new Error("Issue not found");

            const voteDoc = await t.get(voteRef);
            let previousVoteType: 'yes' | 'no' | null = null;
            let previousVoteWeight = 0;
            let isDeselecting = false;

            if (voteDoc.exists()) {
                const prevData = voteDoc.data();
                if (prevData.vote === voteType) {
                    // Same button clicked again → deselect (remove the vote)
                    isDeselecting = true;
                }
                previousVoteType = prevData.vote;
                previousVoteWeight = prevData.weightApplied || 0;
            }

            const issueData = issueDoc.data();
            const currentStatus = issueData.status;

            // Get user's trust score and compute vote weight from tier system
            const userRef = doc(db, 'users', userId);
            const userDoc = await t.get(userRef);
            const userTrustScore = userDoc.exists() ? (userDoc.data().trustScore ?? TRUST_DEFAULT) : TRUST_DEFAULT;
            
            // Confidence scaling incorporates total votes
            const activeVotes = issueData.votes || 0;
            const userWeight = getVoteWeight(userTrustScore, activeVotes);

            const dbKey = STATUS_DB_KEYS[targetStatus];
            if (!dbKey) throw new Error("Invalid status target");

            // Initialize statusData if old issue
            const statusData = issueData.statusData || {};
            const targetData = { ...(statusData[dbKey] || { yesWeight: 0, noWeight: 0, score: 0 }) };

            // ── Deselect path: user clicked the same option they already voted ──
            if (isDeselecting) {
                // Revert the weight of the existing vote
                if (previousVoteType === 'yes') {
                    targetData.yesWeight = Math.max(0, targetData.yesWeight - previousVoteWeight);
                } else if (previousVoteType === 'no') {
                    targetData.noWeight = Math.max(0, targetData.noWeight - previousVoteWeight);
                }
                targetData.score = targetData.yesWeight - targetData.noWeight;

                // Remove the vote document
                t.delete(voteRef);

                // Update issue stats (status does NOT change on deselect)
                t.update(issueRef, { [`statusData.${dbKey}`]: targetData });

                return {
                    success: true as const,
                    deselected: true as const,
                    consensusReached: false as const,
                    newStatus: currentStatus as IssueStatusState,
                    currentStats: targetData,
                    _issueTitle: issueData.title,
                    _authorUid: issueData.userId,
                    _previousVoteType: previousVoteType,
                };
            }

            // ── Normal / flip vote path ──────────────────────────────────────
            // Revert previous vote weight if user is flipping from one option to the other
            if (previousVoteType === 'yes') {
                targetData.yesWeight = Math.max(0, targetData.yesWeight - previousVoteWeight);
            } else if (previousVoteType === 'no') {
                targetData.noWeight = Math.max(0, targetData.noWeight - previousVoteWeight);
            }

            // Apply new vote weight
            if (voteType === 'yes') {
                targetData.yesWeight += userWeight;
            } else {
                targetData.noWeight += userWeight;
            }

            // Calculate Continuous Consensus Score
            const netScore = targetData.yesWeight - targetData.noWeight;
            targetData.score = netScore;

            // Check if Consensus is Reached (Stability Buffer)
            let newStatus = currentStatus;
            let consensusReached = false;

            const currentIndex = STATUS_PROGRESSION.indexOf(currentStatus);
            const targetIndex = STATUS_PROGRESSION.indexOf(targetStatus);

            // ── Consensus Logic ──────────────────────────────────────────────
            // Normal vote: cast on the CURRENT stage → advances to NEXT stage.
            // Quick vote: cast on a FUTURE stage → jumps directly to that stage.
            // Regression: score < -2 on current stage → reverts one step back.
            if (netScore > 2.0) {
                if (targetIndex === currentIndex && currentIndex < STATUS_PROGRESSION.length - 1) {
                    // Normal progression: community confirmed current stage → advance one step
                    newStatus = STATUS_PROGRESSION[currentIndex + 1] as IssueStatusState;
                    consensusReached = true;
                } else if (targetIndex > currentIndex) {
                    // Quick-vote: community confirms issue is already at a future stage → jump directly
                    newStatus = STATUS_PROGRESSION[targetIndex] as IssueStatusState;
                    consensusReached = true;
                }
            } else if (netScore < -2.0 && targetIndex === currentIndex && currentIndex > 0) {
                // Backward Transition: community rejects current stage → revert one step
                newStatus = STATUS_PROGRESSION[currentIndex - 1] as IssueStatusState;
                consensusReached = true;
            }

            // Save the Vote Record
            t.set(voteRef, {
                userId,
                statusVotedFor: targetStatus,
                vote: voteType,
                weightApplied: userWeight,
                createdAt: serverTimestamp()
            });

            // Build update payload
            const updatePayload: Record<string, any> = {
                [`statusData.${dbKey}`]: targetData,
            };

            if (consensusReached && newStatus !== currentStatus) {
                updatePayload.status = newStatus;
                // Append a timestamped entry to the public timeline log (arrayUnion equivalent via Firestore array)
                // We store the log as an array field `statusChangedLog` on the issue document.
                // Since we cannot use arrayUnion inside runTransaction easily, we read the existing log and push.
                const existingLog: any[] = issueData.statusChangedLog || [];
                updatePayload.statusChangedLog = [
                    ...existingLog,
                    {
                        from: currentStatus,
                        to: newStatus,
                        at: new Date().toISOString(), // ISO string — close enough for display; server time unavailable inside transaction
                    }
                ];
            }

            t.update(issueRef, updatePayload);

            return {
                success: true as const,
                deselected: false as const,
                consensusReached,
                newStatus: newStatus as IssueStatusState,
                currentStats: targetData,
                _issueTitle: issueData.title,
                _authorUid: issueData.userId,
                _previousVoteType: previousVoteType,
            };
        });

        if (result.success && result.consensusReached && result.newStatus && result._authorUid) {
            // Fire-and-forget: Notify author of status change
            notifyAuthorStatusUpdate(issueId, result._issueTitle || 'Untitled Issue', result._authorUid, result.newStatus).catch(() => { });
            // Fire-and-forget: Update trust scores for voters based on consensus outcome
            onConsensusReached(issueId, result.newStatus).catch(() => { });
        }

        // Only award XP / log vote for actual votes — not deselects
        if (result.deselected) {
            awardXp(userId, 'VERIFICATION_VOTE_REVOKED').catch(() => { });
        } else if ((result as any)._previousVoteType === null) {
            awardXp(userId, 'VERIFICATION_VOTE').catch(() => { });
            incrementMissionProgress(userId, '', 'verify').catch(() => { });
            logVote(userId, issueId).catch(() => { });
        }

        const { _issueTitle, _authorUid, _previousVoteType, ...cleanResult } = result as any;
        return cleanResult as VoteOnStatusResult;
    } catch (e: any) {
        console.error("Status vote transaction failed: ", e);
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
    const normalised = searchQuery.startsWith('@') ? searchQuery : `@${searchQuery}`;
    const end = normalised.slice(0, -1) + String.fromCharCode(normalised.charCodeAt(normalised.length - 1) + 1);
    try {
        const q = query(
            collection(db, 'users'),
            where('handle', '>=', normalised.toLowerCase()),
            where('handle', '<', end.toLowerCase()),
            limit(10)
        );
        const snapshot = await withRetry(() => getDocs(q));
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
        
        // Filter out unapproved issues unless the user is the author
        all = all.filter(i => (i.status && i.status !== 'Reported') || (currentUserId && i.userId === currentUserId));

        const lower = searchQuery.toLowerCase();
        return all.filter(i =>
            (i.title?.toLowerCase().includes(lower)) ||
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
        const snapshot = await withRetry(() => getDocs(q));
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
        const issueData = issueSnap.data();
        const issueTitle = issueData?.title || 'An issue';
        const authorUid = issueData?.userId;

        notifyCitizenStatusUpdate(issueId, issueTitle, 'Resolved').catch(() => { });

        if (authorUid) {
            notifyAuthorStatusUpdate(issueId, issueTitle, authorUid, 'Resolved').catch(() => { });
            // Reward the reporter: trust boost + XP for getting their issue resolved
            onReportResolved(authorUid).catch(() => { });
            awardXp(authorUid, 'REPORT_RESOLVED').catch(() => { });
        }
        // Update trust for voters who participated in verification
        onConsensusReached(issueId, 'Resolved').catch(() => { });
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
            .filter(i => i.status !== 'Resolved')
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
            limit(100)
        );
        const snapshot = await withRetry(() => getDocs(q));
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Issue))
            .filter(i => i.status !== 'Resolved')
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
export const getTopInProgressByCity = async (cityName: string, limitN: number = 5): Promise<Issue[]> => {
    try {
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', cityName),
            where('status', '==', 'Active'),
            limit(100)
        );
        const snapshot = await withRetry(() => getDocs(q));
        const issues = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        // Sort newest first
        return issues.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        }).slice(0, limitN);
    } catch (error) {
        console.warn("Error getting in progress issues by city:", error);
        return [];
    }
};

/**
 * Top N Resolved issues for a specific city.
 */
export const getTopResolvedByCity = async (cityName: string, limitN: number = 5): Promise<Issue[]> => {
    try {
        const q = query(
            collection(db, 'issues'),
            where('cityName', '==', cityName),
            where('status', '==', 'Resolved'),
            limit(100)
        );
        const snapshot = await withRetry(() => getDocs(q));
        const issues = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        // Sort newest resolved first
        return issues.sort((a, b) => {
            const tA = a.resolvedAt?.toMillis?.() || (a.createdAt?.toMillis?.() || 0);
            const tB = b.resolvedAt?.toMillis?.() || (b.createdAt?.toMillis?.() || 0);
            return tB - tA;
        }).slice(0, limitN);
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
            where('status', '==', 'Under Review'),
            limit(100)
        );
        const snapshot = await getDocs(q);
        const issues = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        // FIFO: Oldest first for pending approval
        return issues.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tA - tB;
        }).slice(0, limitN);
    } catch (error) {
        console.error("Error getting pending issues by city:", error);
        return [];
    }
};
