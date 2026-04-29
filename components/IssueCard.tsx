'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Flame, MessageCircle, Bookmark, User, Share2, BookmarkCheck, CheckCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { Issue, hypeIssue, unhypeIssue, hasUserHyped, saveIssue, unsaveIssue, hasUserSaved } from '@/lib/issues';
import AuthModule from './AuthModule';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import HeartAnimation from './HeartAnimation';
import CommentDrawer from './CommentDrawer';
import ShareModal from './ShareModal';
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
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);
    const [showPendingInfo, setShowPendingInfo] = useState(false);
    const pendingInfoRef = React.useRef<HTMLDivElement>(null);

    const mediaList = issue.mediaUrls && issue.mediaUrls.length > 0
        ? issue.mediaUrls
        : issue.imageUrl
            ? [issue.imageUrl]
            : [];

    const handleScroll = () => {
        if (mediaContainerRef.current) {
            const scrollLeft = mediaContainerRef.current.scrollLeft;
            const width = mediaContainerRef.current.clientWidth;
            const newIndex = Math.round(scrollLeft / width);
            if (newIndex !== currentMediaIndex) {
                setCurrentMediaIndex(newIndex);
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pendingInfoRef.current && !pendingInfoRef.current.contains(event.target as Node)) {
                setShowPendingInfo(false);
            }
        };
        if (showPendingInfo) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPendingInfo]);



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
            case 'Action Seen':
            case 'In Progress': return 'bg-[#FBBC05] text-white';
            case 'Active':
            case 'Verified': return 'bg-blue-600 text-white'; // Verified is legacy, treated as Active
            case 'Verification Needed':
            case 'Under Review': return 'bg-purple-600 text-white';
            case 'Reported':
            case 'Open': default: return 'bg-black text-white';
        }
    };

    const getDisplayStatus = (status: string = 'Open') => {
        switch (status) {
            case 'Open': return 'Reported';
            case 'Under Review': return 'Verification Needed';
            case 'In Progress': return 'Active';
            default: return status;
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
        router.push(`/issue/${issue.id}`);
    };



    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden break-inside-avoid relative">

            {/* 1. Header: Instagram style */}
            <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                    <Link href={`/profile/${issue.userId}`} className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[2px] block cursor-pointer hover:opacity-90 transition-opacity">
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
                className="aspect-square w-full bg-gray-100 relative group overflow-hidden"
                onDoubleClick={handleDoubleTap}
            >
                {mediaList.length > 0 ? (
                    <>
                        <div
                            ref={mediaContainerRef}
                            onScroll={handleScroll}
                            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-none"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {mediaList.map((mediaUrl, idx) => (
                                <div key={idx} className="w-full h-full flex-shrink-0 snap-center relative">
                                    {mediaUrl.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
                                        <video
                                            src={mediaUrl}
                                            controls
                                            className="w-full h-full object-cover select-none"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement?.classList.add('bg-gray-100');
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={mediaUrl}
                                            alt={`${issue.title} - ${idx + 1}`}
                                            className="w-full h-full object-cover select-none"
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement?.classList.add('bg-gray-100');
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Carousel Dots */}
                        {mediaList.length > 1 && (
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                                {mediaList.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={clsx(
                                            "h-1.5 rounded-full transition-all duration-300 shadow-sm",
                                            currentMediaIndex === idx
                                                ? "w-4 bg-blue-500"
                                                : "w-1.5 bg-white/70"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2 bg-gray-50">
                        <MapPin size={48} className="opacity-20" />
                    </div>
                )}

                {/* Heart Animation Overlay */}
                <HeartAnimation isVisible={showHeartAnim} />

                {/* Status Pill — shows current status, links to timeline */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                    <button
                        onClick={handleStatusClick}
                        className={clsx(
                            "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md backdrop-blur-md transition-all active:scale-95 border border-white/20 flex items-center gap-1 cursor-pointer hover:opacity-90",
                            getStatusColor(issue.status)
                        )}>
                        {getDisplayStatus(issue.status)}
                    </button>
                    {/* Pending Approval Badge */}
                    {issue.status === 'Reported' && (
                        <div className="relative" ref={pendingInfoRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowPendingInfo(v => !v); }}
                                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md backdrop-blur-md transition-all active:scale-95 border border-white/20 flex items-center gap-1 cursor-pointer bg-amber-500 text-white hover:opacity-90"
                            >
                                <Info size={12} /> Pending Approval
                            </button>
                            {showPendingInfo && (
                                <div className="absolute right-0 top-full mt-2 w-[240px] sm:w-64 bg-white border border-gray-100 rounded-2xl shadow-xl p-4 z-20 animate-in fade-in slide-in-from-top-2 duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info size={14} className="text-amber-500 flex-shrink-0" />
                                        <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Needs Admin Approval</span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed normal-case">
                                        This report requires admin verification before it can be displayed in the public feed where others can view and hype it. It is currently only visible to you.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
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
                        {(issue.commentCount ?? 0) > 0 && (
                            <span className="text-xs font-semibold text-gray-700">{issue.commentCount}</span>
                        )}
                    </button>

                    <button
                        onClick={() => setIsShareOpen(true)}
                        className="flex items-center gap-1.5 text-gray-900 hover:text-blue-600 transition-colors"
                    >
                        <Share2 size={24} />
                        {(issue.sharesCount ?? 0) > 0 && (
                            <span className="text-xs font-semibold text-gray-700">{issue.sharesCount}</span>
                        )}
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
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                {issue.resolvedByHandle === 'ahr' ? 'Admin Update' : 'Official MCD Update'}
                            </span>
                            <VerifiedBadge 
                                department={issue.resolvedByDepartment || 'MCD'} 
                                size="sm" 
                                label={issue.resolvedByHandle === 'ahr' ? 'Admin' : 'Official'}
                            />
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


        </div>
    );
};

export default IssueCard;
