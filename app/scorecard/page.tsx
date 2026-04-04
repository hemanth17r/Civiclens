'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getTopInProgressByCity, getTopResolvedByCity, Issue
} from '@/lib/issues';
import { getTopContributorsByCity } from '@/lib/users';
import { UserProfile } from '@/context/AuthContext';
import { 
    Loader2, AlertTriangle, Clock, Flame, MapPin, 
    CheckCircle, ShieldCheck, Info, X, Map, Trophy, 
    User as UserIcon, ExternalLink 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export default function CityInsightsPage() {
    const { userProfile } = useAuth();
    const router = useRouter();

    // Data states
    const [inProgressIssues, setInProgressIssues] = useState<Issue[]>([]);
    const [resolvedIssues, setResolvedIssues] = useState<Issue[]>([]);
    const [topContributors, setTopContributors] = useState<UserProfile[]>([]);

    const [loading, setLoading] = useState(true);

    const userCity = userProfile?.city || 'Delhi';

    useEffect(() => {
        setLoading(true);
        Promise.all([
            getTopInProgressByCity(userCity, 5),
            getTopResolvedByCity(userCity, 5),
            getTopContributorsByCity(userCity, 5)
        ]).then(([ip, res, contributors]) => {
            setInProgressIssues(ip);
            setResolvedIssues(res);
            setTopContributors(contributors);
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, [userCity]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    const renderLeaderboard = () => {
        if (topContributors.length === 0) {
            return <div className="p-8 text-center text-gray-400 text-sm italic py-10">No contributors yet in this city.</div>;
        }

        return (
            <div className="divide-y divide-gray-50">
                {topContributors.map((contributor, idx) => {
                    const rankEmojis = ['🥇', '🥈', '🥉'];
                    const isTop3 = idx < 3;

                    return (
                        <Link 
                            key={contributor.uid}
                            href={`/profile/${contributor.handle || ''}`}
                            className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 flex justify-center text-lg font-bold text-gray-400">
                                    {isTop3 ? rankEmojis[idx] : idx + 1}
                                </div>
                                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100 overflow-hidden shadow-sm flex-shrink-0">
                                    {contributor.photoURL ? (
                                        <img src={contributor.photoURL} alt="" className="w-full h-full object-cover" />
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

    const renderIssueList = (issues: Issue[], emptyMessage: string, type: 'in_progress' | 'resolved') => {
        if (issues.length === 0) {
            return <div className="p-8 text-center text-gray-400 text-sm italic py-10">{emptyMessage}</div>;
        }

        return (
            <div className="divide-y divide-gray-50">
                {issues.map(issue => {
                    const createdMs = issue.createdAt?.toMillis?.() || Date.now();
                    const age = formatDistanceToNow(new Date(createdMs), { addSuffix: true });
                    const resolvedMs = issue.resolvedAt?.toMillis?.();
                    const resolvedAge = resolvedMs ? formatDistanceToNow(new Date(resolvedMs), { addSuffix: true }) : null;

                    return (
                        <div
                            key={issue.id}
                            className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/issue/${issue.id}`)}
                        >
                            <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border ${type === 'resolved' ? 'border-green-100 grayscale-[0.2]' : 'border-gray-100'} bg-gray-100`}>
                                {(type === 'resolved' && issue.afterImageUrl) ? (
                                    <img src={issue.afterImageUrl} alt="" className="w-full h-full object-cover" />
                                ) : issue.imageUrl ? (
                                    <img src={issue.imageUrl} alt="" className="w-full h-full object-cover" />
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
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-4">
            {/* Hero */}
            <div className="bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] text-white px-5 pt-8 pb-12 shadow-lg">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 mb-1">
                        <Map size={20} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">City Insights</span>
                    </div>
                    <h1 className="text-2xl font-extrabold mt-2 tracking-tight">Civic Pulse in {userCity}</h1>
                    <p className="text-slate-400 text-sm mt-1 font-medium">Tracking the leadership and progress within your community.</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-8 space-y-6">

                {/* ── TOP CONTRIBUTORS ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-amber-100 shadow-xl overflow-hidden relative">
                    <div className="px-5 py-4 border-b border-amber-50 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-white">
                        <div className="flex items-center gap-2">
                            <Trophy size={18} className="text-amber-500" />
                            <h2 className="font-black text-gray-900 tracking-tight">Top Contributors</h2>
                        </div>
                        <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Leaders</span>
                    </div>
                    {renderLeaderboard()}
                </div>

                {/* ── TOP IN PROGRESS ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-blue-100 shadow-md overflow-hidden relative">
                    <div className="px-5 py-4 border-b border-blue-50 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-blue-600" />
                            <h2 className="font-bold text-gray-900 tracking-tight">Active Issues</h2>
                        </div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">Top 5</span>
                    </div>
                    {renderIssueList(inProgressIssues, `No issues are currently marked as Active in ${userCity}.`, 'in_progress')}
                </div>

                {/* ── TOP RESOLVED ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-emerald-100 shadow-md overflow-hidden relative">
                    <div className="px-5 py-4 border-b border-emerald-50 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-white">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-600" />
                            <h2 className="font-bold text-gray-900 tracking-tight">Recently Resolved</h2>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">Top 5</span>
                    </div>
                    {renderIssueList(resolvedIssues, `No recently resolved issues in ${userCity}.`, 'resolved')}
                </div>

                <div className="text-center pb-8 pt-4">
                    <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5 font-semibold uppercase tracking-widest bg-gray-100/50 w-fit mx-auto px-4 py-1.5 rounded-full">
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
