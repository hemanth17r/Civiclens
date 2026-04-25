import React from 'react';

const FeedSkeleton = () => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                    <div>
                        <div className="h-3 w-24 bg-gray-200 rounded mb-1"></div>
                        <div className="h-2 w-16 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>

            {/* Image Skeleton (4:5 Ratio) */}
            <div className="aspect-[4/5] w-full bg-gray-200"></div>

            {/* Actions Bar Skeleton */}
            <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="px-3 pb-4 space-y-2">
                <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
            </div>
        </div>
    );
};

export default FeedSkeleton;
