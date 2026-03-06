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
}

interface AuthContextType {
    user: User | null; // Firebase Auth User
    userProfile: UserProfile | null; // Firestore Profile
    loading: boolean;
    isOfficial: boolean; // Computed: userProfile?.role === 'official'
    sendMagicLink: (email: string) => Promise<void>;
    loginWithGoogleCredential: (idToken: string) => Promise<void>;
    loginWithGooglePopup: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
    isOfficial: false,
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

    useEffect(() => {
        // Handle Magic Link cross-device / same-device resolution
        if (typeof window !== 'undefined' && isSignInWithEmailLink(auth, window.location.href)) {
            let email = window.localStorage.getItem('emailForSignIn');
            if (!email) {
                // User opened the link on a different device.
                email = window.prompt('Please provide your email for confirmation to complete sign-in.');
            }
            if (email) {
                signInWithEmailLink(auth, email, window.location.href)
                    .then((result) => {
                        window.localStorage.removeItem('emailForSignIn');
                        // Clean up URL parameters
                        window.history.replaceState(null, '', window.location.origin);
                    })
                    .catch((error) => {
                        console.error('Error signing in with magic link:', error);
                    });
            }
        }

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // If logged in, listen to their Firestore profile for the 'handle'
                const userDocRef = doc(db, 'users', currentUser.uid);
                const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserProfile(docSnap.data() as UserProfile);
                    } else {
                        // Profile doesn't exist yet (will optionally be created in onboarding)
                        setUserProfile(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching user profile:", error);
                    setLoading(false);
                });

                return () => unsubscribeFirestore();
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const sendMagicLink = async (email: string) => {
        const actionCodeSettings = {
            url: window.location.origin,
            handleCodeInApp: true,
        };
        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);
        } catch (error) {
            console.error("Magic link failed to send:", error);
            throw error;
        }
    };

    const loginWithGoogleCredential = async (idToken: string) => {
        try {
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
        } catch (error) {
            console.error("Google credential login failed:", error);
            throw error;
        }
    };

    const loginWithGooglePopup = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Google popup login failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const isOfficial = userProfile?.role === 'official';

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, isOfficial, sendMagicLink, loginWithGoogleCredential, loginWithGooglePopup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
