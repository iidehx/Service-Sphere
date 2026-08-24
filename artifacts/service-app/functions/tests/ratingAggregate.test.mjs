import assert from "node:assert/strict";
import { test } from "node:test";
import { publicProfileFromUser } from "../lib/publicProfile.js";
import { buildRatingSummary } from "../lib/ratingAggregate.js";

const review = (overrides = {}) => ({
  id: "review-1",
  jobId: "job-1",
  jobTitle: "Deep clean a two-bedroom apartment",
  reviewerId: "reviewer-1",
  reviewerName: "Taylor Reviewer",
  targetUserId: "target-1",
  rating: 5,
  tags: [],
  comment: "",
  createdAtMs: 100,
  ...overrides,
});

test("rebuilds average, count, and five most recent reviews", () => {
  const summary = buildRatingSummary([
    review({ id: "old", jobId: "job-old", rating: 3, createdAtMs: 10 }),
    review({ id: "new-1", jobId: "job-new-1", rating: 5, createdAtMs: 300 }),
    review({ id: "new-2", jobId: "job-new-2", rating: 4, createdAtMs: 200 }),
    review({ id: "new-3", jobId: "job-new-3", rating: 2, createdAtMs: 150 }),
    review({ id: "new-4", jobId: "job-new-4", rating: 5, createdAtMs: 140 }),
    review({ id: "new-5", jobId: "job-new-5", rating: 4, createdAtMs: 130 }),
    review({ id: "new-6", jobId: "job-new-6", rating: 1, createdAtMs: 120 }),
  ]);

  assert.equal(summary.ratingCount, 7);
  assert.equal(summary.ratingAvg, 3.43);
  assert.deepEqual(
    summary.recentReviews.map(({ id }) => id),
    ["new-1", "new-2", "new-3", "new-4", "new-5"],
  );
});

test("deduplicates a retried review by job, reviewer, and target", () => {
  const original = review({ id: "review-created", rating: 5, createdAtMs: 100 });
  const duplicate = review({ id: "review-retry-copy", rating: 1, createdAtMs: 99 });
  const summary = buildRatingSummary([original, duplicate, review({ jobId: "job-2", rating: 3 })]);

  assert.equal(summary.ratingCount, 2);
  assert.equal(summary.ratingAvg, 4);
  assert.deepEqual(summary.recentReviews.map(({ id }) => id), ["review-1", "review-created"]);
});

test("ignores malformed ratings instead of corrupting summaries", () => {
  const summary = buildRatingSummary([
    review({ rating: 0 }),
    review({ rating: 6 }),
    review({ rating: 4 }),
    review({ createdAtMs: Number.NaN }),
  ]);

  assert.deepEqual(summary, {
    ratingAvg: 4,
    ratingCount: 1,
    recentReviews: [review({ rating: 4 })],
  });
});

test("only stores the bounded public review projection in summaries", () => {
  const summary = buildRatingSummary([
    review({
      tags: ["Professional"],
      privateOrUnexpectedPayload: "x".repeat(2_000_000),
    }),
  ]);

  assert.deepEqual(summary.recentReviews, [
    review({ tags: ["Professional"] }),
  ]);
  assert.equal(
    Object.hasOwn(summary.recentReviews[0], "privateOrUnexpectedPayload"),
    false,
  );
});

test("creates a complete public-profile mirror without private account fields", () => {
  const profile = publicProfileFromUser({
    name: "Pat Provider",
    email: "private@example.test",
    role: "provider",
    workArea: "Austin, TX",
    categories: ["Cleaning"],
    priceRange: "$40–$80 / hour",
    companyInfo: "",
    bio: "Reliable local provider.",
    avatarUrl: "",
    verified: true,
    availableForWork: true,
    createdAtMs: 100,
    savedJobIds: ["job-1"],
  });

  assert.deepEqual(profile, {
    name: "Pat Provider",
    role: "provider",
    workArea: "Austin, TX",
    categories: ["Cleaning"],
    priceRange: "$40–$80 / hour",
    companyInfo: "",
    bio: "Reliable local provider.",
    avatarUrl: "",
    verified: true,
    availableForWork: true,
    createdAtMs: 100,
  });
});