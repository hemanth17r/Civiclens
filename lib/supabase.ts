/**
 * Supabase client — used ONLY for file/media storage.
 *
 * Architecture:
 *   Firebase Firestore  → all application data (users, issues, comments,
 *                          hypes, saves, notifications, gamification, etc.)
 *   Supabase Storage    → media uploads (issue photos/videos, profile photos,
 *                          official resolution after-images)
 *
 * Do NOT add database (table) queries here. All data logic lives in Firebase.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
        'Media uploads will fail.'
    );
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder_key',
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    }
);

/**
 * Temporarily sets the Supabase Auth session using a Firebase JWT.
 * This allows Supabase Storage RLS (Row Level Security) to enforce 'authenticated'
 * rules natively, even though Firebase handles our core authentication.
 */
export const getAuthenticatedSupabase = async (firebaseUser: any) => {
    if (!firebaseUser) return supabase;
    try {
        const token = await firebaseUser.getIdToken();
        await supabase.auth.setSession({
            access_token: token,
            refresh_token: ''
        });
    } catch (e) {
        console.error('Failed to set Supabase session with Firebase token', e);
    }
    return supabase;
};
