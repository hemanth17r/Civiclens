'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Calendar, Edit2, ShieldAlert, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import StatusVoteModal from '@/components/StatusVoteModal';
import { getIssueById, Issue, IssueStatusState } from '@/lib/issues';

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { user } = useAuth();
    const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
    const [voteTargetStatus, setVoteTargetStatus] = useState<IssueStatusState | null>(null);

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

    const getSteps = (currentStatus: IssueStatusState) => {
        const createdAt = issue?.createdAt;
        const timeAgo = createdAt?.toDate
            ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true })
            : 'Recently';

        return [
            { status: 'Reported', date: timeAgo, done: true },
            { status: 'Under Review', date: currentStatus === 'Under Review' || currentStatus === 'In Progress' || currentStatus === 'Resolved' ? 'Verified' : 'Pending', done: currentStatus === 'Under Review' || currentStatus === 'In Progress' || currentStatus === 'Resolved' },
            { status: 'In Progress', date: currentStatus === 'In Progress' || currentStatus === 'Resolved' ? 'Verified' : 'Pending', done: currentStatus === 'In Progress' || currentStatus === 'Resolved' },
            { status: 'Resolved', date: currentStatus === 'Resolved' ? 'Confirmed' : 'Pending', done: currentStatus === 'Resolved' },
        ];
    };

    const handleStatusClick = (status: string) => {
        if (status === 'Reported' || status === 'Open') return;
        setVoteTargetStatus(status as IssueStatusState);
        setIsVoteModalOpen(true);
    };

    const handleVoteComplete = (_newStatusData: any, newStatus?: string) => {
        if (newStatus && issue) {
            setIssue(prev => prev ? { ...prev, status: newStatus as IssueStatusState } : prev);
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
                        {[1, 2, 3, 4].map(i => (
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
    const steps = getSteps(issue.status);
    const timeAgo = issue.createdAt?.toDate
        ? formatDistanceToNow(issue.createdAt.toDate(), { addSuffix: true })
        : 'Recently';

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

                {/* Status Timeline */}
                <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100 relative">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-900">Status Verification</h3>
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-3 py-1.5 rounded-full">
                            <ShieldAlert size={14} /> Crowdsourced
                        </div>
                    </div>

                    <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                        {steps.map((step, idx) => (
                            <div key={idx} className="relative pl-8 group">
                                <div className={clsx(
                                    "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 transition-colors",
                                    step.done ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"
                                )} />

                                {/* Status Row — NO layout-shifting hover */}
                                <div
                                    className={clsx(
                                        "flex items-center justify-between rounded-xl px-3 py-2 transition-colors cursor-pointer",
                                        step.status !== 'Reported' && "hover:bg-gray-100/80"
                                    )}
                                    onClick={() => handleStatusClick(step.status)}
                                    title={step.status !== 'Reported' ? `Click to verify if the issue is ${step.status}` : undefined}
                                >
                                    <div>
                                        <p className={clsx("font-semibold text-sm", step.done ? "text-gray-900" : "text-gray-400")}>
                                            {step.status}
                                        </p>
                                        <p className="text-xs text-gray-400 font-medium">{step.date}</p>
                                    </div>

                                    {/* Edit Hover Icon */}
                                    {step.status !== 'Reported' && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400">
                                            <Edit2 size={14} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

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

            {voteTargetStatus && (
                <StatusVoteModal
                    isOpen={isVoteModalOpen}
                    onClose={() => setIsVoteModalOpen(false)}
                    issue={issue}
                    targetStatus={voteTargetStatus}
                    onVoteComplete={handleVoteComplete}
                />
            )}
        </div>
    );
}
