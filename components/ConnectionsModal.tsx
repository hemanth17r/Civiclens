'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getFollowers, getFollowing, getFollowStatus, followUser, unfollowUser } from '@/lib/followers';
import { useRouter } from 'next/navigation';

interface ConnectionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'followers' | 'following';
    userId: string;
}

export default function ConnectionsModal({ isOpen, onClose, type, userId }: ConnectionsModalProps) {
    const { user: currentUser } = useAuth();
    const router = useRouter();

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [followStatuses, setFollowStatuses] = useState<Record<string, boolean>>({});
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!isOpen || !userId) return;

        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            try {
                let fetchedUsers: any[] = [];
                if (type === 'followers') {
                    fetchedUsers = await getFollowers(userId);
                } else {
                    fetchedUsers = await getFollowing(userId);
                }

                if (cancelled) return;
                setUsers(fetchedUsers);

                // Fetch follow statuses for current user
                if (currentUser && currentUser.uid) {
                    const statuses: Record<string, boolean> = {};
                    await Promise.all(fetchedUsers.map(async (u) => {
                        // Don't need status for self
                        if (u.uid === currentUser.uid) {
                            statuses[u.uid] = false;
                            return;
                        }
                        const isFollowing = await getFollowStatus(currentUser.uid, u.uid);
                        statuses[u.uid] = isFollowing;
                    }));
                    if (!cancelled) {
                        setFollowStatuses(statuses);
                    }
                }

            } catch (err) {
                console.error("Failed to fetch connections", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [isOpen, userId, type, currentUser]);

    const handleFollowToggle = async (targetId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent navigation
        if (!currentUser) return;

        setActionLoading(prev => ({ ...prev, [targetId]: true }));
        try {
            const isCurrentlyFollowing = followStatuses[targetId];
            if (isCurrentlyFollowing) {
                await unfollowUser(currentUser.uid, targetId);
                setFollowStatuses(prev => ({ ...prev, [targetId]: false }));
            } else {
                await followUser(currentUser.uid, targetId);
                setFollowStatuses(prev => ({ ...prev, [targetId]: true }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(prev => ({ ...prev, [targetId]: false }));
        }
    };

    const handleUserClick = (targetId: string) => {
        onClose();
        if (currentUser?.uid === targetId) {
            router.push('/profile');
        } else {
            router.push(`/profile/${targetId}`);
        }
    };

    if (!isOpen) return null;

    const filteredUsers = users.filter(u =>
        (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.handle || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[85vh] overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-center p-4 border-b border-gray-100 dark:border-gray-800 relative flex-shrink-0">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white capitalize">
                            {type}
                        </h2>
                        <button
                            onClick={onClose}
                            className="absolute right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 flex-shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto min-h-[300px]">
                        {loading ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                            </div>
                        ) : filteredUsers.length > 0 ? (
                            <div className="flex flex-col">
                                {filteredUsers.map((u) => {
                                    const isSelf = currentUser?.uid === u.uid;
                                    const isFollowing = followStatuses[u.uid];
                                    const isActionLoading = actionLoading[u.uid];

                                    return (
                                        <div
                                            key={u.uid}
                                            onClick={() => handleUserClick(u.uid)}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-700">
                                                    {u.photoURL ? (
                                                        <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <UserCircle2 size={24} className="text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex flex-col">
                                                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">
                                                        {u.handle ? `@${u.handle.replace('@', '')}` : u.displayName}
                                                    </span>
                                                    <span className="text-sm text-gray-500 truncate leading-tight mt-0.5">
                                                        {u.displayName}
                                                    </span>
                                                </div>
                                            </div>

                                            {currentUser && !isSelf && (
                                                <button
                                                    onClick={(e) => handleFollowToggle(u.uid, e)}
                                                    disabled={isActionLoading}
                                                    className={`ml-3 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${isFollowing
                                                            ? 'bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'
                                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        }`}
                                                >
                                                    {isActionLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <p className="text-sm">No users found.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
