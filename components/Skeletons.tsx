import React from 'react';
import { clsx } from 'clsx';

export function Skeleton({ className }: { className?: string }) {
    return (
        <div className={clsx("animate-pulse bg-gray-200 rounded-md", className)} />
    );
}

export function FeedCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 mb-6 overflow-hidden">
            <div className="flex items-center p-3 gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex flex-col gap-1">
                    <Skeleton className="w-24 h-3" />
                    <Skeleton className="w-16 h-2" />
                </div>
            </div>
            <Skeleton className="w-full aspect-[4/5]" />
            <div className="p-3 space-y-3">
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-full h-3" />
                <Skeleton className="w-2/3 h-3" />
            </div>
        </div>
    );
}

export function ListSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="w-1/3 h-4" />
                        <Skeleton className="w-1/2 h-3" />
                    </div>
                </div>
            ))}
        </div>
    );
}
