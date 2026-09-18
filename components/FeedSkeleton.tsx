import React from 'react';

const FeedSkeleton = () => {
    return (
        <div className="bg-white border-b border-gray-100 pb-3 mb-2 md:rounded-2xl md:border md:shadow-xs md:mb-6 overflow-hidden animate-pulse w-full">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gray-200"></div>
                    <div>
                        <div className="h-3 w-24 bg-gray-200 rounded mb-1"></div>
                        <div className="h-2 w-16 bg-gray-200 rounded"></div>
                    </div>
                </div>
                <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
            </div>

            {/* Image Skeleton (4:5 Portrait Mobile / 1:1 Desktop) */}
            <div className="aspect-[4/5] sm:aspect-square w-full bg-gray-200"></div>

            {/* Actions Bar Skeleton */}
            <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                </div>
                <div className="w-6 h-6 bg-gray-200 rounded"></div>
            </div>

            {/* Content Skeleton */}
            <div className="px-3.5 pb-3 space-y-2">
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
                <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                <div className="h-2.5 w-1/3 bg-gray-200 rounded"></div>
            </div>
        </div>
    );
};

export default FeedSkeleton;
