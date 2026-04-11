import {
    collection, doc, addDoc, getDocs, getDoc, updateDoc, query, where, orderBy,
    limit, serverTimestamp, Timestamp, writeBatch, increment
} from 'firebase/firestore';
import { db } from './firebase';

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const VIRAL_THRESHOLD = 50;
export const SLA_HOURS = 72;

export type NotificationType =
    | 'urgent_viral'
    | 'urgent_sla'
    | 'status_update'
    | 'hype'
    | 'comment'
    | 'issue_approved'
    | 'issue_rejected'
    | 'author_milestone'
    | 'author_status';

export interface NotificationData {
    id: string;
    targetUid: string;
    type: NotificationType;
    isUrgent: boolean;
    title: string;
    body: string;
    issueId: string;
    issueTitle: string;
    read: boolean;
    createdAt: any;
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

export const createNotification = async (data: Omit<NotificationData, 'id' | 'createdAt' | 'read'>): Promise<string | null> => {
    try {
        const docRef = await addDoc(collection(db, 'notifications'), {
            ...data,
            read: false,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (e) {
        console.warn('Error creating notification:', e);
        return null;
    }
};

export const getNotifications = async (uid: string, limitN: number = 30): Promise<NotificationData[]> => {
    if (!uid) return [];
    try {
        return await withRetry(async () => {
            const q = query(
                collection(db, 'notifications'),
                where('targetUid', '==', uid)
            );
            const snapshot = await getDocs(q);
            const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NotificationData));
            return all
                .sort((a, b) => {
                    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return bTime - aTime;
                })
                .slice(0, limitN);
        });
    } catch (e: any) {
        console.warn('Error fetching notifications:', e.message);
        return [];
    }
};

export const getUnreadCount = async (uid: string): Promise<number> => {
    if (!uid) return 0;
    try {
        return await withRetry(async () => {
            const q = query(
                collection(db, 'notifications'),
                where('targetUid', '==', uid),
                where('read', '==', false)
            );
            const snapshot = await getDocs(q);
            return snapshot.size;
        });
    } catch (e: any) {
        console.warn('Error getting unread count:', e.message);
        return 0;
    }
};

export const markAsRead = async (notifId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (e: any) {
        console.warn('Error marking notification as read:', e.message);
    }
};

export const markAllRead = async (uid: string): Promise<void> => {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('targetUid', '==', uid),
            where('read', '==', false)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.update(d.ref, { read: true }));
        await batch.commit();
    } catch (e: any) {
        console.warn('Error marking all as read:', e.message);
    }
};

// ═══════════════════════════════════════════════════════════════════════
// TIER 2: VIRAL THRESHOLD (50 Hypes)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Find officials matching department (category) and jurisdiction (cityName).
 */
const findOfficials = async (department: string, jurisdiction: string): Promise<string[]> => {
    try {
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'official')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .filter(d => {
                const data = d.data();
                return (
                    data.department?.toLowerCase() === department.toLowerCase() ||
                    // Also match officials whose jurisdiction covers this city
                    data.jurisdiction?.toLowerCase() === jurisdiction.toLowerCase()
                );
            })
            .map(d => d.id);
    } catch (e: any) {
        console.warn('Error finding officials:', e.message);
        return [];
    }
};

/**
 * Called after each hype. When vote count == VIRAL_THRESHOLD, alert officials.
 */
