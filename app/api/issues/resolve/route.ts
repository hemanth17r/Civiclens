import { NextRequest, NextResponse } from 'next/server';
import { admin, db } from '@/lib/firebase-admin';
import { awardXpServer } from '@/lib/server-gamification';

export async function POST(req: NextRequest) {
    try {
        if (!db) {
            console.error('[resolve] Firebase Admin SDK not initialized');
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
            return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
        }

        const uid = decodedToken.uid;

        // 2. Verify admin or official role
        const isAdmin = decodedToken.admin === true ||
            decodedToken.admin === 'true' ||
            decodedToken.email?.toLowerCase() === 'hemanthreddya276@gmail.com' ||
            uid === 'FyW3BjXcebZ0jqjP9ZXKMhROnWz1';

        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data() || {};
        const isOfficial = userData.role === 'official' || isAdmin;

        if (!isOfficial) {
            return NextResponse.json(
                { error: 'Forbidden: Only administrators or verified municipal officials can resolve issues.' },
                { status: 403 }
            );
        }

        // 3. Parse request payload
        const body = await req.json();
        const { issueId, statement, afterImageUrl, department } = body;

        if (!issueId || !statement) {
            return NextResponse.json({ error: 'issueId and resolution statement are required.' }, { status: 400 });
        }

        const issueRef = db.collection('issues').doc(issueId);
        const issueSnap = await issueRef.get();
        if (!issueSnap.exists) {
            return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
        }

        const issueData = issueSnap.data() || {};
        const authorUid = issueData.userId;
        const currentStatus = issueData.status;

        const resolvedDept = department || userData.department || 'Administration';
        const resolvedHandle = userData.handle || (isAdmin ? '@admin' : '@official');

        // 4. Update issue document
        const existingLog = issueData.statusChangedLog || [];
        await issueRef.update({
            status: 'Resolved',
            resolvedByUid: uid,
            resolvedByHandle: resolvedHandle,
            resolvedByDepartment: resolvedDept,
            resolvedStatement: statement,
            afterImageUrl: afterImageUrl || null,
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            statusChangedLog: [
                ...existingLog,
                {
                    from: currentStatus,
                    to: 'Resolved',
                    at: new Date().toISOString()
                }
            ]
        });

        // 5. Award author XP & trust boost (server-side via Admin SDK)
        if (authorUid) {
            awardXpServer(authorUid, 'REPORT_RESOLVED').catch(() => {});

            // Boost author trust (+0.05)
            (async () => {
                try {
                    const authorRef = db.collection('users').doc(authorUid);
                    const authorSnap = await authorRef.get();
                    if (authorSnap.exists) {
                        const currentTrust = authorSnap.data()?.trustScore ?? 0.3;
                        const newTrust = Math.round(Math.min(1.0, currentTrust + 0.05) * 100) / 100;
                        await authorRef.update({
                            trustScore: newTrust,
                            trustUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            'trustStats.resolvedReports': admin.firestore.FieldValue.increment(1)
                        });
                    }
                } catch (e) {
                    console.error('Failed to reward author trust:', e);
                }
            })().catch(() => {});

            // Direct notification to author
            db.collection('notifications').add({
                targetUid: authorUid,
                type: 'status_update',
                isUrgent: false,
                title: 'Issue Resolved! 🎉',
                body: `Great news! Your report "${issueData.title || 'Untitled'}" was officially marked as Resolved by ${resolvedDept}.`,
                issueId,
                issueTitle: issueData.title || 'Untitled',
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
        }

        // 6. Notify all citizens who hyped this issue
        (async () => {
            try {
                const hypesSnap = await issueRef.collection('hypes').get();
                if (hypesSnap.empty) return;

                const hyperUids = hypesSnap.docs.map((d: any) => d.id).filter((hUid: string) => hUid !== authorUid);
                const batchSize = 400;
                for (let i = 0; i < hyperUids.length; i += batchSize) {
                    const batch = db.batch();
                    const chunk = hyperUids.slice(i, i + batchSize);
                    for (const citizenUid of chunk) {
                        const notifRef = db.collection('notifications').doc();
                        batch.set(notifRef, {
                            targetUid: citizenUid,
                            type: 'status_update',
                            isUrgent: false,
                            title: 'Issue Resolved! 🎉',
                            body: `An issue you hyped ("${issueData.title || 'Untitled'}") was officially marked as Resolved.`,
                            issueId,
                            issueTitle: issueData.title || 'Untitled',
                            read: false,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    await batch.commit();
                }
            } catch (err) {
                console.error('Failed to batch notify hypers:', err);
            }
        })().catch(() => {});

        return NextResponse.json({
            success: true,
            newStatus: 'Resolved',
            resolvedAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Error in /api/issues/resolve:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
