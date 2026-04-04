/**
 * Anti-Manipulation & Rate Limiting for CivicLens
 *
 * Implements account age gating, voting cooldowns, and community flagging
 * to protect the integrity of crowdsourced civic data.
 */
import { db } from './firebase';
import {
    doc, getDoc, collection, query, where, getDocs, addDoc,
    serverTimestamp, Timestamp, updateDoc, increment, orderBy, limit
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

/** Minimum account age (hours) before full access */
const ACCOUNT_AGE_GATE_HOURS = 24;

/** Max reports per day for new accounts (< 24h old) */
const NEW_ACCOUNT_DAILY_REPORT_LIMIT = 3;

/** Max status votes per hour per user */
const VOTES_PER_HOUR_LIMIT = 10;

/** Number of flags before auto-hiding a report */
const AUTO_HIDE_FLAG_THRESHOLD = 5;

// ═══════════════════════════════════════════════════════════════════════
// ACCOUNT AGE GATING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if an account is considered "new" (less than gate hours old).
 * Returns the age in hours and whether the account is gated.
 */
export async function checkAccountAge(uid: string): Promise<{
    isNew: boolean;
    ageHours: number;
    dailyReportLimit: number;
}> {
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return { isNew: true, ageHours: 0, dailyReportLimit: NEW_ACCOUNT_DAILY_REPORT_LIMIT };

        const data = snap.data();
        const createdAt = data.createdAt;

        if (!createdAt || !createdAt.toMillis) {
            return { isNew: true, ageHours: 0, dailyReportLimit: NEW_ACCOUNT_DAILY_REPORT_LIMIT };
        }

        const ageMs = Date.now() - createdAt.toMillis();
        const ageHours = ageMs / (1000 * 60 * 60);
        const isNew = ageHours < ACCOUNT_AGE_GATE_HOURS;

        return {
            isNew,
            ageHours: Math.floor(ageHours),
            dailyReportLimit: isNew ? NEW_ACCOUNT_DAILY_REPORT_LIMIT : Infinity,
        };
    } catch (error) {
        console.error('Failed to check account age:', error);
        return { isNew: false, ageHours: 999, dailyReportLimit: Infinity };
    }
}

/**
 * Check how many reports a user has submitted today.
 * Used with account age gating to enforce daily limits.
 */
export async function getDailyReportCount(uid: string): Promise<number> {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = Timestamp.fromDate(today);

        const q = query(
            collection(db, 'issues'),
            where('userId', '==', uid),
            where('createdAt', '>=', startOfDay),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.size;
    } catch (error) {
        console.error('Failed to get daily report count:', error);
        return 0;
    }
}

/**
 * Validate whether a user can submit a report (checks account age + daily limit).
 */
export async function canSubmitReport(uid: string): Promise<{
    allowed: boolean;
    reason?: string;
    remaining?: number;
}> {
    const accountInfo = await checkAccountAge(uid);

    if (!accountInfo.isNew) {
        return { allowed: true };
    }

    const todayCount = await getDailyReportCount(uid);

    if (todayCount >= accountInfo.dailyReportLimit) {
        return {
            allowed: false,
            reason: `New accounts are limited to ${accountInfo.dailyReportLimit} reports per day. Your account is ${accountInfo.ageHours} hours old.`,
            remaining: 0,
        };
    }

    return {
        allowed: true,
        remaining: accountInfo.dailyReportLimit - todayCount,
    };
}

// ═══════════════════════════════════════════════════════════════════════
// VOTING COOLDOWNS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if a user has exceeded the hourly vote limit.
 */
export async function canVoteOnStatus(uid: string): Promise<{
    allowed: boolean;
    reason?: string;
    votesThisHour?: number;
}> {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const cutoff = Timestamp.fromDate(oneHourAgo);

        // Count recent status votes by this user across all issues
        // We'll count from a user-level voting log
        const voteLogRef = collection(db, 'users', uid, 'voteLog');
        const q = query(
            voteLogRef,
            where('timestamp', '>', cutoff),
            limit(VOTES_PER_HOUR_LIMIT + 1)
        );
        const snap = await getDocs(q);

        if (snap.size >= VOTES_PER_HOUR_LIMIT) {
            return {
                allowed: false,
                reason: `You've reached the limit of ${VOTES_PER_HOUR_LIMIT} votes per hour. Please try again shortly.`,
                votesThisHour: snap.size,
            };
        }

        return { allowed: true, votesThisHour: snap.size };
    } catch (error) {
        console.error('Failed to check vote cooldown:', error);
        return { allowed: true }; // Fail open to not block legitimate votes
    }
}

/**
 * Log a vote for cooldown tracking.
 */
export async function logVote(uid: string, issueId: string): Promise<void> {
    try {
        const voteLogRef = collection(db, 'users', uid, 'voteLog');
        await addDoc(voteLogRef, {
            issueId,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error('Failed to log vote:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// COMMUNITY FLAGGING
// ═══════════════════════════════════════════════════════════════════════

export interface Flag {
    id: string;
    issueId: string;
    reporterUid: string;
    reason: 'fake' | 'spam' | 'inappropriate' | 'duplicate' | 'other';
    description?: string;
    createdAt: any;
}

/**
 * Flag an issue as fake/spam/inappropriate.
 * When threshold is reached, the issue is auto-hidden.
 */
export async function flagIssue(
    issueId: string,
    reporterUid: string,
    reason: Flag['reason'],
    description?: string
): Promise<{ success: boolean; autoHidden: boolean; reason?: string }> {
    try {
        // Check if user already flagged this issue
        const existingQ = query(
            collection(db, 'issues', issueId, 'flags'),
            where('reporterUid', '==', reporterUid)
        );
        const existingSnap = await getDocs(existingQ);
        if (existingSnap.size > 0) {
            return { success: false, autoHidden: false, reason: 'You have already flagged this issue.' };
        }

        // Create flag
        await addDoc(collection(db, 'issues', issueId, 'flags'), {
            issueId,
            reporterUid,
            reason,
            description: description || '',
            createdAt: serverTimestamp(),
        });

        // Increment flag count on issue
        const issueRef = doc(db, 'issues', issueId);
        await updateDoc(issueRef, { flagCount: increment(1) });

        // Check if auto-hide threshold reached
        const issueSnap = await getDoc(issueRef);
        const flagCount = issueSnap.data()?.flagCount || 0;

        if (flagCount >= AUTO_HIDE_FLAG_THRESHOLD) {
            await updateDoc(issueRef, { isHidden: true });
            return { success: true, autoHidden: true };
        }

        return { success: true, autoHidden: false };
    } catch (error) {
        console.error('Failed to flag issue:', error);
        return { success: false, autoHidden: false, reason: 'Failed to submit flag.' };
    }
}

/**
 * Get flag count for an issue.
 */
export async function getFlagCount(issueId: string): Promise<number> {
    try {
        const issueRef = doc(db, 'issues', issueId);
        const snap = await getDoc(issueRef);
        return snap.data()?.flagCount || 0;
    } catch {
        return 0;
    }
}
