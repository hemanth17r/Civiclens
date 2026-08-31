'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Compass, Map, User, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { tapScale } from '@/lib/motion';

interface BottomNavProps {
    onReportClick: () => void;
}

function BottomNav({ onReportClick }: BottomNavProps) {
    const pathname = usePathname();

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 px-2 z-50 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] text-[10px] sm:text-xs">
            <div className="flex h-full items-center justify-around relative">
                {/* 1. Home */}
                <motion.div whileTap={{ scale: 0.9 }}>
                    <Link href="/" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/' ? "text-blue-600" : "text-gray-400")}>
                        <Home size={24} strokeWidth={pathname === '/' ? 2.5 : 2} />
                        <span className="font-medium">Home</span>
                    </Link>
                </motion.div>

                {/* 2. Explore */}
                <motion.div whileTap={{ scale: 0.9 }}>
                    <Link href="/explore" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/explore' ? "text-blue-600" : "text-gray-400")}>
                        <Compass size={24} strokeWidth={pathname === '/explore' ? 2.5 : 2} />
                        <span className="font-medium">Explore</span>
                    </Link>
                </motion.div>

                {/* 3. Center CTA Placeholder */}
                <div className="w-16 flex justify-center">
                    <div className="absolute -top-5">
                        <motion.button
                            {...tapScale.fab}
                            onClick={onReportClick}
                            className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-full shadow-lg shadow-blue-200 flex items-center justify-center text-white cursor-pointer"
                            aria-label="Report Issue"
                        >
                            <Plus size={32} />
                        </motion.button>
                    </div>
                </div>

                {/* 4. Scorecard */}
                <motion.div whileTap={{ scale: 0.9 }}>
                    <Link href="/scorecard" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/scorecard' ? "text-blue-600" : "text-gray-400")}>
                        <Map size={24} strokeWidth={pathname === '/scorecard' ? 2.5 : 2} />
                        <span className="font-medium">City Insights</span>
                    </Link>
                </motion.div>

                {/* 5. Profile */}
                <motion.div whileTap={{ scale: 0.9 }}>
                    <Link href="/profile" className={clsx("flex flex-col items-center w-16 gap-1 transition-colors", pathname === '/profile' ? "text-blue-600" : "text-gray-400")}>
                        <User size={24} strokeWidth={pathname === '/profile' ? 2.5 : 2} />
                        <span className="font-medium">Profile</span>
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}

// Memoized: Shell owns isReportDialogOpen state; without memo, every dialog
// open/close re-renders BottomNav even though its props never changed.
export default React.memo(BottomNav);

