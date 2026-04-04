'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, Flame, MessageCircle, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getNotifications, getUnreadCount, markAsRead, markAllRead, NotificationData } from '@/lib/notifications';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export default function NotificationBell() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Poll unread count every 30 seconds
    const refreshUnread = useCallback(async () => {
        if (!user) return;
        const count = await getUnreadCount(user.uid);
        setUnread(count);
    }, [user]);

    useEffect(() => {
        refreshUnread();
        const interval = setInterval(refreshUnread, 30000);
        return () => clearInterval(interval);
    }, [refreshUnread]);

    // Load notifications when dropdown opens
    useEffect(() => {
        if (!isOpen || !user) return;
        setLoading(true);
        getNotifications(user.uid, 20)
            .then(setNotifications)
            .finally(() => setLoading(false));
    }, [isOpen, user]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleMarkAllRead = async () => {
        if (!user) return;
        await markAllRead(user.uid);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnread(0);
    };

    const handleNotifClick = async (notif: NotificationData) => {
        if (!notif.read) {
            await markAsRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
            setUnread(prev => Math.max(0, prev - 1));
        }
    };

    const getNotifIcon = (type: string, isUrgent: boolean) => {
        if (isUrgent) return <AlertTriangle size={16} className="text-red-600" />;
        switch (type) {
            case 'status_update':
            case 'author_status':
            case 'issue_approved': return <ShieldCheck size={16} className="text-green-600" />;
            case 'issue_rejected': return <X size={16} className="text-red-600" />;
            case 'hype':
            case 'author_milestone': return <Flame size={16} className="text-orange-500" />;
            case 'comment': return <MessageCircle size={16} className="text-blue-500" />;
            default: return <Bell size={16} className="text-gray-500" />;
        }
    };

    const getNotifBg = (notif: NotificationData) => {
        if (notif.isUrgent && !notif.read) return 'bg-red-50 border-l-4 border-red-500';
        if (!notif.read) return 'bg-blue-50/50';
        return '';
    };

    const formatTime = (ts: any) => {
        if (!ts) return 'Just now';
        try {
            const date = ts.toDate ? ts.toDate() : new Date(ts);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch {
            return 'Just now';
        }
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
                <Bell size={22} className="text-gray-700" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-gray-900">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unread > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-xs text-blue-600 font-semibold hover:text-blue-800 flex items-center gap-1"
                                >
                                    <CheckCheck size={14} /> Mark all read
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                                <X size={16} className="text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell size={32} className="text-gray-200 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotifClick(notif)}
                                    className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${getNotifBg(notif)}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${notif.isUrgent || notif.type === 'issue_rejected' ? 'bg-red-100' :
                                        (notif.type === 'status_update' || notif.type === 'author_status' || notif.type === 'issue_approved') ? 'bg-green-100' :
                                            (notif.type === 'hype' || notif.type === 'author_milestone') ? 'bg-orange-100' :
                                                'bg-blue-100'
                                        }`}>
                                        {getNotifIcon(notif.type, notif.isUrgent)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-snug ${notif.isUrgent ? 'font-bold text-red-900' : notif.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                            {notif.isUrgent && <span className="text-red-600 mr-1">🚨</span>}
                                            <span className="font-bold">{notif.title}:</span>{' '}
                                            {notif.body}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                                            <Clock size={10} />
                                            {formatTime(notif.createdAt)}
                                        </p>
                                    </div>
                                    {!notif.read && (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 px-4 py-2.5">
                        <Link
                            href="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 w-full text-center block"
                        >
                            View all notifications →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
