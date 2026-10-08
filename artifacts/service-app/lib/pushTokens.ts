import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { getFirebase } from '@/lib/firebase';

/**
 * Expo push tokens live in `pushTokens/{uid}`, readable and writable only by
 * their owner (see firestore.rules). The `sendJobPushNotifications` Cloud
 * Function reads them with Admin credentials to deliver job-event pushes.
 */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/.test(token);
}

export async function savePushToken(uid: string, token: string): Promise<void> {
  if (!isExpoPushToken(token)) return;
  const { db } = getFirebase();
  await setDoc(doc(db, 'pushTokens', uid), {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    updatedAtMs: Date.now(),
  });
}

/** Stops pushes to this device after sign-out. Best-effort. */
export async function clearPushToken(uid: string): Promise<void> {
  try {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'pushTokens', uid));
  } catch {
    // Signing out must never fail because of push cleanup.
  }
}
