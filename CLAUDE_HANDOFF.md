# Claude project handoff — Service Sphere

This is a working handoff for continuing development in this repository. It describes the checked-in code and the current known Replit/Firebase state; verify live cloud configuration before relying on it.

## Read this first

- **Never put secret values in this repository or in chat.** The root `secrets` file is only a safe inventory of variable names, not a place to paste values. Transfer credentials through Replit Secrets or the secret/environment manager for the Claude runtime.
- Do not replace Firebase, change the database, or loosen security rules as a shortcut. The existing Firebase/Firestore/Storage setup is part of the product.
- Read `replit.md`, `artifacts/service-app/FIREBASE_SETUP.md`, and the relevant current source before changing behavior. Some older README/setup text is stale; see “Known documentation drift.”
- Firestore and Storage rules in the repository are not automatically published to Firebase. Emulator tests do not publish them.
- Preserve the two roles exactly as lowercase `employer` and `provider`.
- Treat current source and Replit Tasks as authoritative over this handoff if they disagree.

## Product

Service Sphere is a two-sided local-services marketplace. Employers post jobs; providers find suitable work, submit quotes, negotiate in job chat, complete work, and both sides may review one another.

Core product rules:

- Email/password is the primary login. Google sign-in is also present; the web flow works, but Android requires a native development/production build rather than Expo Go.
- Profiles have roles (`employer` or `provider`) and must be complete before some marketplace actions, including emergency matching.
- A normal job progresses through `open` → `negotiating` → `accepted` → `completed`. Both participants accept the quote before the normal job becomes accepted.
- Payment state is tracked as `pending`, `paid`, or `refunded`, but payments are **manual**. There is no Stripe or other payment processor integration.
- The platform fee is 5%; provider net is calculated as the agreed price × 0.95.
- Employers, rather than providers, currently mark a normal accepted job complete. Providers have a separate affordance for adding after/completion photos.

## Repository and runtime

This is a pnpm monorepo. The primary app is `artifacts/service-app/`.

- `artifacts/service-app/` — Expo / React Native app, Firebase client, rules, Cloud Functions, app tests.
- `artifacts/api-server/` — Express service for Expo push-token persistence and push dispatch.
- `artifacts/admin-dashboard/` — admin web app.
- `artifacts/mockup-sandbox/` — design/component preview artifact.
- `lib/` — shared workspace libraries, including API and database packages.
- `scripts/post-merge.sh` — post-merge setup hook configured by `.replit`.

Configured Replit workflows (already present; do not create duplicates):

- `artifacts/service-app: expo` — `pnpm --filter @workspace/service-app run dev`
- `artifacts/api-server: API Server` — `pnpm --filter @workspace/api-server run dev`
- `artifacts/admin-dashboard: web`
- `artifacts/mockup-sandbox: Component Preview Server`

Useful commands from the workspace root:

```bash
pnpm install
pnpm run typecheck
pnpm --filter @workspace/service-app run typecheck
pnpm --filter @workspace/service-app run test:rules
pnpm --filter @workspace/service-app run test:password
pnpm --filter @workspace/service-app run test:job-fit
pnpm --filter @workspace/service-app-functions run test
```

`test:rules` runs the local Firestore emulator. It does not touch or deploy to the live Firebase project. The functions package targets Node 20; the main Replit workspace is configured with Node 24.

When an `EXPO_PUBLIC_*` value changes, restart the Expo workflow: Expo inlines these variables at bundle time. Restart the relevant workflow after code/package/toolchain/run-command changes, then check its logs.

## Architecture

### Mobile app and state

- Expo SDK 54, React Native 0.81, TypeScript, Expo Router v6.
- Routes are file-based in `artifacts/service-app/app/`. The `(tabs)` group contains the main jobs, browse, messages, providers, and profile surfaces.
- Global marketplace state and data operations live in `artifacts/service-app/context/ServiceAppContext.tsx`.
- Types, role/job models, constants, demo fixtures, and validation helpers are in `artifacts/service-app/context/types.ts`.
- Shared UI primitives are in `artifacts/service-app/components/AppPrimitives.tsx`.
- Firebase initialization is in `artifacts/service-app/lib/firebase.ts`.

The app has two data modes:

1. **Firebase mode** when Firebase client configuration is set.
2. **Demo mode** backed by AsyncStorage (storage key `@service-app-state-v2`) when Firebase is not configured. The demo data and auth behavior are for previews only; they are not production security boundaries.

