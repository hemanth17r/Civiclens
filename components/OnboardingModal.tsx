'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AtSign, Check, X, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';

export default function OnboardingModal() {
    const { user, userProfile, loading } = useAuth();
    const [handle, setHandle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // If loading, or not logged in, or profile already has a handle → Don't show
    if (loading || !user || userProfile?.handle) return null;

    const validateHandle = (value: string): string | null => {
        if (!value) return 'Handle is required.';
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
            return '3–20 chars, letters, numbers and underscores only.';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const validationError = validateHandle(handle);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // Get the user's ID token to authenticate the server-side request
            const idToken = await auth.currentUser?.getIdToken(/* forceRefresh */ true);
            if (!idToken) {
                setError('Authentication error. Please sign in again.');
                return;
            }

            const res = await fetch('/api/profile/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ handle: handle.trim().toLowerCase() }),
            });

            const data = await res.json();

            if (!res.ok) {
                // Surface specific errors from the server
                setError(data.error || 'Failed to save profile. Please try again.');
                return;
            }

            // Success — AuthContext's onSnapshot listener will detect the new document
            // and set userProfile, which hides this modal automatically.
        } catch (err: any) {
            console.error('[OnboardingModal] submit error:', err);
            setError('Connection error. Check your connection and try again.');
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
                            maxLength={20}
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
                        disabled={!handle || isSubmitting}
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
