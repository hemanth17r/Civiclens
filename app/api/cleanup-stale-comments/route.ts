import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, collectionGroup, limit } from 'firebase/firestore';

/**
 * GET /api/cleanup-stale-comments
 * Removes seed/mock comment documents created by the seed-realistic script
 * that have the real user's UID but were not genuinely authored by them.
 *
 * Identifies stale comments by: userId matches real user, but userHandle is missing
 * (the seed script doesn't set userHandle, but real addComment always does).
 */
export async function GET() {
    try {
        // Find all comment docs across all issues (no orderBy needed for cleanup)
        const q = query(
            collectionGroup(db, 'comments'),
            limit(500)
        );

        const snapshot = await getDocs(q);
        let staleCount = 0;
        const batch = writeBatch(db);

        for (const d of snapshot.docs) {
            const data = d.data();
            // Stale seed comments: have userId but NO userHandle field
            // Real comments from addComment always include userHandle
            if (data.userId && !data.userHandle) {
                batch.delete(d.ref);
                staleCount++;
            }
        }

        if (staleCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({
            success: true,
            message: `Cleaned up ${staleCount} stale seed comment(s).`
        });
    } catch (error: any) {
        console.error('Cleanup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
