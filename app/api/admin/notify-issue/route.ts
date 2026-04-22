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

        const fcmTokens: string[] = [];
        adminsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                fcmTokens.push(...data.fcmTokens);
            }
        });

        if (fcmTokens.length === 0) {
            console.log('No FCM tokens found for admins. Skipping push notification.');
            return NextResponse.json({ success: true, message: 'Admins found but no FCM tokens.' });
        }

        // 3. Prepare Message
        const message = {
            notification: {
                title: '🚨 New Issue Needs Review',
                body: `"${issueTitle}" in ${category} is pending approval.`,
            },
            data: {
                issueId: issueId,
                click_action: `/admin/dashboard`, 
                type: 'ADMIN_REVIEW'
            },
            tokens: Array.from(new Set(fcmTokens)), 
        };

        // 4. Send Multicast Message
        const response = await messaging.sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);

        return NextResponse.json({ 
            success: true, 
            sent: response.successCount, 
            failed: response.failureCount 
        });

    } catch (error: any) {
        console.error('Error in notify-issue API:', error);
        // Return generic message to avoid leaking internals
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
