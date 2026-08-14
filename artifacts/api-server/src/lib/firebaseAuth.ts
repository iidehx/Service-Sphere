/**
 * Verifies a Firebase ID token using Firebase's identitytoolkit REST API.
 * Returns the caller's UID on success, or null on failure.
 *
 * This approach requires only the Firebase Web API key (already in the
 * environment as EXPO_PUBLIC_FIREBASE_API_KEY) — no service-account
 * credentials or Admin SDK are needed.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!response.ok) return null;
    const data = await response.json() as { users?: Array<{ localId: string }> };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

/**
 * Extracts the Bearer token from an Authorization header value.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}
