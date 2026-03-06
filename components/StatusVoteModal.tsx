'use client';

import React, { useState } from 'react';
import { voteOnStatus, Issue, IssueStatusState } from '@/lib/issues';
import { useAuth } from '@/context/AuthContext';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import AuthModule from './AuthModule';

interface StatusVoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    issue: Issue;
    targetStatus: IssueStatusState;
    onVoteComplete: (newStatusData: any, newStatus?: string) => void;
}

export default function StatusVoteModal({ isOpen, onClose, issue, targetStatus, onVoteComplete }: StatusVoteModalProps) {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showAuthModal, setShowAuthModal] = useState(false);

    if (!isOpen) return null;

    const handleVote = async (vote: 'yes' | 'no') => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const res = await voteOnStatus(issue.id, user.uid, targetStatus, vote);
            if (!res.success) {
                setError('error' in res && res.error ? res.error : 'Failed to submit your input.');
            } else if ('currentStats' in res) {
                onVoteComplete(res.currentStats, res.consensusReached ? res.newStatus : undefined);
                onClose();
            }
        } catch (e: any) {
            setError(e.message || 'An error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 pb-0">
                    <h2 className="text-xl font-bold text-gray-900">Verify Status</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 pt-4 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} className="text-blue-500" />
                    </div>
                    <p className="text-gray-600 mb-6">
                        Is this issue currently <span className="font-bold text-gray-900">{targetStatus}</span>?
                        <br />
                        <span className="text-sm mt-2 block text-gray-400">
                            Updates rely on community consensus. False reports lower your trust score.
                        </span>
                    </p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => handleVote('yes')}
                            disabled={isSubmitting}
                            className={clsx(
                                "py-3.5 px-6 rounded-xl font-bold transition-colors w-full flex justify-center items-center gap-2",
                                isSubmitting ? "bg-green-100 text-green-400" : "bg-green-500 hover:bg-green-600 text-white"
                            )}
                        >
                            {isSubmitting && <Loader2 size={18} className="animate-spin" />} Yes, it is
                        </button>

                        <button
                            onClick={() => handleVote('no')}
                            disabled={isSubmitting}
                            className={clsx(
                                "py-3.5 px-6 rounded-xl font-bold transition-colors w-full flex justify-center items-center gap-2",
                                isSubmitting ? "bg-red-50 text-red-300" : "bg-red-100 hover:bg-red-200 text-red-600"
                            )}
                        >
                            No, it's not
                        </button>
                    </div>
                </div>
            </div>

            <AuthModule
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                triggerAction="to verify this status"
            />
        </div>
    );
}
