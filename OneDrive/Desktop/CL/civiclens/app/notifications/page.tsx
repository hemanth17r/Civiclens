'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Flame, MessageCircle, CheckCircle, AlertTriangle, ShieldCheck, Clock, CheckCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getNotifications, markAsRead, markAllRead, NotificationData } from '@/lib/notifications';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function NotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        getNotifications(user.uid, 50)
            .then(setNotifications)
            .finally(() => setLoading(false));
    }, [user]);

    const handleMarkAllRead = async () => {
        if (!user) return;
        await markAllRead(user.uid);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleClick = async (notif: NotificationData) => {
        if (!notif.read) {
            await markAsRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }
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

    const getIcon = (type: string, isUrgent: boolean) => {
        if (isUrgent) return <AlertTriangle size={20} className="text-red-600" fill="currentColor" />;
        switch (type) {
            case 'status_update': return <ShieldCheck size={20} className="text-green-600" />;
            case 'hype': return <Flame size={20} className="text-orange-500" fill="currentColor" />;
            case 'comment': return <MessageCircle size={20} className="text-blue-500" />;
            default: return <Bell size={20} className="text-gray-500" />;
        }
    };

    const getIconBg = (type: string, isUrgent: boolean) => {
        if (isUrgent) return 'bg-red-100';
        switch (type) {
            case 'status_update': return 'bg-green-100';
            case 'hype': return 'bg-orange-100';
            case 'comment': return 'bg-blue-100';
            default: return 'bg-gray-100';
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="min-h-screen bg-white pb-20 md:pb-0">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                    <Bell size={24} className="text-gray-900" />
                    <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
                    {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllRead}
                        className="text-sm text-blue-600 font-semibold hover:text-blue-800 flex items-center gap-1"
                    >
                        <CheckCheck size={16} /> Mark all read
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-gray-400" size={28} />
                </div>
            ) : notifications.length === 0 ? (
                <div className="p-16 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell size={32} className="text-gray-300" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">No notifications yet</h3>
                    <p className="text-gray-400 text-sm mt-1">You'll see updates here when things happen.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleClick(notif)}
                            className={`p-4 flex gap-4 cursor-pointer hover:bg-gray-50 transition-colors ${notif.isUrgent && !notif.read
                                    ? 'bg-red-50 border-l-4 border-red-500'
                                    : !notif.read
                                        ? 'bg-blue-50/40'
                                        : ''
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${getIconBg(notif.type, notif.isUrgent)}`}>
                                {getIcon(notif.type, notif.isUrgent)}
                            </div>
                            <div className="flex-1">
                                <p className={`text-sm leading-snug ${notif.isUrgent
                                        ? 'font-bold text-red-900'
                                        : notif.read
                                            ? 'text-gray-600'
                                            : 'text-gray-900 font-medium'
                                    }`}>
                                    {notif.isUrgent && <span className="text-red-600 mr-1">🚨</span>}
                                    <span className="font-bold">{notif.title}:</span>{' '}
                                    {notif.body}
                                </p>
                                <p className="text-xs text-gray-400 mt-1.5 font-medium flex items-center gap-1">
                                    <Clock size={12} />
                                    {formatTime(notif.createdAt)}
                                </p>
                            </div>
                            {!notif.read && (
                                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
