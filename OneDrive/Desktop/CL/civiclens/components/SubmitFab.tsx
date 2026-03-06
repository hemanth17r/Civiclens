'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ReportIssueDialog from './ReportIssueDialog';

export default function SubmitFab() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsDialogOpen(true)}
                className="md:hidden fixed bottom-20 right-4 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-40"
                aria-label="Report Issue"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>

            <ReportIssueDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
            />
        </>
    );
}
