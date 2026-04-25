'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Trophy, Award } from 'lucide-react';
import type { Badge } from '@/lib/gamification';

// ═══════════════════════════════════════════════════════════════════════
// XP TOAST — shown when user earns XP
// ═══════════════════════════════════════════════════════════════════════

interface XpToastProps {
    xp: number;
    label: string;
    leveledUp?: boolean;
    newLevelTitle?: string;
    newBadges?: Badge[];
    onDone: () => void;
}

export function XpToast({ xp, label, leveledUp, newLevelTitle, newBadges, onDone }: XpToastProps) {
    useEffect(() => {
        const timer = setTimeout(onDone, 3500);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <motion.div
            initial={{ y: -80, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
        >
            <div className="flex flex-col items-center gap-2">
                {/* XP Pill */}
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 rounded-full shadow-lg shadow-orange-500/30">
                    <Zap size={18} className="fill-white" />
                    <span className="font-bold text-lg">+{xp} XP</span>
                    <span className="text-white/80 text-sm font-medium">{label}</span>
                </div>

                {/* Level Up */}
                {leveledUp && newLevelTitle && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: 'spring' }}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg shadow-purple-500/30"
                    >
                        <Trophy size={16} className="fill-white" />
                        <span className="font-bold text-sm">Level Up! {newLevelTitle}</span>
                    </motion.div>
                )}

                {/* New Badges */}
                {newBadges && newBadges.length > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                        className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-full shadow-lg shadow-emerald-500/30"
                    >
                        <Award size={16} />
                        {newBadges.map(b => (
                            <span key={b.id} className="font-bold text-sm">{b.emoji} {b.name}</span>
                        ))}
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// XP PROGRESS BAR — for profile page
// ═══════════════════════════════════════════════════════════════════════

interface XpProgressBarProps {
    xp: number;
    progress: number;    // 0.0 - 1.0
    currentLevelXp: number;
    nextLevelXp: number;
    levelColor: string;
    currentLevel?: number;
}

export function XpProgressBar({ xp, progress, currentLevelXp, nextLevelXp, levelColor, currentLevel }: XpProgressBarProps) {
    const isMax = nextLevelXp <= currentLevelXp;
    
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
                {currentLevel && !isMax ? (
                    <span className="w-full flex justify-between">
                        <span>Level {currentLevel} &rarr; {xp} / {nextLevelXp} XP</span>
                        <span>Level {currentLevel + 1}</span>
                    </span>
                ) : (
                    <>
                        <span>{xp} XP</span>
                        <span>{isMax ? 'MAX' : `${nextLevelXp} XP`}</span>
                    </>
                )}
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(progress * 100, 2)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: levelColor }}
                />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// TRUST BADGE — small indicator for trust tier
// ═══════════════════════════════════════════════════════════════════════

interface TrustBadgeProps {
    trustScore: number;
    tierName: string;
    tierColor: string;
    size?: 'sm' | 'md';
}

export function TrustBadge({ trustScore, tierName, tierColor, size = 'sm' }: TrustBadgeProps) {
    const sizeClasses = size === 'sm'
        ? 'text-[10px] px-2 py-0.5'
        : 'text-xs px-3 py-1';

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full font-bold ${sizeClasses}`}
            style={{ backgroundColor: tierColor + '18', color: tierColor }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tierColor }} />
            {tierName}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// LEVEL BADGE — shown on profile
// ═══════════════════════════════════════════════════════════════════════

interface LevelBadgeProps {
    level: number;
    title: string;
    emoji: string;
    color: string;
    size?: 'sm' | 'lg';
}

export function LevelBadge({ level, title, emoji, color, size = 'sm' }: LevelBadgeProps) {
    if (size === 'lg') {
        return (
            <div className="flex items-center gap-2">
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md"
                    style={{ backgroundColor: color + '20', border: `2px solid ${color}` }}
                >
                    {emoji}
                </div>
                <div>
                    <div className="text-xs text-gray-400 font-medium">Level {level}</div>
                    <div className="text-sm font-bold" style={{ color }}>{title}</div>
                </div>
            </div>
        );
    }

    return (
        <span
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: color + '18', color }}
        >
            {emoji} Lv.{level} {title}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// BADGE GRID — for profile page
// ═══════════════════════════════════════════════════════════════════════

interface BadgeGridProps {
    badges: Badge[];
}

export function BadgeGrid({ badges }: BadgeGridProps) {
    if (badges.length === 0) {
        return (
            <div className="text-center py-6 text-gray-400 text-sm">
                No badges yet. Keep contributing to earn them!
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-3">
            {badges.map(badge => (
                <div
                    key={badge.id}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: badge.color + '18' }}
                    >
                        {badge.emoji}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">
                        {badge.name}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// STREAK DISPLAY — for profile page
// ═══════════════════════════════════════════════════════════════════════

interface StreakDisplayProps {
    currentStreak: number;
    longestStreak: number;
}

export function StreakDisplay({ currentStreak, longestStreak }: StreakDisplayProps) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <div>
                    <div className="text-lg font-bold text-gray-900">{currentStreak}</div>
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Current</div>
                </div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="flex items-center gap-2">
                <span className="text-xl">💎</span>
                <div>
                    <div className="text-lg font-bold text-gray-900">{longestStreak}</div>
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Best</div>
                </div>
            </div>
        </div>
    );
}
