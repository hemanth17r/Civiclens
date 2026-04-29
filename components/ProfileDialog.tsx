'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
    const { user, userProfile, logout } = useAuth();

    if (!isOpen || !user) return null;

    const handleLogout = async () => {
        await logout();
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-8 flex flex-col items-center text-center">
                        {/* Avatar */}
                        <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-purple-500 mb-4">
                            <div className="w-full h-full rounded-full border-4 border-white bg-gray-200 overflow-hidden flex items-center justify-center">
                                {userProfile?.photoURL ? (
                                    <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon size={40} className="text-gray-400" />
                                )}
                            </div>
                        </div>

                        {/* Name & Handle */}
                        <h2 className="text-2xl font-bold text-gray-900">
                            {user.displayName || 'User'}
                        </h2>
                        <p className="text-lg font-medium text-blue-600 mb-1">
                            {userProfile?.handle || '@new_user'}
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            {user.email}
                        </p>

                        {/* UID Badge */}
                        <div className="bg-gray-50 rounded-lg py-2 px-3 mb-8 w-full">
                            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">User ID</p>
                            <p className="text-xs font-mono text-gray-600 truncate">
                                {user.uid}
                            </p>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={20} />
                            Sign Out
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