export const checkViralThreshold = async (issueId: string): Promise<void> => {
    try {
        const issueDoc = await getDoc(doc(db, 'issues', issueId));
        if (!issueDoc.exists()) return;

        const data = issueDoc.data();
        const votes = data.votes || 0;
        const category = data.category || '';
        const cityName = data.cityName || '';
        const title = data.title || 'Untitled Issue';
        const authorUid = data.userId;

        // Check for Author Hype Milestones (e.g. 50, 100, 150)
        if (votes > 0 && votes % 50 === 0 && authorUid) {
            await notifyAuthorHypeMilestone(issueId, title, authorUid, votes);
        }

        // Official Viral Notification is ONLY sent exactly at VIRAL_THRESHOLD (50)
        if (votes !== VIRAL_THRESHOLD) return;

        const officialUids = await findOfficials(category, cityName);
        if (officialUids.length === 0) return;

        const batch = writeBatch(db);
        for (const uid of officialUids) {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                targetUid: uid,
                type: 'urgent_viral',
                isUrgent: true,
                title: 'Trending Issue',
                body: `"${title}" has reached ${VIRAL_THRESHOLD} citizens. High visibility.`,
                issueId,
                issueTitle: title,
                read: false,
                createdAt: serverTimestamp()
            });
        }
        await batch.commit();
    } catch (e) {
        console.warn('Error checking viral threshold:', e);
    }
};

// ═══════════════════════════════════════════════════════════════════════
// TIER 3: SLA BREACH (>50 Hypes + >72h Unresolved)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if an issue has breached SLA: >50 hypes AND status is Reported/Verification Needed AND >72h old.
 */
