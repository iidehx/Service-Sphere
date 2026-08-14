---
name: Service App architecture decisions
description: Dual-mode Firebase/demo data layer, key quirks, and patterns used throughout the Service App mobile artifact.
---

# Service App — durable decisions and quirks

## Dual-mode data layer
The app runs in two modes, selected automatically at startup with no code change:
- **Demo mode**: data stored in AsyncStorage under `@service-app-state-v2`, seeded with 3 demo users and 3 jobs.
- **Firebase mode**: activates when all six `EXPO_PUBLIC_FIREBASE_*` env vars are present (`isFirebaseConfigured()` in `lib/firebase.ts`).

**Why:** lets the app be demoed without any Firebase setup, while production just needs secrets.

**How to apply:** `mode` is exposed from `ServiceAppContext` and used everywhere. Never hardcode Firebase calls — always branch on `mode`.

## EXPO_PUBLIC_* vars baked at bundle time
`EXPO_PUBLIC_` vars are inlined by Metro at bundle time, not at runtime. Adding or changing them requires **restarting the Expo workflow** before the app picks them up. Hot-reload is not enough.

## Firebase v12 RN persistence quirk
`getReactNativePersistence` moved in v12 — it cannot be imported directly from `firebase/auth`. The workaround in `lib/firebase.ts` uses a guarded `require()` with a `getAuth` fallback. Do not remove this guard or upgrade without testing.

## No composite Firestore indexes needed
All queries use single fields only (`orderBy('createdAtMs', 'desc')`, `where('participants', 'array-contains', uid)`). No index configuration is required in Firebase Console.

## RN Web Alert.alert is a no-op
`Alert.alert` does nothing on React Native Web. All destructive confirmations use the custom `ConfirmDialog` modal in `components/ConfirmDialog.tsx`.

## Metro ENOENT after package installs
Metro's file watcher sometimes throws ENOENT errors after `pnpm install`. A workflow restart (not just a hot-reload) clears it.

## Firestore rules must be manually published
The file `firestore.rules` is NOT auto-deployed. It must be copy-pasted and published in Firebase Console → Firestore → Rules tab. Remind the user of this after any rules change.

## proposeQuote accepted-job guard
`proposeQuote` checks `status === 'accepted'` and returns an error before allowing a new quote, preventing either party from silently reopening a confirmed agreement.
