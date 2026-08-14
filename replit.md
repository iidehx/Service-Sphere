# Service App

A two-sided marketplace mobile app (Android-first) where Employers post jobs and Providers accept, negotiate quotes via in-app chat, complete the work, and mutually review each other.

## Run & Operate

- **Expo workflow**: `pnpm --filter @workspace/service-app run dev` (managed by the `artifacts/service-app: expo` workflow)
- `pnpm run typecheck` — full typecheck across all packages
- After changing any `EXPO_PUBLIC_*` secret, **restart the Expo workflow** — these variables are baked into the bundle at build time.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, React Native 0.81.5, expo-router v6
- Auth: Firebase Auth (email/password + Google via expo-auth-session)
- Database: Cloud Firestore (JS SDK v12)
- Storage: Firebase Storage (profile photos)
- State: React Context + dual-mode data layer (see Architecture decisions)

## Where things live

- `artifacts/service-app/` — the entire mobile app artifact
- `artifacts/service-app/context/ServiceAppContext.tsx` — all data operations + React context
- `artifacts/service-app/context/types.ts` — all TypeScript types, constants, seed data
- `artifacts/service-app/lib/firebase.ts` — Firebase init (v12 with RN persistence workaround)
- `artifacts/service-app/components/AppPrimitives.tsx` — shared UI components
- `artifacts/service-app/firestore.rules` — Firestore security rules (publish to Firebase Console)
- `artifacts/service-app/FIREBASE_SETUP.md` — step-by-step Firebase console walkthrough

## Architecture decisions

- **Dual-mode data layer**: Firebase activates when all six `EXPO_PUBLIC_FIREBASE_*` env vars are present (`isFirebaseConfigured` in `lib/firebase.ts`); otherwise the app runs in demo mode on AsyncStorage (key `@service-app-state-v2`) with seeded demo accounts. No code change needed to switch — just add the secrets and restart.
- **EXPO_PUBLIC_* vars are baked at bundle time**: changing secrets requires a workflow restart (not just a hot-reload) before the app picks them up.
- **Firebase v12 RN persistence**: `getReactNativePersistence` is accessed via a guarded `require()` with `getAuth` fallback because v12 changed the import path.
- **No composite Firestore indexes**: all queries use single fields only (`orderBy createdAtMs`, `where participants array-contains`), so no index configuration is needed in Firebase Console.
- **RN Web ignores `Alert.alert`**: replaced with a custom `ConfirmDialog` modal (`components/ConfirmDialog.tsx`) for all destructive confirmations.
- **Job lifecycle**: open → negotiating → accepted (both sides accept quote) → completed. Payment tracked separately as pending / paid / refunded (manual, no Stripe).
- **5% platform fee** charged to the provider: `providerReceives = agreedPrice × 0.95`.

## Product

- Employers post jobs in 10 categories; providers browse and accept them.
- Quote negotiation happens in real-time chat; both sides must accept before the job is confirmed.
- Mutual reviews with star ratings, sub-ratings (quality / communication / punctuality), and tags.
- In-app notifications for quotes, job updates, and reviews.
- Report/block system; saved jobs; public provider profiles.

## User preferences

- Android-first (Expo Go compatible); no native dev build required for core flows.
- Theme: navy `#1E3A5F`, slate `#64748B`/`#0F172A`, amber `#D97706`, bg `#F8FAFC`, white cards, ~10px radius.
- Plain, feature-focused summaries — no emoji, no overly technical language.

## Gotchas

- Google sign-in works in the web preview only. Android needs a native dev build.
- After adding/changing `EXPO_PUBLIC_*` secrets, always restart the Expo workflow.
- Firestore rules in `firestore.rules` must be manually published in the Firebase Console (Build → Firestore → Rules tab). They are NOT auto-deployed.
- FCM push notifications are deferred (need a native dev build); in-app notifications work in all modes.
- Metro watcher sometimes throws ENOENT after package installs — a workflow restart fixes it.

## Pointers

- Firebase setup walkthrough: `artifacts/service-app/FIREBASE_SETUP.md`
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
