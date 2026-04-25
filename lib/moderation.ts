import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";

export const reportUser = async (
    reportedUid: string,
    reporterUid: string,
    reason: string,
    details: string
): Promise<void> => {
    try {
        await addDoc(collection(db, 'user_reports'), {
            reportedUid,
            reporterUid,
            reason,
            details,
            status: 'pending', // pending, reviewed, dismissed, acted_upon
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error("Error submitting user report:", e);
        throw e;
    }
};

export const warnUser = async (userId: string, warningMessage: string): Promise<void> => {
    try {
        await addDoc(collection(db, 'notifications'), {
            targetUid: userId,
            title: "OFFICIAL WARNING",
            body: warningMessage,
            type: "urgent_sla", // Reuse urgent styling for maximum visibility
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error("Error issuing warning to user:", e);
        throw e;
    }
};

export const blockUser = async (userId: string): Promise<void> => {
    try {
        const userRef = doc(db, 'users', userId);
        // We will need to update the user doc to set isBlocked: true
        await updateDoc(userRef, { isBlocked: true });
    } catch (e) {
        console.error("Error blocking user:", e);
        throw e;
    }
};
export const unblockUser = async (userId: string): Promise<void> => {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { isBlocked: false });
    } catch (e) {
        console.error("Error unblocking user:", e);
        throw e;
    }
};
