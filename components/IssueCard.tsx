'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MapPin, Flame, MessageCircle, Bookmark, User, Share2, BookmarkCheck, CheckCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { Issue, hypeIssue, unhypeIssue, hasUserHyped, saveIssue, unsaveIssue, hasUserSaved, getIssueTimeMs } from '@/lib/issues';
import { setPendingIntent } from '@/lib/authIntents';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import HeartAnimation from './HeartAnimation';
import VerifiedBadge from './VerifiedBadge';
import { motion } from 'framer-motion';
import { tapScale } from '@/lib/motion';

const AuthModule = dynamic(() => import('./AuthModule'), { ssr: false });
const CommentDrawer = dynamic(() => import('./CommentDrawer'), { ssr: false });
const CommentSection = dynamic(() => import('./CommentSection'), { ssr: false });
const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false });

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
    const [optimisticCommentCount, setOptimisticCommentCount] = useState(issue.commentCount || 0);
    const [showHeartAnim, setShowHeartAnim] = useState(false);
    const [isCommentOpen, setIsCommentOpen] = useState(false);
    const [isInlineCommentsOpen, setIsInlineCommentsOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);
    const [showPendingInfo, setShowPendingInfo] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
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

    const scrollMedia = useCallback((direction: 'left' | 'right') => {
        if (mediaContainerRef.current) {
            const width = mediaContainerRef.current.clientWidth;
            mediaContainerRef.current.scrollBy({
                left: direction === 'left' ? -width : width,
                behavior: 'smooth'
            });
        }
    }, []);

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

    // Helpers — memoized to avoid recomputation on every render.
    const timeAgo = useMemo(() => {
        const ms = getIssueTimeMs(issue.createdAt);
        return ms ? formatDistanceToNow(new Date(ms), { addSuffix: true }) : 'Just now';
    }, [issue.createdAt]);

    const statusColor = useMemo(() => {
        switch (issue.status) {
            case 'Resolved': return 'bg-[#34A853] text-white';
            case 'Action Seen':
            case 'In Progress': return 'bg-[#FBBC05] text-white';
            case 'Active':
            case 'Verified': return 'bg-blue-600 text-white';
            case 'Verification Needed':
            case 'Under Review': return 'bg-purple-600 text-white';
            case 'Reported':
            case 'Open': default: return 'bg-black text-white';
        }
    }, [issue.status]);

    const displayStatus = useMemo(() => {
        switch (issue.status) {
            case 'Open': return 'Reported';
            case 'Under Review': return 'Verification Needed';
            case 'In Progress': return 'Active';
            default: return issue.status;
        }
    }, [issue.status]);

    // Listen for auto-executed intents on this issue after login
    useEffect(() => {
        const handleIntentExecuted = (e: Event) => {
            const customEvent = e as CustomEvent;
            const intent = customEvent.detail;
            if (!intent) return;
            if (intent.issueId === issue.id) {
                if (intent.type === 'HYPE') {
                    setHasHyped(true);
                    setOptimisticVotes(prev => prev + 1);
                    setShowHeartAnim(true);
                    setTimeout(() => setShowHeartAnim(false), 1000);
                } else if (intent.type === 'SAVE') {
                    setIsSaved(true);
                }
            }
        };

        window.addEventListener('civiclens:intent-executed', handleIntentExecuted);
        return () => window.removeEventListener('civiclens:intent-executed', handleIntentExecuted);
    }, [issue.id]);

    const handleHype = useCallback(async () => {
        if (!user) {
            setPendingIntent({ type: 'HYPE', issueId: issue.id });
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
            setPendingIntent({ type: 'SAVE', issueId: issue.id });
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

    const handleCommentClick = useCallback(() => {
        setIsAuthModalOpen(false);
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            setIsInlineCommentsOpen(prev => !prev);
        } else {
            setIsCommentOpen(true);
        }
    }, []);



    return (
        <div className="bg-white border-b border-gray-100 pb-3 mb-2 md:rounded-2xl md:border md:shadow-xs md:mb-6 overflow-hidden break-inside-avoid relative w-full">

            {/* 1. Header: Instagram style */}
            <div className="flex items-center justify-between px-3.5 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Link href={`/profile/${issue.userId}`} className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[2px] block cursor-pointer hover:opacity-90 transition-opacity shrink-0">
                        <div className="w-full h-full rounded-full border-2 border-white bg-gray-100 overflow-hidden text-gray-400 flex items-center justify-center">
                            {issue.userAvatar ? (
                                <img src={issue.userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User size={18} />
                            )}
                        </div>
                    </Link>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-gray-900 leading-none truncate">
                                {issue.userHandle || '@citizen'}
                            </p>
                            <span className="text-gray-300 text-xs">•</span>
                            <span className="text-xs text-gray-500 font-medium shrink-0">{timeAgo}</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-0.5 font-medium truncate">
                            <MapPin size={10} className="fill-blue-100 shrink-0" />
                            <span className="truncate">{issue.cityName ? issue.cityName : (issue.location || 'Unknown Location')}</span>
                        </p>
                    </div>
                </div>

                {/* Right: Status Badge & Info */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={handleStatusClick}
                        className={clsx(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs flex items-center gap-1 cursor-pointer transition-colors",
                            statusColor
                        )}
                        title="View issue details"
                    >
                        {displayStatus}
                    </motion.button>

                    {/* Pending Approval Badge */}
                    {issue.status === 'Reported' && (
                        <div className="relative" ref={pendingInfoRef}>
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.94 }}
                                onClick={(e) => { e.stopPropagation(); setShowPendingInfo(v => !v); }}
                                className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-1 cursor-pointer"
                                title="Needs Admin Approval"
                            >
                                <Info size={11} />
                            </motion.button>
                            {showPendingInfo && (
                                <div className="absolute right-0 top-full mt-2 w-[240px] sm:w-64 bg-white border border-gray-100 rounded-2xl shadow-xl p-4 z-30 animate-in fade-in slide-in-from-top-2 duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
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

            {/* 2. Media: 4:5 mobile portrait / 1:1 desktop */}
            <div
                className="aspect-[4/5] sm:aspect-square w-full bg-gray-100 relative group overflow-hidden"
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
                            <>
                                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
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

                                {/* Desktop-only Carousel Navigation Arrows */}
                                {currentMediaIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); scrollMedia('left'); }}
                                        className="hidden md:flex absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-sm"
                                        aria-label="Previous image"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                )}
                                {currentMediaIndex < mediaList.length - 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); scrollMedia('right'); }}
                                        className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-sm"
                                        aria-label="Next image"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2 bg-gray-50">
                        <MapPin size={48} className="opacity-20" />
                    </div>
                )}

                {/* Heart Animation Overlay */}
                <HeartAnimation isVisible={showHeartAnim} />
            </div>

            {/* 3. Action Bar: Instagram Layout */}
            <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <motion.button
                        {...tapScale.icon}
                        onClick={handleHype}
                        className="flex items-center gap-1 cursor-pointer"
                        aria-label="Hype"
                    >
                        <Flame
                            size={26}
                            className={clsx(
                                "transition-colors",
                                hasHyped ? "fill-orange-500 text-orange-500" : "text-gray-900 hover:text-orange-500"
                            )}
                        />
                    </motion.button>

                    <motion.button
                        {...tapScale.icon}
                        onClick={handleCommentClick}
                        className="flex items-center gap-1 text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                        aria-label="Comments"
                    >
                        <MessageCircle size={25} className={clsx("transition-colors", isInlineCommentsOpen ? "text-blue-600 fill-blue-50" : "text-gray-900")} />
                        {optimisticCommentCount > 0 && (
                            <span className="text-xs font-semibold text-gray-700">{optimisticCommentCount}</span>
                        )}
                    </motion.button>

                    <motion.button
                        {...tapScale.icon}
                        onClick={() => setIsShareOpen(true)}
                        className="flex items-center gap-1 text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                        aria-label="Share"
                    >
                        <Share2 size={23} />
                        {(issue.sharesCount ?? 0) > 0 && (
                            <span className="text-xs font-semibold text-gray-700">{issue.sharesCount}</span>
                        )}
                    </motion.button>
                </div>

                <motion.button
                    {...tapScale.icon}
                    onClick={handleSaveToggle}
                    className="text-gray-900 hover:text-gray-600 transition-colors cursor-pointer p-0.5"
                    aria-label="Bookmark"
                >
                    {isSaved ? (
                        <BookmarkCheck size={25} className="text-gray-900 fill-gray-900" />
                    ) : (
                        <Bookmark size={25} className="text-gray-900" />
                    )}
                </motion.button>
            </div>

            {/* 4. Likes & Content */}
            <div className="px-3.5 pb-3">
                <p className="font-bold text-xs text-gray-900 mb-1.5">
                    {optimisticVotes} {optimisticVotes === 1 ? 'hype' : 'hypes'}
                </p>

                <div className="text-xs text-gray-900 leading-snug">
                    <span className="font-bold mr-1.5">{issue.userHandle || 'citizen'}</span>
                    <span className="font-semibold text-gray-900">{issue.title}</span>
                    {issue.description && (
                        <span className="text-gray-700 font-normal ml-1">
                            — {isDescriptionExpanded ? issue.description : (issue.description.length > 90 ? issue.description.slice(0, 90) + '...' : issue.description)}
                            {!isDescriptionExpanded && issue.description.length > 90 && (
                                <button
                                    onClick={() => setIsDescriptionExpanded(true)}
                                    className="text-gray-400 hover:text-gray-600 text-xs font-normal ml-1 cursor-pointer"
                                >
                                    more
                                </button>
                            )}
                        </span>
                    )}
                </div>

                {/* Comment counter link */}
                <button
                    onClick={handleCommentClick}
                    className="text-gray-400 hover:text-gray-600 text-xs mt-1.5 font-medium cursor-pointer transition-colors block"
                >
                    {optimisticCommentCount > 0
                        ? (isInlineCommentsOpen ? 'Hide comments' : `View all ${optimisticCommentCount} comments`)
                        : (isInlineCommentsOpen ? 'Hide comments' : 'Add a comment...')}
                </button>

                {/* Uppercase relative timestamp */}
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                    {timeAgo}
                </p>

                {/* Instagram Desktop Style Quick Comment Bar */}
                {!isInlineCommentsOpen && (
                    <div
                        onClick={handleCommentClick}
                        className="hidden md:flex items-center justify-between pt-2.5 mt-2.5 border-t border-gray-100 text-xs text-gray-400 cursor-pointer hover:text-gray-600 group"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={12} className="text-gray-400" />
                                )}
                            </div>
                            <span>Add a comment...</span>
                        </div>
                        <span className="font-semibold text-blue-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Post</span>
                    </div>
                )}
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
                            {issue.resolvedAt ? (getIssueTimeMs(issue.resolvedAt) ? formatDistanceToNow(new Date(getIssueTimeMs(issue.resolvedAt)), { addSuffix: true }) : 'Recently') : 'Recently'}
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
                                {"\""}{issue.resolvedStatement}{"\""}
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

            {/* Desktop Inline Comments Thread */}
            {isInlineCommentsOpen && (
                <div className="hidden md:block border-t border-gray-100 bg-gray-50/20 animate-in fade-in duration-200">
                    <CommentSection
                        issueId={issue.id}
                        onCommentAdded={() => setOptimisticCommentCount(prev => prev + 1)}
                        maxHeightClass="max-h-80"
                        showHeader={false}
                        autoFocus={true}
                    />
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
                onCommentAdded={() => setOptimisticCommentCount(prev => prev + 1)}
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

export default React.memo(IssueCard);
