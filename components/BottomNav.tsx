'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, BarChart3, User, Plus } from 'lucide-react';
import { clsx } from 'clsx';

interface BottomNavProps {
    onReportClick: () => void;
}

const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Explore', href: '/explore', icon: Compass },
    { name: 'Scorecard', href: '/scorecard', icon: BarChart3 },
    { name: 'Profile', href: '/profile', icon: User },
];

export default function BottomNav({ onReportClick }: BottomNavProps) {
    const pathname = usePathname();

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 px-2 z-50 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] text-[10px] sm:text-xs">
            <div className="flex h-full items-center justify-around relative">
                {/* 1. Home */}
                <Link href="/" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/' ? "text-blue-600" : "text-gray-400")}>
                    <Home size={24} strokeWidth={pathname === '/' ? 2.5 : 2} />
                    <span className="font-medium">Home</span>
                </Link>

                {/* 2. Explore */}
                <Link href="/explore" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/explore' ? "text-blue-600" : "text-gray-400")}>
                    <Compass size={24} strokeWidth={pathname === '/explore' ? 2.5 : 2} />
                    <span className="font-medium">Explore</span>
                </Link>

                {/* 3. Center CTA Placeholder */}
                <div className="w-16 flex justify-center">
                    <div className="absolute -top-5">
                        <button
                            onClick={onReportClick}
                            className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-full shadow-lg shadow-blue-200 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
                        >
                            <Plus size={32} />
                        </button>
                    </div>
                </div>

                {/* 4. Scorecard */}
                <Link href="/scorecard" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/scorecard' ? "text-blue-600" : "text-gray-400")}>
                    <BarChart3 size={24} strokeWidth={pathname === '/scorecard' ? 2.5 : 2} />
                    <span className="font-medium">Scorecard</span>
                </Link>

                {/* 5. Profile */}
                <Link href="/profile" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/profile' ? "text-blue-600" : "text-gray-400")}>
                    <User size={24} strokeWidth={pathname === '/profile' ? 2.5 : 2} />
                    <span className="font-medium">Profile</span>
                </Link>
            </div>
        </div>
    );
}
