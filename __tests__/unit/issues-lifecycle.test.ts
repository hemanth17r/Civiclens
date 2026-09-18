import { describe, it, expect } from 'vitest';
import {
    normalizeStatus,
    getIssueTimeMs,
} from '@/lib/issues';

describe('Issues Lifecycle & Time Utilities (Small Tests)', () => {
    describe('normalizeStatus', () => {
        it('normalizes legacy and active statuses into unified lifecycle states', () => {
            // Reported stage
            expect(normalizeStatus('Open')).toBe('Reported');
            expect(normalizeStatus('Reported')).toBe('Reported');

            // Verification Needed stage
            expect(normalizeStatus('Under Review')).toBe('Verification Needed');
            expect(normalizeStatus('Verification Needed')).toBe('Verification Needed');

            // Active stage (merged from In Progress and legacy Verified)
            expect(normalizeStatus('Verified')).toBe('Active');
            expect(normalizeStatus('In Progress')).toBe('Active');
            expect(normalizeStatus('Active')).toBe('Active');

            // Action Seen stage
            expect(normalizeStatus('Action Seen')).toBe('Action Seen');

            // Resolved stage
            expect(normalizeStatus('Resolved')).toBe('Resolved');
        });

        it('safely defaults unmapped or invalid status strings to Reported', () => {
            expect(normalizeStatus('')).toBe('Reported');
            expect(normalizeStatus('UnknownStatus')).toBe('Reported');
            expect(normalizeStatus('Archived')).toBe('Reported');
        });
    });

    describe('getIssueTimeMs', () => {
        it('returns 0 for falsy or empty inputs', () => {
            expect(getIssueTimeMs(null)).toBe(0);
            expect(getIssueTimeMs(undefined)).toBe(0);
            expect(getIssueTimeMs('')).toBe(0);
        });

        it('parses raw epoch milliseconds directly', () => {
            const now = 1700000000000;
            expect(getIssueTimeMs(now)).toBe(now);
        });

        it('parses objects with toMillis() methods (Firestore Timestamp)', () => {
            const mockTimestamp = {
                toMillis: () => 1700000000500,
            };
            expect(getIssueTimeMs(mockTimestamp)).toBe(1700000000500);
        });

        it('parses serialized timestamp objects with seconds property', () => {
            const serialized = {
                seconds: 1700000,
                nanoseconds: 0,
            };
            expect(getIssueTimeMs(serialized)).toBe(1700000 * 1000);
        });

        it('parses standard JS Date objects', () => {
            const d = new Date('2026-01-01T12:00:00Z');
            expect(getIssueTimeMs(d)).toBe(d.getTime());
        });

        it('unwraps createdAt property if nested', () => {
            const nested = {
                createdAt: 1700000123000,
            };
            expect(getIssueTimeMs(nested)).toBe(1700000123000);
        });

        it('parses valid ISO string representations', () => {
            const iso = '2026-03-15T10:30:00.000Z';
            const expected = new Date(iso).getTime();
            expect(getIssueTimeMs(iso)).toBe(expected);
        });
    });
});
