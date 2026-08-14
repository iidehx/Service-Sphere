/** A report filed by an app user against another user. */
export interface Report {
  id: string;         // Firestore document ID
  reporterId: string;
  reportedUserId: string;
  reason: string;
  message?: string;
  createdAtMs: number;
  // Set by admin when reviewing
  dismissed?: boolean;
  reviewedAt?: number;
  reviewedByAdminId?: string;
}

/** Public user profile as stored in /users/{uid}. */
export interface UserProfile {
  name: string;
  role: 'employer' | 'provider';
  email?: string;
  avatarUrl?: string;
  bio?: string;
  workArea?: string;
  categories?: string[];
  ratingAvg?: number;
  ratingCount?: number;
  createdAtMs?: number;
  disabled?: boolean;
}

/** A report enriched with resolved profile info for both parties. */
export interface EnrichedReport extends Report {
  reporterProfile?: UserProfile | null;
  accusedProfile?: UserProfile | null;
}
