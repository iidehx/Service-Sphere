import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
};

export const FIREBASE_PROJECT_ID: string = import.meta.env.FIREBASE_PROJECT_ID ?? '';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId &&
  firebaseConfig.authDomain,
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function init() {
  if (_app) return { app: _app, auth: _auth as Auth, db: _db as Firestore };
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  // Long-polling so Firestore works behind the Replit iframe proxy.
  _db = initializeFirestore(_app, { experimentalAutoDetectLongPolling: true });
  return { app: _app, auth: _auth, db: _db };
}

export function getFirebase() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* secrets first.');
  }
  return init();
}

export { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User };
