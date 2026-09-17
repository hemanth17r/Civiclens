import { NextResponse } from 'next/server';
import { admin, db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        // 1. Guard: Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }

        // Optional: Add an isAdmin check here if you want to be stricter
        // const user = await admin.auth().getUser(decodedToken.uid);
        // if (!user.customClaims?.admin) { ... }

        const { issueId, issueTitle, category } = await request.json();

        if (!issueId) {
            return NextResponse.json({ error: 'Missing issueId' }, { status: 400 });
        }

        if (!db) {
            throw new Error('Database not initialized');
        }

        const messaging = admin.messaging();

        // 2. Get Admins
        const adminEmails = ["hemanthreddya276@gmail.com"];
        const adminsSnapshot = await db.collection('users')
            .where('email', 'in', adminEmails)
            .get();

        // 3. Write in-app notification document for each admin using Admin SDK (bypasses client security rules)
        if (!adminsSnapshot.empty) {
            const batch = db.batch();
            adminsSnapshot.forEach((adminDoc: admin.firestore.QueryDocumentSnapshot) => {
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    targetUid: adminDoc.id,
                    type: 'admin_new_issue',
                    isUrgent: true,
                    title: 'New Issue Needs Approval',
                    body: `A new issue "${issueTitle}" (${category}) has been reported and needs your review.`,
                    issueId,
                    issueTitle,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
        }

        // 4. Collect FCM tokens for Web Push notifications
        const fcmTokens: string[] = [];
        adminsSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            const data = doc.data();
            if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                fcmTokens.push(...data.fcmTokens);
            }
        });

        if (fcmTokens.length === 0) {
            console.log('In-app notification created. No FCM tokens found for admins, skipping push notification.');
            return NextResponse.json({ success: true, inAppDelivered: true, pushSent: 0 });
        }

        // 5. Prepare Push Message
        const message = {
            notification: {
                title: '🚨 New Issue Needs Review',
                body: `"${issueTitle}" in ${category} is pending approval.`,
            },
            data: {
                issueId: issueId,
                click_action: `/admin/dashboard#issues`, 
                type: 'ADMIN_REVIEW'
            },
            tokens: Array.from(new Set(fcmTokens)), 
        };

        // 6. Send Multicast Message
        const response = await messaging.sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} push messages; ${response.failureCount} failed.`);

        return NextResponse.json({ 
            success: true, 
            inAppDelivered: true,
            pushSent: response.successCount, 
            pushFailed: response.failureCount 
        });

    } catch (error: any) {
        console.error('Error in notify-issue API:', error);
        // Return generic message to avoid leaking internals
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
