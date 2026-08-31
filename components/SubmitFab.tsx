'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ReportIssueDialog from './ReportIssueDialog';
import AuthModule from './AuthModule';
import { tapScale } from '@/lib/motion';

export default function SubmitFab() {
    const { user } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);

    const handleClick = () => {
        if (!user) {
            setIsAuthOpen(true);
        } else {
            setIsDialogOpen(true);
        }
    };

    return (
        <>
            <motion.button
                {...tapScale.fab}
                onClick={handleClick}
                className="md:hidden fixed bottom-20 right-4 bg-primary text-white p-4 rounded-full shadow-lg shadow-blue-500/25 z-40 flex items-center justify-center cursor-pointer"
                aria-label="Report Issue"
            >
                <Plus size={28} strokeWidth={2.5} />
            </motion.button>

            <ReportIssueDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
            />

            <AuthModule
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                triggerAction="to report an issue"
            />
        </>
    );
}

