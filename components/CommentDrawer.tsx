'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import VerifiedBadge from './VerifiedBadge';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import {
    getComments, addComment, addReply, getReplies,
    likeComment, unlikeComment, hasUserLikedComment,
    CommentData, ReplyData
} from '@/lib/issues';
import Link from 'next/link';

interface CommentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    issueId: string;
}

interface CommentWithReplies extends CommentData {
    replies: ReplyData[];
    isLiked: boolean;
}

export default function CommentDrawer({ isOpen, onClose, issueId }: CommentDrawerProps) {
    const { user, userProfile, isOfficial, isAdmin } = useAuth();
    const [commentText, setCommentText] = useState("");
    const [replyingTo, setReplyingTo] = useState<{ id: string, user: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [comments, setComments] = useState<CommentWithReplies[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);
    const [sending, setSending] = useState(false);

    // Load comments from Firestore when drawer opens
    useEffect(() => {
        if (!isOpen || !issueId) return;
        let cancelled = false;

        const loadComments = async () => {
            setLoadingComments(true);
            try {
                const rawComments = await getComments(issueId);
                const withReplies: CommentWithReplies[] = await Promise.all(
                    rawComments.map(async (c) => {
                        const replies = await getReplies(issueId, c.id);
                        const isLiked = user ? await hasUserLikedComment(issueId, c.id, user.uid) : false;
                        return { ...c, replies, isLiked };
                    })
                );
                if (!cancelled) setComments(withReplies);
            } catch (e) {
                console.error('Error loading comments:', e);
            } finally {
                if (!cancelled) setLoadingComments(false);
            }
        };

        loadComments();
        return () => { cancelled = true; };
    }, [isOpen, issueId, user]);

    // Input focus when replying
    useEffect(() => {
        if (replyingTo && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingTo]);

    const formatTime = (ts: any) => {
        if (!ts) return 'Just now';
        try {
            const date = ts.toDate ? ts.toDate() : new Date(ts);
            return formatDistanceToNow(date, { addSuffix: false });
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
            // Add as a nested reply
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
                setComments(prev => prev.map(c => {
                    if (c.id === replyingTo.id) {
                        return { ...c, replies: [...c.replies, newReply] };
                    }
                    return c;
                }));
            }
            setReplyingTo(null);
        } else {
            // Add as a top-level comment
            const commentId = await addComment(issueId, user.uid, commentText, handle, avatar, isOfficial, isAdmin, userProfile?.department);
            if (commentId) {
                const newComment: CommentWithReplies = {
                    id: commentId,
                    userId: user.uid,
                    userHandle: handle,
                    userAvatar: avatar,
                    text: commentText.trim(),
                    createdAt: null,
                    likes: 0,
                    replies: [],
                    isLiked: false
                };
                setComments(prev => [...prev, newComment]);
            }
        }
        setCommentText("");
        setSending(false);
    };

    const toggleLikeComment = async (commentId: string) => {
        if (!user) return;
        const comment = comments.find(c => c.id === commentId);
        if (!comment) return;

        // Optimistic
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

        // Persist
        if (comment.isLiked) {
            await unlikeComment(issueId, commentId, user.uid);
        } else {
            await likeComment(issueId, commentId, user.uid);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-white z-[90] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[85vh] flex flex-col md:max-w-md md:left-1/2 md:-translate-x-1/2"
                    >
                        <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose} >
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full cursor-pointer"></div>
                        </div>

                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shadow-sm z-10">
                            <h3 className="font-bold text-lg text-center flex-1">Comments</h3>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full absolute right-4">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {loadingComments ? (
                                <div className="flex justify-center items-center py-16 h-full">
                                    <Loader2 className="animate-spin text-gray-400" size={24} />
                                </div>
                            ) : comments.length === 0 ? (
                                <div className="text-center flex flex-col items-center justify-center text-gray-400 py-16 h-full">
                                    <h3 className="font-bold text-gray-900 text-lg mb-1">No Comments Yet</h3>
                                    <p className="text-sm">Start the conversation.</p>
                                </div>
                            ) : (
                                comments.map((c) => (
                                    <div key={c.id} className="flex gap-3">
                                        <Link href={`/profile/${c.userId}`} className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0 mt-1 overflow-hidden hover:opacity-80 transition-opacity">
                                            {c.userAvatar ? (
                                                <img src={c.userAvatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                c.userHandle?.replace('@', '').substring(0, 1).toUpperCase() || 'U'
                                            )}
                                        </Link>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Link href={`/profile/${c.userId}`} className="font-bold text-[13px] text-gray-900 hover:underline">{c.userHandle}</Link>
                                                {(c.isAdmin || c.userHandle === '@ahr') ? (
                                                    <VerifiedBadge label="Admin" size="sm" />
                                                ) : c.isOfficial ? (
                                                    <VerifiedBadge department={c.department} size="sm" />
                                                ) : null}
                                                <span className="text-xs text-gray-400 font-medium">{formatTime(c.createdAt)}</span>
                                            </div>
                                            <p className="text-gray-800 text-sm mt-0.5 leading-snug">{c.text}</p>

                                            {/* Action Bar */}
                                            <div className="flex items-center gap-4 mt-2 mb-1">
                                                <button
                                                    onClick={() => setReplyingTo({ id: c.id, user: c.userHandle })}
                                                    className="text-xs font-bold text-gray-500 hover:text-gray-900"
                                                >
                                                    Reply
                                                </button>
                                                <button
                                                    onClick={() => toggleLikeComment(c.id)}
                                                    className="text-xs font-bold flex items-center gap-1 text-gray-500 hover:text-gray-900"
                                                >
                                                    <Heart size={12} className={clsx(c.isLiked && "fill-red-500 text-red-500")} />
                                                    {c.likes > 0 && c.likes}
                                                </button>
                                            </div>

                                            {/* Nested Replies */}
                                            {c.replies && c.replies.length > 0 && (
                                                <div className="mt-3 space-y-4">
                                                    {c.replies.map(r => (
                                                        <div key={r.id} className="flex gap-3">
                                                            <Link href={`/profile/${r.userId}`} className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-[10px] flex-shrink-0 mt-0.5 overflow-hidden hover:opacity-80 transition-opacity">
                                                                {r.userAvatar ? (
                                                                    <img src={r.userAvatar} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    r.userHandle?.replace('@', '').substring(0, 1).toUpperCase() || 'U'
                                                                )}
                                                            </Link>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <Link href={`/profile/${r.userId}`} className="font-bold text-[13px] text-gray-900 hover:underline">{r.userHandle}</Link>
                                                                    <span className="text-xs text-gray-400 font-medium">{formatTime(r.createdAt)}</span>
                                                                </div>
                                                                <p className="text-gray-800 text-sm leading-snug mt-0.5">
                                                                    <Link href={`/profile/${c.userId}`} className="text-blue-600 font-medium mr-1 hover:underline">{c.userHandle}</Link>
                                                                    {r.text}
                                                                </p>
                                                                <div className="flex items-center gap-4 mt-1.5">
                                                                    <button
                                                                        onClick={() => setReplyingTo({ id: c.id, user: r.userHandle })}
                                                                        className="text-[11px] font-bold text-gray-500 hover:text-gray-900"
                                                                    >
                                                                        Reply
                                                                    </button>
                                                                </div>
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

                        {/* Input Area */}
                        <div className="p-3 border-t border-gray-100 bg-white pb-6 md:pb-3 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                            {replyingTo && (
                                <div className="flex items-center justify-between px-2 pb-2 text-xs font-medium text-gray-500">
                                    <span>Replying to <span className="text-gray-900 font-bold">{replyingTo.user}</span></span>
                                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-100 rounded-full">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                            <form onSubmit={handleSend} className="flex gap-3 items-center">
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden shadow-sm">
                                    {user?.photoURL ?
                                        <img src={user.photoURL} alt="Me" className="w-full h-full object-cover" /> :
                                        <User size={20} className="m-2.5 text-gray-400" />
                                    }
                                </div>
                                <div className="flex-1 relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder={replyingTo ? `Reply to ${replyingTo.user}...` : "Add a comment..."}
                                        className="w-full border border-gray-200 rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all font-medium"
                                        disabled={!user}
                                    />
                                    {commentText.trim() && (
                                        <button
                                            type="submit"
                                            disabled={sending}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-blue-600 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50"
                                        >
                                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