export const checkSLABreach = async (issueId: string): Promise<boolean> => {
    try {
        const issueDoc = await getDoc(doc(db, 'issues', issueId));
        if (!issueDoc.exists()) return false;

        const data = issueDoc.data();
        const votes = data.votes || 0;
        const status = data.status || 'Reported';
        const createdMs = data.createdAt?.toMillis?.() || Date.now();
        const hoursOld = (Date.now() - createdMs) / (1000 * 60 * 60);

        const breached = votes >= VIRAL_THRESHOLD && hoursOld >= SLA_HOURS &&
            (status === 'Reported' || status === 'Verification Needed' || status === 'Open' || status === 'Under Review');

        if (breached) {
            // Check we haven't already sent an SLA notification for this issue
            const existing = query(
                collection(db, 'notifications'),
                where('issueId', '==', issueId),
                where('type', '==', 'urgent_sla'),
                limit(1)
            );
            const existingSnap = await getDocs(existing);
            if (existingSnap.size > 0) return true; // Already notified

            const category = data.category || '';
            const cityName = data.cityName || '';
            const title = data.title || 'Untitled Issue';

            const officialUids = await findOfficials(category, cityName);
            const batch = writeBatch(db);
            for (const uid of officialUids) {
                const notifRef = doc(collection(db, 'notifications'));
                batch.set(notifRef, {
                    targetUid: uid,
                    type: 'urgent_sla',
                    isUrgent: true,
                    title: 'Escalation Warning',
                    body: `"${title}" is unresolved after ${SLA_HOURS} hours. Imminent risk of public escalation.`,
                    issueId,
                    issueTitle: title,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }
            if (officialUids.length > 0) await batch.commit();
        }

        return breached;
    } catch (e) {
        console.warn('Error checking SLA breach:', e);
        return false;
    }
};

// ═══════════════════════════════════════════════════════════════════════
// CITIZEN FEEDBACK LOOP
// ═══════════════════════════════════════════════════════════════════════

/**
 * When an official changes status → notify every citizen who hyped the issue.
 */
export const notifyCitizenStatusUpdate = async (
    issueId: string,
    issueTitle: string,
    newStatus: string
): Promise<void> => {
    try {
        // Get all users who hyped this issue
        const hypesSnap = await getDocs(collection(db, 'issues', issueId, 'hypes'));
        const hyperUids = hypesSnap.docs.map(d => d.data().userId as string).filter(Boolean);

        if (hyperUids.length === 0) return;

        // Batch-write notifications (max 500 per batch)
        const batchSize = 450;
        for (let i = 0; i < hyperUids.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = hyperUids.slice(i, i + batchSize);
            for (const uid of chunk) {
                const notifRef = doc(collection(db, 'notifications'));
                batch.set(notifRef, {
                    targetUid: uid,
                    type: 'status_update',
                    isUrgent: false,
                    title: 'Issue Update',
                    body: `The issue you hyped ("${issueTitle}") has been marked as ${newStatus} by the authorities.`,
                    issueId,
                    issueTitle,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }
            await batch.commit();
        }
    } catch (e) {
        console.error('Error notifying citizens:', e);
    }
};

export const notifyCitizenIssueApproved = async (
    issueId: string,
    issueTitle: string,
    targetUid: string
): Promise<void> => {
    try {
        await addDoc(collection(db, 'notifications'), {
            targetUid,
            type: 'issue_approved',
            isUrgent: false,
            title: 'Report Approved',
            body: `Your report "${issueTitle}" has been approved and is now live.`,
            issueId,
            issueTitle,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error('Error notifying citizen of approval:', e);
    }
};

export const notifyCitizenIssueRejected = async (
    issueId: string,
    issueTitle: string,
    targetUid: string,
    remarks: string
): Promise<void> => {
    try {
        await addDoc(collection(db, 'notifications'), {
            targetUid,
            type: 'issue_rejected',
            isUrgent: true,
            title: 'Report Rejected',
            body: `Your report "${issueTitle}" was rejected. Remarks: ${remarks}`,
            issueId,
            issueTitle,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error('Error notifying citizen of rejection:', e);
    }
};

export const notifyAuthorHypeMilestone = async (
    issueId: string,
    issueTitle: string,
    authorUid: string,
    hypeCount: number
): Promise<void> => {
    try {
        await addDoc(collection(db, 'notifications'), {
            targetUid: authorUid,
            type: 'author_milestone',
            isUrgent: false,
            title: 'Hype Milestone Reached! 🎉',
            body: `Your report "${issueTitle}" just reached ${hypeCount} hypes! Keep up the great work.`,
            issueId,
            issueTitle,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error('Error notifying author of milestone:', e);
    }
};

export const notifyAuthorStatusUpdate = async (
    issueId: string,
    issueTitle: string,
    authorUid: string,
    newStatus: string
): Promise<void> => {
    try {
        await addDoc(collection(db, 'notifications'), {
            targetUid: authorUid,
            type: 'author_status',
            isUrgent: false,
            title: 'Report Status Updated',
            body: `The status of your report "${issueTitle}" has been updated to ${newStatus}.`,
            issueId,
            issueTitle,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error('Error notifying author of status update:', e);
    }
};

// ═══════════════════════════════════════════════════════════════════════
// DEV TESTING HELPERS — gated to development environment only
// ═══════════════════════════════════════════════════════════════════════

/**
 * DEV ONLY: Set an issue's votes to the given count and trigger viral check.
 * No-op in production builds.
 */
export const simulateHypes = async (issueId: string, count: number = VIRAL_THRESHOLD): Promise<void> => {
    if (process.env.NODE_ENV !== 'development') {
        console.warn('simulateHypes is disabled outside development.');
        return;
    }
    try {
        await updateDoc(doc(db, 'issues', issueId), { votes: count });
        await checkViralThreshold(issueId);
    } catch (e) {
        console.error('Error simulating hypes:', e);
    }
};

/**
 * DEV ONLY: Set an issue's createdAt to 72+ hours ago and trigger SLA check.
 * No-op in production builds.
 */
export const fastForward72h = async (issueId: string): Promise<void> => {
    if (process.env.NODE_ENV !== 'development') {
        console.warn('fastForward72h is disabled outside development.');
        return;
    }
    try {
        const pastTime = Timestamp.fromMillis(Date.now() - (SLA_HOURS + 1) * 60 * 60 * 1000);
        await updateDoc(doc(db, 'issues', issueId), { createdAt: pastTime });
        await checkSLABreach(issueId);
    } catch (e) {
        console.error('Error fast-forwarding:', e);
    }
};

