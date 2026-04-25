'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    signOut,
    onAuthStateChanged,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    GoogleAuthProvider,
    signInWithCredential,
    signInWithPopup
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import { registerForPushNotifications } from '@/lib/fcmRegistration';

// Interface for our custom user profile in Firestore
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    handle?: string; // The unique @handle
    city?: string;   // User's selected city for local feed
    createdAt: any;
    // CRM Role fields
    role?: 'citizen' | 'official';
    department?: string;    // e.g. "Road", "Waste", "Water", "Sanitation"
    jurisdiction?: string;  // e.g. "Jalandhar"
    isBlocked?: boolean;    // For Moderation
    // Trust & Reputation
    trustScore?: number;          // 0.0 – 1.0
    trustStats?: {
        resolvedReports?: number;
        accurateVotes?: number;
        flaggedReports?: number;
        wrongVotes?: number;
    };
    // Gamification
    xp?: number;
    level?: number;
    levelTitle?: string;
    badges?: string[];            // Badge IDs
    currentStreak?: number;
    longestStreak?: number;
    lastActiveDate?: string;      // 'YYYY-MM-DD'
    gamificationStats?: {
        totalReports?: number;
        totalVerifications?: number;
        totalComments?: number;
        totalResolved?: number;
    };
}

interface AuthContextType {
    user: User | null; // Firebase Auth User
    userProfile: UserProfile | null; // Firestore Profile
    loading: boolean;
    profileChecked: boolean; // true once we've confirmed whether a Firestore doc exists or not
    isOfficial: boolean; // Computed: userProfile?.role === 'official' || isAdmin
    isAdmin: boolean;
    sendMagicLink: (email: string) => Promise<void>;
    loginWithGoogleCredential: (idToken: string) => Promise<void>;
    loginWithGooglePopup: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
    profileChecked: false,
    isOfficial: false,
    isAdmin: false,
    sendMagicLink: async () => { },
    loginWithGoogleCredential: async () => { },
    loginWithGooglePopup: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileChecked, setProfileChecked] = useState(false);

    useEffect(() => {
        // Handle Magic Link cross-device / same-device resolution
        if (typeof window !== 'undefined' && isSignInWithEmailLink(auth, window.location.href)) {
            let email = window.localStorage.getItem('emailForSignIn');
            if (!email) {
                email = window.prompt('Please provide your email for confirmation to complete sign-in.');
            }
            if (email) {
                signInWithEmailLink(auth, email, window.location.href)
                    .then(() => {
                        window.localStorage.removeItem('emailForSignIn');
                        window.history.replaceState(null, '', window.location.origin);
                    })
                    .catch((error) => {
                        console.warn('Error signing in with magic link:', error);
                    });
            }
        }

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) {
            setUserProfile(null);
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        let unsubscribeFirestore: (() => void) | null = null;

        const setupListener = (retries: number) => {
            // Guard: in case user becomes null during retry timeout
            if (!auth.currentUser) return;

            unsubscribeFirestore = onSnapshot(userDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const profileData = docSnap.data() as UserProfile;
                    if (profileData.isBlocked) {
                        await signOut(auth);
                        setUser(null);
                        setUserProfile(null);
                        setProfileChecked(true);
                        setLoading(false);
                        alert("Your account has been suspended.");
                        return;
                    }
                    setUserProfile(profileData);
                    setProfileChecked(true);
                    setLoading(false);

                    // Register for push notifications if admin
                    const adminEmails = ["hemanthreddya276@gmail.com"];
                    const isAdminUser = adminEmails.includes(profileData.email);
                    if (isAdminUser) {
                        registerForPushNotifications(user.uid).catch(err => console.warn('FCM registration failed:', err));
                    }
                } else {
                    setUserProfile(null);
                    setProfileChecked(true);
                    setLoading(false);
                }
            }, (error) => {
                if (retries > 0 && (error as any).code === 'permission-denied') {
                    console.warn("Retrying profile listener...");
                    setTimeout(() => setupListener(retries - 1), 1000);
                } else {
                    console.warn("Error fetching user profile:", error);
                    // Don't mark profileChecked on error — prevents modal from falsely showing
                    setLoading(false);
                }
            });
        };

        setupListener(3);

        return () => {
            if (unsubscribeFirestore) unsubscribeFirestore();
        };
    }, [user]);

    const sendMagicLink = async (email: string) => {
        const actionCodeSettings = {
            url: window.location.origin,
            handleCodeInApp: true,
        };
        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);
        } catch (error) {
            console.warn("Magic link failed to send:", error);
            throw error;
        }
    };

    const loginWithGoogleCredential = async (idToken: string) => {
        try {
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
        } catch (error) {
            console.warn("Google credential login failed:", error);
            throw error;
        }
    };

    const loginWithGooglePopup = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.warn("Google popup login failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.warn("Logout failed:", error);
        }
    };

    // Admin check: prefer Firebase custom claims, fall back to hardcoded email
    // To set custom claims: admin.auth().setCustomUserClaims(uid, { admin: true })
    const isAdmin = (user as any)?.customClaims?.admin === true || user?.email === 'hemanthreddya276@gmail.com';
    const isOfficial = userProfile?.role === 'official' || isAdmin;

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, profileChecked, isOfficial, isAdmin, sendMagicLink, loginWithGoogleCredential, loginWithGooglePopup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
