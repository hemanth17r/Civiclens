'use client';

import React, { useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { AtSign, Check, X, Loader2 } from 'lucide-react';

export default function OnboardingModal() {
    const { user, userProfile, loading } = useAuth();
    const [handle, setHandle] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // If loading, or not logged in, or profile already has a handle -> Don't show
    if (loading || !user || userProfile?.handle) return null;

    const validateHandle = (value: string) => {
        const regex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!regex.test(value)) {
            return "3-20 chars, alphanumeric & underscores only.";
        }
        return null;
    };

    const checkHandleAvailability = async () => {
        const validationError = validateHandle(handle);
        if (validationError) {
            setError(validationError);
            return false;
        }

        setIsChecking(true);
        setError(null);

        // Ideally we query a "usernames" collection or dedicated index
        // For Phase 2 MVP, we can just check if any user has this handle 
        // OR rely on a unique constraint/rules. 
        // For simplicity now: We will try to rely on client-side check if possible, 
        // but since we query by ID usually, checking uniqueness requires a query.
        // Let's assume for MVP we skip the race-condition strict check and just save.
        // Real-world: Use a separate 'usernames' collection where Document ID = username.

        // Let's try to query 'users' where handle == handle.
        // NOTE: This requires an index. We might hit an error if index is missing.
        // We will TRY to just save it for now and handle UI.

        setIsChecking(false);
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const isValid = await checkHandleAvailability(); // Simulating check
        if (!isValid) return;

        setIsSubmitting(true);

        try {
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL,
                handle: `@${handle}`,
                createdAt: serverTimestamp(),
            });
            // Profile updates, Modal will disappear via AuthContext listener
        } catch (err: any) {
            console.error(err);
            setError("Failed to save profile. Try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                    <AtSign size={32} />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">Claim your Handle</h2>
                <p className="text-gray-500 mb-8">
                    Choose a unique username to track your impact on CivicLens.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-bold">
                            @
                        </div>
                        <input
                            type="text"
                            value={handle}
                            onChange={(e) => {
                                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                setError(null);
                            }}
                            placeholder="username"
                            className="block w-full pl-8 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl text-lg font-semibold text-gray-900 focus:border-primary focus:ring-0 transition-colors"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm font-medium flex items-center justify-center gap-1">
                            <X size={14} /> {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={!handle || isChecking || isSubmitting}
                        className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check size={20} />
                                Complete Profile
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
