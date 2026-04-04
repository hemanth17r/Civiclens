'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Calendar, Edit2, ShieldAlert, AlertCircle, Info, Users, CheckCircle2, Eye, Wrench, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import StageVoteCard from '@/components/StageVoteCard';
import { getIssueById, Issue, IssueStatusState, normalizeStatus, voteOnStatus, STATUS_DB_KEYS } from '@/lib/issues';

// ═══════════════════════════════════════════════════════════════════════
// LIFECYCLE CONFIGURATION — 6-stage progression
// ═══════════════════════════════════════════════════════════════════════

interface LifecycleStage {
    key: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;         // primary color
    bgColor: string;       // light background
    borderColor: string;   // border when active
    canVote: boolean;      // whether users can vote to verify
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
    {
        key: 'Reported',
        label: 'Reported',
        description: 'User submitted this issue',
        icon: <AlertCircle size={16} />,
        color: '#374151',
        bgColor: '#F3F4F6',
        borderColor: '#9CA3AF',
        canVote: false,
    },
    {
        key: 'Verification Needed',
        label: 'Verification Needed',
        description: 'Waiting for community confirmation',
        icon: <Users size={16} />,
        color: '#7C3AED',
        bgColor: '#F5F3FF',
        borderColor: '#8B5CF6',
        canVote: true,
    },
    {
        key: 'Verified',
        label: 'Verified',
        description: 'Trust-weighted votes confirmed this issue',
        icon: <CheckCircle2 size={16} />,
        color: '#0D9488',
        bgColor: '#F0FDFA',
        borderColor: '#14B8A6',
        canVote: false,
    },
    {
        key: 'Active',
        label: 'Active',
        description: 'Issue is awaiting action',
        icon: <Eye size={16} />,
        color: '#2563EB',
        bgColor: '#EFF6FF',
        borderColor: '#3B82F6',
        canVote: true,
    },
    {
        key: 'Action Seen',
        label: 'Action Seen',
        description: 'Work activity has been detected',
        icon: <Wrench size={16} />,
        color: '#D97706',
        bgColor: '#FFFBEB',
        borderColor: '#F59E0B',
        canVote: true,
    },
    {
        key: 'Resolved',
        label: 'Resolved',
        description: 'Issue has been fixed and confirmed',
        icon: <CheckCircle2 size={16} />,
        color: '#059669',
        bgColor: '#ECFDF5',
        borderColor: '#10B981',
        canVote: true,
    },
];

