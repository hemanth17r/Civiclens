import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, writeBatch, doc, serverTimestamp, arrayUnion, increment } from 'firebase/firestore';

export async function GET() {
    try {
        // 1. Fetch @ahr User ID
        const usersRef = collection(db, 'users');
        const ahrQuery = query(usersRef, where('handle', '==', '@ahr'), limit(1));
        const ahrSnapshot = await getDocs(ahrQuery);

        if (ahrSnapshot.empty) {
            return NextResponse.json({ error: 'User @ahr not found. Please ensure the account exists.' }, { status: 400 });
        }

        const ahrUserId = ahrSnapshot.docs[0].id;

        // 2. Mock Users Data
        const mockUsers = [
            {
                uid: 'mock_user_1',
                displayName: 'Priya Sharma',
                handle: '@priya_s',
                email: 'priya@example.com',
                city: 'Delhi',
                score: 450,
                photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
            },
            {
                uid: 'mock_user_2',
                displayName: 'Rahul Verma',
                handle: '@rahul_fixes',
                email: 'rahul@example.com',
                city: 'Delhi',
                score: 820,
                photoURL: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop',
            },
            {
                uid: 'mock_user_3',
                displayName: 'Anita Desai',
                handle: '@anita_d',
                email: 'anita@example.com',
                city: 'Delhi',
                score: 310,
                photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
            }
        ];

        // Seed Users
        const batch = writeBatch(db);
        for (const user of mockUsers) {
            const userRef = doc(db, 'users', user.uid);
            batch.set(userRef, {
                ...user,
                createdAt: serverTimestamp(),
            });
        }

        // 3. Mock Issues Data (Authored by Mock Users)
        const mockIssues = [
            {
                title: 'Massive Pothole on MG Road',
                description: 'This pothole has been causing severe traffic slow-downs and is a major hazard for two-wheelers, especially at night.',
                address: 'MG Road, Near Metro Station, Delhi',
                cityName: 'Delhi',
                category: 'Infrastructure',
                imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&h=400&fit=crop',
                userId: mockUsers[0].uid,
                userHandle: mockUsers[0].handle,
                userAvatar: mockUsers[0].photoURL,
                status: 'Open',
                hypes: [mockUsers[1].uid, mockUsers[2].uid, ahrUserId],
                hypeCount: 3,
                shareCount: 2,
                bookmarkCount: 1,
            },
            {
                title: 'Overflowing Garbage Dump',
                description: 'The garbage collection hasn\'t happened in 4 days. The smell is unbearable and stray dogs are tearing the bags apart.',
                address: 'Sector 4 Market Area, Delhi',
                cityName: 'Delhi',
                category: 'Sanitation',
                imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&h=400&fit=crop',
                userId: mockUsers[1].uid,
                userHandle: mockUsers[1].handle,
                userAvatar: mockUsers[1].photoURL,
                status: 'Under Review',
                hypes: [mockUsers[0].uid, ahrUserId],
                hypeCount: 2,
                shareCount: 5,
                bookmarkCount: 0,
            },
            {
                title: 'Broken Streetlight at Intersection',
                description: 'Crucial streetlight at the main four-way crossing has been out for a week. Very dangerous blind spot.',
                address: 'Ring Road Crossing, Delhi',
                cityName: 'Delhi',
                category: 'Infrastructure',
                imageUrl: 'https://images.unsplash.com/photo-1494412552100-42e4e7a74ec6?w=600&h=400&fit=crop',
                userId: mockUsers[2].uid,
                userHandle: mockUsers[2].handle,
                userAvatar: mockUsers[2].photoURL,
                status: 'In Progress',
                hypes: [mockUsers[0].uid, mockUsers[1].uid, ahrUserId],
                hypeCount: 3,
                shareCount: 1,
                bookmarkCount: 2,
            },
            {
                title: 'Water pipe leaking constantly',
                description: 'Thousands of liters of clean water are being wasted daily from this ruptured main pipe.',
                address: 'Vasant Kunj block C, Delhi',
                cityName: 'Delhi',
                category: 'Water',
                imageUrl: 'https://images.unsplash.com/photo-1623861214300-4e3edc6b2298?w=600&h=400&fit=crop',
                userId: mockUsers[0].uid,
                userHandle: mockUsers[0].handle,
                userAvatar: mockUsers[0].photoURL,
                status: 'Open',
                hypes: [ahrUserId],
                hypeCount: 1,
                shareCount: 0,
                bookmarkCount: 0,
            }
        ];

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        for (let i = 0; i < mockIssues.length; i++) {
            const issueRef = doc(collection(db, 'issues'));

            // Create timestamps spread out over the last 30 days
            const createdTime = new Date(thirtyDaysAgo.getTime() + (i * 2 * 24 * 60 * 60 * 1000));

            batch.set(issueRef, {
                ...mockIssues[i],
                createdAt: createdTime,
                updatedAt: createdTime,
                votes: mockIssues[i].hypeCount,
                // Add interactedBy array to track users who hyped/commented for the Activity Feed
                interactedBy: mockIssues[i].hypes,
                statusData: {
                    under_review: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 },
                    in_progress: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 },
                    resolved: { yesWeight: 0, noWeight: 0, requiredThreshold: 3 }
                }
            });

            // If @ahr hyped it, we want a comment too for realism
            if (mockIssues[i].hypes.includes(ahrUserId)) {
                const commentRef = doc(collection(db, `issues/${issueRef.id}/comments`));
                batch.set(commentRef, {
                    userId: ahrUserId,
                    userDisplayName: 'A Hemanth Reddy',
                    userPhotoURL: null, // or use @ahr's actual photo
                    text: ['This is unacceptable, needs fixing ASAP!', 'Thanks for reporting this.', 'I have also faced issues here.', 'Boosting this for visibility.'][i % 4],
                    createdAt: new Date(createdTime.getTime() + 3600000), // 1 hour later
                });

                // simulate other users commenting too
                const replyRef = doc(collection(db, `issues/${issueRef.id}/comments`));
                batch.set(replyRef, {
                    userId: mockUsers[(i + 1) % 3].uid,
                    userDisplayName: mockUsers[(i + 1) % 3].displayName,
                    userPhotoURL: mockUsers[(i + 1) % 3].photoURL,
                    text: 'Agreed, I\'ve forwarded this to the local authority on WhatsApp.',
                    createdAt: new Date(createdTime.getTime() + 7200000), // 2 hours later
                });
            }
        }

        // 4. Simulate Interactions on @ahr's issues
        const ahrIssuesQuery = query(collection(db, 'issues'), where('userId', '==', ahrUserId));
        const ahrIssuesSnapshot = await getDocs(ahrIssuesQuery);

        ahrIssuesSnapshot.docs.forEach((docSnap, idx) => {
            const mockUser = mockUsers[idx % 3];

            // Add hype and interactedBy
            batch.update(docSnap.ref, {
                hypes: arrayUnion(mockUser.uid),
                votes: increment(1),
                interactedBy: arrayUnion(mockUser.uid)
            });

            // Add comment
            const commentRef = doc(collection(db, `issues/${docSnap.id}/comments`));
            batch.set(commentRef, {
                userId: mockUser.uid,
                userDisplayName: mockUser.displayName,
                userPhotoURL: mockUser.photoURL,
                text: 'Great catch, boosting this.',
                createdAt: serverTimestamp(),
            });
        });

        await batch.commit();

        return NextResponse.json({ success: true, message: 'Seeded realistic data successfully!' });
    } catch (error: any) {
        console.error('Seeding error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
