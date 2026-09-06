import { hypeIssue, saveIssue, voteOnStatus, IssueStatusState } from './issues';
import { followUser } from './followers';
import { User } from 'firebase/auth';

export type AuthPendingIntent =
    | { type: 'HYPE'; issueId: string }
    | { type: 'SAVE'; issueId: string }
    | { type: 'REPORT_ISSUE' }
    | { type: 'VOTE_STATUS'; issueId: string; stageKey: IssueStatusState; voteType: 'yes' | 'no' }
    | { type: 'FOLLOW'; targetUserId: string };

const INTENT_STORAGE_KEY = 'civiclens_pending_auth_intent';

/**
 * Persist a user action intent to sessionStorage before opening the auth wall.
 */
export function setPendingIntent(intent: AuthPendingIntent): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(intent));
    } catch (e) {
        console.warn('Failed to save pending auth intent:', e);
    }
}

/**
 * Retrieve the pending intent if one was stored.
 */
export function getPendingIntent(): AuthPendingIntent | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(INTENT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Clear the pending intent from storage.
 */
export function clearPendingIntent(): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
    } catch { }
}

/**
 * Execute a stored intent on behalf of the newly authenticated user,
 * then notify all active UI subscribers via a custom event.
 */
export async function executePendingIntent(user: User): Promise<void> {
    const intent = getPendingIntent();
    if (!intent || !user) return;

    // Clear early to avoid double execution on strict-mode or multiple listeners
    clearPendingIntent();

    try {
        switch (intent.type) {
            case 'HYPE':
                await hypeIssue(intent.issueId, user.uid);
                break;
            case 'SAVE':
                await saveIssue(intent.issueId, user.uid);
                break;
            case 'VOTE_STATUS':
                await voteOnStatus(intent.issueId, user.uid, intent.stageKey, intent.voteType);
                break;
            case 'FOLLOW':
                await followUser(user.uid, intent.targetUserId);
                break;
            case 'REPORT_ISSUE':
                // UI only: dialog open triggered via event
                break;
        }

        // Broadcast to all mounted components that the action has completed
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('civiclens:intent-executed', {
                    detail: intent,
                })
            );
        }
    } catch (err) {
        console.error('Failed to execute pending auth intent:', err);
    }
}
