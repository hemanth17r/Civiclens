'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Route guard: wraps children and redirects non-official users to '/'.
 */
export default function OfficialGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, isOfficial } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || !isOfficial)) {
            router.replace('/');
        }
    }, [loading, user, isOfficial, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    if (!user || !isOfficial) return null;

    return <>{children}</>;
}
