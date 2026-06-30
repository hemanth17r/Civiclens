'use client';

import React, { useMemo } from 'react';
import { Star, Trophy, Zap, Award, CheckCircle2, Milestone, Lock } from 'lucide-react';
import { BADGES, type Badge } from '@/lib/gamification';

interface AchievementGalleryProps {
    userXp: number;
    userLevel: number;
    unlockedBadges: Badge[];
    currentStreak: number;
    longestStreak: number;
    totalReports: number;
    totalVerifications: number;
}

export const AchievementGallery = React.memo(function AchievementGallery({
    userXp,
    userLevel,
    unlockedBadges,
    currentStreak,
    longestStreak,
    totalReports,
    totalVerifications
}: AchievementGalleryProps) {
    // Memoize derived sets/arrays — rebuilt only when their inputs change.
    const unlockedIds = useMemo(() => new Set(unlockedBadges.map(b => b.id)), [unlockedBadges]);
    const allBadgesList = useMemo(() => Object.values(BADGES), []);

    // Memoized milestone cards — recalculated only when the user's progress values change.
    const milestones = useMemo(() => [
        {
            id: 'level_5',
            title: 'Changemaker',
            desc: 'Reach Level 5',
            icon: <Star size={24} className="text-amber-500" />,
            color: 'bg-amber-50',
            borderColor: 'border-amber-200',
            achieved: userLevel >= 5,
            progress: Math.min(100, (userLevel / 5) * 100)
        },
        {
            id: 'level_10',
            title: 'Urban Guardian',
            desc: 'Reach Level 10 (Max)',
            icon: <Trophy size={24} className="text-emerald-500" />,
            color: 'bg-emerald-50',
            borderColor: 'border-emerald-200',
            achieved: userLevel >= 10,
            progress: Math.min(100, (userLevel / 10) * 100)
        },
        {
            id: 'streak_30',
            title: 'Iron Will',
            desc: '30-Day Activity Streak',
            icon: <Zap size={24} className="text-pink-500" />,
            color: 'bg-pink-50',
            borderColor: 'border-pink-200',
            achieved: longestStreak >= 30,
            progress: Math.min(100, (longestStreak / 30) * 100)
        },
        {
            id: 'reports_50',
            title: 'Civic Leader',
            desc: 'Submit 50 Reports',
            icon: <Award size={24} className="text-blue-500" />,
            color: 'bg-blue-50',
            borderColor: 'border-blue-200',
            achieved: totalReports >= 50,
            progress: Math.min(100, (totalReports / 50) * 100)
        },
        {
            id: 'verify_100',
            title: 'Master Auditor',
            desc: 'Verify 100 Issues',
            icon: <CheckCircle2 size={24} className="text-purple-500" />,
            color: 'bg-purple-50',
            borderColor: 'border-purple-200',
            achieved: totalVerifications >= 100,
            progress: Math.min(100, (totalVerifications / 100) * 100)
        }
    ], [userLevel, longestStreak, totalReports, totalVerifications]);

    return (
        <div className="flex flex-col h-full bg-white">
            
            {/* Header section of the gallery */}
            <div className="px-6 py-8 bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-b-3xl shadow-lg relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm border border-white/30 shadow-inner">
                        <Trophy size={32} className="text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight mb-1">Your Civic Journey</h2>
                    <p className="text-blue-100/80 text-sm font-medium px-4">Track your milestones and unlocked achievements</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-10">
                
                {/* Horizontal Path / Timeline */}
                <div className="mt-8 px-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Milestone size={18} className="text-blue-600" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Achievement Path</h3>
                    </div>
                    
                    {/* Scrollable Container */}
                    <div className="relative w-full overflow-x-auto pb-6 scrollbar-hide snap-x">
                        <div className="flex items-center px-2 min-w-max">
                            {allBadgesList.map((badge, idx) => {
                                const isUnlocked = unlockedIds.has(badge.id);
                                return (
                                    <React.Fragment key={badge.id}>
                                        <div className="flex flex-col items-center justify-center snap-center px-1">
                                            {/* Badge Node */}
                                            <div className="relative group">
                                                <div 
                                                    className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-md transition-all duration-300 border-4 ${
                                                        isUnlocked 
                                                        ? 'bg-white scale-110' 
                                                        : 'bg-gray-100 scale-95 opacity-60 border-gray-200 grayscale'
                                                    }`}
                                                    style={isUnlocked ? { borderColor: badge.color, boxShadow: `0 10px 25px -5px ${badge.color}40` } : {}}
                                                >
                                                    {isUnlocked ? (
                                                        badge.emoji
                                                    ) : (
                                                        <Lock size={28} className="text-gray-400" />
                                                    )}
                                                </div>
                                                
                                                {/* Tooltip / Label */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 flex flex-col items-center w-28 opacity-100 transition-opacity">
                                                    <span className={`text-[11px] font-bold text-center leading-tight ${isUnlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                                                        {badge.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Connecting Line */}
                                        {idx < allBadgesList.length - 1 && (
                                            <div className="w-12 h-1.5 mx-1 rounded-full relative overflow-hidden bg-gray-100 mt-[-30px]">
                                                {isUnlocked && unlockedIds.has(allBadgesList[idx + 1].id) && (
                                                    <div className="absolute inset-0 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                                )}
                                                {isUnlocked && !unlockedIds.has(allBadgesList[idx + 1].id) && (
                                                    <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-blue-500 to-transparent" />
                                                )}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-4" />

                {/* Major Milestones */}
                <div className="px-5 mt-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Award size={18} className="text-purple-600" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Major Milestones</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {milestones.map(m => (
                            <div 
                                key={m.id} 
                                className={`relative p-4 rounded-2xl border-2 transition-all ${
                                    m.achieved 
                                    ? `${m.color} ${m.borderColor} shadow-sm` 
                                    : 'bg-white border-gray-100'
                                }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${m.achieved ? 'bg-white/60 shadow-sm' : 'bg-gray-50'}`}>
                                        {m.achieved ? m.icon : <Lock size={20} className="text-gray-300" />}
                                    </div>
                                    <div className="flex-1 pt-0.5">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className={`font-bold ${m.achieved ? 'text-gray-900' : 'text-gray-500'}`}>{m.title}</h4>
                                            {m.achieved && (
                                                <div className="bg-white rounded-full p-1 shadow-sm">
                                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 font-medium mb-3">{m.desc}</p>
                                        
                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${m.achieved ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                style={{ width: `${m.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
});
export default AchievementGallery;
