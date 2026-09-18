'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { springJelly, springSnappy } from '@/lib/motion';

export interface StageVoteCardProps {
    stage: any;
    prompt?: string;       // optional override for the question text (used by quick-vote)
    yesWeight: number;
    noWeight: number;
    score: number;
    isVoting: boolean;
    onVote: (type: 'yes' | 'no') => void;
    userVote?: 'yes' | 'no' | null; // current user's vote (null / undefined = no vote)
    isAuthor?: boolean;
}

export default function StageVoteCard({
    stage,
    prompt,
    yesWeight,
    noWeight,
    score,
    isVoting,
    onVote,
    userVote,
    isAuthor = false,
}: StageVoteCardProps) {
    const totalWeight = yesWeight + noWeight;
    const percentageYes =
        totalWeight > 0
            ? Math.max(5, Math.min(95, Math.round((yesWeight / totalWeight) * 100)))
            : 50;

    // Humanized prompts based on stage key (overridden by `prompt` prop for quick-votes)
    const getPrompt = () => {
        if (prompt) return prompt;
        switch (stage.key) {
            case 'Verification Needed': return 'Is this a genuine civic issue?';
            case 'Active':             return 'Has any official work started on this?';
            case 'Action Seen':        return 'Is work actively continuing on this?';
            case 'Resolved':           return 'Officially confirmed and resolved';
            default:                   return 'Update status?';
        }
    };

    // Determine pill position: 'yes' → left, 'no' → right, null → hidden
    const hasVote = userVote === 'yes' || userVote === 'no';

    return (
        <div className="mt-2.5 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-3">
            {/* Question + signal pill */}
            <div className="flex items-start justify-between gap-2.5">
                <span className="text-sm font-semibold text-gray-900 leading-snug">
                    {getPrompt()}
                </span>
                {totalWeight > 0 && (
                    <span className={clsx(
                        "shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight whitespace-nowrap border",
                        percentageYes >= 60
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : percentageYes <= 40
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                        {percentageYes}% Yes
                    </span>
                )}
            </div>

            {/* Confidence Bar */}
            <div className="space-y-1">
                <div className="relative h-2 w-full bg-gray-200/70 rounded-full overflow-hidden">
                    <motion.div
                        className={clsx(
                            'h-full rounded-full',
                            percentageYes >= 60
                                ? 'bg-emerald-500'
                                : percentageYes <= 40
                                ? 'bg-rose-500'
                                : 'bg-amber-400'
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentageYes}%` }}
                        transition={springSnappy}
                    />
                </div>
                {totalWeight > 0 && (
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                        <span>Community Confidence</span>
                        <span>{totalWeight} {totalWeight === 1 ? 'vote' : 'votes'}</span>
                    </div>
                )}
            </div>

            {/* Vote Buttons or Author Notice */}
            {isAuthor ? (
                <div className="p-2.5 bg-white border border-gray-200 rounded-xl text-center text-xs text-gray-500 font-medium">
                    As the author of this report, you cannot vote on its community verification.
                </div>
            ) : (
                <div className="relative flex rounded-xl overflow-hidden border border-gray-200 bg-white p-1 shadow-2xs">
                    {/* Sliding pill indicator — only visible when a vote is cast */}
                    {hasVote && (
                        <motion.div
                            layoutId={`votePill-${stage?.key || 'stage'}`}
                            className={clsx(
                                'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg pointer-events-none z-0',
                                userVote === 'yes'
                                    ? 'left-1 bg-emerald-500 shadow-xs shadow-emerald-500/30'
                                    : 'left-[calc(50%+2px)] bg-rose-500 shadow-xs shadow-rose-500/30'
                            )}
                            transition={springJelly}
                        />
                    )}

                    {/* YES button */}
                    <motion.button
                        whileTap={{ scale: isVoting ? 1 : 0.96 }}
                        onClick={() => !isVoting && onVote('yes')}
                        disabled={isVoting}
                        className={clsx(
                            'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold transition-colors duration-200 cursor-pointer rounded-lg',
                            isVoting && 'cursor-not-allowed opacity-60',
                            userVote === 'yes'
                                ? 'text-white'
                                : 'text-gray-600 hover:text-emerald-600'
                        )}
                        aria-pressed={userVote === 'yes'}
                        aria-label="Vote Yes"
                    >
                        {isVoting && userVote !== 'no' ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <ThumbsUp size={15} />
                        )}
                        Yes
                    </motion.button>

                    {/* NO button */}
                    <motion.button
                        whileTap={{ scale: isVoting ? 1 : 0.96 }}
                        onClick={() => !isVoting && onVote('no')}
                        disabled={isVoting}
                        className={clsx(
                            'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold transition-colors duration-200 cursor-pointer rounded-lg',
                            isVoting && 'cursor-not-allowed opacity-60',
                            userVote === 'no'
                                ? 'text-white'
                                : 'text-gray-600 hover:text-rose-600'
                        )}
                        aria-pressed={userVote === 'no'}
                        aria-label="Vote No"
                    >
                        {isVoting && userVote !== 'yes' ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <ThumbsDown size={15} />
                        )}
                        No
                    </motion.button>
                </div>
            )}

            {/* Hint text */}
            {hasVote && (
                <p className="text-[10px] text-gray-400 text-center -mt-1">
                    Tap the same option again to remove your vote
                </p>
            )}

            {/* Debug score — dev only */}
            {process.env.NODE_ENV === 'development' && (
                <div className="text-[10px] text-gray-400 font-mono text-center">
                    Score: {score.toFixed(3)} | Need &gt;2 to advance / &lt;-2 to revert
                </div>
            )}
        </div>
    );
}

