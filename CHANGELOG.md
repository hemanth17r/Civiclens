# Changelog

All notable changes to CivicLens are documented here.
Format: [Semantic Versioning](https://semver.org/)

---

## [0.2.0] — 2026-04-04

### Features
- **Issue Lifecycle (6-stage)** — `Reported → Verification Needed → Verified → Active → Action Seen → Resolved`
- **Trust-weighted community voting** — votes carry weight based on user trust score; net score >+2 advances stage, <−2 reverts
- **Admin approval gate** — issues start as `Reported` and require admin approval before community can vote
- **Gamification system** — XP awards, mission tracking, 4-tier badge system (Observer → Scout → Guardian → Architect)
- **Leaderboards & Scorecard** — city-based ranking with trust scores and contribution metrics
- **Civic profile pages** — public profile with activity, contributions, verifications, badges
- **Notification system** — bell + page for status updates, viral threshold alerts, admin actions
- **Admin dashboard** — approve/reject issues, moderate users (warn/block), filter by city
- **Community Verified badge** — clickable info tooltip explaining how trust-weighted voting works
- **Anti-manipulation layer** — rate limiting on reports and status votes (`lib/antiManipulation.ts`)
- **Media carousel** — multi-image upload with swipe/dots in issue reports
- **Connections/followers** — follow users, view follower/following counts
- **Official Resolution** — officials can mark issues resolved with before/after images and statement

### Fixes
- Fixed reversed admin flow: vote card now only appears AFTER admin approves (not before)
- Fixed status transition: community consensus now advances to the NEXT stage (not the current)
- Fixed `isAdmin` badge display on comments and public profiles
- Resolved Firebase Admin SDK initialization edge cases in API routes
- Fixed composite Firestore index for `userId + createdAt` query

### Security
- Removed `app/api/debug-env` route (was exposing FIREBASE env key prefix + names publicly)
- Removed `app/api/check-env` route (was exposing key lengths/prefixes/suffixes publicly)
- Removed `app/api/mock-stages` dev-only seeding route
- Added `public/uploads/`, `firebase-debug.log`, `tsc-errors.txt` to `.gitignore`
- All secrets remain in `.env.local` (never committed — covered by `.env*` gitignore rule)

### Removed
- `components/StatusVoteModal.tsx` — replaced by inline `StageVoteCard` component
- `app/api/cleanup-stale-comments/route.ts` — dev utility, not needed in production
- `app/api/seed-realistic/route.ts` — dev seeding route, removed from production

### Structure (unchanged — already clean)
- Firebase client config: `lib/firebase.ts` → env vars only
- Firebase Admin SDK: `lib/firebase-admin.ts` → `FIREBASE_SERVICE_ACCOUNT_KEY` env var
- Supabase client: `lib/supabase.ts` → `NEXT_PUBLIC_SUPABASE_*` env vars

---

## [0.1.0] — 2026-03-06

### Initial Release
- Core civic issue reporting (submit, browse, explore by city)
- Firebase Auth (Google SSO + email/password)
- Firestore database with city-based feed
- Firebase Storage for media uploads
- Hype (upvote), comment, save, share actions
- Official resolution flow
- Basic lifecycle stages (Open → Under Review → In Progress → Resolved)
