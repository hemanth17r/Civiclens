import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    try {
        const saKeyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!saKeyStr) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found in environment variables');
        }

        let saKey;
        try {
            // Handle both stringified JSON and eval-style formats
            if (saKeyStr.trim().startsWith('{')) {
                saKey = JSON.parse(saKeyStr);
            } else {
                // For safety in production, we should prefer JSON.parse, 
                // but some local environments use eval-friendly strings
                saKey = eval('(' + saKeyStr + ')');
            }
        } catch (e) {
            console.error('Failed to parse service account key:', e);
            throw e;
        }

        if (saKey.private_key) {
            saKey.private_key = saKey.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(saKey)
        });
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}

export async function POST(request: Request) {
    try {
        const { issueId, issueTitle, category } = await request.json();

        if (!issueId) {
            return NextResponse.json({ error: 'Missing issueId' }, { status: 400 });
        }

        const db = admin.firestore();
        const messaging = admin.messaging();

        // 1. Get Admins
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

        // 2. Prepare Message
        const message = {
            notification: {
                title: '🚨 New Issue Needs Review',
                body: `"${issueTitle}" in ${category} is pending approval.`,
            },
            data: {
                issueId: issueId,
                click_action: `/admin/dashboard`, // Navigate to admin dashboard
                type: 'ADMIN_REVIEW'
            },
            tokens: Array.from(new Set(fcmTokens)), // Deduplicate tokens
        };

        // 3. Send Multicast Message
        let response;
        if (typeof messaging.sendEachForMulticast === 'function') {
            response = await messaging.sendEachForMulticast(message);
        } else if (typeof (messaging as any).sendMulticast === 'function') {
            response = await (messaging as any).sendMulticast(message);
        } else {
            throw new Error('No valid multicast method found in Firebase Admin Messaging');
        }
        console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);

        // Clean up invalid tokens if any failed with specific errors
        if (response.failureCount > 0) {
            // Logic to remove stale tokens could go here
        }

        return NextResponse.json({ 
            success: true, 
            sent: response.successCount, 
            failed: response.failureCount 
        });

    } catch (error: any) {
        console.error('Error in notify-issue API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