The code currently checks for `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`, and `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` to decide whether Firebase is configured. Set all six Firebase config variables listed in `secrets` anyway; Storage and Firebase app initialization also need the bucket and sender ID.

For native Firebase Auth, the code uses a guarded React Native persistence import with an Auth fallback. Firestore uses long-polling autodetection for proxy compatibility.

### Cloud data and security

Main Firestore collections and subcollections include:

- `users/{uid}` — private profile, preferences, saved items, blocked users.
- `publicProfiles/{uid}` — discoverable marketplace profile projection.
- `jobs/{jobId}` — public/coarse job data and lifecycle.
- `jobs/{jobId}/private/location` — precise address/place details.
- `jobs/{jobId}/private/photos` — before/after photo URL arrays.
- `jobs/{jobId}/review/{reviewerId}` and `jobs/{jobId}/employerReview/{reviewerId}` — immutable participant reviews.
- `chats/{chatId}/messages/{messageId}` — job chat.
- `notifications/{notificationId}`, `reports/{reportId}`, plus internal emergency request, reservation, rate-limit, tombstone, and admin documents.

`artifacts/service-app/firestore.rules` is the source of truth for Firestore authorization. Important constraints:

- A precise job address is separate from the marketplace-readable job document. Employer can access it; an assigned provider can access it only after acceptance/completion.
- Job photo metadata is also separate from the main job document. Current source rules require an active, complete profile for reads/writes. The employer can write only `beforePhotoUrls`; the assigned provider can write only `afterPhotoUrls` after acceptance/completion. Each side's list is capped at six. Photo metadata is readable by the employer and assigned provider, including a provider who is still negotiating.
- The public job location is deliberately coarse: a bare five-digit ZIP or a plain neighborhood/area label. Never put a street address there.
- Coarse coordinates use integer hundredths of a degree (`latE2`, `lngE2`) and are intended for approximate-area distance matching, not exact location sharing.
- Access notes/permit/certification requirements are stored as `specialRequirements` on the job; the current UI and rules cap the string at 1,000 characters.
- Keep collection-list queries constrained to fields that Firestore rules can prove; a broad collection query may be denied even if the UI intends to filter results later.
- Rating summaries are server-maintained; do not make client writes to aggregate ratings.
- The user-requested email verification gate is currently disabled in `lib/firebase.ts` (`EMAIL_VERIFICATION_REQUIRED = false`). The verification screen and logic remain in the app. Confirm the published rules match current source rather than assuming they do.

**Storage URL caveat:** `storage.rules` requires Firebase authentication to read paths, but the app obtains and stores Firebase `getDownloadURL()` URLs in the private Firestore photo document. Such download URLs are bearer links: anyone who obtains a URL may be able to fetch the image without passing the Storage read rule. Firestore rules restrict who learns the URL through the app; they do not make a leaked URL non-transferable. Reassess this if the product requires strict URL-level privacy (for example, store object paths and fetch authenticated media only after participant authorization).

**Upload robustness caveat:** Photo additions read the current list, upload files, then replace that side's array with a merged list. There is no transaction protecting simultaneous additions from two devices, and files uploaded before a later upload/metadata failure are not cleaned up. Review concurrent append behavior and partial-failure cleanup before promising loss-free retries.

### Firebase Cloud Functions

Source: `artifacts/service-app/functions/src/`. Firebase Admin SDK uses the deployed Functions runtime identity; do not add a service-account JSON file to the repository.

Callables:

- `deleteAccount` — authenticated user only; requires recent sign-in (within five minutes). Creates a deletion tombstone, deletes the Firebase Auth identity, and removes private/public profiles. The Auth deletion trigger retries profile cleanup if the callable is interrupted. The tombstone stays to stop stale sessions recreating profile docs.
- `requestEmergencyMatch` — takes `{ jobId }`; checks employer ownership, complete/active profile, job state, future time and coarse coordinates; finds one opted-in, available provider; rate-limits employer requests; reserves provider and sends an in-app notification.
- `respondToEmergencyRequest` — takes `{ jobId, response: "accept" | "decline" }`; only the provider selected for the pending request can respond. Acceptance creates a chat and moves the job into negotiation.

Triggers/scheduled functions:

- `cleanDeletedAccountProfiles` — Firebase Auth deletion cleanup trigger.
- `expireEmergencyRequests` — scheduled every minute; transactionally expires pending requests and frees provider reservations.
- `aggregateProviderRating` — trigger on `jobs/{jobId}/review/{reviewerId}`.
- `aggregateEmployerRating` — trigger on `jobs/{jobId}/employerReview/{reviewerId}`.

