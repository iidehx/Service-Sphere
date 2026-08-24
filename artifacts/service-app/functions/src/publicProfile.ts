export type PublicProfileProjection = {
  name: string;
  role: "employer" | "provider";
  workArea: string;
  categories: string[];
  priceRange: string;
  companyInfo: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  availableForWork: boolean;
  createdAtMs: number;
};

/**
 * Produces a complete public profile from the source-of-truth private account.
 * This lets the trigger repair an older account that does not yet have its
 * public mirror without exposing any account-only data.
 */
export function publicProfileFromUser(
  user: Record<string, unknown>,
): PublicProfileProjection {
  const role = user.role;
  const categories = user.categories;
  if (
    typeof user.name !== "string" ||
    (role !== "employer" && role !== "provider") ||
    typeof user.workArea !== "string" ||
    !Array.isArray(categories) ||
    !categories.every((category) => typeof category === "string") ||
    typeof user.priceRange !== "string" ||
    typeof user.companyInfo !== "string" ||
    typeof user.bio !== "string" ||
    typeof user.avatarUrl !== "string" ||
    typeof user.verified !== "boolean" ||
    typeof user.availableForWork !== "boolean" ||
    typeof user.createdAtMs !== "number" ||
    !Number.isFinite(user.createdAtMs)
  ) {
    throw new Error("Cannot create a public profile from an invalid private account");
  }

  return {
    name: user.name,
    role,
    workArea: user.workArea,
    categories,
    priceRange: user.priceRange,
    companyInfo: user.companyInfo,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    verified: user.verified,
    availableForWork: user.availableForWork,
    createdAtMs: user.createdAtMs,
  };
}