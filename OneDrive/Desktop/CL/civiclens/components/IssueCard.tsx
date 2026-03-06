'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Flame, MessageCircle, Bookmark, User, Share2, BookmarkCheck, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { Issue, IssueStatusState, hypeIssue, unhypeIssue, hasUserHyped, saveIssue, unsaveIssue, hasUserSaved } from '@/lib/issues';
import AuthModule from './AuthModule';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import HeartAnimation from './HeartAnimation';
import CommentDrawer from './CommentDrawer';
import ShareModal from './ShareModal';
import StatusVoteModal from './StatusVoteModal';
import VerifiedBadge from './VerifiedBadge';

interface IssueCardProps {
    issue: Issue;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue }) => {
    const { user } = useAuth();
    const router = useRouter();

    // Interaction States
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authTrigger, setAuthTrigger] = useState("to join the movement");

    // Feature States
    const [hasHyped, setHasHyped] = useState(false);
    const [optimisticVotes, setOptimisticVotes] = useState(issue.votes || 0);
    const [showHeartAnim, setShowHeartAnim] = useState(false);
    const [isCommentOpen, setIsCommentOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
    const [voteTargetStatus, setVoteTargetStatus] = useState<IssueStatusState | null>(null);

    // Load hype/save state from Firestore on mount
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        (async () => {
            const [hyped, saved] = await Promise.all([
                hasUserHyped(issue.id, user.uid),
                hasUserSaved(issue.id, user.uid)
            ]);
            if (!cancelled) {
                setHasHyped(hyped);
                setIsSaved(saved);
            }
        })();
        return () => { cancelled = true; };
    }, [user, issue.id]);

    // Helpers
    const timeAgo = issue.createdAt
        ? formatDistanceToNow(issue.createdAt.toDate(), { addSuffix: true })
        : 'Just now';

    const getStatusColor = (status: string = 'Open') => {
        switch (status) {
            case 'Resolved': return 'bg-[#34A853] text-white';
            case 'In Progress': return 'bg-[#FBBC05] text-white';
            case 'Open': default: return 'bg-gray-800 text-white';
        }
    };

    const handleHype = useCallback(async () => {
        if (!user) {
            setAuthTrigger("to hype this issue");
            setIsAuthModalOpen(true);
            return;
        }

        if (!hasHyped) {
            // Optimistic UI
            setHasHyped(true);
            setOptimisticVotes(prev => prev + 1);
            setShowHeartAnim(true);
            setTimeout(() => setShowHeartAnim(false), 1000);
            // Persist to Firestore
            const success = await hypeIssue(issue.id, user.uid);
            if (!success) {
                // Revert on failure
                setHasHyped(false);
                setOptimisticVotes(prev => prev - 1);
            }
        } else {
            // Unhype
            setHasHyped(false);
            setOptimisticVotes(prev => prev - 1);
            const success = await unhypeIssue(issue.id, user.uid);
            if (!success) {
                setHasHyped(true);
                setOptimisticVotes(prev => prev + 1);
            }
        }
    }, [user, hasHyped, issue.id]);

    const handleDoubleTap = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleHype();
    };

    const handleSaveToggle = useCallback(async () => {
        if (!user) {
            setAuthTrigger("to save this issue");
            setIsAuthModalOpen(true);
            return;
        }

        if (!isSaved) {
            setIsSaved(true);
            const success = await saveIssue(issue.id, user.uid);
            if (!success) setIsSaved(false);
        } else {
            setIsSaved(false);
            const success = await unsaveIssue(issue.id, user.uid);
            if (!success) setIsSaved(true);
        }
    }, [user, isSaved, issue.id]);

    const handleStatusClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (issue.status === 'Resolved') return;

        let target: IssueStatusState | 'Resolved' = issue.status;
        if (issue.status === 'Open') target = 'Under Review';
        if (issue.status === 'Under Review') target = 'In Progress';
        if (issue.status === 'In Progress') target = 'Resolved';

        setVoteTargetStatus(target as IssueStatusState);
        setIsVoteModalOpen(true);
    };

    const handleVoteComplete = (newStatusData: any, newStatus?: string) => {
        // Realtime listeners update the feed automatically
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden break-inside-avoid relative">

            {/* 1. Header: Instagram style */}
            <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                    <Link href="/profile" className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[2px] block cursor-pointer hover:opacity-90 transition-opacity">
                        <div className="w-full h-full rounded-full border-2 border-white bg-gray-100 overflow-hidden text-gray-400 flex items-center justify-center">
                            {issue.userAvatar ? (
                                <img src={issue.userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User size={18} />
                            )}
                        </div>
                    </Link>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-gray-900 leading-none">
                                {issue.userHandle || '@citizen'}
                            </p>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-gray-500 font-medium">{timeAgo}</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-0.5 font-medium">
                            <MapPin size={10} className="fill-blue-100" />
                            {issue.cityName ? issue.cityName : (issue.location || 'Unknown Location')}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSaveToggle}
                    className="text-gray-400 hover:text-gray-900 p-1 transition-colors active:scale-90"
                >
                    {isSaved ? <BookmarkCheck size={24} className="text-gray-900 fill-gray-900" /> : <Bookmark size={24} className="text-gray-900" />}
                </button>
            </div>

            {/* 2. Media: 1:1 Aspect Ratio & Double Tap */}
            <div
                className="aspect-square w-full bg-gray-100 relative overflow-hidden group cursor-pointer"
                onDoubleClick={handleDoubleTap}
                onClick={() => router.push(`/issue/${issue.id}`)}
            >
                {issue.imageUrl ? (
                    <img
                        src={issue.imageUrl}
                        alt={issue.title}
                        className="w-full h-full object-cover select-none"
                        loading="lazy"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-gray-100');
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2 bg-gray-50">
                        <MapPin size={48} className="opacity-20" />
                    </div>
                )}

                {/* Heart Animation Overlay */}
                <HeartAnimation isVisible={showHeartAnim} />

                {/* Status Pill */}
                <div className="absolute top-4 right-4 z-10">
                    <button
                        onClick={handleStatusClick}
                        className={clsx(
                            "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md backdrop-blur-md transition-all active:scale-95 border border-white/20 flex items-center gap-1",
                            getStatusColor(issue.status),
                            issue.status !== 'Resolved' && "hover:opacity-90 cursor-pointer"
                        )}>
                        {issue.status}
                        {issue.status !== 'Resolved' && <span className="text-[8px] bg-white/20 px-1 rounded ml-1">VOTE</span>}
                    </button>
                </div>
            </div>

            {/* 3. Action Bar */}
            <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <button
                        onClick={handleHype}
                        className="flex items-center gap-1.5 transition-transform active:scale-90"
                    >
                        <Flame
                            size={26}
                            className={clsx(
                                "transition-colors",
                                hasHyped ? "fill-orange-500 text-orange-500" : "text-gray-900 hover:text-orange-500"
                            )}
                        />
                    </button>

                    <button
                        onClick={() => setIsCommentOpen(true)}
                        className="flex items-center gap-1.5 text-gray-900 hover:text-blue-600 transition-colors"
                    >
                        <MessageCircle size={26} className="text-gray-900" />
                    </button>

                    <button
                        onClick={() => setIsShareOpen(true)}
                        className="text-gray-900 hover:text-blue-600 transition-colors"
                    >
                        <Share2 size={24} />
                    </button>
                </div>
            </div>

            {/* 4. Likes & Content */}
            <div className="px-4 pb-4">
                <p className="font-bold text-sm text-gray-900 mb-2">
                    {optimisticVotes} Hypes
                </p>
                <div className="text-sm text-gray-900">
                    <span className="font-bold mr-2">{issue.userHandle || 'user'}</span>
                    {issue.title}
                    {issue.description && (
                        <span className="text-gray-600 font-normal ml-1">
                            - {issue.description.length > 60 ? issue.description.substring(0, 60) + "..." : issue.description}
                        </span>
                    )}
                </div>

                <button
                    onClick={() => setIsCommentOpen(true)}
                    className="text-gray-400 text-sm mt-2 font-medium"
                >
                    View all comments
                </button>
            </div>

            {/* Official MCD Resolution Banner */}
            {issue.resolvedByHandle && (
                <div className="mx-4 mb-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Header Strip */}
                    <div className="bg-emerald-600 px-3 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Official MCD Update</span>
                            <VerifiedBadge department={issue.resolvedByDepartment || 'MCD'} size="sm" />
                        </div>
                        <span className="text-[10px] text-emerald-100 font-medium">
                            {issue.resolvedAt ? formatDistanceToNow(issue.resolvedAt.toDate(), { addSuffix: true }) : 'Recently'}
                        </span>
                    </div>

                    <div className="p-3">
                        <div className="flex items-start gap-2 mb-2">
                            <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm text-gray-800 font-medium">Issue Resolved</p>
                                <p className="text-xs text-gray-500">
                                    Action taken by <span className="font-semibold text-gray-700">@{issue.resolvedByHandle}</span>
                                    {issue.resolvedByDepartment && ` (${issue.resolvedByDepartment})`}
                                </p>
                            </div>
                        </div>

                        {issue.resolvedStatement && (
                            <div className="bg-white/60 rounded-lg p-2.5 text-sm text-gray-700 italic border border-emerald-100/50 mb-3">
                                "{issue.resolvedStatement}"
                            </div>
                        )}

                        {issue.afterImageUrl && (
                            <div className="flex gap-2">
                                {issue.imageUrl && (
                                    <div className="flex-1 rounded-lg overflow-hidden border border-gray-200 relative aspect-video">
                                        <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm z-10">BEFORE</div>
                                        <img src={issue.imageUrl} alt="Before" className="w-full h-full object-cover opacity-80" />
                                    </div>
                                )}
                                <div className="flex-1 rounded-lg overflow-hidden border border-emerald-300 relative aspect-video ring-2 ring-emerald-100">
                                    <div className="absolute top-1 left-1 bg-emerald-600 shadow-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm z-10">AFTER</div>
                                    <img src={issue.afterImageUrl} alt="After" className="w-full h-full object-cover" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <AuthModule
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                triggerAction={authTrigger}
            />

            <CommentDrawer
                isOpen={isCommentOpen}
                onClose={() => setIsCommentOpen(false)}
                issueId={issue.id}
            />

            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                issueId={issue.id}
                issueTitle={issue.title}
            />

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
};

export default IssueCard;
