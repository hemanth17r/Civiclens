import { describe, it, expect } from 'vitest';
import {
    getVoteWeightTier,
    getVoteWeight,
    TRUST_DEFAULT,
    TRUST_MIN,
    TRUST_MAX,
    VOTE_WEIGHT_TIERS,
} from '@/lib/trust';

describe('Trust & Reputation Engine (Small Tests)', () => {
    describe('Constants and Tier Configuration', () => {
        it('starts new users at Scout threshold (0.3)', () => {
            expect(TRUST_DEFAULT).toBe(0.3);
            const defaultTier = getVoteWeightTier(TRUST_DEFAULT);
            expect(defaultTier.name).toBe('Scout');
            expect(defaultTier.weight).toBe(2.0);
        });

        it('has valid min and max trust bounds', () => {
            expect(TRUST_MIN).toBe(0.0);
            expect(TRUST_MAX).toBe(1.0);
            expect(TRUST_MIN).toBeLessThan(TRUST_MAX);
        });

        it('has strictly ascending contiguous tiers', () => {
            for (let i = 0; i < VOTE_WEIGHT_TIERS.length - 1; i++) {
                const current = VOTE_WEIGHT_TIERS[i];
                const next = VOTE_WEIGHT_TIERS[i + 1];
                expect(next.minTrust).toBeGreaterThan(current.minTrust);
                expect(next.weight).toBeGreaterThan(current.weight);
            }
        });
    });

    describe('getVoteWeightTier', () => {
        it('maps scores to the correct civic tier', () => {
            // Observer (0.00 – 0.29)
            expect(getVoteWeightTier(0.0).name).toBe('Observer');
            expect(getVoteWeightTier(0.15).name).toBe('Observer');
            expect(getVoteWeightTier(0.29).name).toBe('Observer');

            // Scout (0.30 – 0.59)
            expect(getVoteWeightTier(0.30).name).toBe('Scout');
            expect(getVoteWeightTier(0.45).name).toBe('Scout');
            expect(getVoteWeightTier(0.59).name).toBe('Scout');

            // Guardian (0.60 – 0.89)
            expect(getVoteWeightTier(0.60).name).toBe('Guardian');
            expect(getVoteWeightTier(0.75).name).toBe('Guardian');
            expect(getVoteWeightTier(0.89).name).toBe('Guardian');

            // Architect (0.90 – 1.00)
            expect(getVoteWeightTier(0.90).name).toBe('Architect');
            expect(getVoteWeightTier(0.95).name).toBe('Architect');
            expect(getVoteWeightTier(1.00).name).toBe('Architect');
        });

        it('clamps out-of-bounds trust scores safely', () => {
            // Negative numbers clamp to minimum (Observer)
            expect(getVoteWeightTier(-0.5).name).toBe('Observer');
            expect(getVoteWeightTier(-100).name).toBe('Observer');

            // Numbers > 1.0 clamp to maximum (Architect)
            expect(getVoteWeightTier(1.5).name).toBe('Architect');
            expect(getVoteWeightTier(999).name).toBe('Architect');
        });

        it('returns expected tier styling colors', () => {
            expect(getVoteWeightTier(0.1).color).toBe('#9CA3AF');
            expect(getVoteWeightTier(0.4).color).toBe('#3B82F6');
            expect(getVoteWeightTier(0.7).color).toBe('#8B5CF6');
            expect(getVoteWeightTier(0.95).color).toBe('#10B981');
        });
    });

    describe('getVoteWeight (Confidence Scaling)', () => {
        it('returns base weight when prior votes count is 0', () => {
            expect(getVoteWeight(0.1, 0)).toBe(1.0);  // Observer base
            expect(getVoteWeight(0.4, 0)).toBe(2.0);  // Scout base
            expect(getVoteWeight(0.7, 0)).toBe(5.0);  // Guardian base
            expect(getVoteWeight(0.95, 0)).toBe(8.0); // Architect base
        });

        it('scales weight upwards with prior participation', () => {
            const baseScout = 2.0;
            // 2 votes -> scaling factor 1 + (2 * 0.1) = 1.2
            expect(getVoteWeight(0.4, 2)).toBeCloseTo(baseScout * 1.2);

            // 5 votes -> scaling factor 1 + (5 * 0.1) = 1.5
            expect(getVoteWeight(0.4, 5)).toBeCloseTo(baseScout * 1.5);
        });

        it('caps confidence scaling at 1.5x max', () => {
            const baseArchitect = 8.0;
            // 10 votes would be 2.0x without cap, but should cap at 1.5x
            expect(getVoteWeight(0.95, 10)).toBe(baseArchitect * 1.5);
            expect(getVoteWeight(0.95, 100)).toBe(baseArchitect * 1.5);
        });
    });
});
