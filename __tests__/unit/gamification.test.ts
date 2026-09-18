import { describe, it, expect } from 'vitest';
import {
    getLevelFromXp,
    getXpProgress,
    CIVIC_LEVELS,
    XP_ACTIONS,
} from '@/lib/gamification';

describe('Gamification Engine (Small Tests)', () => {
    describe('Level Thresholds & Progression', () => {
        it('starts users at Level 1 (Observer) with 0 XP', () => {
            const level = getLevelFromXp(0);
            expect(level.level).toBe(1);
            expect(level.title).toBe('Observer');
        });

        it('correctly advances through defined levels as XP increases', () => {
            expect(getLevelFromXp(99).level).toBe(1);
            expect(getLevelFromXp(100).level).toBe(2);  // Reporter
            expect(getLevelFromXp(299).level).toBe(2);
            expect(getLevelFromXp(300).level).toBe(3);  // Advocate
            expect(getLevelFromXp(600).level).toBe(4);  // Watchdog
            expect(getLevelFromXp(1000).level).toBe(5); // Changemaker
            expect(getLevelFromXp(1600).level).toBe(6); // Civic Hero
            expect(getLevelFromXp(2500).level).toBe(7); // Community Leader
            expect(getLevelFromXp(3500).level).toBe(8); // City Champion
            expect(getLevelFromXp(5000).level).toBe(9); // Urban Sentinel
            expect(getLevelFromXp(7500).level).toBe(10);// Urban Guardian
        });

        it('retains max level 10 for XP beyond 7500', () => {
            const highXp = getLevelFromXp(50000);
            expect(highXp.level).toBe(10);
            expect(highXp.title).toBe('Urban Guardian');
        });

        it('has strictly increasing XP requirements for each level', () => {
            for (let i = 0; i < CIVIC_LEVELS.length - 1; i++) {
                expect(CIVIC_LEVELS[i + 1].minXp).toBeGreaterThan(CIVIC_LEVELS[i].minXp);
                expect(CIVIC_LEVELS[i + 1].level).toBe(CIVIC_LEVELS[i].level + 1);
            }
        });
    });

    describe('getXpProgress', () => {
        it('calculates 0% progress at exact level thresholds', () => {
            // At 0 XP (start of Level 1)
            const p0 = getXpProgress(0);
            expect(p0.progress).toBe(0);
            expect(p0.currentLevelXp).toBe(0);
            expect(p0.nextLevelXp).toBe(100);

            // At 100 XP (start of Level 2)
            const p100 = getXpProgress(100);
            expect(p100.progress).toBe(0);
            expect(p100.currentLevelXp).toBe(100);
            expect(p100.nextLevelXp).toBe(300);
        });

        it('calculates accurate midpoint progress', () => {
            // Level 1 range: 0 -> 100. At 50 XP => 50%
            const p50 = getXpProgress(50);
            expect(p50.progress).toBeCloseTo(0.5);

            // Level 2 range: 100 -> 300 (range 200). At 200 XP => 50%
            const p200 = getXpProgress(200);
            expect(p200.progress).toBeCloseTo(0.5);
        });

        it('returns 1.0 progress and matches minXp at max level', () => {
            const max = getXpProgress(7500);
            expect(max.progress).toBe(1.0);
            expect(max.currentLevelXp).toBe(7500);
            expect(max.nextLevelXp).toBe(7500);

            const beyond = getXpProgress(12000);
            expect(beyond.progress).toBe(1.0);
        });
    });

    describe('XP Action Definitions', () => {
        it('defines positive rewards for productive civic actions', () => {
            expect(XP_ACTIONS.REPORT_SUBMITTED.xp).toBeGreaterThan(0);
            expect(XP_ACTIONS.REPORT_RESOLVED.xp).toBeGreaterThan(0);
            expect(XP_ACTIONS.VERIFICATION_VOTE.xp).toBeGreaterThan(0);
            expect(XP_ACTIONS.COMMENT_ADDED.xp).toBeGreaterThan(0);
            expect(XP_ACTIONS.FIRST_REPORT.xp).toBeGreaterThan(0);
            expect(XP_ACTIONS.DAILY_STREAK_BONUS.xp).toBeGreaterThan(0);
        });

        it('penalizes vote revocation by exact reciprocal amount', () => {
            expect(XP_ACTIONS.VERIFICATION_VOTE.xp).toBe(10);
            expect(XP_ACTIONS.VERIFICATION_VOTE_REVOKED.xp).toBe(-10);
        });
    });
});
