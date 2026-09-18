import { vi } from 'vitest';

// Provide safe defaults for Next.js and Firebase in Node test environment
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDummyKeyForUnitTestingOnly12345';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'civiclens-test';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:12345:web:67890';

// Global zero-I/O mock for client firebase instances during unit testing
vi.mock('@/lib/firebase', () => ({
    app: {},
    auth: { currentUser: null },
    db: {},
    storage: {},
    googleProvider: {},
}));
