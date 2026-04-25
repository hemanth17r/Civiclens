/**
 * Trust & Reputation Engine for CivicLens
 * 
 * Each user has a Trust Score (0.0 – 1.0) that determines vote weight
 * in crowdsourced status voting. Trust is earned through accurate
 * reporting and honest verification, and lost through fake/flagged reports.
 */
import { db } from './firebase';
import {
    doc, getDoc, updateDoc, increment, serverTimestamp,
    collection, query, where, getDocs
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const TRUST_DEFAULT = 0.3;       // New users start here
export const TRUST_MIN = 0.0;
export const TRUST_MAX = 1.0;

// Trust increments/decrements
const TRUST_REPORT_RESOLVED = 0.05;     // Report got officially resolved
const TRUST_ACCURATE_VOTE = 0.015;      // Vote aligned with final consensus
const TRUST_REPORT_FLAGGED = -0.08;     // Report was flagged/removed
const TRUST_WRONG_VOTE = -0.025;        // Vote opposed final consensus
const TRUST_INACTIVITY_DECAY = -0.01;   // Per 30 days inactive

// Vote weight tiers (Civic Badges)
export const VOTE_WEIGHT_TIERS = [
    { name: 'Observer', minTrust: 0.0, maxTrust: 0.29, weight: 1.0, color: '#9CA3AF' },
    { name: 'Scout', minTrust: 0.3, maxTrust: 0.59, weight: 2.0, color: '#3B82F6' },
    { name: 'Guardian', minTrust: 0.6, maxTrust: 0.89, weight: 5.0, color: '#8B5CF6' },
    { name: 'Architect', minTrust: 0.9, maxTrust: 1.0, weight: 8.0, color: '#10B981' },
] as const;

// ═══════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/** Get the vote weight tier for a given trust score */
export function getVoteWeightTier(trustScore: number) {
    const clamped = Math.max(TRUST_MIN, Math.min(TRUST_MAX, trustScore));
    for (let i = VOTE_WEIGHT_TIERS.length - 1; i >= 0; i--) {
        if (clamped >= VOTE_WEIGHT_TIERS[i].minTrust) {
            return VOTE_WEIGHT_TIERS[i];
        }
    }
    return VOTE_WEIGHT_TIERS[0];
}

/** Get vote weight for a trust score, with optional confidence scaling based on total prior votes */
export function getVoteWeight(trustScore: number, totalVotes: number = 0): number {
    const baseWeight = getVoteWeightTier(trustScore).weight;
    // Confidence Scaling: Later votes scale up to an extra 50%
    const scalingFactor = Math.min(1.5, 1 + (totalVotes * 0.1));
    return baseWeight * scalingFactor;
}

/** Clamp trust score to valid range */
function clampTrust(score: number): number {
    return Math.round(Math.max(TRUST_MIN, Math.min(TRUST_MAX, score)) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════
// TRUST MUTATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Update a user's trust score by a delta. 
 * Also updates the trustStats counters on the user document.
 */
export async function adjustTrustScore(
    uid: string,
    delta: number,
    reason: 'report_resolved' | 'accurate_vote' | 'report_flagged' | 'wrong_vote' | 'inactivity'
): Promise<number | null> {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return null;

        const currentTrust = userSnap.data().trustScore ?? TRUST_DEFAULT;
        const newTrust = clampTrust(currentTrust + delta);

        const updateData: Record<string, any> = {
            trustScore: newTrust,
            trustUpdatedAt: serverTimestamp(),
        };

        // Track stats based on reason
        switch (reason) {
            case 'report_resolved':
                updateData['trustStats.resolvedReports'] = increment(1);
                break;
            case 'accurate_vote':
                updateData['trustStats.accurateVotes'] = increment(1);
                break;
            case 'report_flagged':
                updateData['trustStats.flaggedReports'] = increment(1);
                break;
            case 'wrong_vote':
                updateData['trustStats.wrongVotes'] = increment(1);
                break;
        }

        await updateDoc(userRef, updateData);
        return newTrust;
    } catch (error) {
        console.error('Failed to adjust trust score:', error);
        return null;
    }
}

/**
 * Called when an issue created by a user gets officially resolved.
 * Rewards the reporter with trust.
 */
export async function onReportResolved(reporterUid: string): Promise<void> {
    await adjustTrustScore(reporterUid, TRUST_REPORT_RESOLVED, 'report_resolved');
}

/**
 * Called when status consensus is reached and we can check 
 * who voted correctly vs incorrectly.
 */
export async function onConsensusReached(
    issueId: string,
    finalStatus: string
): Promise<void> {
    try {
        // Get all status votes for this issue
        const votesQ = query(
            collection(db, 'issues', issueId, 'statusVotes')
        );
        const votesSnap = await getDocs(votesQ);

        for (const voteDoc of votesSnap.docs) {
            const data = voteDoc.data();
            const votedFor = data.statusVotedFor;
            const voteType = data.vote; // 'yes' or 'no'
            const userId = data.userId;

            // If they voted 'yes' for the status that was reached, they were accurate
            // If they voted 'no' for the status that was reached, they were wrong
            if (votedFor === finalStatus) {
                if (voteType === 'yes') {
                    adjustTrustScore(userId, TRUST_ACCURATE_VOTE, 'accurate_vote').catch(() => { });
                } else {
                    adjustTrustScore(userId, TRUST_WRONG_VOTE, 'wrong_vote').catch(() => { });
                }
            }
        }
    } catch (error) {
        console.error('Failed to process consensus trust updates:', error);
    }
}

/**
 * Called when a report is flagged/removed by moderation.
 */
export async function onReportFlagged(reporterUid: string): Promise<void> {
    await adjustTrustScore(reporterUid, TRUST_REPORT_FLAGGED, 'report_flagged');
}

// ═══════════════════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Get a user's current trust score (reads from Firestore) */
export async function getUserTrustScore(uid: string): Promise<number> {
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return TRUST_DEFAULT;
        return snap.data().trustScore ?? TRUST_DEFAULT;
    } catch {
        return TRUST_DEFAULT;
    }
}

/** Get trust stats for a user */
export async function getUserTrustStats(uid: string): Promise<{
    trustScore: number;
    tier: typeof VOTE_WEIGHT_TIERS[number];
    resolvedReports: number;
    accurateVotes: number;
    flaggedReports: number;
    wrongVotes: number;
}> {
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            const defaultTier = getVoteWeightTier(TRUST_DEFAULT);
            return {
                trustScore: TRUST_DEFAULT,
                tier: defaultTier,
                resolvedReports: 0,
                accurateVotes: 0,
                flaggedReports: 0,
                wrongVotes: 0,
            };
        }
        const data = snap.data();
        const ts = data.trustScore ?? TRUST_DEFAULT;
        const stats = data.trustStats || {};
        return {
            trustScore: ts,
            tier: getVoteWeightTier(ts),
            resolvedReports: stats.resolvedReports || 0,
            accurateVotes: stats.accurateVotes || 0,
            flaggedReports: stats.flaggedReports || 0,
            wrongVotes: stats.wrongVotes || 0,
        };
    } catch {
        return {
            trustScore: TRUST_DEFAULT,
            tier: getVoteWeightTier(TRUST_DEFAULT),
            resolvedReports: 0,
            accurateVotes: 0,
            flaggedReports: 0,
            wrongVotes: 0,
        };
    }
}
