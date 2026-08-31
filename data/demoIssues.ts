import { Issue } from '@/lib/issues';

/**
 * Static demo issues stored directly in frontend code.
 * Used as a fallback when Firestore has 0 real reports for the active city/cluster.
 * Statically loads local images from /public/demo/ to eliminate database reads and storage queries.
 */
export const DEMO_ISSUES: Issue[] = [
    {
        id: 'demo-delhi-waste-1',
        title: 'Garbage pile on roadside',
        category: 'Waste',
        description: 'Large garbage pile spreading onto the road causing foul smell and hygiene issues. Attracting stray animals and blocking part of the lane.',
        location: 'Near Mayapuri Industrial Area, roadside',
        cityName: 'Delhi',
        cityCoordinates: {
            lat: 28.7041,
            lng: 77.1025
        },
        imageUrl: '/demo/delhi-garbage.png',
        mediaUrls: ['/demo/delhi-garbage.png'],
        userHandle: '@civiclens',
        userAvatar: 'https://lh3.googleusercontent.com/a/ACg8ocJgsE6zOVOjzY8k_L9lAmTj_ne-cIfEsDAviRjzJMT_aBtkQjM=s96-c',
        status: 'Resolved',
        votes: 3,
        commentCount: 1,
        savesCount: 0,
        createdAt: {
            toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
            seconds: Math.floor((Date.now() - 1000 * 60 * 60 * 24 * 120) / 1000),
            nanoseconds: 0
        },
        statusData: {
            verification_needed: { yesWeight: 2.2, noWeight: 0, score: 2.2 },
            active: { yesWeight: 2.2, noWeight: 0, score: 2.2 },
            action_seen: { yesWeight: 2.2, noWeight: 0, score: 2.2 },
            resolved: { yesWeight: 7.2, noWeight: 0, score: 7.2 }
        }
    },
    {
        id: 'demo-delhi-road-2',
        title: 'Large pothole on Outer Ring Road',
        category: 'Road',
        description: 'Deep pothole in middle lane causing vehicles to slow and swerve. Risky for two-wheelers, especially at night.',
        location: 'Near Mukarba Chowk Flyover',
        cityName: 'Delhi',
        cityCoordinates: {
            lat: 28.7041,
            lng: 77.1025
        },
        imageUrl: '/demo/delhi-pothole.png',
        mediaUrls: ['/demo/delhi-pothole.png'],
        userHandle: '@civiclens',
        userAvatar: 'https://lh3.googleusercontent.com/a/ACg8ocJgsE6zOVOjzY8k_L9lAmTj_ne-cIfEsDAviRjzJMT_aBtkQjM=s96-c',
        status: 'Active',
        votes: 2,
        commentCount: 1,
        savesCount: 2,
        createdAt: {
            toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
            seconds: Math.floor((Date.now() - 1000 * 60 * 60 * 24 * 120) / 1000),
            nanoseconds: 0
        },
        statusData: {
            verification_needed: { yesWeight: 4.2, noWeight: 0, score: 4.2 },
            active: { yesWeight: 2.2, noWeight: 0, score: 2.2 },
            resolved: { yesWeight: 0, noWeight: 2.2, score: -2.2 },
            action_seen: { yesWeight: 0, noWeight: 2.2, score: -2.2 }
        }
    }
];
