'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getFeedIssues, Issue } from '@/lib/issues';
import IssueCard from '@/components/IssueCard';
import ReportIssueDialog from '@/components/ReportIssueDialog';
import AuthModule from '@/components/AuthModule';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { RotateCw, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PullToRefresh from 'react-simple-pull-to-refresh';

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
                    <button
                        onClick={onReportClick}
                        className={clsx(
                            'group flex items-center justify-center gap-2 px-8 py-3.5 font-bold rounded-full transition-all border-2',
                            userState === 'A'
                                ? 'w-full sm:w-auto border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                                : 'w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        )}
                    >
                        Make Impact
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
    // ✅ Destructure `loading` (authLoading) so we wait for Firebase before deciding state
    const { user, userProfile, loading: authLoading, loginWithGoogleCredential } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const [issues, setIssues] = useState<Issue[]>([]);
    const [loadingIssues, setLoadingIssues] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // User state: starts as 'A', updated once auth resolves
    const [userState, setUserState] = useState<'A' | 'B' | 'C'>('A');
    const [statsLoading, setStatsLoading] = useState(true);

    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authTrigger, setAuthTrigger] = useState('to contribute');

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
            try {
                const q = query(
                    collection(db, 'issues'),
                    where('userId', '==', user.uid),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                setUserState(snapshot.empty ? 'B' : 'C');
            } catch (e) {
                console.error('Error checking user reports:', e);
                setUserState('B'); // safe fallback
            } finally {
                setStatsLoading(false);
            }
        };

        checkUserStatus();
    }, [user, authLoading]); // ✅ authLoading is now properly in scope & deps

    // ── Feed ─────────────────────────────────────────────────────────────────
    const fetchFeed = useCallback(async () => {
        // Don't fetch until auth has resolved
        if (authLoading) return;
        // Logged-in users without a city set don't get a feed — show the nudge instead
        const cityName = user ? (userProfile?.city || null) : 'Delhi';
        if (!cityName) {
            setLoadingIssues(false);
            setRefreshing(false);
            return;
        }
        setRefreshing(true);
        try {
            const data = await getFeedIssues(cityName);
            setIssues(data);
        } catch (e) {
            console.error('Feed fetch error:', e);
        } finally {
            setLoadingIssues(false);
            setRefreshing(false);
        }
    }, [authLoading, user, userProfile]);

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleReportClick = () => {
        if (!user) {
            setAuthTrigger('to report an issue');
            setIsAuthModalOpen(true);
        } else {
            setIsReportDialogOpen(true);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">

            <HeroSection
                userState={userState}
                statsLoading={statsLoading}
                onReportClick={handleReportClick}
            />

            <div className="max-w-2xl mx-auto px-4 pt-2">

                {/* Feed Header */}
                <div className="flex items-center justify-between mb-5">
                    {(() => {
                        const cityName = user ? userProfile?.city : 'Delhi';
                        return cityName ? (
                            <p className="text-xs text-gray-400 font-medium">
                                📍 <span className="font-semibold text-gray-500">{cityName}</span>{' '}
                                <span className="font-normal">& nearby</span>
                            </p>
                        ) : <span />;
                    })()}
                </div>

                {/* City nudge — shown when logged-in user hasn't set a city */}
                {user && !userProfile?.city && !authLoading && (
                    <div className="mb-6 bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center">
                        <p className="text-2xl mb-2">📍</p>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">Set your city to see your local feed</h3>
                        <p className="text-xs text-gray-500 mb-4">
                            We'll show you issues from your city and 5 nearby areas.
                        </p>
                        <button
                            onClick={() => router.push('/profile')}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full transition-colors"
                        >
                            Go to Profile → Set City
                        </button>
                    </div>
                )}

                {/* Feed Content */}
                <PullToRefresh onRefresh={async () => { await fetchFeed(); }} className="min-h-[60vh]">
                    <div className="space-y-6">
                        {loadingIssues ? (
                            Array(2).fill(0).map((_, i) => (
                                <div key={i} className="bg-white rounded-xl h-[400px] border border-gray-100 p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="w-24 h-3 bg-gray-100 animate-pulse rounded" />
                                            <div className="w-16 h-2 bg-gray-100 animate-pulse rounded" />
                                        </div>
                                    </div>
                                    <div className="w-full h-64 bg-gray-100 animate-pulse rounded-lg" />
                                </div>
                            ))
                        ) : (
                            <>
                                {/* Only show feed cards if user has a city (or is a guest) */}
                                {(user ? !!userProfile?.city : true) && (
                                    issues.length > 0
                                        ? issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                                        : (
                                            <div className="text-center py-12 text-gray-400">
                                                <p className="text-2xl mb-2">🏘️</p>
                                                <p className="font-semibold text-gray-500">No issues reported nearby yet.</p>
                                                <p className="text-xs mt-1">Be the first to report one in your area!</p>
                                            </div>
                                        )
                                )}

                                <button
                                    onClick={() => router.push('/explore')}
                                    className="w-full py-4 text-center text-blue-600 font-semibold bg-white border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors mt-4 shadow-sm"
                                >
                                    View All in Explore
                                </button>
                            </>
                        )}
                    </div>
                </PullToRefresh>
            </div>

            <ReportIssueDialog
                isOpen={isReportDialogOpen}
                onClose={() => setIsReportDialogOpen(false)}
            />

            <AuthModule
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                triggerAction={authTrigger}
            />

            {!authLoading && !user && (
                <Script
                    src="https://accounts.google.com/gsi/client"
                    strategy="afterInteractive"
                    onLoad={() => {
                        if ((window as any).google) {
                            (window as any).google.accounts.id.initialize({
                                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy-client-id',
                                callback: (response: any) => {
                                    loginWithGoogleCredential(response.credential).catch(console.error);
                                },
                                use_fedcm_for_prompt: true,
                            });
                            (window as any).google.accounts.id.prompt((notification: any) => {
                                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                                    console.log('One Tap prompt was skipped or not displayed:', notification.getNotDisplayedReason() || notification.getSkippedReason());
                                }
                            });
                        }
                    }}
                />
            )}
        </div>
    );
}
