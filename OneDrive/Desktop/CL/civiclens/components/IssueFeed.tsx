'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import IssueCard from './IssueCard';
import { Issue, getPaginatedIssues } from '@/lib/issues';
import FeedSkeleton from './FeedSkeleton';
import { DocumentSnapshot } from 'firebase/firestore';
import { RefreshCw, Camera } from 'lucide-react';

interface IssueFeedProps {
    userId?: string;
}

export default function IssueFeed({ userId }: IssueFeedProps = {}) {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);

    const { ref, inView } = useInView();

    const loadMoreIssues = useCallback(async () => {
        if (loading || !hasMore) return;
        setLoading(true);

        const { issues: newIssues, lastVisible } = await getPaginatedIssues(lastDoc, undefined, userId);

        if (newIssues.length < 10) {
            setHasMore(false);
        }

        setLastDoc(lastVisible);
        setIssues(prev => [...prev, ...newIssues]);
        setLoading(false);
        setInitialLoad(false);
    }, [lastDoc, loading, hasMore]);

    useEffect(() => {
        // Initial load
        loadMoreIssues();
    }, []); // Run once on mount

    useEffect(() => {
        if (inView && hasMore && !loading && !initialLoad) {
            loadMoreIssues();
        }
    }, [inView, hasMore, loading, initialLoad, loadMoreIssues]);

    if (initialLoad) {
        return (
            <div className="max-w-md mx-auto pt-6">
                <FeedSkeleton />
                <FeedSkeleton />
            </div>
        );
    }

    if (issues.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <Camera size={40} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Issues Yet</h3>
                <p className="text-gray-500 max-w-xs mx-auto mb-8">
                    Be the first to report an issue in your community and earn 100 XP!
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto pt-6 pb-20">
            {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
            ))}

            {/* Infinite Scroll Trigger */}
            <div ref={ref} className="h-20 flex items-center justify-center">
                {loading && hasMore && <FeedSkeleton />}
                {!hasMore && issues.length > 0 && (
                    <p className="text-gray-400 text-sm font-medium py-8">You've reached the end! 🎉</p>
                )}
            </div>
        </div>
    );
}
