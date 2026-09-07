'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getTopInProgressByCity, getTopResolvedByCity, Issue, getCityPulseStats, getIssueTimeMs
} from '@/lib/issues';
import { getTopContributorsByCity } from '@/lib/users';
import { UserProfile } from '@/context/AuthContext';
import { INDIAN_CITIES } from '@/data/cities';
import { 
    Loader2, AlertTriangle, Clock, Flame, MapPin, 
    CheckCircle, ShieldCheck, Info, X, Map, Trophy, 
    User as UserIcon, ExternalLink, ChevronDown, TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { tapScale } from '@/lib/motion';

export default function CityInsightsPage() {
    const { userProfile } = useAuth();
    const router = useRouter();

    // City state
    const [selectedCity, setSelectedCity] = useState<string>('Delhi');
    const [hasUserChangedCity, setHasUserChangedCity] = useState<boolean>(false);

    // Synchronize default city with user profile once profile loads
    useEffect(() => {
        if (userProfile?.city && !hasUserChangedCity) {
            setSelectedCity(userProfile.city);
        }
    }, [userProfile?.city, hasUserChangedCity]);

    // Data states
    const [inProgressIssues, setInProgressIssues] = useState<Issue[]>([]);
    const [resolvedIssues, setResolvedIssues] = useState<Issue[]>([]);
    const [topContributors, setTopContributors] = useState<UserProfile[]>([]);
    const [pulseStats, setPulseStats] = useState<{
        activeCount: number;
        resolvedCount: number;
        totalCount: number;
        resolutionRate: number;
    } | null>(null);

    const [loading, setLoading] = useState(true);

    const cityOptions = useMemo(() => {
        const names = INDIAN_CITIES.map(c => c.name);
        if (selectedCity && !names.includes(selectedCity)) {
            return [selectedCity, ...names];
        }
        return names;
    }, [selectedCity]);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            getTopInProgressByCity(selectedCity, 5),
            getTopResolvedByCity(selectedCity, 5),
            getTopContributorsByCity(selectedCity, 5),
            getCityPulseStats(selectedCity)
        ]).then(([ip, res, contributors, stats]) => {
            setInProgressIssues(ip);
            setResolvedIssues(res);
            setTopContributors(contributors);
            setPulseStats(stats);
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedCity]);

    // Pre-compute time strings safely outside the render loop
    const enrichedInProgress = useMemo(() =>
        inProgressIssues.map(issue => {
            const timeMs = getIssueTimeMs(issue.createdAt);
            return {
                ...issue,
                _age: timeMs ? formatDistanceToNow(new Date(timeMs), { addSuffix: true }) : 'Recently',
            };
        }),
        [inProgressIssues]
    );

    const enrichedResolved = useMemo(() =>
        resolvedIssues.map(issue => {
            const timeMs = getIssueTimeMs(issue.createdAt);
            const resolvedMs = getIssueTimeMs(issue.resolvedAt);
            return {
                ...issue,
                _age: timeMs ? formatDistanceToNow(new Date(timeMs), { addSuffix: true }) : 'Recently',
                _resolvedAge: resolvedMs ? formatDistanceToNow(new Date(resolvedMs), { addSuffix: true }) : null,
            };
        }),
        [resolvedIssues]
    );



    const renderLeaderboard = () => {
        if (loading) {
            return (
                <div className="divide-y divide-gray-50">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-6 bg-gray-100 animate-pulse rounded" />
                                <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                                <div className="flex flex-col gap-1.5">
                                    <div className="w-28 h-4 bg-gray-100 animate-pulse rounded" />
                                    <div className="w-16 h-3 bg-gray-100 animate-pulse rounded" />
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="w-8 h-4 bg-gray-100 animate-pulse rounded" />
                                <div className="w-12 h-3 bg-gray-100 animate-pulse rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        if (topContributors.length === 0) {
            return <div className="p-8 text-center text-gray-400 text-sm italic py-10">No contributors yet in {selectedCity}.</div>;
        }

        return (
            <div className="divide-y divide-gray-50">
                {topContributors.map((contributor, idx) => {
                    const rankEmojis = ['🥇', '🥈', '🥉'];
                    const isTop3 = idx < 3;

                    return (
                        <Link 
                            key={contributor.uid}
                            href={`/profile/${contributor.uid}`}
                            className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 flex justify-center text-lg font-bold text-gray-400">
                                    {isTop3 ? rankEmojis[idx] : idx + 1}
                                </div>
                                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100 overflow-hidden shadow-sm flex-shrink-0">
                                    {contributor.photoURL ? (
                                        <img src={contributor.photoURL} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <UserIcon size={20} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm text-gray-900 group-hover:text-amber-600 transition-colors">
                                            {contributor.displayName || 'Contributor'}
                                        </p>
                                        <ExternalLink size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                            {contributor.levelTitle || 'Citizen'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-sm font-black text-gray-900">{contributor.xp || 0}</p>
                                <p className="text-[10px] uppercase tracking-tighter font-bold text-gray-400">XP Points</p>
                            </div>
                        </Link>
                    );
                })}
            </div>
        );
    };

    const renderIssueList = (issues: Array<any>, emptyMessage: string, type: 'in_progress' | 'resolved') => {
        if (loading) {
            return (
                <div className="divide-y divide-gray-50">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 flex gap-4 items-center">
                            <div className="w-14 h-14 bg-gray-100 animate-pulse rounded-xl flex-shrink-0" />
                            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                <div className="w-1/2 h-4 bg-gray-100 animate-pulse rounded" />
                                <div className="w-1/3 h-3 bg-gray-100 animate-pulse rounded" />
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <div className="w-12 h-4 bg-gray-100 animate-pulse rounded" />
                                <div className="w-10 h-3 bg-gray-100 animate-pulse rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        if (issues.length === 0) {
            return <div className="p-8 text-center text-gray-400 text-sm italic py-10">{emptyMessage}</div>;
        }

        return (
            <div className="divide-y divide-gray-50">
                {issues.map(issue => {
                    const age = issue._age;
                    const resolvedAge = issue._resolvedAge ?? null;

                    return (
                        <motion.div
                            whileTap={{ scale: 0.98 }}
                            key={issue.id}
                            className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/issue/${issue.id}`)}
                        >
                            <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border ${type === 'resolved' ? 'border-green-100 grayscale-[0.2]' : 'border-gray-100'} bg-gray-100`}>
                                {(type === 'resolved' && issue.afterImageUrl) ? (
                                    <img src={issue.afterImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                ) : issue.imageUrl ? (
                                    <img src={issue.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {type === 'resolved' ? <CheckCircle size={20} className="text-green-300" /> : <AlertTriangle size={20} className="text-gray-300" />}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-sm text-gray-900 truncate">{issue.title}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate">
                                            <MapPin size={10} />{issue.cityName || 'Unknown'}
                                            <span className="text-gray-300 mx-1">·</span>
                                            {issue.category}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                            <Flame size={10} /> {issue.votes || 0}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                                            <Clock size={10} /> {type === 'resolved' && resolvedAge ? resolvedAge : age}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white pb-24 md:pb-8">
            {/* Clean Light Hero Header */}
            <div className="bg-gradient-to-b from-blue-50/60 via-slate-50/30 to-white px-4 sm:px-6 pt-8 pb-6 border-b border-slate-100">
                <div className="max-w-2xl mx-auto">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100/70 text-blue-700 rounded-full shadow-xs">
                            <Map size={14} className="text-blue-600 -translate-y-[0.5px]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">City Insights</span>
                        </div>

                        {/* Interactive City Selector */}
                        <div className="relative inline-flex items-center">
                            <label htmlFor="city-select" className="sr-only">Choose City</label>
                            <MapPin size={14} className="absolute left-3 text-slate-400 pointer-events-none -translate-y-[0.5px]" />
                            <select
                                id="city-select"
                                value={selectedCity}
                                onChange={(e) => {
                                    setSelectedCity(e.target.value);
                                    setHasUserChangedCity(true);
                                }}
                                className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-900 text-xs font-bold rounded-xl pl-8 pr-7 py-1.5 shadow-xs transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                {cityOptions.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                        Civic Pulse in {selectedCity}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1.5 font-medium leading-relaxed">
                        Tracking leadership, active improvements, and verified progress within your community.
                    </p>

                    {/* Civic Pulse High-Level KPIs */}
                    <div className="grid grid-cols-3 gap-3 mt-6">
                        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Active</span>
                                <Clock size={13} className="text-blue-500" />
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-slate-900">
                                {loading ? '—' : (pulseStats?.activeCount ?? 0)}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Under action</span>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Resolved</span>
                                <CheckCircle size={13} className="text-emerald-500" />
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-slate-900">
                                {loading ? '—' : (pulseStats?.resolvedCount ?? 0)}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Fixed & verified</span>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Velocity</span>
                                <TrendingUp size={13} className="text-purple-500" />
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-slate-900">
                                {loading ? '—' : `${pulseStats?.resolutionRate ?? 0}%`}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Resolution rate</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

                {/* ── TOP CONTRIBUTORS ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-amber-100/80 shadow-sm overflow-hidden relative">
                    <div className="px-5 py-4 border-b border-amber-50 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-white">
                        <div className="flex items-center gap-2">
                            <Trophy size={18} className="text-amber-500" />
                            <h2 className="font-bold text-gray-900 tracking-tight">Top Contributors</h2>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Leaders</span>
                    </div>
                    {renderLeaderboard()}
                </div>

                {/* ── TOP IN PROGRESS ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-blue-100/80 shadow-sm overflow-hidden relative">
                    <div className="px-5 py-4 border-b border-blue-50 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-blue-600" />
                            <h2 className="font-bold text-gray-900 tracking-tight">Active Issues</h2>
                        </div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">Top 5</span>
                    </div>
                    {renderIssueList(enrichedInProgress, `No issues are currently marked as Active in ${selectedCity}.`, 'in_progress')}
                </div>

                {/* ── TOP RESOLVED ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-emerald-100/80 shadow-sm overflow-hidden relative">
                    <div className="px-5 py-4 border-b border-emerald-50 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-white">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-600" />
                            <h2 className="font-bold text-gray-900 tracking-tight">Recently Resolved</h2>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">Top 5</span>
                    </div>
                    {renderIssueList(enrichedResolved, `No recently resolved issues in ${selectedCity}.`, 'resolved')}
                </div>

                <div className="text-center pb-6 pt-2">
                    <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5 font-semibold uppercase tracking-widest bg-gray-50 border border-gray-100 w-fit mx-auto px-4 py-1.5 rounded-full">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Live Pulse
                    </p>
                </div>
            </div>
        </div>
    );
}
