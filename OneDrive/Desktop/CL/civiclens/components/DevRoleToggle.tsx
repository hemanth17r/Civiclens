'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bug } from 'lucide-react';

/**
 * Dev-only floating toggle to switch between Citizen and Official roles.
 * Only renders in development mode.
 */
export default function DevRoleToggle() {
    const { user, userProfile, isOfficial } = useAuth();
    const [busy, setBusy] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Only show in dev
    if (process.env.NODE_ENV !== 'development') return null;
    if (!user) return null;

    const toggle = async () => {
        if (busy || !user) return;
        setBusy(true);
        try {
            const ref = doc(db, 'users', user.uid);
            if (isOfficial) {
                // Switch to citizen
                await updateDoc(ref, {
                    role: 'citizen',
                    department: null,
                    jurisdiction: null
                });
            } else {
                // Switch to official
                await updateDoc(ref, {
                    role: 'official',
                    department: 'Sanitation',
                    jurisdiction: 'South Zone' // MCD Hackathon Default
                });
            }
        } catch (e) {
            console.error('DevRoleToggle error:', e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed bottom-20 right-4 z-[100] md:bottom-4">
            {expanded && (
                <div className="mb-2 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl w-56 animate-in slide-in-from-bottom-2">
                    <p className="font-bold mb-1 text-yellow-400">⚙ Dev Role Toggle</p>
                    <p className="text-gray-300 mb-2">
                        Current: <span className="font-semibold text-white">
                            {isOfficial
                                ? `🏛 Official (${userProfile?.department}, ${userProfile?.jurisdiction})`
                                : '👤 Citizen'}
                        </span>
                    </p>
                    <button
                        onClick={toggle}
                        disabled={busy}
                        className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${isOfficial
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                            } disabled:opacity-50`}
                    >
                        {busy ? 'Switching...' : isOfficial ? 'Switch to Citizen' : 'Switch to Official'}
                    </button>
                </div>
            )}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-10 h-10 bg-yellow-400 text-gray-900 rounded-full shadow-lg flex items-center justify-center hover:bg-yellow-300 transition-colors"
                title="Dev Role Toggle"
            >
                <Bug size={18} />
            </button>
        </div>
    );
}
