'use client';

import dynamic from 'next/dynamic';

import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { useAuth } from '@/context/AuthContext';
import { setPendingIntent } from '@/lib/authIntents';
const ReportIssueDialog = dynamic(() => import('./ReportIssueDialog'), { ssr: false });
const AuthModule = dynamic(() => import('./AuthModule'), { ssr: false });
const OnboardingModal = dynamic(() => import('./OnboardingModal'), { ssr: false });
const PWAInstallPrompt = dynamic(() => import('./PWAInstallPrompt'), { ssr: false });
import NotificationBell from './NotificationBell';
import { motion } from 'framer-motion';
import { tapScale } from '@/lib/motion';

interface ShellProps {
    children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
    const { user, loading: authLoading } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authTrigger, setAuthTrigger] = useState('to report an issue');

    // Auto-open report dialog if user authenticated with REPORT_ISSUE intent
    useEffect(() => {
        const handleIntentExecuted = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.type === 'REPORT_ISSUE') {
                setIsReportDialogOpen(true);
            }
        };
        window.addEventListener('civiclens:intent-executed', handleIntentExecuted);
        return () => window.removeEventListener('civiclens:intent-executed', handleIntentExecuted);
    }, []);

    const handleReportClick = useCallback(() => {
        if (!user) {
            setPendingIntent({ type: 'REPORT_ISSUE' });
            setAuthTrigger('to report an issue');
            setIsAuthModalOpen(true);
        } else {
            setIsReportDialogOpen(true);
        }
    }, [user]);

    // Global listeners so child pages don't need duplicate modal instances
    useEffect(() => {
        const handleOpenReport = () => {
            handleReportClick();
        };
        const handleOpenAuth = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.trigger) {
                setAuthTrigger(customEvent.detail.trigger);
            }
            setIsAuthModalOpen(true);
        };
        window.addEventListener('civiclens:open-report', handleOpenReport);
        window.addEventListener('civiclens:open-auth', handleOpenAuth);
        return () => {
            window.removeEventListener('civiclens:open-report', handleOpenReport);
            window.removeEventListener('civiclens:open-auth', handleOpenAuth);
        };
    }, [handleReportClick]);

    const closeReportDialog = useCallback(() => setIsReportDialogOpen(false), []);

    return (
        <div className="h-screen overflow-hidden bg-white text-foreground flex flex-col md:flex-row">
            {/* Mobile: Header/Sidebar Hidden */}
            {/* Desktop: Header + Sidebar */}

            {/* Desktop Header */}
            <div className="hidden md:block fixed top-0 left-0 right-0 z-30">
                <Header
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    onReportClick={handleReportClick}
                />
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:block pt-16 h-screen sticky top-0">
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            </div>

            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white h-12 px-4 flex items-center justify-between border-b border-gray-100">
                <span className="text-lg font-semibold text-gray-900">CivicLens</span>
                <div className="flex items-center gap-2">
                    {user ? (
                        <NotificationBell />
                    ) : !authLoading ? (
                        <motion.button
                            {...tapScale.button}
                            onClick={() => setIsAuthModalOpen(true)}
                            className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors cursor-pointer"
                        >
                            Sign In
                        </motion.button>
                    ) : null}
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 w-full h-full pb-20 pt-12 md:pb-4 md:pt-16 md:pr-4 md:pl-1 transition-all duration-300 flex flex-col min-h-0">
                <div className="flex-1 bg-white rounded-t-[24px] md:rounded-[24px] overflow-hidden flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {children}
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden">
                <BottomNav onReportClick={handleReportClick} />
            </div>

            {/* Desktop Dialog (Mobile uses FAB via BottomNav) */}
            <ReportIssueDialog
                isOpen={isReportDialogOpen}
                onClose={closeReportDialog}
            />

            <AuthModule
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                triggerAction={authTrigger}
            />

            <OnboardingModal />
            <PWAInstallPrompt />
        </div>
    );
}
