'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import OfficialGuard from '@/components/OfficialGuard';
import OfficialResolveModal from '@/components/OfficialResolveModal';
import VerifiedBadge from '@/components/VerifiedBadge';
import { getOfficialFeed, Issue } from '@/lib/issues';
import { checkSLABreach, SLA_HOURS } from '@/lib/notifications';
import {
    Loader2, AlertTriangle, CheckCircle, Clock,
    Flame, MapPin, ArrowUpDown, ExternalLink,
    MessageSquare, Inbox
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ── Urgency scoring ─────────────────────────────────────────────────────
function computeUrgency(issue: Issue): number {
    const hypes = issue.votes || 0;
    const comments = issue.commentCount || 0;
    const createdMs = issue.createdAt?.toMillis?.() || Date.now();
    const hoursOld = (Date.now() - createdMs) / (1000 * 60 * 60);
    return (hypes * 2 + comments * 1.5) * (1 + hoursOld / 24);
}

function isEscalationRisk(issue: Issue): boolean {
    const createdMs = issue.createdAt?.toMillis?.() || Date.now();
    const hoursOld = (Date.now() - createdMs) / (1000 * 60 * 60);
    return hoursOld >= 24 && hoursOld < 48 && issue.status !== 'Resolved';
}

function isSLABreached(issue: Issue): boolean {
    const createdMs = issue.createdAt?.toMillis?.() || Date.now();
    const hoursOld = (Date.now() - createdMs) / (1000 * 60 * 60);
    return hoursOld >= 48 && issue.status !== 'Resolved';
}

function urgencyLevel(score: number): 'green' | 'yellow' | 'red' {
    if (score < 10) return 'green';
    if (score < 40) return 'yellow';
    return 'red';
}

const urgencyColors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
};

