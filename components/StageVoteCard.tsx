import React from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export interface StageVoteCardProps {
    stage: any;
    prompt?: string;       // optional override for the question text (used by quick-vote)
    yesWeight: number;
    noWeight: number;
    score: number;
    isVoting: boolean;
    onVote: (type: 'yes' | 'no') => void;
    userVote?: 'yes' | 'no' | null; // current user's vote (null / undefined = no vote)
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
            case 'Verification Needed': return 'Is this a real issue?';
            case 'Active':             return 'Has any action started on this?';
            case 'Action Seen':        return 'Is work actively being done?';
            case 'Resolved':           return 'Is this issue fully fixed?';
            default:                   return 'Update status?';
        }
    };

    // Determine pill position: 'yes' → left, 'no' → right, null → hidden
    const hasVote = userVote === 'yes' || userVote === 'no';

    return (
        <div className="mt-4 p-4 rounded-xl border border-gray-100 bg-white/50 space-y-4">
            {/* Question + signal */}
            <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-gray-800">{getPrompt()}</span>
                {totalWeight > 0 && (
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Signal: {percentageYes}% Yes
                    </span>
                )}
            </div>

            {/* Confidence Bar */}
            <div className="relative h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={clsx(
                        'h-full transition-all duration-500 ease-out',
                        percentageYes > 60
                            ? 'bg-emerald-500'
                            : percentageYes < 40
                            ? 'bg-rose-500'
                            : 'bg-amber-400'
                    )}
                    style={{ width: `${percentageYes}%` }}
                />
            </div>

            {/* Vote Buttons with slide-pill animation */}
            <div className="relative flex rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                {/* Sliding pill indicator — only visible when a vote is cast */}
                {hasVote && (
                    <div
                        className={clsx(
                            'absolute inset-y-0 w-1/2 rounded-xl transition-all duration-300 ease-in-out pointer-events-none z-0',
                            userVote === 'yes'
                                ? 'left-0 bg-emerald-500'
                                : 'left-1/2 bg-rose-500'
                        )}
                    />
                )}

                {/* YES button */}
                <button
                    onClick={() => !isVoting && onVote('yes')}
                    disabled={isVoting}
                    className={clsx(
                        'relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-colors duration-200',
                        isVoting && 'cursor-not-allowed opacity-60',
                        !isVoting && 'active:scale-95',
                        userVote === 'yes'
                            ? 'text-white'
                            : 'text-gray-500 hover:text-emerald-600'
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
                </button>

                {/* Divider */}
                <div className={clsx(
                    'w-px self-stretch transition-opacity duration-300',
                    hasVote ? 'opacity-0' : 'bg-gray-200 opacity-100'
                )} />

                {/* NO button */}
                <button
                    onClick={() => !isVoting && onVote('no')}
                    disabled={isVoting}
                    className={clsx(
                        'relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-colors duration-200',
                        isVoting && 'cursor-not-allowed opacity-60',
                        !isVoting && 'active:scale-95',
                        userVote === 'no'
                            ? 'text-white'
                            : 'text-gray-500 hover:text-rose-600'
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
                </button>
            </div>

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
