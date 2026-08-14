/**
 * Firestore helpers for the admin dashboard.
 * All operations require the caller to be authenticated and in the
 * /admins/{uid} collection (enforced by Firestore rules).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebase, FIREBASE_PROJECT_ID } from './firebase';
import type { Report, UserProfile } from './types';

// ---------------------------------------------------------------------------
// Admin check
// ---------------------------------------------------------------------------

/** Returns true if the current user's UID exists in /admins collection. */
export async function checkIsAdmin(uid: string): Promise<boolean> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function docToReport(id: string, data: DocumentData): Report {
  return {
    id,
    reporterId: data.reporterId ?? '',
    reportedUserId: data.reportedUserId ?? '',
    reason: data.reason ?? '',
    message: data.message ?? '',
    createdAtMs: data.createdAtMs ?? 0,
    dismissed: data.dismissed ?? false,
    reviewedAt: data.reviewedAt ?? undefined,
    reviewedByAdminId: data.reviewedByAdminId ?? undefined,
  };
}

/** Fetch all reports, newest first. */
export async function listReports(): Promise<Report[]> {
  const { db } = getFirebase();
  const q = query(collection(db, 'reports'), orderBy('createdAtMs', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToReport(d.id, d.data()));
}

/** Mark a report as dismissed by the current admin. */
export async function dismissReport(reportId: string, adminUid: string): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'reports', reportId), {
    dismissed: true,
    reviewedAt: Date.now(),
    reviewedByAdminId: adminUid,
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Fetch a single user profile document. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/**
 * Set disabled:true on a user document.
 * Firestore rules allow admins to update any user doc.
 */
export async function disableUser(uid: string): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'users', uid), { disabled: true });
}

/** Re-enable a previously disabled user. */
export async function enableUser(uid: string): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'users', uid), { disabled: false });
}

// ---------------------------------------------------------------------------
// Deep link to Firebase Console
// ---------------------------------------------------------------------------

/** Returns the Firebase Console URL for a user's Firestore document. */
export function firestoreUserConsoleUrl(uid: string): string {
  return `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/data/~2Fusers~2F${uid}`;
}
