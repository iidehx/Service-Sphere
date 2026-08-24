export type RatingReview = {
  id: string;
  jobId: string;
  jobTitle: string;
  reviewerId: string;
  reviewerName: string;
  targetUserId: string;
  rating: number;
  communication?: number;
  quality?: number;
  punctuality?: number;
  tags: string[];
  comment: string;
  createdAtMs: number;
};

export type RatingSummary = {
  ratingAvg: number;
  ratingCount: number;
  recentReviews: RatingReview[];
};

const REVIEW_TAGS = new Set([
  "Professional",
  "On time",
  "Great value",
  "Friendly",
  "Clean work",
  "Clear communication",
  "Would hire again",
  "Went above & beyond",
]);

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !value.includes("/");
}

function validScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

/**
 * Projects a review document into the small, public shape stored in a rating
 * summary. Never copy arbitrary document fields into a profile document.
 */
export function publicReviewFromData(
  id: string,
  data: Record<string, unknown>,
): RatingReview | null {
  const optionalScores = ["communication", "quality", "punctuality"] as const;
  if (
    !validIdentifier(id) ||
    !validIdentifier(data.jobId) ||
    typeof data.jobTitle !== "string" ||
    data.jobTitle.length > 160 ||
    !validIdentifier(data.reviewerId) ||
    typeof data.reviewerName !== "string" ||
    data.reviewerName.length > 120 ||
    !validIdentifier(data.targetUserId) ||
    !validScore(data.rating) ||
    !Array.isArray(data.tags) ||
    data.tags.length > 8 ||
    !data.tags.every((tag) => typeof tag === "string" && REVIEW_TAGS.has(tag)) ||
    typeof data.comment !== "string" ||
    data.comment.length > 2000 ||
    typeof data.createdAtMs !== "number" ||
    !Number.isFinite(data.createdAtMs) ||
    optionalScores.some(
      (field) => field in data && !validScore(data[field]),
    )
  ) {
    return null;
  }

  return {
    id,
    jobId: data.jobId,
    jobTitle: data.jobTitle,
    reviewerId: data.reviewerId,
    reviewerName: data.reviewerName,
    targetUserId: data.targetUserId,
    rating: data.rating,
    ...(typeof data.communication === "number"
      ? { communication: data.communication }
      : {}),
    ...(typeof data.quality === "number" ? { quality: data.quality } : {}),
    ...(typeof data.punctuality === "number"
      ? { punctuality: data.punctuality }
      : {}),
    tags: data.tags,
    comment: data.comment,
    createdAtMs: data.createdAtMs,
  };
}

function reviewKey(review: RatingReview): string {
  return `${review.jobId}\u0000${review.reviewerId}\u0000${review.targetUserId}`;
}

/**
 * Rebuilds a summary from immutable review documents.
 *
 * Rebuilding instead of incrementing makes a retried trigger idempotent. The
 * stable job/reviewer/target key also prevents duplicate documents from
 * inflating the count if bad historical data is encountered.
 */
export function buildRatingSummary(reviews: readonly unknown[]): RatingSummary {
  const unique = new Map<string, RatingReview>();
  for (const value of reviews) {
    if (typeof value !== "object" || value === null) continue;
    const rawReview = value as Record<string, unknown>;
    const review = publicReviewFromData(
      typeof rawReview.id === "string" ? rawReview.id : "",
      rawReview,
    );
    if (!review) continue;
    const key = reviewKey(review);
    const previous = unique.get(key);
    if (!previous || review.createdAtMs > previous.createdAtMs || (review.createdAtMs === previous.createdAtMs && review.id < previous.id)) {
      unique.set(key, review);
    }
  }

  const ordered = [...unique.values()].sort(
    (a, b) => b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id),
  );
  const ratingCount = ordered.length;
  const total = ordered.reduce((sum, review) => sum + review.rating, 0);

  return {
    ratingAvg: ratingCount === 0 ? 0 : Math.round((total / ratingCount) * 100) / 100,
    ratingCount,
    recentReviews: ordered.slice(0, 5),
  };
}