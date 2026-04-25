'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, orderBy, limit as fbLimit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { Loader2, Trophy, Flame, Shield, ChevronDown } from 'lucide-react';
import { getLevelFromXp } from '@/lib/gamification';
import { getVoteWeightTier, TRUST_DEFAULT } from '@/lib/trust';
import { LevelBadge, TrustBadge } from '@/components/GamificationUI';
import Link from 'next/link';

interface LeaderboardEntry {
    uid: string;
    displayName: string;
    handle: string;
    photoURL?: string;
    xp: number;
    level: number;
    levelTitle: string;
    trustScore: number;
    totalResolved: number;
    currentStreak: number;
    city?: string;
}

type SortBy = 'xp' | 'trustScore' | 'totalResolved';
type TimeRange = 'all' | 'city';

export default function LeaderboardPage() {
    const { user, userProfile } = useAuth();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<SortBy>('xp');
    const [timeRange, setTimeRange] = useState<TimeRange>('all');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                let q;
                if (timeRange === 'city' && userProfile?.city) {
                    q = query(
                        collection(db, 'users'),
                        where('city', '==', userProfile.city),
                        orderBy(sortBy === 'totalResolved' ? 'gamificationStats.totalResolved' : sortBy, 'desc'),
                        fbLimit(50)
                    );
                } else {
                    q = query(
                        collection(db, 'users'),
                        orderBy(sortBy === 'totalResolved' ? 'gamificationStats.totalResolved' : sortBy, 'desc'),
                        fbLimit(50)
                    );
                }

                const snap = await getDocs(q);
                const results: LeaderboardEntry[] = snap.docs.map(d => {
                    const data = d.data();
                    return {
                        uid: d.id,
                        displayName: data.displayName || 'Anonymous',
                        handle: data.handle || '',
                        photoURL: data.photoURL,
                        xp: data.xp || 0,
                        level: data.level || 1,
                        levelTitle: data.levelTitle || 'Observer',
                        trustScore: data.trustScore ?? TRUST_DEFAULT,
                        totalResolved: data.gamificationStats?.totalResolved || 0,
                        currentStreak: data.currentStreak || 0,
                        city: data.city,
                    };
                });

                // Client-side sort as fallback
                results.sort((a, b) => {
                    if (sortBy === 'xp') return b.xp - a.xp;
                    if (sortBy === 'trustScore') return b.trustScore - a.trustScore;
                    return b.totalResolved - a.totalResolved;
                });

                setEntries(results);
            } catch (e) {
                console.error('Failed to load leaderboard:', e);
                setEntries([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [sortBy, timeRange, userProfile?.city]);

    const getMedalEmoji = (rank: number) => {
        if (rank === 0) return '🥇';
        if (rank === 1) return '🥈';
        if (rank === 2) return '🥉';
        return null;
    };

    const getSortLabel = (s: SortBy) => {
        switch (s) {
            case 'xp': return 'XP';
            case 'trustScore': return 'Trust';
            case 'totalResolved': return 'Impact';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-lg mx-auto px-5 pt-8 pb-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shadow-amber-200">
                            <Trophy size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Civic Champions</h1>
                            <p className="text-sm text-gray-500">Top contributors making a difference</p>
                        </div>
                    </div>

                    {/* Sort + Filter */}
                    <div className="flex gap-2">
                        {(['xp', 'trustScore', 'totalResolved'] as SortBy[]).map(s => (
                            <button
                                key={s}
                                onClick={() => setSortBy(s)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${sortBy === s
                                    ? 'bg-gray-900 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                {getSortLabel(s)}
                            </button>
                        ))}
                        <div className="flex-1" />
                        {userProfile?.city && (
                            <button
                                onClick={() => setTimeRange(t => t === 'all' ? 'city' : 'all')}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${timeRange === 'city'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                {timeRange === 'city' ? userProfile.city : 'All Cities'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-lg mx-auto px-4 pt-4">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-amber-500" size={28} />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-16">
                        <Trophy size={32} className="text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-gray-600">No contributors yet</h3>
                        <p className="text-gray-400 text-sm">Be the first to earn XP!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {entries.map((entry, idx) => {
                            const isMe = entry.uid === user?.uid;
                            const levelInfo = getLevelFromXp(entry.xp);
                            const trustTier = getVoteWeightTier(entry.trustScore);
                            const medal = getMedalEmoji(idx);

                            return (
                                <motion.div
                                    key={entry.uid}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                >
                                    <Link
                                        href={`/profile/${entry.uid}`}
                                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isMe
                                            ? 'bg-blue-50 border border-blue-200'
                                            : 'bg-white border border-gray-100 hover:shadow-sm'
                                            }`}
                                    >
                                        {/* Rank */}
                                        <div className="w-8 text-center flex-shrink-0">
                                            {medal ? (
                                                <span className="text-lg">{medal}</span>
                                            ) : (
                                                <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-blue-500 to-purple-500 flex-shrink-0">
                                            {entry.photoURL ? (
                                                <img src={entry.photoURL} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                                                    {entry.displayName[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-900 truncate">
                                                    {entry.displayName}
                                                </span>
                                                {isMe && (
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">You</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-gray-400">{entry.handle}</span>
                                                {entry.currentStreak > 0 && (
                                                    <span className="flex items-center gap-0.5 text-[10px] text-orange-500 font-bold">
                                                        <Flame size={10} className="fill-orange-400" />{entry.currentStreak}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            <LevelBadge
                                                level={levelInfo.level}
                                                title={levelInfo.title}
                                                emoji={levelInfo.emoji}
                                                color={levelInfo.color}
                                                size="sm"
                                            />
                                            <div className="flex items-center gap-2 text-[10px]">
                                                <span className="font-bold text-gray-600">{entry.xp} XP</span>
                                                <TrustBadge
                                                    trustScore={entry.trustScore}
                                                    tierName={trustTier.name}
                                                    tierColor={trustTier.color}
                                                    size="sm"
                                                />
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
