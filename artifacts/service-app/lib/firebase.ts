import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

/**
 * Dual-mode bootstrap: when the EXPO_PUBLIC_FIREBASE_* env vars are present the
 * app runs against real Firebase (Auth + Firestore + Storage). When they are
 * absent the app falls back to a fully local demo mode so the preview keeps
 * working before keys are supplied.
 *
 * EXPO_PUBLIC_* vars are inlined at bundle time, so the Expo workflow must be
 * restarted after adding or changing them.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && firebaseConfig.authDomain,
);

export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* secrets first.');
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);

    if (Platform.OS === 'web') {
      auth = getAuth(app);
    } else {
      // On native, firebase/auth resolves to the react-native build which
      // exports getReactNativePersistence — but the TypeScript types come from
      // the browser build, so we reach it via require and fall back gracefully.
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const authModule: any = require('firebase/auth');
        const persistence = authModule.getReactNativePersistence
          ? authModule.getReactNativePersistence(AsyncStorage)
          : undefined;
        auth = persistence ? authModule.initializeAuth(app, { persistence }) : getAuth(app);
      } catch {
        auth = getAuth(app);
      }
    }

    // Long-polling autodetect keeps Firestore working behind proxies (the
    // Replit preview iframe) where WebChannel streaming can fail.
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    storage = getStorage(app);
  }
  return { app, auth: auth as Auth, db: db as Firestore, storage: storage as FirebaseStorage };
}
