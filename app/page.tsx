'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getFeedIssues, Issue } from '@/lib/issues';
import IssueCard from '@/components/IssueCard';
import FeedSkeleton from '@/components/FeedSkeleton';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { ArrowRight, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PullToRefresh from 'react-simple-pull-to-refresh';
import SemanticOverview from '@/components/SemanticOverview';
import { motion } from 'framer-motion';
import { tapScale } from '@/lib/motion';

// User States:
//   'A' = Guest (not logged in)
//   'B' = Rookie (logged in, never reported)
//   'C' = Pro    (logged in, has reported at least once)

// ── Hero is a module-level component so React never re-mounts it on re-render ──
function HeroSection({
    userState,
    statsLoading,
    onReportClick,
}: {
    userState: 'A' | 'B' | 'C';
    statsLoading: boolean;
    onReportClick: () => void;
}) {
    if (statsLoading) {
        return <div className="w-full h-52 bg-gray-100 animate-pulse mb-6 rounded-b-2xl" />;
    }

    // Pro users skip the hero — jump straight to the feed
    if (userState === 'C') return null;

    return (
        <div className="relative w-full text-center mb-10 pt-8 pb-4 px-4">
            <div className="relative z-10 max-w-2xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight text-gray-900">
                    Don't Ignore It. <br />
                    <span className="text-blue-600">Report It.</span>
                </h1>

                <p className="text-gray-600 text-lg mb-8 max-w-lg mx-auto leading-relaxed">
                    {userState === 'A'
                        ? 'Join citizens across India in transforming their communities, one report at a time.'
                        : 'It takes 10 seconds to start your first fix. Try it now.'}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <motion.button
                        {...tapScale.button}
                        onClick={onReportClick}
                        className={clsx(
                            'group flex items-center justify-center gap-2 px-8 py-3.5 font-semibold rounded-full transition-all border cursor-pointer',
                            userState === 'A'
                                ? 'w-full sm:w-auto border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20'
                                : 'w-full border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
                        )}
                    >
                        Make Impact
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

// Helper to get initial city synchronously from localStorage (0ms delay)
function getInitialCity(): string {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('civiclens:last_city');
            if (saved && saved.trim()) return saved.trim();
        } catch {
            // ignore localStorage restrictions
        }
    }
    return 'Delhi';
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
    // ✅ Destructure `loading` (authLoading) so we wait for Firebase before deciding state
    const { user, userProfile, loading: authLoading, loginWithGoogleCredential } = useAuth();
    const router = useRouter();

    const [currentCity, setCurrentCity] = useState<string>(getInitialCity);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loadingIssues, setLoadingIssues] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Track which city was actually fetched to prevent duplicate Firestore queries
    const fetchedCityRef = useRef<string | null>(null);

    // User state: starts as 'A', updated once auth resolves
    const [userState, setUserState] = useState<'A' | 'B' | 'C'>('A');
    const [statsLoading, setStatsLoading] = useState(true);
    const isGsiInitialized = useRef(false);

    // ── Determine user state after auth resolves ──────────────────────────────
    useEffect(() => {
        // Wait for Firebase Auth to finish initialising
        if (authLoading) return;

        const checkUserStatus = async () => {
            setStatsLoading(true);

            if (!user) {
                // Not logged in → Guest
                setUserState('A');
                setStatsLoading(false);
                return;
            }

            // Logged in → check whether they've ever reported
            // NOTE: We use a small retry/delay because sometimes Firestore reports permission error 
            // the split-second after login before the token propagates.
            const tryFetch = async (retries = 3): Promise<void> => {
                try {
                    const q = query(
                        collection(db, 'issues'),
                        where('userId', '==', user.uid),
                        limit(1)
                    );
                    const snapshot = await getDocs(q);
                    setUserState(snapshot.empty ? 'B' : 'C');
                } catch (e: any) {
                    if (retries > 0 && (e.code === 'permission-denied' || e.message?.includes('permissions'))) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        return tryFetch(retries - 1);
                    }
                    console.warn('Error checking user reports:', e.message);
                    setUserState('B'); // safe fallback
                }
            };

            await tryFetch();
            setStatsLoading(false);
        };

        checkUserStatus();
    }, [user, authLoading]);

    // ── Feed Fetcher ──────────────────────────────────────────────────────────
    const fetchFeedForCity = useCallback(async (cityName: string, userId?: string) => {
        if (!cityName) {
            setLoadingIssues(false);
            setRefreshing(false);
            return;
        }
        setRefreshing(true);
        try {
            const data = await getFeedIssues(cityName, userId);
            setIssues(data);
            fetchedCityRef.current = cityName;
        } catch (e) {
            console.error('Feed fetch error:', e);
        } finally {
            setLoadingIssues(false);
            setRefreshing(false);
        }
    }, []);

    // 1. Initial mount: fetch IMMEDIATELY with local cached city or default (0ms delay)
    useEffect(() => {
        const initialCity = getInitialCity();
        setCurrentCity(initialCity);
        fetchFeedForCity(initialCity, user?.uid);
    }, [fetchFeedForCity]);

    // 2. Profile sync: when userProfile resolves, save to localStorage & ONLY refetch if city differs
    useEffect(() => {
        if (authLoading) return;

        if (user && userProfile?.city) {
            const profileCity = userProfile.city.trim();
            try {
                localStorage.setItem('civiclens:last_city', profileCity);
            } catch {}

            // Prevent duplicate query: only fetch if city differs from what was already fetched
            if (profileCity !== fetchedCityRef.current) {
                setCurrentCity(profileCity);
                fetchFeedForCity(profileCity, user.uid);
            }
        }
    }, [authLoading, user, userProfile, fetchFeedForCity]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleReportClick = () => {
        // Dispatches to Shell's global modal handler
        window.dispatchEvent(new CustomEvent('civiclens:open-report'));
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-white pb-20 md:pb-8">

            <HeroSection
                userState={userState}
                statsLoading={statsLoading}
                onReportClick={handleReportClick}
            />

            <div className="max-w-xl mx-auto px-0 md:px-4 pt-1 md:pt-4">

                {/* Feed Header */}
                <div className="flex items-center justify-between mb-3 px-4 md:px-0">
                    {currentCity ? (
                        <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                            <MapPin size={14} className="text-blue-500/70" />
                            <span className="font-semibold text-gray-500">{currentCity}</span>{' '}
                            <span className="font-normal">& nearby</span>
                        </p>
                    ) : <span />}
                </div>

                {/* City nudge — shown when logged-in user hasn't set a city */}
                {user && !userProfile?.city && !authLoading && (
                    <div className="mx-4 md:mx-0 mb-4 bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center flex flex-col items-center">
                        <MapPin className="text-blue-500 mb-2 animate-bounce" size={28} />
                        <h3 className="text-sm font-bold text-gray-900 mb-1">Set your city to see your local feed</h3>
                        <p className="text-xs text-gray-500 mb-4">
                            We'll show you issues from your city and 5 nearby areas.
                        </p>
                        <motion.button
                            {...tapScale.button}
                            onClick={() => router.push('/profile')}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                        >
                            Go to Profile → Set City
                        </motion.button>
                    </div>
                )}

                {/* Feed Content */}
                <PullToRefresh onRefresh={async () => { await fetchFeedForCity(currentCity, user?.uid); }} className="min-h-[60vh]">
                    <div className="space-y-1 md:space-y-6">
                        {loadingIssues ? (
                            Array(2).fill(0).map((_, i) => (
                                <FeedSkeleton key={i} />
                            ))
                        ) : (
                            <>
                                {/* Only show feed cards if user has a city (or is a guest) */}
                                {(user ? !!userProfile?.city : true) && (
                                    issues.length > 0
                                        ? issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                                        : (
                                            <div className="text-center py-12 text-gray-400 px-4">
                                                <p className="text-2xl mb-2">🏘️</p>
                                                <p className="font-semibold text-gray-500">No issues reported nearby yet.</p>
                                                <p className="text-xs mt-1">Be the first to report one in your area!</p>
                                            </div>
                                        )
                                )}

                                <div className="px-4 md:px-0 pb-6">
                                    <motion.button
                                        {...tapScale.button}
                                        onClick={() => router.push('/explore')}
                                        className="w-full py-3 text-center text-blue-600 font-semibold bg-white border border-blue-100 rounded-full hover:bg-blue-50 transition-colors mt-3 shadow-xs cursor-pointer block text-xs"
                                    >
                                        Explore All Community Reports →
                                    </motion.button>
                                </div>
                            </>
                        )}
                    </div>
                </PullToRefresh>

                <SemanticOverview />
            </div>

            {!authLoading && !user && (
                <Script
                    src="https://accounts.google.com/gsi/client"
                    strategy="afterInteractive"
                    onLoad={() => {
                        if ((window as any).google && !isGsiInitialized.current) {
                            (window as any).google.accounts.id.initialize({
                                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy-client-id',
                                callback: (response: any) => {
                                    loginWithGoogleCredential(response.credential).catch(console.error);
                                },
                                use_fedcm_for_prompt: false, // 🛠️ Disabled to avoid FedCM AbortError
                            });
                            (window as any).google.accounts.id.prompt((notification: any) => {
                                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                                    console.log('One Tap prompt was skipped or not displayed:', notification.getNotDisplayedReason() || notification.getSkippedReason());
                                } else {
                                    isGsiInitialized.current = true;
                                }
                            });
                        }
                    }}
                />
            )}
        </div>
    );
}
