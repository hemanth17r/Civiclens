'use client';

import React, { useState } from 'react';
import IssueFeed from "@/components/IssueFeed";
import { useAuth } from "@/context/AuthContext";
import { Loader2, LogIn, FileText } from 'lucide-react';
import dynamic from 'next/dynamic';

const AuthModule = dynamic(() => import('@/components/AuthModule'), { ssr: false });

export default function MyReportsPage() {
    const { user, loading } = useAuth();
    const [isAuthOpen, setIsAuthOpen] = useState(false);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="max-w-md mx-auto py-20 px-4 text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Track Your Reports</h2>
                <p className="text-sm text-gray-500 mb-6">
                    Sign in to view all civic issues you have reported and monitor their verification status in real-time.
                </p>
                <button
                    onClick={() => setIsAuthOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-colors shadow-sm cursor-pointer"
                >
                    <LogIn size={16} /> Sign In
                </button>
                <AuthModule
                    isOpen={isAuthOpen}
                    onClose={() => setIsAuthOpen(false)}
                    triggerAction="to track your reports"
                />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Reports</h1>
                <p className="text-gray-500 text-sm mt-1">Track the lifecycle and community verification of issues you've reported.</p>
            </div>
            <IssueFeed userId={user.uid} />
        </div>
    );
}
