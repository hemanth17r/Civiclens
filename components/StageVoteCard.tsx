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
    userVote?: 'yes' | 'no' | null; // Keep track if the user has already voted on this
}

export default function StageVoteCard({ stage, prompt, yesWeight, noWeight, score, isVoting, onVote, userVote }: StageVoteCardProps) {
    const totalWeight = yesWeight + noWeight;
    const percentageYes = totalWeight > 0 ? Math.max(5, Math.min(95, Math.round((yesWeight / totalWeight) * 100))) : 50;
    
    // Humanized prompts based on stage key (overridden by `prompt` prop for quick-votes)
    const getPrompt = () => {
        if (prompt) return prompt;
        switch (stage.key) {
            case 'Verification Needed': return "Is this a real issue?";
            case 'Active': return "Has any action started on this?";
            case 'Action Seen': return "Is work actively being done?";
            case 'Resolved': return "Is this issue fully fixed?";
            default: return "Update status?";
        }
    };

    return (
        <div className="mt-4 p-4 rounded-xl border border-gray-100 bg-white/50 space-y-4">
            <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-gray-800">{getPrompt()}</span>
                {totalWeight > 0 && (
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Signal: {percentageYes}% Yes
                    </span>
                )}
            </div>

            {/* Confidence Bar */}
            <div className="relative h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                <div 
                    className={clsx(
                        "h-full transition-all duration-500 ease-out",
                        percentageYes > 60 ? "bg-emerald-500" : percentageYes < 40 ? "bg-rose-500" : "bg-amber-400"
                    )}
                    style={{ width: `${percentageYes}%` }}
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={() => onVote('yes')}
                    disabled={isVoting || userVote === 'yes'}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border",
                        userVote === 'yes' 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner" 
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:opacity-50"
                    )}
                >
                    {isVoting && userVote !== 'yes' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
                    Yes
                </button>
                <button
                    onClick={() => onVote('no')}
                    disabled={isVoting || userVote === 'no'}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border",
                        userVote === 'no' 
                            ? "bg-rose-50 text-rose-700 border-rose-200 shadow-inner" 
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:opacity-50"
                    )}
                >
                    {isVoting && userVote !== 'no' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsDown size={16} />}
                    No
                </button>
            </div>
            
            {/* Hidden debug score for verifying buffer logic */}
            {process.env.NODE_ENV === 'development' && (
                <div className="text-[10px] text-gray-400 font-mono text-center">
                    Score: {score.toFixed(3)} | Need &gt;2 to advance / &lt;-2 to revert
                </div>
            )}
        </div>
    );
}
