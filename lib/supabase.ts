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
        // Disable Supabase Auth — Firebase Auth is the sole auth provider.
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    }
);
