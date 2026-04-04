'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import ReportIssueDialog from './ReportIssueDialog';
import OnboardingModal from './OnboardingModal';
import NotificationBell from './NotificationBell';

interface ShellProps {
    children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
            {/* Mobile: Header/Sidebar Hidden */}
            {/* Desktop: Header + Sidebar */}

            {/* Desktop Header */}
            <div className="hidden md:block fixed top-0 left-0 right-0 z-30">
                <Header
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    onReportClick={() => setIsReportDialogOpen(true)}
                />
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:block pt-16 h-screen sticky top-0">
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            </div>

            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 h-12 px-4 flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">CivicLens</span>
                <NotificationBell />
            </div>

            {/* Main Content Area */}
            {/* Mobile: Full width, padding bottom for Nav */}
            {/* Desktop: Padding top for Header, Flex grow */}
            <main className="flex-1 w-full min-h-screen pb-20 pt-12 md:pb-0 md:pt-16 transition-all duration-300">
                <div className="h-full w-full">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden">
                <BottomNav onReportClick={() => setIsReportDialogOpen(true)} />
            </div>

            {/* Desktop Dialog (Mobile uses FAB via BottomNav) */}
            <ReportIssueDialog
                isOpen={isReportDialogOpen}
                onClose={() => setIsReportDialogOpen(false)}
            />

            <OnboardingModal />
        </div>
    );
}
