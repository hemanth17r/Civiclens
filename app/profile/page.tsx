'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    User, FileText, Heart, Menu, X, LogOut,
    Camera, Check, Loader2, ChevronRight, UserCircle, Info, MapPin, Bookmark, Flame, MessageCircle, MessageSquare, Shield, Zap, Award
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { Issue, getUserHypedIssues, getUserCommentedIssues, getUserSavedIssues } from '@/lib/issues';
import { getFollowStats } from '@/lib/followers';
import IssueCard from '@/components/IssueCard';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { INDIAN_CITIES } from '@/data/cities';
import ConnectionsModal from '@/components/ConnectionsModal';
import { getUserGamificationStats, getLevelFromXp, getXpProgress, type Badge as GBadge } from '@/lib/gamification';
import { getUserTrustStats, getVoteWeightTier } from '@/lib/trust';
import { getUserCityRank } from '@/lib/users';
import { LevelBadge, XpProgressBar, TrustBadge, BadgeGrid, StreakDisplay } from '@/components/GamificationUI';
import VerifiedBadge from '@/components/VerifiedBadge';

type DrawerSection = null | 'menu' | 'editProfile' | 'accountDetails' | 'feedback';
type ActivitySubTab = 'hyped' | 'commented' | 'saved';

export default function ProfilePage() {
    const { user, userProfile, logout, isAdmin } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'reports' | 'activity'>('reports');
    const [myReports, setMyReports] = useState<Issue[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);

    // Activity subtabs
    const [activitySubTab, setActivitySubTab] = useState<ActivitySubTab>('hyped');
    const [hypedIssues, setHypedIssues] = useState<Issue[]>([]);
    const [commentedIssues, setCommentedIssues] = useState<Issue[]>([]);
    const [savedIssues, setSavedIssues] = useState<Issue[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(true);

    // Follower Stats
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);

    // Drawer
    const [drawer, setDrawer] = useState<DrawerSection>(null);
    const [connectionsModalType, setConnectionsModalType] = useState<'followers' | 'following' | null>(null);

    // Edit Profile fields
    const [editName, setEditName] = useState('');
    const [editHandle, setEditHandle] = useState('');
    const [editCity, setEditCity] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // City combobox
    const [citySearch, setCitySearch] = useState('');
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

    // Feedback
    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    // Gamification
    const [gamification, setGamification] = useState<{
        xp: number; level: ReturnType<typeof getLevelFromXp>;
        xpProgress: ReturnType<typeof getXpProgress>;
        badges: GBadge[]; currentStreak: number; longestStreak: number;
        stats: { totalReports: number; totalVerifications: number; totalComments: number; totalResolved: number };
    } | null>(null);
    const [trustInfo, setTrustInfo] = useState<{ 
        trustScore: number; 
        tier: ReturnType<typeof getVoteWeightTier>;
        accurateVotes: number;
        wrongVotes: number;
    } | null>(null);
    const [cityRank, setCityRank] = useState<number>(0);

    const filteredCities = citySearch === ''
        ? INDIAN_CITIES.sort((a, b) => a.tier - b.tier).slice(0, 8)
        : INDIAN_CITIES.filter(c =>
            c.name.toLowerCase().includes(citySearch.toLowerCase())
        ).slice(0, 8);

    useEffect(() => {
        const fetchReports = async () => {
            if (!user) return;
            try {
                const q = query(
                    collection(db, 'issues'),
                    where('userId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                setMyReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Issue)));
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingReports(false);
            }
        };
        fetchReports();
    }, [user]);

    // Load follower stats
    useEffect(() => {
        if (!user) return;
        const fetchStats = async () => {
            const stats = await getFollowStats(user.uid);
            setFollowersCount(stats.followersCount);
            setFollowingCount(stats.followingCount);
        };
        fetchStats();
    }, [user]);

    // Load gamification data
    useEffect(() => {
        if (!user) return;
        const fetchGamification = async () => {
            const [gData, tData] = await Promise.all([
                getUserGamificationStats(user.uid),
                getUserTrustStats(user.uid),
            ]);
            setGamification(gData);
            setTrustInfo({ 
                trustScore: tData.trustScore, 
                tier: tData.tier,
                accurateVotes: tData.accurateVotes,
                wrongVotes: tData.wrongVotes
            });

            if (userProfile?.city) {
                const rank = await getUserCityRank(userProfile.city, gData.xp);
                setCityRank(rank);
            }
        };
        fetchGamification();
    }, [user, userProfile?.city]);

    // Load activity data when activity tab is selected
    useEffect(() => {
        if (activeTab !== 'activity' || !user) return;
        let cancelled = false;

        const fetchActivity = async () => {
            setLoadingActivity(true);
            try {
                const [hyped, commented, saved] = await Promise.all([
                    getUserHypedIssues(user.uid),
                    getUserCommentedIssues(user.uid),
                    getUserSavedIssues(user.uid)
                ]);
                if (!cancelled) {
                    setHypedIssues(hyped);
                    setCommentedIssues(commented);
                    setSavedIssues(saved);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (!cancelled) setLoadingActivity(false);
            }
        };
        fetchActivity();
        return () => { cancelled = true; };
    }, [activeTab, user]);

    const openEditProfile = () => {
        setEditName(user?.displayName || '');
        const raw = userProfile?.handle || user?.email?.split('@')[0] || '';
        setEditHandle(raw.startsWith('@') ? raw.slice(1) : raw);
        const savedCity = userProfile?.city || '';
        setEditCity(savedCity);
        setCitySearch(savedCity);
        setIsCityDropdownOpen(false);
        setPhotoPreview(null);
        setPhotoFile(null);
        setDrawer('editProfile');
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSavingProfile(true);
        try {
            let photoURL = user.photoURL || '';
            if (photoFile) {
                const filePath = `profile_photos/${user.uid}`;
                const { data, error } = await supabase.storage
                    .from('media')
                    .upload(filePath, photoFile, {
                        upsert: true
                    });
                
                if (error) {
                    console.error('Supabase profile photo upload error:', error);
                    throw new Error('Failed to upload profile photo to Supabase.');
                }

                const { data: publicUrlData } = supabase.storage
                    .from('media')
                    .getPublicUrl(filePath);
                
                photoURL = publicUrlData.publicUrl;
            }
            await updateProfile(user, {
                displayName: editName || user.displayName,
                photoURL,
            });
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                displayName: editName || user.displayName,
                handle: editHandle ? `@${editHandle}` : userProfile?.handle,
                city: editCity || userProfile?.city || '',
                photoURL,
            });
            setDrawer(null);
        } catch (e) {
            console.error('Failed to save profile:', e);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSignOut = async () => {
        await logout();
        router.push('/login');
    };

    const submitFeedback = async () => {
        if (!feedbackMsg.trim()) return;
        setSubmittingFeedback(true);
        try {
            await addDoc(collection(db, 'feedbacks'), {
                message: feedbackMsg.trim(),
                userEmail: user?.email || 'Anonymous',
                userId: user?.uid || 'Unknown',
                createdAt: serverTimestamp()
            });
            setFeedbackMsg('');
            setDrawer(null);
            alert('Feedback submitted successfully!');
        } catch (e) {
            console.error(e);
            alert('Failed to submit feedback.');
        } finally {
            setSubmittingFeedback(false);
        }
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const avatarUrl = photoPreview || user?.photoURL;
    const displayName = user?.displayName || 'Citizen';
    const rawHandle = userProfile?.handle || user?.email?.split('@')[0] || '';
    const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
    const city = userProfile?.city || '';

    // Get current activity list
    const getActivityList = () => {
        switch (activitySubTab) {
            case 'hyped': return hypedIssues;
            case 'commented': return commentedIssues;
            case 'saved': return savedIssues;
        }
    };

    const getActivityEmptyMessage = () => {
        switch (activitySubTab) {
            case 'hyped': return { title: 'No hyped posts', desc: 'Hype issues to support your community.' };
            case 'commented': return { title: 'No commented posts', desc: 'Comment on issues to start conversations.' };
            case 'saved': return { title: 'No saved posts', desc: 'Save issues to revisit them later.' };
        }
    };

    const getActivityEmptyIcon = () => {
        switch (activitySubTab) {
            case 'hyped': return <Flame size={28} strokeWidth={1.5} />;
            case 'commented': return <MessageCircle size={28} strokeWidth={1.5} />;
            case 'saved': return <Bookmark size={28} strokeWidth={1.5} />;
        }
    };

    // ── Guest ─────────────────────────────────────────────────────────────────
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-gray-50">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <User size={40} className="text-gray-300" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">You're not logged in</h1>
                <p className="text-gray-500 text-sm">Sign in to see your profile and reports.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">

            {/* ── PROFILE CARD ─────────────────────────────────────────────── */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-lg mx-auto px-5 pt-8 pb-0">

                    {/* Top bar: Location left, Menu right */}
                    <div className="flex justify-between items-center mb-5">
                        <button
                            onClick={openEditProfile}
                            className="flex items-center group px-4 py-1.5 -ml-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            <MapPin size={16} className={clsx('mr-1.5 flex-shrink-0 transition-colors', city ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700')} />
                            <span className={clsx('text-sm font-semibold transition-colors', city ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700')}>
                                {city || 'Add Location'}
                            </span>
                        </button>

                        <button
                            onClick={() => setDrawer('menu')}
                            className="p-2 -mr-2 rounded-full text-gray-800 hover:bg-gray-100 transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                    </div>

                    {/* Avatar row: pic LEFT, Name+Stats RIGHT */}
                    <div className="flex items-center justify-between gap-6 mb-6">
                        {/* Avatar */}
                        <div className="w-22 h-22 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2.5px] shadow-sm flex-shrink-0">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-white">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-500 to-purple-500 text-white text-2xl font-bold">
                                        {displayName[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right side: Name + Stats */}
                        <div className="flex flex-col flex-1 pl-2">
                            <h1 className="text-[15px] font-bold text-gray-900 leading-tight mb-3 flex items-center gap-2">
                                {displayName}
                                {isAdmin && <VerifiedBadge label="Admin" size="sm" />}
                                {trustInfo && (
                                    <TrustBadge
                                        trustScore={trustInfo.trustScore}
                                        tierName={trustInfo.tier.name}
                                        tierColor={trustInfo.tier.color}
                                        size="sm"
                                    />
                                )}
                            </h1>
                            <div className="flex gap-6 w-full">
                                <div
                                    className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setConnectionsModalType('followers')}
                                >
                                    <span className="font-semibold text-gray-900 text-[15px] leading-none">{followersCount}</span>
                                    <span className="text-[13px] text-gray-600 mt-1">followers</span>
                                </div>
                                <div
                                    className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setConnectionsModalType('following')}
                                >
                                    <span className="font-semibold text-gray-900 text-[15px] leading-none">{followingCount}</span>
                                    <span className="text-[13px] text-gray-600 mt-1">following</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── GAMIFICATION SECTION ── */}
                    {gamification && (
                        <div className="px-1 pt-3 pb-3">
                            {/* Level + Trust Row */}
                            <div className="flex items-center justify-between mb-3">
                                <LevelBadge
                                    level={gamification.level.level}
                                    title={gamification.level.title}
                                    emoji={gamification.level.emoji}
                                    color={gamification.level.color}
                                />
                            </div>

                            {/* XP Progress */}
                            <XpProgressBar
                                xp={gamification.xp}
                                progress={gamification.xpProgress.progress}
                                currentLevelXp={gamification.xpProgress.currentLevelXp}
                                nextLevelXp={gamification.xpProgress.nextLevelXp}
                                levelColor={gamification.level.color}
                                currentLevel={gamification.level.level}
                            />

                            {/* Streak + Impact Stats */}
                            <div className="flex items-center justify-between mt-3">
                                <StreakDisplay
                                    currentStreak={gamification.currentStreak}
                                    longestStreak={gamification.longestStreak}
                                />
                                <div className="flex gap-3 text-center">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-emerald-600">{gamification.stats.totalResolved}</span>
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Resolved</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-blue-600">{gamification.stats.totalVerifications}</span>
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Verified</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── CIVIC IMPACT SECTION ── */}
                    {gamification && (
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-6 mx-1">
                            <h3 className="text-[13px] font-bold text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Award size={16} className="text-blue-500" />
                                Civic Impact
                            </h3>
                            <div className="grid grid-cols-2 gap-y-5 gap-x-2">
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-gray-900">{myReports.length}</span>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Issues Reported</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-blue-600">{gamification.stats.totalVerifications}</span>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Issues Verified</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-emerald-600">{gamification.stats.totalResolved}</span>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Issues Resolved</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-purple-600">
                                        {trustInfo && (trustInfo.accurateVotes + trustInfo.wrongVotes) > 0 
                                            ? Math.round((trustInfo.accurateVotes / (trustInfo.accurateVotes + trustInfo.wrongVotes)) * 100) + '%'
                                            : '--'}
                                    </span>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Verification Accuracy</span>
                                </div>
                                <div className="flex flex-col col-span-2 mt-2 pt-4 border-t border-gray-200/60">
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Contribution Score</span>
                                            <span className="text-3xl font-black text-amber-500 flex items-center gap-1.5 mt-0.5">
                                                <Zap size={22} className="fill-amber-500" /> {gamification.xp}
                                            </span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">City Rank</span>
                                            <span className="text-2xl font-black text-gray-900 mt-0.5">
                                                {cityRank > 0 ? `#${cityRank}` : '--'} <span className="text-sm font-semibold text-gray-500 ml-1">in {city || 'City'}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* IG Tabs */}
                    <div className="flex border-t border-gray-100">
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={clsx("flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors", activeTab === 'reports' ? "border-gray-900" : "border-transparent")}
                        >
                            <FileText size={20} className={clsx("transition-colors", activeTab === 'reports' ? "text-gray-900" : "text-gray-400")} />
                            <span className={clsx("text-sm font-semibold transition-colors", activeTab === 'reports' ? "text-gray-900" : "text-gray-400")}>Reports</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={clsx("flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors", activeTab === 'activity' ? "border-gray-900" : "border-transparent")}
                        >
                            <Heart size={20} className={clsx("transition-colors", activeTab === 'activity' ? "text-gray-900" : "text-gray-400")} />
                            <span className={clsx("text-sm font-semibold transition-colors", activeTab === 'activity' ? "text-gray-900" : "text-gray-400")}>My Activity</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── TAB CONTENT ── */}
            <div className="max-w-lg mx-auto px-4 pt-5">
                {activeTab === 'reports' ? (
                    loadingReports ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="animate-spin text-blue-400" size={28} />
                        </div>
                    ) : myReports.length > 0 ? (
                        <div className="space-y-5">
                            {myReports.map((r) => <IssueCard key={r.id} issue={r} />)}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center mx-auto mb-3 text-gray-300">
                                <FileText size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">No Reports Yet</h3>
                        </div>
                    )
                ) : (
                    <>
                        {/* Activity Subtabs: Hyped | Commented | Saved */}
                        <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
                            <button
                                onClick={() => setActivitySubTab('hyped')}
                                className={clsx(
                                    "flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors border-b-2",
                                    activitySubTab === 'hyped' ? "border-orange-500 text-orange-600 bg-orange-50/50" : "border-transparent text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Flame size={18} />
                                Hyped
                            </button>
                            <button
                                onClick={() => setActivitySubTab('commented')}
                                className={clsx(
                                    "flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors border-b-2",
                                    activitySubTab === 'commented' ? "border-blue-500 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <MessageCircle size={18} />
                                Commented
                            </button>
                            <button
                                onClick={() => setActivitySubTab('saved')}
                                className={clsx(
                                    "flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors border-b-2",
                                    activitySubTab === 'saved' ? "border-gray-900 text-gray-900 bg-gray-50" : "border-transparent text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Bookmark size={18} />
                                Saved
                            </button>
                        </div>

                        {loadingActivity ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="animate-spin text-blue-400" size={28} />
                            </div>
                        ) : getActivityList().length > 0 ? (
                            <div className="space-y-5">
                                {getActivityList().map((r) => <IssueCard key={r.id} issue={r} />)}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center mx-auto mb-3 text-gray-300">
                                    {getActivityEmptyIcon()}
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">{getActivityEmptyMessage().title}</h3>
                                <p className="text-gray-500 text-sm mt-1">{getActivityEmptyMessage().desc}</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── RIGHT-SIDE DRAWER ─────────────────────────────────────────── */}
            <AnimatePresence>
                {drawer && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setDrawer(null); setIsCityDropdownOpen(false); }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
                        />

                        {/* Panel */}
                        <motion.div
                            key="panel"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="fixed top-0 right-0 h-full w-[85vw] max-w-sm bg-white z-[90] flex flex-col shadow-2xl"
                        >

                            {/* ── MENU ── */}
                            {drawer === 'menu' && (
                                <div className="flex flex-col h-full">
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 overflow-hidden flex-shrink-0">
                                                {avatarUrl
                                                    ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-white font-bold">{displayName[0].toUpperCase()}</div>
                                                }
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-gray-900 truncate">{displayName}</p>
                                                {city && (
                                                    <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                                                        <MapPin size={10} className="text-blue-400" />{city}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => setDrawer(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {/* Items */}
                                    <div className="flex-1 p-4 space-y-1 overflow-y-auto">
                                        <button
                                            onClick={openEditProfile}
                                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                                                    <UserCircle size={18} className="text-blue-600" />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-800">Edit Profile</span>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                                        </button>

                                        <button
                                            onClick={() => setDrawer('accountDetails')}
                                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                                                    <Info size={18} className="text-gray-500" />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-800">Account Details</span>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                                        </button>

                                        <button
                                            onClick={() => setDrawer('feedback')}
                                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                                                    <MessageSquare size={18} className="text-blue-500" />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-800">Feedback</span>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                                        </button>

                                    </div>

                                    {/* Sign out */}
                                    <div className="p-4 border-t border-gray-100 flex-shrink-0">
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full flex items-center justify-center gap-2.5 py-3 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl transition-colors"
                                        >
                                            <LogOut size={16} />
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── EDIT PROFILE ── */}
                            {drawer === 'editProfile' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center gap-3 p-5 border-b border-gray-100 flex-shrink-0">
                                        <button onClick={() => setDrawer('menu')} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                                            <X size={18} />
                                        </button>
                                        <h2 className="text-base font-bold text-gray-900">Edit Profile</h2>
                                    </div>

                                    <div className="flex-1 p-5 space-y-5 overflow-y-auto">
                                        {/* Photo */}
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="relative">
                                                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2.5px] shadow-md">
                                                    <div className="w-full h-full rounded-full overflow-hidden bg-white">
                                                        {(photoPreview || avatarUrl) ? (
                                                            <img src={photoPreview || avatarUrl!} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-500 to-purple-500 text-white text-2xl font-bold">
                                                                {displayName[0].toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => photoInputRef.current?.click()}
                                                    className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"
                                                >
                                                    <Camera size={22} className="text-white" />
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-400">Tap to change photo</p>
                                            <input type="file" ref={photoInputRef} accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                        </div>

                                        {/* Name */}
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Name</label>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                placeholder="Your name"
                                            />
                                        </div>

                                        {/* Handle */}
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Handle</label>
                                            <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3">
                                                <span className="text-gray-400 text-sm mr-1">@</span>
                                                <input
                                                    type="text"
                                                    value={editHandle}
                                                    onChange={(e) => setEditHandle(e.target.value.replace(/[@\s]/g, '').toLowerCase())}
                                                    className="flex-1 bg-transparent text-sm font-medium text-gray-800 focus:outline-none"
                                                    placeholder="yourhandle"
                                                />
                                            </div>
                                        </div>

                                        {/* Nearby City — searchable combobox */}
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Nearby City</label>
                                            <div className="relative">
                                                <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 gap-2">
                                                    <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                                                    <input
                                                        type="text"
                                                        value={citySearch}
                                                        onChange={(e) => {
                                                            setCitySearch(e.target.value);
                                                            setEditCity('');
                                                            setIsCityDropdownOpen(true);
                                                        }}
                                                        onClick={() => setIsCityDropdownOpen(true)}
                                                        className="flex-1 bg-transparent text-sm font-medium text-gray-800 focus:outline-none"
                                                        placeholder="Enter nearby city"
                                                    />
                                                    {citySearch && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setCitySearch(''); setEditCity(''); }}
                                                            className="text-gray-300 hover:text-gray-500 transition-colors"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Dropdown */}
                                                {isCityDropdownOpen && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-44 overflow-y-auto z-20">
                                                        {filteredCities.length > 0 ? (
                                                            filteredCities.map(c => (
                                                                <button
                                                                    key={c.name}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditCity(c.name);
                                                                        setCitySearch(c.name);
                                                                        setIsCityDropdownOpen(false);
                                                                    }}
                                                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                                                                >
                                                                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                                                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{c.state}</span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="p-4 text-center text-gray-400 text-sm">No cities found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Save */}
                                    <div className="p-5 border-t border-gray-100 flex-shrink-0">
                                        <button
                                            onClick={handleSave}
                                            disabled={savingProfile}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
                                        >
                                            {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                            {savingProfile ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── ACCOUNT DETAILS ── */}
                            {drawer === 'accountDetails' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center gap-3 p-5 border-b border-gray-100 flex-shrink-0">
                                        <button onClick={() => setDrawer('menu')} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                                            <X size={18} />
                                        </button>
                                        <h2 className="text-base font-bold text-gray-900">Account Details</h2>
                                    </div>

                                    <div className="flex-1 p-5 space-y-3 overflow-y-auto">
                                        {[
                                            { label: 'Name', value: displayName },
                                            { label: 'Handle', value: handle },
                                            { label: 'Email', value: user.email || '—' },
                                            { label: 'Nearby City', value: city || 'Not set' },
                                            { label: 'Reports', value: `${myReports.length} submitted` },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="bg-gray-50 rounded-xl px-4 py-3.5">
                                                <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
                                                <p className="text-sm font-semibold text-gray-800">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── FEEDBACK ── */}
                            {drawer === 'feedback' && (
                                <div className="flex flex-col h-full bg-white">
                                    <div className="flex items-center gap-3 p-5 border-b border-gray-100 flex-shrink-0">
                                        <button onClick={() => setDrawer('menu')} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                                            <X size={18} />
                                        </button>
                                        <h2 className="text-base font-bold text-gray-900">Send Feedback</h2>
                                    </div>

                                    <div className="flex-1 p-5 overflow-y-auto">
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">We value your thoughts!</label>
                                        <textarea
                                            value={feedbackMsg}
                                            onChange={(e) => setFeedbackMsg(e.target.value)}
                                            rows={5}
                                            placeholder="Tell us what you think or report bugs here..."
                                            className="w-full bg-gray-50 rounded-xl px-4 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent focus:border-transparent text-gray-800 resize-none transition-shadow"
                                        />
                                    </div>

                                    <div className="p-4 border-t border-gray-100 flex-shrink-0">
                                        <button
                                            onClick={submitFeedback}
                                            disabled={submittingFeedback || !feedbackMsg.trim()}
                                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            {submittingFeedback ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Feedback'}
                                        </button>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <ConnectionsModal
                isOpen={!!connectionsModalType}
                onClose={() => setConnectionsModalType(null)}
                type={connectionsModalType || 'followers'}
                userId={user.uid}
            />
        </div>
    );
}
