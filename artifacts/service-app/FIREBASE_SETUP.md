# Firebase setup for Service App

The app runs in **two modes** automatically:

- **Demo mode** (no setup): data lives on the device with two demo accounts. Great for previewing.
- **Firebase mode**: real accounts, real-time data across devices. Activates as soon as the
  Firebase environment variables below are set.

Follow these steps once to go live.

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Name it (e.g. `service-app`), Google Analytics optional → **Create project**.

## 2. Register a Web app

1. Project overview → the `</>` (Web) icon → nickname `service-app` → **Register app**.
2. Copy the config values shown — you'll paste them into Replit as secrets:

| Firebase config key | Replit secret name |
| --- | --- |
| `apiKey` | `EXPO_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `EXPO_PUBLIC_FIREBASE_APP_ID` |

## 3. Enable Authentication

1. Build → **Authentication** → Get started.
2. **Sign-in method** tab → enable **Email/Password**.
3. Open **Templates** → **Email address verification** and customize the sender name,
   subject, and reply address for Service App. Keep the verification link enabled.
4. In **Settings** → **Authorized domains**, add every published Service App domain
   where users may open a verification link.
5. (Optional) Enable **Google**. Then:
   - Under the Google provider, note the **Web client ID** (also visible in
     Google Cloud Console → APIs & Services → Credentials).
   - Save it in Replit as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - In Google Cloud Console → Credentials → that OAuth client → **Authorized JavaScript
     origins**, add your Replit dev URL (`https://<your-repl>.replit.dev`) and any domain
     you publish to.
   - Note: Google sign-in works in the web preview. On Android it requires a development
     build (it can't run inside Expo Go) — email/password works everywhere.

## 4. Create the Firestore database

1. Build → **Firestore Database** → Create database → **Production mode** → pick a region.
2. Open the **Rules** tab and replace the contents with the rules from
   [`firestore.rules`](./firestore.rules) in this folder → **Publish**.
3. No composite indexes are needed — the app only uses single-field queries.


### Publish the active ruleset

The file in this repository is the source of truth. Saving a local copy or using
Firestore's temporary simulator does not change the live project: the rules must be
published in the Firebase project that supplies `EXPO_PUBLIC_FIREBASE_PROJECT_ID`.

From this folder, an authenticated Firebase CLI user can publish the rules directly:

```bash
pnpm exec firebase login
pnpm exec firebase deploy --project <your-firebase-project-id> \
  --only firestore:rules --config firebase.json
```

After publishing, confirm the Firebase Console's Rules page shows a new published
version. The live job flow requires the published rules to include:

- signed-in users can read `/jobs/{jobId}`;
- only an active employer can create a job;
- the job's `employerId`, `employerName`, open status, pending payment status,
  empty review list, and required fields are validated; and
- calendar timestamps are accepted as ISO strings, while flexible and legacy
  schedule labels remain readable during the rollout.

### What the rules protect

- `/users/{uid}` is private to its owner. It contains the email address, saved jobs/providers,
  blocked users, and notification preferences.
- `/publicProfiles/{uid}` contains only the fields needed to show employers and providers in
  the marketplace. Any signed-in user may read this collection.
- Jobs, chat membership, messages, notifications, reports, reviews, quotes, payments, and
  lifecycle updates are checked for the correct participant, role, fields, and transition.
- Rating summaries are **not writable by the mobile client**. The deployed Cloud Functions
  trigger recomputes each recipient's average, count, and five most recent reviews from
  immutable review documents, then mirrors the same summary to private and public profiles.

### Existing accounts

The app automatically creates a matching `/publicProfiles/{uid}` document the next time an
existing user signs in. Ask active employers and providers to open the updated app once after
publishing the rules before relying on provider search or starting a new direct chat.

### Email verification and account deletion

- New email/password accounts receive Firebase's built-in verification email and cannot use
  the marketplace until the verification link is opened.
- Existing email/password accounts that have not verified their email see the same verification
  screen after signing in. They can resend the email, then use **I've verified my email** to
  refresh their status.
- Deleting a document in Firestore does **not** delete the matching Firebase Authentication
  account, so it does not free the email address for another registration. Use the app's
  **Profile → Delete account** action instead; it removes both Auth and the private/public
  Firestore profile documents. The server temporarily blocks all sessions for the removed UID,
  and its Auth-deletion trigger finishes profile cleanup if a deletion request is interrupted.
- The delete action is implemented as a Firebase Function. Publish the rules and functions
  after deploying this app version, or deletion will show an availability message. The deploy
  automatically builds the function first:

  ```bash
  pnpm exec firebase deploy --only firestore:rules,functions --config artifacts/service-app/firebase.json
  ```

## 5. Enable Storage (profile photos)

1. Build → **Storage** → Get started → same region.
2. Rules tab → paste and publish:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 3 * 1024 * 1024;
    }
  }
}
```

## 6. Add the secrets in Replit

Add each `EXPO_PUBLIC_*` value from steps 2–3 as a Replit secret, then **restart the
Expo workflow**. `EXPO_PUBLIC_` variables are baked into the app bundle at build time,
so a restart is required for changes to take effect.

That's it — the auth screen will stop showing the demo accounts and start using real
Firebase accounts.

## 7. Deploy rating aggregation functions

The repository includes two Firestore create triggers under
[`functions/`](./functions): one for an employer's provider review and one for a
provider's employer review. Both run with Firebase Admin privileges after a review is
created, so they can update the protected `ratingAvg`, `ratingCount`, and
`recentReviews` fields without granting that permission to mobile clients.

From this folder, deploy the rules and functions:

```bash
pnpm --filter @workspace/service-app-functions run build
pnpm exec firebase deploy --only firestore:rules,functions --config firebase.json
```

The trigger rebuilds the recipient's summary from both review subcollections in a
transaction. This makes event retries safe: the same review is counted once by its
stable job/reviewer/recipient identity, not once per trigger delivery.

## Run the Firestore permission tests

The repository includes an emulator test suite covering allowed and denied operations for
private profiles, jobs, chats, messages, notifications, reviews, reports, and disabled users.
It also includes unit tests for the trusted rating-summary aggregation logic.

```bash
pnpm --filter @workspace/service-app run test:rules
pnpm --filter @workspace/service-app-functions run test
```

The command starts a local Firestore emulator and does not touch your Firebase project. It
requires Java 21 or newer; the Replit workspace is configured with it already.

## Troubleshooting

- **Still in demo mode?** All six `EXPO_PUBLIC_FIREBASE_*` secrets must be present, then
  restart the workflow.
- **`auth/configuration-not-found`**: Email/Password isn't enabled (step 3).
- **Google popup fails on web**: the Replit URL is missing from Authorized JavaScript
  origins (step 3), or third-party cookies are blocked.
- **`permission-denied` in Firestore**: rules from step 4 weren't published.
- **New employers can sign in but cannot post jobs**: check the live Rules
  publish history, then publish `firestore.rules` again. The local emulator
  tests cannot update a Firebase project.
- **Provider search or direct chat is empty after publishing rules**: the provider needs to
  sign in once so the app can create their public profile document.
