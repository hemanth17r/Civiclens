'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Heart, Loader2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import VerifiedBadge from './VerifiedBadge';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import {
    getComments, addComment, addReply, getReplies,
    likeComment, unlikeComment, hasUserLikedComment,
    CommentData, ReplyData, getIssueTimeMs
} from '@/lib/issues';
import Link from 'next/link';
import AuthModule from './AuthModule';

export interface CommentWithReplies extends CommentData {
    isLiked: boolean;
}

interface CommentSectionProps {
    issueId: string;
    onCommentAdded?: () => void;
    className?: string;
    maxHeightClass?: string;
    autoFocus?: boolean;
    showHeader?: boolean;
    title?: string;
}

export default function CommentSection({
    issueId,
    onCommentAdded,
    className = '',
    maxHeightClass = 'max-h-[420px]',
    autoFocus = false,
    showHeader = false,
    title = 'Comments'
}: CommentSectionProps) {
    const { user, userProfile, isOfficial, isAdmin } = useAuth();
    const [commentText, setCommentText] = useState("");
    const [replyingTo, setReplyingTo] = useState<{ id: string, user: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authTrigger, setAuthTrigger] = useState("to comment on this issue");

    const [comments, setComments] = useState<CommentWithReplies[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);
    const [sending, setSending] = useState(false);

    // Lazy load state for replies
    const [loadedReplies, setLoadedReplies] = useState<Record<string, ReplyData[]>>({});
    const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

    // Load comments from Firestore
    useEffect(() => {
        if (!issueId) return;
        let cancelled = false;

        const loadComments = async () => {
            setLoadingComments(true);
            try {
                const rawComments = await getComments(issueId);
                const withLikes: CommentWithReplies[] = await Promise.all(
                    rawComments.map(async (c) => {
                        const isLiked = (user && (c.likes || 0) > 0)
                            ? await hasUserLikedComment(issueId, c.id, user.uid)
                            : false;
                        return { ...c, isLiked };
                    })
                );
                if (!cancelled) {
                    setComments(withLikes);
                    setLoadedReplies({});
                    setLoadingReplies({});
                    setExpandedComments({});
                }
            } catch (e) {
                console.error('Error loading comments:', e);
            } finally {
                if (!cancelled) setLoadingComments(false);
            }
        };

        loadComments();
        return () => { cancelled = true; };
    }, [issueId, user]);

    // Input focus when replying or when autoFocus requested
    useEffect(() => {
        if ((replyingTo || autoFocus) && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingTo, autoFocus]);

    const formatTime = (ts: any) => {
        if (!ts) return 'Just now';
        try {
            const ms = getIssueTimeMs(ts);
            if (!ms) return 'Just now';
            return formatDistanceToNow(new Date(ms), { addSuffix: false });
        } catch {
            return 'Just now';
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !user) return;

        const handle = userProfile?.handle || `@${user.email?.split('@')[0] || 'user'}`;
        const avatar = user.photoURL || undefined;

        setSending(true);

        if (replyingTo) {
            const replyId = await addReply(issueId, replyingTo.id, user.uid, commentText, handle, avatar);
            if (replyId) {
                const newReply: ReplyData = {
                    id: replyId,
                    userId: user.uid,
                    userHandle: handle,
                    userAvatar: avatar,
                    text: commentText.trim(),
                    createdAt: null,
                    likes: 0
                };

                setLoadedReplies(prev => ({
                    ...prev,
                    [replyingTo.id]: [...(prev[replyingTo.id] || []), newReply]
                }));
                setExpandedComments(prev => ({ ...prev, [replyingTo.id]: true }));
                setComments(prev => prev.map(c => {
                    if (c.id === replyingTo.id) {
                        return { ...c, replyCount: (c.replyCount || 0) + 1 };
                    }
                    return c;
                }));
                onCommentAdded?.();
            }
            setReplyingTo(null);
        } else {
            const commentId = await addComment(
                issueId,
                user.uid,
                commentText,
                handle,
                avatar,
                isOfficial,
                isAdmin,
                userProfile?.department
            );
            if (commentId) {
                const newComment: CommentWithReplies = {
                    id: commentId,
                    userId: user.uid,
                    userHandle: handle,
                    userAvatar: avatar,
                    text: commentText.trim(),
                    createdAt: null,
                    likes: 0,
                    replyCount: 0,
                    isLiked: false
                };
                setComments(prev => [...prev, newComment]);
                onCommentAdded?.();
            }
        }
        setCommentText("");
        setSending(false);
    };

    const toggleLikeComment = async (commentId: string) => {
        if (!user) {
            setAuthTrigger("to like comments");
            setIsAuthOpen(true);
            return;
        }
        const comment = comments.find(c => c.id === commentId);
        if (!comment) return;

        setComments(prev => prev.map(c => {
            if (c.id === commentId) {
                return {
                    ...c,
                    isLiked: !c.isLiked,
                    likes: c.isLiked ? c.likes - 1 : c.likes + 1
                };
            }
            return c;
        }));

        if (comment.isLiked) {
            await unlikeComment(issueId, commentId, user.uid);
        } else {
            await likeComment(issueId, commentId, user.uid);
        }
    };

    const handleReplyClick = (commentId: string, userHandle: string) => {
        if (!user) {
            setAuthTrigger("to reply to comments");
            setIsAuthOpen(true);
            return;
        }
        setReplyingTo({ id: commentId, user: userHandle });
    };

    const handleInputClick = () => {
        if (!user) {
            setAuthTrigger("to comment on this issue");
            setIsAuthOpen(true);
        }
    };

    const toggleReplies = async (commentId: string) => {
        const isExpanded = expandedComments[commentId];
        if (isExpanded) {
            setExpandedComments(prev => ({ ...prev, [commentId]: false }));
            return;
        }

        if (!loadedReplies[commentId]) {
            setLoadingReplies(prev => ({ ...prev, [commentId]: true }));
            try {
                const replies = await getReplies(issueId, commentId);
                setLoadedReplies(prev => ({ ...prev, [commentId]: replies }));
            } catch (err) {
                console.error("Failed to load replies dynamically:", err);
            } finally {
                setLoadingReplies(prev => ({ ...prev, [commentId]: false }));
            }
        }
        setExpandedComments(prev => ({ ...prev, [commentId]: true }));
    };

    return (
        <div className={clsx("flex flex-col w-full", className)}>
            {showHeader && (
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900">{title}</h3>
                    <span className="text-xs text-gray-400 font-medium">
                        {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                    </span>
                </div>
            )}

            {/* Scrollable Comments List */}
            <div className={clsx("overflow-y-auto px-4 py-3 space-y-4", maxHeightClass)}>
                {loadingComments ? (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="animate-spin text-gray-400" size={20} />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center flex flex-col items-center justify-center text-gray-400 py-6">
                        <p className="text-xs font-semibold text-gray-700">No comments yet</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Be the first to share your thoughts.</p>
                    </div>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="flex gap-2.5 items-start group">
                            <Link
                                href={`/profile/${c.userId}`}
                                className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0 mt-0.5 overflow-hidden hover:opacity-80 transition-opacity"
                            >
                                {c.userAvatar ? (
                                    <img src={c.userAvatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                    c.userHandle?.replace('@', '').substring(0, 1).toUpperCase() || 'U'
                                )}
                            </Link>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Link href={`/profile/${c.userId}`} className="font-bold text-xs text-gray-900 hover:underline">
                                        {c.userHandle}
                                    </Link>
                                    {(c.isAdmin || c.userHandle === '@ahr') ? (
                                        <VerifiedBadge label="Admin" size="sm" />
                                    ) : c.isOfficial ? (
                                        <VerifiedBadge department={c.department} size="sm" />
                                    ) : null}
                                    <span className="text-[11px] text-gray-400 font-normal">
                                        {formatTime(c.createdAt)}
                                    </span>
                                </div>
                                <p className="text-gray-800 text-xs mt-0.5 leading-relaxed break-words">
                                    {c.text}
                                </p>

                                {/* Action Bar */}
                                <div className="flex items-center gap-3 mt-1.5">
                                    <button
                                        onClick={() => handleReplyClick(c.id, c.userHandle)}
                                        className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 cursor-pointer transition-colors"
                                    >
                                        Reply
                                    </button>
                                    <button
                                        onClick={() => toggleLikeComment(c.id)}
                                        className="text-[11px] font-semibold flex items-center gap-1 text-gray-500 hover:text-gray-900 cursor-pointer transition-colors"
                                    >
                                        <Heart size={11} className={clsx(c.isLiked && "fill-red-500 text-red-500")} />
                                        {c.likes > 0 && <span>{c.likes}</span>}
                                    </button>
                                </div>

                                {/* Toggle View Replies */}
                                {((c.replyCount && c.replyCount > 0) || (loadedReplies[c.id] && loadedReplies[c.id].length > 0)) && (
                                    <button
                                        onClick={() => toggleReplies(c.id)}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1.5 cursor-pointer"
                                    >
                                        {loadingReplies[c.id] ? (
                                            <Loader2 size={11} className="animate-spin text-gray-400" />
                                        ) : expandedComments[c.id] ? (
                                            '── Hide replies'
                                        ) : (
                                            `── View replies (${c.replyCount || loadedReplies[c.id]?.length || 0})`
                                        )}
                                    </button>
                                )}

                                {/* Nested Replies */}
                                {expandedComments[c.id] && loadedReplies[c.id] && loadedReplies[c.id].length > 0 && (
                                    <div className="mt-2.5 space-y-2.5 pl-3 border-l-2 border-gray-100">
                                        {loadedReplies[c.id].map(r => (
                                            <div key={r.id} className="flex gap-2 items-start">
                                                <Link
                                                    href={`/profile/${r.userId}`}
                                                    className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-[9px] flex-shrink-0 mt-0.5 overflow-hidden hover:opacity-80 transition-opacity"
                                                >
                                                    {r.userAvatar ? (
                                                        <img src={r.userAvatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                    ) : (
                                                        r.userHandle?.replace('@', '').substring(0, 1).toUpperCase() || 'U'
                                                    )}
                                                </Link>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <Link href={`/profile/${r.userId}`} className="font-bold text-[11px] text-gray-900 hover:underline">
                                                            {r.userHandle}
                                                        </Link>
                                                        <span className="text-[10px] text-gray-400 font-normal">
                                                            {formatTime(r.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-800 text-xs leading-relaxed break-words mt-0.5">
                                                        <span className="text-blue-600 font-medium mr-1">{c.userHandle}</span>
                                                        {r.text}
                                                    </p>
                                                    <button
                                                        onClick={() => handleReplyClick(c.id, r.userHandle)}
                                                        className="text-[10px] font-semibold text-gray-500 hover:text-gray-900 cursor-pointer mt-1"
                                                    >
                                                        Reply
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Comment Input Bar */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                {replyingTo && (
                    <div className="flex items-center justify-between px-2 pb-2 text-xs font-medium text-gray-500">
                        <span>Replying to <span className="text-gray-900 font-bold">{replyingTo.user}</span></span>
                        <button onClick={() => setReplyingTo(null)} className="p-0.5 hover:bg-gray-200 rounded-full text-gray-500">
                            <X size={13} />
                        </button>
                    </div>
                )}
                <form onSubmit={handleSend} className="flex gap-2.5 items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden shadow-xs">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Me" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                            <User size={16} className="m-2 text-gray-400" />
                        )}
                    </div>
                    <div className="flex-1 relative" onClick={handleInputClick}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={replyingTo ? `Reply to ${replyingTo.user}...` : (user ? "Add a comment..." : "Sign in to comment...")}
                            className="w-full bg-white border border-gray-200 rounded-full pl-4 pr-10 py-2 text-xs focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-medium"
                            readOnly={!user}
                        />
                        {commentText.trim() && user && (
                            <button
                                type="submit"
                                disabled={sending}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <AuthModule
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                triggerAction={authTrigger}
            />
        </div>
    );
}
