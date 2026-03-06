'use client';

import React from 'react';
import Link from 'next/link';
import { Search, Menu, Bell, User as UserIcon, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
    toggleSidebar: () => void;
    onReportClick: () => void;
}

import ProfileDialog from '@/components/ProfileDialog';
import AuthModule from '@/components/AuthModule';
import NotificationBell from '@/components/NotificationBell';

const Header: React.FC<HeaderProps> = ({ toggleSidebar, onReportClick }) => {
    const { user, userProfile } = useAuth();
    const [isAuthOpen, setIsAuthOpen] = React.useState(false);

    return (
        <>
            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 justify-between fixed top-0 left-0 right-0 z-30">
                <div className="flex items-center gap-4 w-64">
                    <button onClick={toggleSidebar} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <Menu size={24} />
                    </button>
                    <Link href="/" className="text-xl font-medium text-gray-800 tracking-tight hover:opacity-80 transition-opacity">
                        CivicLens
                    </Link>
                </div>

                <div className="flex items-center gap-3 justify-end ml-auto">
                    <button
                        onClick={onReportClick}
                        className="flex flex-row items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} strokeWidth={2.5} />
                        <span className="text-sm">Report Issue</span>
                    </button>
                    {user ? (
                        <>
                            <NotificationBell />
                            <Link
                                href="/profile"
                                className="h-9 w-9 rounded-full flex items-center justify-center text-white font-medium cursor-pointer ring-2 ring-transparent hover:ring-purple-100 transition-all overflow-hidden bg-gray-200 outline-none"
                            >
                                {userProfile?.photoURL ? (
                                    <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-gray-500"><UserIcon size={20} /></span>
                                )}
                            </Link>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsAuthOpen(true)}
                            className="text-sm font-bold text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-full transition-colors"
                        >
                            Log In
                        </button>
                    )}
                </div>
            </header>

            <AuthModule
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                triggerAction="to sign in"
            />
        </>
    );
};

export default Header;