// ── Main Dashboard ──────────────────────────────────────────────────────
function OfficialDashboard() {
    const { userProfile } = useAuth();
    const router = useRouter();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolveTarget, setResolveTarget] = useState<Issue | null>(null);

    const department = userProfile?.department || '';
    const jurisdiction = userProfile?.jurisdiction || '';

    useEffect(() => {
        if (!department || !jurisdiction) return;
        setLoading(true);
        getOfficialFeed(department, jurisdiction)
            .then(setIssues)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [department, jurisdiction]);

    const sorted = useMemo(() => {
        return [...issues].sort((a, b) => computeUrgency(b) - computeUrgency(a));
    }, [issues]);

    // Kanban columns
    const slaBreachedIssues = sorted.filter(isSLABreached);
    const newOpenIssues = sorted.filter(i => !isSLABreached(i) && i.status !== 'Resolved');
    const resolvedIssues = sorted.filter(i => i.status === 'Resolved');

    const escalationCount = newOpenIssues.filter(isEscalationRisk).length;
    const slaBreachedCount = slaBreachedIssues.length;

    // SLA breach check on load
    useEffect(() => {
        sorted.forEach(issue => {
            if (isSLABreached(issue)) {
                checkSLABreach(issue.id).catch(() => { });
            }
        });
    }, [sorted]);

    const handleResolved = () => {
        if (department && jurisdiction) {
            getOfficialFeed(department, jurisdiction).then(setIssues);
        }
    };

    const renderIssueCard = (issue: Issue) => {
        const score = computeUrgency(issue);
        const level = urgencyLevel(score);
        const escalation = isEscalationRisk(issue);
        const slaBreach = isSLABreached(issue);
        const createdMs = issue.createdAt?.toMillis?.() || Date.now();
        const age = formatDistanceToNow(new Date(createdMs), { addSuffix: true });

        return (
            <div
                key={issue.id}
                className={`bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${slaBreach ? 'border-red-400 ring-1 ring-red-100' :
                    escalation ? 'border-amber-300 ring-1 ring-amber-50' : 'border-gray-100'
                    }`}
            >
                {/* SLA Breach Banner */}
                {slaBreach && (
                    <div className="bg-red-600 px-4 py-1.5 flex items-center gap-2">
                        <AlertTriangle size={12} className="text-white" />
                        <span className="text-[11px] font-bold text-white uppercase tracking-wide">
                            SLA Breach (&gt;{SLA_HOURS}h)
                        </span>
                    </div>
                )}

                {/* Escalation Banner */}
                {escalation && !slaBreach && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2">
                        <Clock size={12} className="text-amber-600" />
                        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
                            Approaching SLA limit
                        </span>
                    </div>
                )}

                <div className="p-4">
                    {/* Top row: urgency + age */}
                    <div className="flex items-center justify-between mb-2.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${urgencyColors[level]}`}>
                            {Math.round(score)} Pts
                        </span>
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Clock size={11} />{age}
                        </span>
                    </div>

                    {/* Title + Location */}
                    <h3 className="font-bold text-gray-900 text-[15px] leading-snug mb-1">{issue.title}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                        <MapPin size={11} />{issue.location || issue.cityName || 'Unknown'}
                    </p>

                    {/* Engagement stats */}
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                        <span className="flex items-center gap-1">
                            <Flame size={12} /> {issue.votes || 0}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageSquare size={12} /> {issue.commentCount || 0}
                        </span>
                    </div>

                    {/* Description */}
                    {issue.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{issue.description}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        {issue.status !== 'Resolved' && (
                            <button
                                onClick={() => setResolveTarget(issue)}
                                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                            >
                                <CheckCircle size={14} /> Resolve
                            </button>
                        )}
                        <button
                            onClick={() => router.push(`/issue/${issue.id}`)}
                            className="py-2 px-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            <ExternalLink size={14} /> View
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Empty column component ───────────────────────────────────────────
    const EmptyColumn = ({ icon: Icon, text, color }: { icon: any; text: string; color: string }) => (
        <div className={`text-center py-12 border-2 border-dashed rounded-xl ${color}`}>
            <Icon className="mx-auto mb-2 opacity-40" size={24} />
            <p className="text-sm font-medium opacity-60">{text}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-24 md:pb-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 pt-8 pb-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-1">
                        <VerifiedBadge department={department} size="md" />
                    </div>
                    <h1 className="text-2xl font-bold mt-3">Official Portal</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {department} Department · {jurisdiction}
                    </p>

                    {/* Stats Row */}
                    <div className="flex gap-3 mt-5">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 flex-1 text-center">
                            <p className="text-2xl font-bold">{newOpenIssues.length}</p>
                            <p className="text-xs text-slate-400">Open</p>
                        </div>
                        <div className={`rounded-xl px-4 py-3 flex-1 text-center ${slaBreachedCount > 0 ? 'bg-red-500/20 border border-red-400/30' : 'bg-white/10 backdrop-blur-sm'}`}>
                            <p className="text-2xl font-bold">{slaBreachedCount}</p>
                            <p className="text-xs text-slate-400">SLA Breached</p>
                        </div>
                        <div className={`rounded-xl px-4 py-3 flex-1 text-center ${escalationCount > 0 ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-white/10 backdrop-blur-sm'}`}>
                            <p className="text-2xl font-bold">{escalationCount}</p>
                            <p className="text-xs text-slate-400">At Risk</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 flex-1 text-center">
                            <p className="text-2xl font-bold">{resolvedIssues.length}</p>
                            <p className="text-xs text-slate-400">Resolved</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sort label */}
            <div className="max-w-6xl mx-auto px-5 pt-5 pb-2 flex items-center gap-2">
                <ArrowUpDown size={14} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-600">Urgency Matrix</h2>
                <span className="text-xs text-gray-400">· sorted by engagement × age</span>
            </div>

            {/* Kanban Board */}
            <div className="max-w-6xl mx-auto px-4 pt-4 pb-20">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-gray-400" size={28} />
                    </div>
                ) : issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Inbox size={32} className="text-gray-300" />
                        </div>
                        <h3 className="font-bold text-gray-700 text-lg mb-1">No issues found</h3>
                        <p className="text-gray-400 text-sm max-w-sm">
                            No reported issues match your department ({department}) in {jurisdiction}. Check back later.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                        {/* Column 1: Open Tickets */}
                        <div className="bg-slate-100/80 rounded-2xl p-4 min-h-[400px] border border-slate-200">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    Open Tickets
                                </h2>
                                <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">{newOpenIssues.length}</span>
                            </div>
                            <div className="space-y-3">
                                {newOpenIssues.length === 0 ? (
                                    <EmptyColumn icon={CheckCircle} text="No open tickets" color="border-slate-200 text-slate-400" />
                                ) : (
                                    newOpenIssues.map(renderIssueCard)
                                )}
                            </div>
                        </div>

                        {/* Column 2: SLA Breached */}
                        <div className="bg-red-50/50 rounded-2xl p-4 min-h-[400px] border border-red-100">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="font-bold text-red-800 flex items-center gap-2 text-sm">
                                    <div className={`w-2 h-2 rounded-full bg-red-500 ${slaBreachedCount > 0 ? 'animate-pulse' : ''}`} />
                                    Urgent (SLA Breached)
                                </h2>
                                <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{slaBreachedIssues.length}</span>
                            </div>
                            <div className="space-y-3">
                                {slaBreachedIssues.length === 0 ? (
                                    <EmptyColumn icon={CheckCircle} text="All SLAs met" color="border-green-200 text-green-500" />
                                ) : (
                                    slaBreachedIssues.map(renderIssueCard)
                                )}
                            </div>
                        </div>

                        {/* Column 3: Resolved */}
                        <div className="bg-emerald-50/30 rounded-2xl p-4 min-h-[400px] border border-emerald-100">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="font-bold text-emerald-800 flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Resolved
                                </h2>
                                <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{resolvedIssues.length}</span>
                            </div>
                            <div className="space-y-3">
                                {resolvedIssues.length === 0 ? (
                                    <EmptyColumn icon={Inbox} text="No resolved issues" color="border-emerald-200 text-emerald-400" />
                                ) : (
                                    resolvedIssues.map(renderIssueCard)
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Resolve Modal */}
            {resolveTarget && (
                <OfficialResolveModal
                    issue={resolveTarget}
                    isOpen={!!resolveTarget}
                    onClose={() => setResolveTarget(null)}
                    onResolved={handleResolved}
                />
            )}
        </div>
    );
}

export default function OfficialPage() {
    return (
        <OfficialGuard>
            <OfficialDashboard />
        </OfficialGuard>
    );
}
