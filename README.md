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
| Mobile app | Expo (SDK 53), React Native |
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
- Node.js 18+
- pnpm
- Expo CLI (`npm install -g expo`)
- A Firebase project with Auth and Firestore enabled

### Environment Variables

Create the following secrets (Replit Secrets or `.env`):

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
```

### Run locally

```bash
pnpm install
pnpm --filter @workspace/service-app run dev
```

Scan the QR code with **Expo Go** (Android/iOS) or press `a` for Android emulator.

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
