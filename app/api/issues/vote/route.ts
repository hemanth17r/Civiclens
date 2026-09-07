import { NextRequest, NextResponse } from 'next/server';
import { admin, db } from '@/lib/firebase-admin';
import { awardXpServer } from '@/lib/server-gamification';
import { getVoteWeight } from '@/lib/trust';

const VOTES_PER_HOUR_LIMIT = 10;

// Allowed stages for community voting (Reported and Resolved are forbidden)
const ALLOWED_VOTE_STAGES: Record<string, string> = {
    'Verification Needed': 'verification_needed',
    'Active': 'active',
    'Action Seen': 'action_seen',
};

export async function POST(req: NextRequest) {
    try {
        if (!db) {
            console.error('[vote] Firebase Admin SDK not initialized');
            return NextResponse.json(
                { error: 'Server configuration error: Firebase Admin not initialized.' },
                { status: 503 }
            );
        }

        // 1. Authenticate caller
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch {
            return NextResponse.json({ error: 'Invalid or expired authentication token.' }, { status: 401 });
        }

        const uid = decodedToken.uid;

        // 2. Parse request body
        const body = await req.json();
        const { issueId, targetStageKey, voteType } = body;

        if (!issueId || !targetStageKey || !['yes', 'no'].includes(voteType)) {
            return NextResponse.json({ error: 'Invalid parameters: issueId, targetStageKey, and voteType are required.' }, { status: 400 });
        }

        const dbKey = ALLOWED_VOTE_STAGES[targetStageKey];
        if (!dbKey) {
            return NextResponse.json({
                error: `Voting is not available for "${targetStageKey}". Only Verification Needed, Active, and Action Seen accept community votes.`
            }, { status: 400 });
        }

        const issueRef = db.collection('issues').doc(issueId);
        const voteDocRef = issueRef.collection('statusVotes').doc(`${uid}_${dbKey}`);

        // 3. Pre-flight check: rate-limiting (only for new votes / flips, skip for deselect)
        const voteSnapPre = await voteDocRef.get();
        const isDeselectPre = voteSnapPre.exists && voteSnapPre.data()?.vote === voteType;

        if (!isDeselectPre) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentVotesSnap = await db.collection('users').doc(uid).collection('voteLog')
                .where('timestamp', '>', admin.firestore.Timestamp.fromDate(oneHourAgo))
                .limit(VOTES_PER_HOUR_LIMIT + 1)
                .get();

            if (recentVotesSnap.size >= VOTES_PER_HOUR_LIMIT) {
                return NextResponse.json({
                    error: `Hourly vote limit reached (${VOTES_PER_HOUR_LIMIT} votes/hr). Please try again shortly.`
                }, { status: 429 });
            }
        }

        // 4. Atomic Transaction for Voting & Status Transitions
        const txResult = await db.runTransaction(async (t: any) => {
            const issueDoc: any = await t.get(issueRef);
            if (!issueDoc.exists) throw new Error('ISSUE_NOT_FOUND');

            const issueData = issueDoc.data() || {};
            const currentStatus = issueData.status;

            // Block author from voting on their own issue
            if (issueData.userId === uid) {
                throw new Error('AUTHORS_CANNOT_VOTE');
            }

            // Status checks
            if (currentStatus === 'Reported') {
                throw new Error('ISSUE_UNDER_REVIEW');
            }
            if (currentStatus === 'Resolved') {
                throw new Error('ISSUE_ALREADY_RESOLVED');
            }

            const voteDoc: any = await t.get(voteDocRef);
            let previousVoteType: 'yes' | 'no' | null = null;
            let previousVoteWeight = 0;
            let isDeselecting = false;

            if (voteDoc.exists) {
                const prevData = voteDoc.data() || {};
                if (prevData.vote === voteType) {
                    isDeselecting = true;
                }
                previousVoteType = prevData.vote;
                previousVoteWeight = prevData.weightApplied || 0;
            }

            // Voter Trust Score & Weight calculation
            const userRef = db.collection('users').doc(uid);
            const userDoc: any = await t.get(userRef);
            const userTrust = userDoc.exists ? (userDoc.data()?.trustScore ?? 0.3) : 0.3;
            const activeVotes = issueData.votes || 0;
            const userWeight = getVoteWeight(userTrust, activeVotes);

            // Read stage stats
            const statusData = issueData.statusData || {};
            const stageStats = {
                yesWeight: 0,
                noWeight: 0,
                score: 0,
                yesCount: 0,
                noCount: 0,
                ...(statusData[dbKey] || {})
            };

            // Deselect Path: remove existing vote
            if (isDeselecting) {
                if (previousVoteType === 'yes') {
                    stageStats.yesWeight = Math.max(0, stageStats.yesWeight - previousVoteWeight);
                    stageStats.yesCount = Math.max(0, (stageStats.yesCount || 1) - 1);
                } else if (previousVoteType === 'no') {
                    stageStats.noWeight = Math.max(0, stageStats.noWeight - previousVoteWeight);
                    stageStats.noCount = Math.max(0, (stageStats.noCount || 1) - 1);
                }
                stageStats.score = stageStats.yesWeight - stageStats.noWeight;

                t.delete(voteDocRef);
                t.update(issueRef, { [`statusData.${dbKey}`]: stageStats });

                return {
                    success: true,
                    deselected: true,
                    consensusReached: false,
                    newStatus: currentStatus,
                    currentStats: stageStats,
                    _authorUid: issueData.userId,
                    _issueTitle: issueData.title,
                };
            }

            // Normal / Flip Vote Path
            if (previousVoteType === 'yes') {
                stageStats.yesWeight = Math.max(0, stageStats.yesWeight - previousVoteWeight);
                stageStats.yesCount = Math.max(0, (stageStats.yesCount || 1) - 1);
            } else if (previousVoteType === 'no') {
                stageStats.noWeight = Math.max(0, stageStats.noWeight - previousVoteWeight);
                stageStats.noCount = Math.max(0, (stageStats.noCount || 1) - 1);
            }

            if (voteType === 'yes') {
                stageStats.yesWeight += userWeight;
                stageStats.yesCount = (stageStats.yesCount || 0) + 1;
            } else {
                stageStats.noWeight += userWeight;
                stageStats.noCount = (stageStats.noCount || 0) + 1;
            }

            stageStats.score = stageStats.yesWeight - stageStats.noWeight;

            // ── Quorum & Consensus Rules ────────────────────────────────────
            let newStatus = currentStatus;
            let consensusReached = false;

            if (currentStatus === 'Verification Needed' && targetStageKey === 'Verification Needed') {
                // Advance: Requires at least 3 distinct Yes voters AND net trust score >= 3.0
                if (stageStats.yesCount >= 3 && stageStats.score >= 3.0) {
                    newStatus = 'Active';
                    consensusReached = true;
                }
            } else if (currentStatus === 'Active' && targetStageKey === 'Active') {
                // Advance: Requires at least 2 distinct Yes voters AND net trust score >= 2.5
                if (stageStats.yesCount >= 2 && stageStats.score >= 2.5) {
                    newStatus = 'Action Seen';
                    consensusReached = true;
                }
                // Note: voting "No" on Active DOES NOT regress to Verification Needed.
            } else if (currentStatus === 'Action Seen' && targetStageKey === 'Action Seen') {
                // Regression: If community confirms work has stalled (>= 2 No voters and score <= -2.5)
                if (stageStats.noCount >= 2 && stageStats.score <= -2.5) {
                    newStatus = 'Active';
                    consensusReached = true;
                }
            }

            // Record vote document
            t.set(voteDocRef, {
                userId: uid,
                statusVotedFor: targetStageKey,
                vote: voteType,
                weightApplied: userWeight,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Build update payload
            const updatePayload: Record<string, any> = {
                [`statusData.${dbKey}`]: stageStats,
            };

            if (consensusReached && newStatus !== currentStatus) {
                updatePayload.status = newStatus;
                const existingLog = issueData.statusChangedLog || [];
                updatePayload.statusChangedLog = [
                    ...existingLog,
                    {
                        from: currentStatus,
                        to: newStatus,
                        at: new Date().toISOString()
                    }
                ];
            }

            t.update(issueRef, updatePayload);

            return {
                success: true,
                deselected: false,
                consensusReached,
                newStatus,
                currentStats: stageStats,
                _authorUid: issueData.userId,
                _issueTitle: issueData.title,
                _targetStageKey: targetStageKey,
            };
        });

        // 5. Post-transaction asynchronously: Logging, XP, Trust, Notifications
        if (txResult.deselected) {
            awardXpServer(uid, 'VERIFICATION_VOTE_REVOKED').catch(() => {});
        } else {
            // Log vote for rate limiting
            db.collection('users').doc(uid).collection('voteLog').add({
                issueId,
                stageKey: targetStageKey,
                voteType,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});

            // Award XP for verifying
            awardXpServer(uid, 'VERIFICATION_VOTE').catch(() => {});
        }

        // When consensus is reached, reward voters & notify author
        if (txResult.consensusReached && txResult.newStatus) {
            const authorUid = txResult._authorUid;
            const issueTitle = txResult._issueTitle || 'Untitled Issue';
            const reachedStatus = txResult.newStatus;

            // Notify author
            if (authorUid) {
                const notifTitle = reachedStatus === 'Active'
                    ? 'Report Community Verified! 🌟'
                    : `Status Update: ${reachedStatus}`;
                const notifBody = reachedStatus === 'Active'
                    ? `Your report "${issueTitle}" has been verified by the community and is now Active.`
                    : `Community updates moved "${issueTitle}" to ${reachedStatus}.`;

                db.collection('notifications').add({
                    targetUid: authorUid,
                    type: 'status_update',
                    isUrgent: false,
                    title: notifTitle,
                    body: notifBody,
                    issueId,
                    issueTitle,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            }

            // Reward trust scores to all voters who participated in this stage transition
            (async () => {
                try {
                    const votesSnap = await issueRef.collection('statusVotes').get();
                    const batch = db.batch();

                    for (const vDoc of votesSnap.docs) {
                        const vData = vDoc.data();
                        if (vData.statusVotedFor === txResult._targetStageKey) {
                            const voterRef = db.collection('users').doc(vData.userId);
                            const isAccurate = vData.vote === 'yes';
                            const delta = isAccurate ? 0.015 : -0.025;

                            const vUserSnap = await voterRef.get();
                            if (vUserSnap.exists) {
                                const currentTrust = vUserSnap.data()?.trustScore ?? 0.3;
                                const clampedTrust = Math.round(Math.max(0, Math.min(1.0, currentTrust + delta)) * 100) / 100;
                                const statField = isAccurate ? 'trustStats.accurateVotes' : 'trustStats.wrongVotes';

                                batch.update(voterRef, {
                                    trustScore: clampedTrust,
                                    trustUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    [statField]: admin.firestore.FieldValue.increment(1)
                                });
                            }
                        }
                    }
                    await batch.commit();
                } catch (err) {
                    console.error('Failed to update voter trust scores after consensus:', err);
                }
            })().catch(() => {});
        }

        return NextResponse.json({
            success: true,
            deselected: txResult.deselected,
            consensusReached: txResult.consensusReached,
            newStatus: txResult.newStatus,
            currentStats: txResult.currentStats
        });

    } catch (error: any) {
        console.error('Error in /api/issues/vote:', error);
        if (error.message === 'AUTHORS_CANNOT_VOTE') {
            return NextResponse.json({ error: 'You cannot vote on your own report.' }, { status: 403 });
        }
        if (error.message === 'ISSUE_UNDER_REVIEW') {
            return NextResponse.json({ error: 'This report is currently under review by administrators. Community voting will open once approved.' }, { status: 400 });
        }
        if (error.message === 'ISSUE_ALREADY_RESOLVED') {
            return NextResponse.json({ error: 'This issue has already been resolved.' }, { status: 400 });
        }
        if (error.message === 'ISSUE_NOT_FOUND') {
            return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
