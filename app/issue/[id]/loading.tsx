import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function IssueDetailLoading() {
    return (
        <div className="bg-white min-h-screen pb-20">
            {/* Top Bar with Back Button */}
            <div className="fixed top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                <div className="bg-white/20 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center text-white">
                    <ArrowLeft size={22} />
                </div>
            </div>

            {/* Hero Image Skeleton */}
            <div className="h-72 w-full bg-gray-200 animate-pulse" />

            {/* Content Container (Expanded for maximum space) */}
            <div className="px-3 sm:px-4 max-w-2xl mx-auto -mt-8 relative z-10 space-y-4">
                {/* Title & metadata skeleton */}
                <div className="bg-white/90 backdrop-blur-xs p-3.5 rounded-2xl shadow-2xs space-y-2">
                    <div className="h-7 w-4/5 bg-gray-200 animate-pulse rounded-lg" />
                    <div className="flex gap-3">
                        <div className="h-4 w-28 bg-gray-100 animate-pulse rounded" />
                        <div className="h-4 w-20 bg-gray-100 animate-pulse rounded" />
                    </div>
                </div>

                {/* Lifecycle Card Skeleton (Clean expanded tiles) */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-4 animate-pulse">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                        <div className="space-y-1.5">
                            <div className="h-4 w-32 bg-gray-200 rounded" />
                            <div className="h-3 w-48 bg-gray-100 rounded" />
                        </div>
                        <div className="h-6 w-24 bg-gray-100 rounded-full" />
                    </div>

                    {/* Stage Placeholder Tiles */}
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3 py-1.5">
                            <div className="w-7 h-7 bg-gray-200 rounded-full shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 w-28 bg-gray-200 rounded" />
                                <div className="h-2.5 w-44 bg-gray-100 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
