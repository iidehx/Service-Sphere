# Service Sphere

A two-sided service marketplace mobile app built with Expo (React Native), Firebase, and TypeScript.

**Employers** post jobs. **Providers** browse, quote, chat, complete work, and leave reviews — all in one app.

---

## Features

### For Employers
- Post service jobs with title, description, category, location, and budget
- Review incoming quote proposals from providers
- Accept or decline quotes, then track job progress
- Chat directly with your hired provider
- Leave a review once the job is complete

### For Providers
- Browse open jobs filtered by category
- Submit quote proposals with custom pricing
- Negotiate via in-app chat
- Mark jobs complete and collect reviews
- Build a reputation through your provider profile

### Shared
- Email/password and Google sign-in (Firebase Auth)
- Real-time chat powered by Firestore
- Mutual review system (both parties rate each other)
- Role selection on first login (Employer or Provider)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | Expo (SDK 54), React Native 0.81 |
| Language | TypeScript |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| State | React Context + useReducer |
| Navigation | Expo Router (file-based) |
| Styling | StyleSheet (custom, no UI library) |

---

## Project Structure

```
artifacts/
├── service-app/          # Expo mobile app
│   ├── app/              # File-based routes (Expo Router)
│   ├── components/       # Shared UI components
│   ├── context/          # ServiceAppContext (global state + Firebase)
│   ├── firestore.rules   # Firestore security rules
│   └── app.json          # Expo config
├── api-server/           # Express API server (optional backend)
└── admin-dashboard/      # React admin panel
```

---

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 10 or 11
- A Firebase project with Auth, Firestore and Storage enabled
- Java 21+ (only for the Firestore rules emulator tests)

### Environment Variables

Copy `artifacts/service-app/.env.example` to `artifacts/service-app/.env` and fill in the
Firebase web app config (Firebase Console → Project settings → Your apps). `.env` is
git-ignored. With the Firebase values left empty, the app runs in local demo mode.
Restart the dev server after changing `.env`.

### Run locally (Windows, macOS, Linux)

```bash
pnpm install
pnpm --filter @workspace/service-app run dev
```

Scan the QR code with **Expo Go** (Android/iOS), press `a` for an Android emulator, or
press `w` for the browser (`run web` opens the browser directly). If Expo fails with
`fetch failed` while starting, add `--offline`.

### Tests

```bash
pnpm run typecheck
pnpm --filter @workspace/service-app run test:password
pnpm --filter @workspace/service-app run test:job-fit
pnpm --filter @workspace/service-app-functions run test
pnpm --filter @workspace/service-app run test:rules   # needs Java 21+
```

---

## Building for Android

This project uses EAS Build for production APKs.

```bash
cd artifacts/service-app

# Preview APK (sideloadable)
eas build --platform android --profile preview

# Production AAB (Play Store)
eas build --platform android --profile production
```

Make sure your EAS environment variables match the Firebase secrets above.

---

## Theme

| Role | Color |
|---|---|
| Primary (Navy) | `#1E3A5F` |
| Accent (Amber) | `#D97706` |
| Background | `#F8FAFC` |

---

## License

MIT
