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
    | 'comment';

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
        console.error('Error creating notification:', e);
        return null;
    }
};

export const getNotifications = async (uid: string, limitN: number = 30): Promise<NotificationData[]> => {
    if (!uid) return [];
    try {
        const q = query(
            collection(db, 'notifications'),
            where('targetUid', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(limitN)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NotificationData));
    } catch (e) {
        console.error('Error fetching notifications:', e);
        return [];
    }
};

export const getUnreadCount = async (uid: string): Promise<number> => {
    if (!uid) return 0;
    try {
        const q = query(
            collection(db, 'notifications'),
            where('targetUid', '==', uid),
            where('read', '==', false)
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (e) {
        console.error('Error getting unread count:', e);
        return 0;
    }
};

export const markAsRead = async (notifId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (e) {
        console.error('Error marking notification as read:', e);
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
    } catch (e) {
        console.error('Error marking all as read:', e);
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
    } catch (e) {
        console.error('Error finding officials:', e);
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

        if (votes !== VIRAL_THRESHOLD) return;

        const category = data.category || '';
        const cityName = data.cityName || '';
        const title = data.title || 'Untitled Issue';

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
        console.error('Error checking viral threshold:', e);
    }
};

// ═══════════════════════════════════════════════════════════════════════
// TIER 3: SLA BREACH (>50 Hypes + >72h Unresolved)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if an issue has breached SLA: >50 hypes AND status is Open/Under Review AND >72h old.
 */
export const checkSLABreach = async (issueId: string): Promise<boolean> => {
    try {
        const issueDoc = await getDoc(doc(db, 'issues', issueId));
        if (!issueDoc.exists()) return false;

        const data = issueDoc.data();
        const votes = data.votes || 0;
        const status = data.status || 'Open';
        const createdMs = data.createdAt?.toMillis?.() || Date.now();
        const hoursOld = (Date.now() - createdMs) / (1000 * 60 * 60);

        const breached = votes >= VIRAL_THRESHOLD && hoursOld >= SLA_HOURS &&
            (status === 'Open' || status === 'Under Review');

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
        console.error('Error checking SLA breach:', e);
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

// ═══════════════════════════════════════════════════════════════════════
// DEV TESTING HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * DEV ONLY: Set an issue's votes to the given count and trigger viral check.
 */
export const simulateHypes = async (issueId: string, count: number = VIRAL_THRESHOLD): Promise<void> => {
    try {
        await updateDoc(doc(db, 'issues', issueId), { votes: count });
        await checkViralThreshold(issueId);
    } catch (e) {
        console.error('Error simulating hypes:', e);
    }
};

/**
 * DEV ONLY: Set an issue's createdAt to 72+ hours ago and trigger SLA check.
 */
export const fastForward72h = async (issueId: string): Promise<void> => {
    try {
        const pastTime = Timestamp.fromMillis(Date.now() - (SLA_HOURS + 1) * 60 * 60 * 1000);
        await updateDoc(doc(db, 'issues', issueId), { createdAt: pastTime });
        await checkSLABreach(issueId);
    } catch (e) {
        console.error('Error fast-forwarding:', e);
    }
};