### Express API and external API calls

The Express API is mounted under `/api` in `artifacts/api-server/src/app.ts`:

- `GET /api/healthz` — health check.
- `POST /api/notifications/register-token` — JSON `{ "token": "<Expo push token>" }`; requires `Authorization: Bearer <Firebase ID token>`. Stores one Expo token per Firebase UID in Postgres, not Firestore. Responds with 401/400/503 for auth, validation, or DB failure.
- `POST /api/notifications/send` — JSON `{ "event": "<event>", "jobId": "<id>" }`; same Firebase bearer auth. Supported events: `job_accepted`, `quote_proposed`, `quote_accepted`, `quote_declined`, `payment_updated`, `payment_refunded`, `job_completed`, `review_submitted`. Server reads the job using the caller's Firebase token, validates role/current state, derives recipient/content, applies idempotency, then sends via Expo Push Service. The client must not supply arbitrary recipient or message content.

The server verifies bearer tokens through Firebase Identity Toolkit (`accounts:lookup`) using `EXPO_PUBLIC_FIREBASE_API_KEY`, and reads caller-authorized Firestore documents via the Firestore REST API. Push delivery calls `https://exp.host/--/api/v2/push/send`.

The API server needs `DATABASE_URL` for its Postgres-backed push-token tables. `PORT` is mandatory for the server process. `EXPO_PUBLIC_DOMAIN` is the mobile app's API host used for notification requests; use the Replit-provided value/production routing rather than hardcoding a local host into app code.

There is no payment API. No maps/geocoding provider is currently integrated; coordinates are coarse values supplied by the app's location flow and should not be treated as exact geocoded addresses.

## Shipped product capabilities

- Email/password authentication and web Google sign-in; role selection and profile onboarding.
- Employer job posting and provider job browsing/claiming, quotes, two-sided quote acceptance, chat, completion, manual payment status, and mutual reviews.
- In-app notifications; push token registration/send infrastructure exists, but native push requires correct EAS configuration and a native build.
- Employer/provider profiles, provider browse/search, saved jobs/providers, block/report, and help content.
- Coarse public location and participant-restricted precise address.
- Optional access/permit/certification requirements on jobs.
- Client-side signup password policy: at least 12 characters, uppercase, lowercase, number, and symbol. This is not sufficient by itself against another Firebase client; see open task below.
- Provider-fit filtering: category, approximate distance when both parties have usable coarse coordinates, and a best-effort natural-language schedule fit. Unknown/missing distances and unknown schedules are tracked by the filter logic.
- Emergency matching: provider opt-in, available status, matching category, fresh availability (24 hours), coarse distance up to 50 miles, schedule compatibility, and no overlapping active job within two hours. Requests expire after 15 minutes; direct requests are rate-limited and provider reservations prevent concurrent assignment.
- Before and after job photos: up to six per side, picked with `expo-image-picker`, uploaded to Firebase Storage, referenced in a private Firestore doc, and displayed on participant job details. Employer attaches before photos during posting; provider adds after photos after acceptance/completion. The employer remains the actor that marks a normal job complete.

## Environment variables and credentials

The root `secrets` file contains only names and safe handling instructions. It intentionally contains **no secret values**. Required values must be supplied by the Replit Secrets system or the destination runtime's secret manager:

- Firebase web app config: `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`.
- Google web OAuth client ID: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- EAS build authentication: `EXPO_TOKEN` (credential; never commit or send in chat).
- `SESSION_SECRET` exists in the Replit secret inventory, but a search of the current Service App/API server source found no direct use. Verify its consumer before carrying it over.

Other runtime configuration (not all are credentials):

- `DATABASE_URL` — required for the API server's Postgres DB.
- `PORT` — required by API server; Replit provides it for workflows.
- `EXPO_PUBLIC_DOMAIN` — API server host consumed by the app.
- `EXPO_PUBLIC_EAS_PROJECT_ID` — EAS project UUID used when registering native Expo push tokens; it is not itself a secret. Current task board has an EAS setup item.
- `REPLIT_DEV_DOMAIN`, `REPLIT_EXPO_DEV_DOMAIN`, `REPL_ID`, `REPLIT_INTERNAL_APP_DOMAIN`, `NODE_ENV`, and `LOG_LEVEL` are runtime/platform values. Do not hardcode their current values.

