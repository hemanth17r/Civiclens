import { NextRequest } from 'next/server';
import { POST } from '@/app/api/profile/create/route';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyIdToken, mockRunTransaction } = vi.hoisted(() => {
    return {
        mockVerifyIdToken: vi.fn(),
        mockRunTransaction: vi.fn(),
    };
});

// Mock the firebase-admin module
vi.mock('@/lib/firebase-admin', () => {
    return {
        admin: {
            auth: () => ({
                verifyIdToken: mockVerifyIdToken,
            }),
            firestore: Object.assign(() => ({
                doc: vi.fn(),
                collection: vi.fn(),
                runTransaction: mockRunTransaction,
            }), {
                FieldValue: {
                    serverTimestamp: vi.fn(() => 'mock-timestamp'),
                }
            })
        },
        db: {}
    };
});

function createRequest(body: any, authHeader: string | null = 'Bearer valid-token') {
    return new NextRequest('http://localhost:3000/api/profile/create', {
        method: 'POST',
        headers: authHeader ? { Authorization: authHeader } : {},
        body: JSON.stringify(body),
    });
}

describe('POST /api/profile/create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 if missing auth header', async () => {
        const req = createRequest({ handle: 'testuser' }, null);
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('returns 401 if token is invalid', async () => {
        const req = createRequest({ handle: 'testuser' }, 'Bearer invalid-token');
        mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
        
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('returns 400 if handle is invalid', async () => {
        const req = createRequest({ handle: 't@st' }, 'Bearer valid-token');
        mockVerifyIdToken.mockResolvedValue({ uid: '123' });
        
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('returns 201 on success', async () => {
        const req = createRequest({ handle: 'valid_user' }, 'Bearer valid-token');
        mockVerifyIdToken.mockResolvedValue({ uid: '123' });
        mockRunTransaction.mockImplementation(async (cb: any) => {
            // Mock successful execution
        });
        
        const res = await POST(req);
        expect(res.status).toBe(201);
    });

    it('returns 409 if handle is taken', async () => {
        const req = createRequest({ handle: 'taken_user' }, 'Bearer valid-token');
        mockVerifyIdToken.mockResolvedValue({ uid: '123' });
        mockRunTransaction.mockRejectedValue(new Error('HANDLE_TAKEN'));
        
        const res = await POST(req);
        expect(res.status).toBe(409);
    });

    it('returns 200 if user already has handle', async () => {
        const req = createRequest({ handle: 'existing_user' }, 'Bearer valid-token');
        mockVerifyIdToken.mockResolvedValue({ uid: '123' });
        mockRunTransaction.mockRejectedValue(new Error('ALREADY_HAS_HANDLE'));
        
        const res = await POST(req);
        expect(res.status).toBe(200);
    });
});