// Map legacy statuses to lifecycle index
function getStageIndex(status: string): number {
    const normalized = normalizeStatus(status);
    const idx = LIFECYCLE_STAGES.findIndex(s => s.key === normalized);
    return idx >= 0 ? idx : 0;
}

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { user } = useAuth();
    const [votingStageKey, setVotingStageKey] = useState<string | null>(null);
    const [showVerifiedInfo, setShowVerifiedInfo] = useState(false);

    const unwrappedParams = React.use(params);
    const issueId = unwrappedParams.id;

    const [issue, setIssue] = useState<Issue | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);

        getIssueById(issueId)
            .then((data) => {
                if (cancelled) return;
                if (!data) {
                    setError(true);
                } else {
                    setIssue(data);
                }
            })
            .catch(() => {
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [issueId]);

    const handleInlineVote = async (targetStageKey: string, voteType: 'yes' | 'no') => {
        if (!user || user.isAnonymous) {
            router.push('/login');
            return;
        }

        setVotingStageKey(targetStageKey);
        try {
            const res = await voteOnStatus(issueId, user.uid, targetStageKey as IssueStatusState, voteType);
            if (res.success) {
                setIssue(prev => {
                    if (!prev) return prev;
                    const dbKey = STATUS_DB_KEYS[targetStageKey];
                    const newStatusData = { ...prev.statusData };
                    if (dbKey && res.currentStats) {
                        newStatusData[dbKey] = res.currentStats;
                    }
                    return {
                        ...prev,
                        statusData: newStatusData,
                        status: res.consensusReached && res.newStatus ? res.newStatus : prev.status
                    };
                });
            } else {
                alert(res.error || 'Failed to record vote');
            }
        } catch (e: any) {
            alert(e.message || 'Error recording vote');
        } finally {
            setVotingStageKey(null);
        }
    };

    // ── Loading Skeleton ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="bg-white min-h-screen pb-20">
                <div className="fixed top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                    <button
                        onClick={() => router.back()}
                        className="pointer-events-auto bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                </div>
                <div className="h-72 w-full bg-gray-100 animate-pulse" />
                <div className="px-5 -mt-8 relative z-10 space-y-4">
                    <div className="h-8 w-3/4 bg-gray-100 animate-pulse rounded-lg" />
                    <div className="h-4 w-1/2 bg-gray-100 animate-pulse rounded-lg" />
                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-5">
                        <div className="h-5 w-40 bg-gray-100 animate-pulse rounded" />
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse" />
                                <div className="space-y-1.5">
                                    <div className="h-3.5 w-24 bg-gray-100 animate-pulse rounded" />
                                    <div className="h-2.5 w-16 bg-gray-100 animate-pulse rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Error / Not Found ────────────────────────────────────────────────────
    if (error || !issue) {
        return (
            <div className="bg-white min-h-screen flex flex-col items-center justify-center px-6">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle size={32} className="text-red-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Issue not found</h1>
                <p className="text-gray-500 text-sm mb-6 text-center">
                    This issue may have been removed or doesn't exist.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="px-6 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                    Go Home
                </button>
            </div>
        );
    }

    // ── Computed values ──────────────────────────────────────────────────────
    const currentStageIdx = getStageIndex(issue.status);
    const timeAgo = issue.createdAt?.toDate
        ? formatDistanceToNow(issue.createdAt.toDate(), { addSuffix: true })
        : 'Recently';

    // Build timeline entries from available data
    const timelineEntries: { date: string; label: string; color: string }[] = [];
    const baseDate = issue.createdAt?.toDate ? issue.createdAt.toDate().getTime() : Date.now() - 86400000 * 7;

    timelineEntries.push({
        date: format(new Date(baseDate), 'MMM d'),
        label: 'Issue reported',
        color: LIFECYCLE_STAGES[0].color,
    });

    if (currentStageIdx >= 1) {
        const d = issue.approvedAt?.toDate ? issue.approvedAt.toDate() : new Date(baseDate + 86400000 * 1);
        timelineEntries.push({
            date: format(d, 'MMM d'),
            label: 'Verification started',
            color: LIFECYCLE_STAGES[1].color,
        });
    }
    if (currentStageIdx >= 2) {
        // Fallback or exact dates could be pulled from statusData historically, using sequential offsets for now
        const d = new Date(baseDate + 86400000 * 2);
        timelineEntries.push({
            date: format(d, 'MMM d'),
            label: 'Verified by community',
            color: LIFECYCLE_STAGES[2].color,
        });
    }
    if (currentStageIdx >= 3) {
        const d = new Date(baseDate + 86400000 * 3);
        timelineEntries.push({
            date: format(d, 'MMM d'),
            label: 'Marked as active/ongoing',
            color: LIFECYCLE_STAGES[3].color,
        });
    }
    if (currentStageIdx >= 4) {
        const d = new Date(baseDate + 86400000 * 5);
        timelineEntries.push({
            date: format(d, 'MMM d'),
            label: 'Action activity detected',
            color: LIFECYCLE_STAGES[4].color,
        });
    }
    if (currentStageIdx >= 5) {
        const d = issue.resolvedAt?.toDate ? issue.resolvedAt.toDate() : new Date(baseDate + 86400000 * 7);
        timelineEntries.push({
            date: format(d, 'MMM d'),
            label: 'Issue resolved',
            color: LIFECYCLE_STAGES[5].color,
        });
    }

    return (
        <div className="bg-white min-h-screen pb-20">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                <button
                    onClick={() => router.back()}
                    className="pointer-events-auto bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
            </div>

            {/* Hero Image */}
            <div className="h-72 w-full relative bg-gray-100">
                {issue.imageUrl ? (
                    <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <MapPin size={48} className="text-gray-300" />
                    </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
            </div>

            <div className="px-5 -mt-8 relative z-10">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">{issue.title}</h1>
                <div className="flex items-center gap-4 text-gray-500 text-sm mb-6">
                    <span className="flex items-center gap-1">
                        <MapPin size={16} />
                        {issue.location || issue.cityName || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={16} />
                        {timeAgo}
                    </span>
                </div>

                {/* ── ISSUE LIFECYCLE SYSTEM ────────────────────────────────── */}
                <div className="bg-gray-50 rounded-3xl p-6 mb-6 border border-gray-100 relative">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">Issue Lifecycle</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Each issue moves through defined stages</p>
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowVerifiedInfo(v => !v)}
                                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors cursor-pointer"
                                aria-expanded={showVerifiedInfo}
                                aria-label="Learn about Community Verified status"
                            >
                                <ShieldAlert size={14} className="mb-0.5" /> Community Verified
                            </button>
                            {showVerifiedInfo && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-emerald-100 rounded-2xl shadow-xl p-4 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldAlert size={14} className="text-emerald-600 flex-shrink-0" />
                                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Community Verified</span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                        This badge means the community has collectively confirmed this issue is real through trust-weighted voting. Each vote carries a weight based on the voter&apos;s trust score, and a net score above +2 advances the issue to the next stage.
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                                        Tap again to close this info panel.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── STAGES TIMELINE ─────────────────────────────────── */}
                    <div className="relative ml-1">
                        {LIFECYCLE_STAGES.map((stage, idx) => {
                            const isDone = idx <= currentStageIdx;
                            const isCurrent = idx === currentStageIdx;
                            const isNext = idx === currentStageIdx + 1;
                            const isLast = idx === LIFECYCLE_STAGES.length - 1;

                            return (
                                <div key={stage.key} className="relative">
                                    {/* Connector line */}
                                    {!isLast && (
                                        <div
                                            className="absolute left-[15px] top-[36px] w-0.5 h-[calc(100%-4px)]"
                                            style={{
                                                backgroundColor: isDone && idx < currentStageIdx ? stage.color : '#E5E7EB',
                                            }}
                                        />
                                    )}

                                    {/* Stage Row */}
                                    <div
                                        className={clsx(
                                            "flex items-start gap-4 py-3 px-3 rounded-2xl transition-all",
                                            isCurrent && "bg-white shadow-sm border",
                                            !isDone && !isNext && "opacity-50",
                                        )}
                                        style={isCurrent ? { borderColor: stage.borderColor + '40' } : undefined}
                                    >
                                        {/* Circle Indicator */}
                                        <div
                                            className={clsx(
                                                "w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                                                isCurrent && "ring-4 ring-offset-1",
                                            )}
                                            style={{
                                                backgroundColor: isDone ? stage.color : '#F3F4F6',
                                                color: isDone ? 'white' : '#9CA3AF',
                                                ...(isCurrent ? { ringColor: stage.color + '30' } : {}),
                                            }}
                                        >
                                            {stage.icon}
                                        </div>

                                        {/* Text content */}
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={clsx(
                                                        "font-bold text-sm",
                                                        isDone ? "text-gray-900" : "text-gray-400",
                                                    )}
                                                >
                                                    {stage.label}
                                                </span>
                                                {isCurrent && (
                                                    <span
                                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: stage.bgColor,
                                                            color: stage.color,
                                                        }}
                                                    >
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                            <p className={clsx(
                                                "text-xs mt-0.5",
                                                isDone ? "text-gray-500" : "text-gray-300",
                                            )}>
                                                {stage.description}
                                            </p>
                                            
                                            {/* Render Inline Vote Card for the CURRENT stage when it requires community voting */}
                                            {isCurrent && stage.canVote && (
                                                <StageVoteCard 
                                                    stage={stage}
                                                    yesWeight={issue.statusData?.[STATUS_DB_KEYS[stage.key]]?.yesWeight || 0}
                                                    noWeight={issue.statusData?.[STATUS_DB_KEYS[stage.key]]?.noWeight || 0}
                                                    score={issue.statusData?.[STATUS_DB_KEYS[stage.key]]?.score || 0}
                                                    isVoting={votingStageKey === stage.key}
                                                    onVote={(type) => handleInlineVote(stage.key, type)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── PUBLIC TIMELINE ────────────────────────────────────── */}
                {timelineEntries.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={16} className="text-gray-400" />
                            <h3 className="font-bold text-gray-900 text-sm">Public Timeline</h3>
                            <span className="text-[10px] text-gray-400 font-medium">Transparency builds trust</span>
                        </div>
                        <div className="space-y-3">
                            {timelineEntries.map((entry, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-500 w-14 flex-shrink-0">{entry.date}</span>
                                    <span className="text-gray-300">→</span>
                                    <span className="text-sm text-gray-700 font-medium">{entry.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Description */}
                {issue.description && (
                    <div className="mb-8">
                        <h3 className="font-bold text-gray-900 mb-2">Description</h3>
                        <p className="text-gray-600 leading-relaxed">{issue.description}</p>
                    </div>
                )}

                {/* Official Resolution Banner */}
                {issue.resolvedByHandle && (
                    <div className="mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl overflow-hidden">
                        <div className="bg-emerald-600 px-4 py-2 flex items-center gap-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                                ✅ Officially Resolved
                            </span>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-sm text-gray-700">
                                Resolved by <span className="font-semibold text-gray-900">@{issue.resolvedByHandle}</span>
                                {issue.resolvedByDepartment && ` (${issue.resolvedByDepartment})`}
                            </p>
                            {issue.resolvedStatement && (
                                <div className="bg-white/60 rounded-lg p-3 text-sm text-gray-700 italic border border-emerald-100/50">
                                    "{issue.resolvedStatement}"
                                </div>
                            )}
                            {issue.afterImageUrl && (
                                <div className="flex gap-3">
                                    {issue.imageUrl && (
                                        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 relative aspect-video">
                                            <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm z-10">BEFORE</div>
                                            <img src={issue.imageUrl} alt="Before" className="w-full h-full object-cover opacity-80" />
                                        </div>
                                    )}
                                    <div className="flex-1 rounded-xl overflow-hidden border border-emerald-300 relative aspect-video ring-2 ring-emerald-100">
                                        <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm z-10">AFTER</div>
                                        <img src={issue.afterImageUrl} alt="After" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
