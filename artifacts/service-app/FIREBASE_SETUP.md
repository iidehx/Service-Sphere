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
3. (Optional) Enable **Google**. Then:
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

## Troubleshooting

- **Still in demo mode?** All six `EXPO_PUBLIC_FIREBASE_*` secrets must be present, then
  restart the workflow.
- **`auth/configuration-not-found`**: Email/Password isn't enabled (step 3).
- **Google popup fails on web**: the Replit URL is missing from Authorized JavaScript
  origins (step 3), or third-party cookies are blocked.
- **`permission-denied` in Firestore**: rules from step 4 weren't published.