Firebase client configuration variables are compiled into the app bundle because of the `EXPO_PUBLIC_` prefix. They are client configuration, not Admin SDK credentials, but still transfer/configure them only through the proper environment mechanism. Never place Firebase Admin credentials, OAuth secrets, tokens, passwords, or database connection strings in `CLAUDE_HANDOFF.md`, `secrets`, source files, or chat.

### Transfer checklist

- Give Claude access to the complete repository, not just the Expo app folder; workspace libraries and the supporting API server are used by the app.
- If continuing against the same live system, retain the existing Firebase project, Auth accounts, Firestore data, and Storage bucket. Cloning code does not migrate those services or their data.
- The destination environment needs the listed variables configured securely, and an authorized human/runtime needs Firebase Console/CLI access for rules and Functions deployment.
- Preserve Expo/EAS account/project access and signing/build configuration. A new checkout does not automatically inherit EAS permissions or signing credentials.
- Point the API server at the correct existing Postgres database, or plan an explicit data migration if the hosting environment changes. Do not silently create a new DB and assume push tokens transferred.
- Recheck web authorized domains, API host routing, and published URLs after changing hosting. Never confuse the Replit development domain with the published production URL.
- Check whether the password-enforcement task is still running before editing its files.

## Current state and known blockers

Last known verification after the recent feature merges:

- `pnpm --filter @workspace/service-app run typecheck` passed.
- `pnpm --filter @workspace/service-app run test:rules` passed all 27 Firestore rules tests.
- The app preview loaded without a blank screen.
- Browser testing of before-photo picking confirmed that the file picker accepted an image and showed a thumbnail/removal affordance. The live end-to-end post was **not** successful: the form showed a friendly Firestore “Permission denied. Make sure the Firestore security rules are published.” message before a job detail was reached. Therefore it did not verify a live photo upload.
- The Firebase project's published rules have previously been reported stale versus repository rules. Publishing source rules is a manual deployment/console action. Do not report production photo uploads or live job posting as verified until rules have been published and retested.
- A prior task merge reported `UNEXPECTED_DISCONNECT` during post-merge setup and workflow reconciliation. The workflows were subsequently observed running, but if future merges fail, inspect `scripts/post-merge.sh` and restart only affected configured workflows.
- Workflows were last observed running for the Expo app, API server, admin dashboard, and mockup sandbox.

### Known documentation drift

- Root `README.md` describes Expo SDK 53 and an older, smaller feature set. The current package/replit guidance is Expo SDK 54; use `artifacts/service-app/package.json` and current source.
- `artifacts/service-app/FIREBASE_SETUP.md` includes an older sample Storage rule for `avatars/{userId}/{fileName}`. The actual source of truth is `artifacts/service-app/storage.rules`, which currently uses `avatars/{fileName}` and includes job-photo paths. Do not paste the obsolete snippet into Firebase Console.
- Setup docs describe Firebase mode as needing all six config values; `lib/firebase.ts` currently uses only four values to decide whether it is configured. Populate all six rather than relying on this partial readiness check.

## Current known task-board work

Check the Replit Tasks pane for the latest status. Last known active/incomplete items included:

- Enforce strong passwords against direct Firebase clients (in progress). Current app-side validation alone can be bypassed outside the app; inspect the current implementation and existing design before extending it.
- Publish current Firestore rules so live employers can post jobs.
- Publish current Storage rules so live before/after photo uploads work.
- Verify photo selection on real Android and iPhone builds.
- Configure EAS project/build setup for production push tokens.
- Verify password-guidance accessibility on screen readers.
- Remaining marketplace work has included demo-mode privacy parity, notifications, rating accuracy/performance, onboarding reliability, and permit-note regression checks. Do not assume these are still open; check the task board first.

Recently merged into the repository: employer job privacy, onboarding, permits/requirements, client-side password guidance, job-fit filters, emergency matching, and before/after job photos. Preserve those capabilities when reconciling branches.

## Suggested first steps for Claude

1. Read this file, `replit.md`, and the focused source files for the assigned task.
2. Check git status and the Replit task board; merges may have advanced the repo since this handoff was written.
3. Never request or print secret values. Ask the user to configure them through the destination environment's secret store if needed.
4. For a Firebase production issue, compare source rules with the Firebase Console's published rules before changing application code.
5. Run the narrow unit/rules tests and typecheck for changes; use actual native builds for platform-specific image picker/push behavior.
