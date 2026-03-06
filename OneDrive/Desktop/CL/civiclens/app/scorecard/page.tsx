'use client';

import React, { useState, useEffect } from 'react';
import {
    getDepartmentStats, DepartmentStat,
    getFastestResolved, getMostHypedUnresolved, Issue
} from '@/lib/issues';
import { Loader2, Trophy, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, Flame, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ScorecardPage() {
    const [stats, setStats] = useState<DepartmentStat[]>([]);
    const [fame, setFame] = useState<Issue[]>([]);
    const [shame, setShame] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getDepartmentStats(),
            getFastestResolved(5),
            getMostHypedUnresolved(5)
        ]).then(([s, f, sh]) => {
            setStats(s);
            setFame(f);
            setShame(sh);
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-4">
            {/* Hero */}
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white px-5 pt-8 pb-8">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={20} className="text-indigo-300" />
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Public Accountability</span>
                    </div>
                    <h1 className="text-2xl font-bold mt-2">Civic Scorecard</h1>
                    <p className="text-indigo-300 text-sm mt-1">How well are your local departments performing?</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-4 space-y-6">
                {/* ── DEPARTMENT LEADERBOARD ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <Trophy size={18} className="text-amber-500" />
                        <h2 className="font-bold text-gray-900">Department Leaderboard</h2>
                    </div>

                    {stats.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No resolved issues yet. The leaderboard will populate as officials resolve issues.</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {/* Header row */}
                            <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                <span className="col-span-1">#</span>
                                <span className="col-span-4">Department</span>
                                <span className="col-span-2 text-center">Fixed</span>
                                <span className="col-span-3 text-center">Avg Time</span>
                                <span className="col-span-2 text-center">Trend</span>
                            </div>
                            {stats.map((dept, i) => {
                                const momentum = dept.recentResolved - dept.priorResolved;
                                return (
                                    <div key={dept.department} className="grid grid-cols-12 items-center px-5 py-3 hover:bg-gray-50 transition-colors">
                                        <span className="col-span-1 text-sm font-bold text-gray-500">{i + 1}</span>
                                        <span className="col-span-4 text-sm font-semibold text-gray-900">{dept.department}</span>
                                        <span className="col-span-2 text-center">
                                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{dept.resolved}</span>
                                        </span>
                                        <span className="col-span-3 text-center text-xs text-gray-500">
                                            {dept.avgResolutionHours < 24
                                                ? `${dept.avgResolutionHours}h`
                                                : `${Math.round(dept.avgResolutionHours / 24)}d`
                                            }
                                        </span>
                                        <span className="col-span-2 flex justify-center">
                                            {momentum > 0 ? (
                                                <span className="flex items-center gap-0.5 text-green-600 text-xs font-bold"><TrendingUp size={14} />+{momentum}</span>
                                            ) : momentum < 0 ? (
                                                <span className="flex items-center gap-0.5 text-red-500 text-xs font-bold"><TrendingDown size={14} />{momentum}</span>
                                            ) : (
                                                <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus size={14} />—</span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── WALL OF FAME ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <span className="text-lg">🏆</span>
                        <h2 className="font-bold text-gray-900">Wall of Fame</h2>
                        <span className="text-xs text-gray-400 ml-1">Fastest Resolutions</span>
                    </div>

                    {fame.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No resolved issues yet.</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {fame.map(issue => {
                                const createdMs = issue.createdAt?.toMillis?.() || 0;
                                const resolvedMs = issue.resolvedAt?.toMillis?.() || 0;
                                const diffHours = Math.round((resolvedMs - createdMs) / (1000 * 60 * 60));
                                const timeStr = diffHours < 24 ? `${diffHours}h` : `${Math.round(diffHours / 24)}d`;

                                return (
                                    <div key={issue.id} className="p-4 flex gap-3 items-start hover:bg-gray-50 transition-colors">
                                        {/* Before/After mini */}
                                        <div className="flex gap-1 flex-shrink-0">
                                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                                                {issue.imageUrl && <img src={issue.imageUrl} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            {issue.afterImageUrl && (
                                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border-2 border-green-300">
                                                    <img src={issue.afterImageUrl} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-900 truncate">{issue.title}</p>
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                <MapPin size={10} />{issue.cityName || 'Unknown'}
                                                <span className="text-gray-300 mx-0.5">·</span>
                                                {issue.resolvedByDepartment || issue.category}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                                    <CheckCircle size={10} /> Resolved in {timeStr}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── WALL OF SHAME ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <span className="text-lg">🚨</span>
                        <h2 className="font-bold text-gray-900">Wall of Shame</h2>
                        <span className="text-xs text-gray-400 ml-1">Most Hyped, Unresolved</span>
                    </div>

                    {shame.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">All caught up! No heavily demanded unresolved issues.</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {shame.map(issue => {
                                const createdMs = issue.createdAt?.toMillis?.() || Date.now();
                                const age = formatDistanceToNow(new Date(createdMs), { addSuffix: false });

                                return (
                                    <div key={issue.id} className="p-4 flex gap-3 items-start hover:bg-red-50/50 transition-colors">
                                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                            {issue.imageUrl ? (
                                                <img src={issue.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><AlertTriangle size={20} className="text-gray-300" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-900 truncate">{issue.title}</p>
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                <MapPin size={10} />{issue.cityName || 'Unknown'}
                                                <span className="text-gray-300 mx-0.5">·</span>
                                                {issue.category}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                                    <Flame size={10} /> {issue.votes || 0} hypes
                                                </span>
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                                    <Clock size={10} /> {age} open
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
