import { getToken, isSupported, getMessaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, app } from './firebase';

/**
 * Requests notification permission and registers the device for FCM.
 * @param userId The current user's UID
 */
export const registerForPushNotifications = async (userId: string) => {
    if (typeof window === 'undefined') return;

    try {
        const supported = await isSupported();
        if (!supported) {
            console.warn('Push messaging is not supported in this browser.');
            return;
        }
        
        const messaging = getMessaging(app);
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('Permission granted. Fetching FCM token...');
            
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
            if (!vapidKey) {
                console.error('Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in environment variables.');
                return;
            }

            const token = await getToken(messaging, {
                vapidKey: vapidKey
            });

            if (token) {
                console.log('FCM Token successfully generated:', token);
                
                // Save the token to the user document in Firestore
                const userRef = doc(db, 'users', userId);
                await updateDoc(userRef, {
                    fcmTokens: arrayUnion(token)
                });
                console.log('Token saved to Firestore for user:', userId);
            } else {
                console.warn('No FCM registration token available. Check if firebase-messaging-sw.js is accessible.');
            }
        } else {
            console.warn('Notification permission denied by user.');
        }
    } catch (error) {
        // Enhanced error handling for production stability
        console.error('Error during push notification registration:', error);
        // Specific handling for Firebase Installations API permission issues
        if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'messaging/permission-blocked') {
            console.warn('Firebase Installations permission denied. Ensure the Firebase Installations API is enabled in GCP console.');
        }
        // Service worker registration failures
        if (error instanceof Error && error.message.includes('messaging/failed-service-worker-registration')) {
            console.error('Service Worker registration failed. Verify that firebase-messaging-sw.js is correctly placed in the public folder and accessible.');
        }
    }
};
