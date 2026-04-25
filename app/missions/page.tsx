'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Clock, Target, Trophy, Zap, ChevronRight, Sparkles } from 'lucide-react';
import {
    getActiveMissions, getUserMissionProgress, seedMissionsForCity,
    formatTimeRemaining, type Mission, type MissionProgress
} from '@/lib/missions';
import { awardXp } from '@/lib/gamification';

export default function MissionsPage() {
    const { user, userProfile } = useAuth();
    const [missions, setMissions] = useState<Mission[]>([]);
    const [progress, setProgress] = useState<Record<string, MissionProgress>>({});
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);

    useEffect(() => {
        if (!user || !userProfile?.city) return;

        const fetchMissions = async () => {
            setLoading(true);
            try {
                const activeMissions = await getActiveMissions(userProfile.city!);
                setMissions(activeMissions);

                if (activeMissions.length > 0) {
                    const prog = await getUserMissionProgress(
                        user.uid,
                        activeMissions.map(m => m.id)
                    );
                    setProgress(prog);
                }
            } catch (e) {
                console.error('Failed to load missions:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchMissions();
    }, [user, userProfile?.city]);

    const handleSeedMissions = async () => {
        if (!userProfile?.city) return;
        setSeeding(true);
        try {
            const count = await seedMissionsForCity(userProfile.city);
            // Reload missions
            const activeMissions = await getActiveMissions(userProfile.city);
            setMissions(activeMissions);
            if (activeMissions.length > 0) {
                const prog = await getUserMissionProgress(
                    user!.uid,
                    activeMissions.map(m => m.id)
                );
                setProgress(prog);
            }
        } catch (e) {
            console.error('Failed to seed missions:', e);
        } finally {
            setSeeding(false);
        }
    };

    const getProgressPercent = (mission: Mission) => {
        const prog = progress[mission.id];
        if (!prog) return 0;
        return Math.min((prog.currentCount / mission.targetCount) * 100, 100);
    };

    const isCompleted = (mission: Mission) => {
        return progress[mission.id]?.completed === true;
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-gray-50">
                <Target size={40} className="text-gray-300 mb-4" />
                <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in to see missions</h1>
                <p className="text-gray-500 text-sm">Active missions will appear here.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-lg mx-auto px-5 pt-8 pb-5">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-orange-200">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Flash Missions</h1>
                            <p className="text-sm text-gray-500">City challenges with bonus XP</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-lg mx-auto px-4 pt-5">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-amber-500" size={28} />
                    </div>
                ) : missions.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                            <Target size={28} className="text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">No Active Missions</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            {userProfile?.city
                                ? `No missions available for ${userProfile.city} right now.`
                                : 'Set your city in your profile to see local missions.'}
                        </p>
                        {userProfile?.city && (
                            <button
                                onClick={handleSeedMissions}
                                disabled={seeding}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                            >
                                {seeding ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                {seeding ? 'Creating...' : 'Generate Missions'}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {missions.map((mission, idx) => {
                            const completed = isCompleted(mission);
                            const percent = getProgressPercent(mission);
                            const prog = progress[mission.id];

                            return (
                                <motion.div
                                    key={mission.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.08 }}
                                    className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${completed
                                        ? 'border-emerald-200 bg-emerald-50/30'
                                        : 'border-gray-100 hover:shadow-md'
                                        }`}
                                >
                                    {/* Top row */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <div
                                            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${completed ? 'bg-emerald-100' : 'bg-amber-50'
                                                }`}
                                        >
                                            {completed ? '✅' : mission.emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className={`text-sm font-bold ${completed ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                    {mission.title}
                                                </h3>
                                                <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                                                    <Zap size={12} className="fill-amber-400" />
                                                    +{mission.xpReward} XP
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">{mission.description}</p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percent}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                            className={`h-full rounded-full ${completed
                                                ? 'bg-emerald-500'
                                                : 'bg-gradient-to-r from-amber-400 to-orange-500'
                                                }`}
                                        />
                                    </div>

                                    {/* Bottom row */}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500 font-medium">
                                            {prog ? prog.currentCount : 0}/{mission.targetCount}
                                            {completed ? (
                                                <span className="ml-1.5 text-emerald-600 font-bold">Completed!</span>
                                            ) : null}
                                        </span>
                                        <span className="flex items-center gap-1 text-gray-400">
                                            <Clock size={12} />
                                            {formatTimeRemaining(mission.expiresAt)}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
