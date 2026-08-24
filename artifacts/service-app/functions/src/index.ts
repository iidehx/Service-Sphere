import { initializeApp } from "firebase-admin/app";
import {
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  getFirestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { publicProfileFromUser } from "./publicProfile.js";
import {
  buildRatingSummary,
  publicReviewFromData,
  type RatingReview,
} from "./ratingAggregate.js";

initializeApp();

const REVIEW_COLLECTIONS = ["review", "employerReview"] as const;
type ReviewCollection = (typeof REVIEW_COLLECTIONS)[number];

type JobRecord = {
  status?: unknown;
  employerId?: unknown;
  employeeId?: unknown;
};

function isDocumentId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !value.includes("/");
}

function expectedTarget(
  collection: ReviewCollection,
  reviewerId: string,
  job: JobRecord,
): string | null {
  if (job.status !== "completed") return null;
  const employerId = typeof job.employerId === "string" ? job.employerId : "";
  const employeeId = typeof job.employeeId === "string" ? job.employeeId : "";
  if (collection === "review") {
    return reviewerId === employerId && isDocumentId(employeeId) ? employeeId : null;
  }
  return reviewerId === employeeId && isDocumentId(employerId) ? employerId : null;
}

function reviewFromSnapshot(
  snapshot: QueryDocumentSnapshot,
  collection: ReviewCollection,
  jobs: Map<string, JobRecord>,
): RatingReview | null {
  const data = snapshot.data() as Record<string, unknown>;
  const jobId = data.jobId;
  const reviewerId = data.reviewerId;
  const targetUserId = data.targetUserId;
  const rating = data.rating;
  const createdAtMs = data.createdAtMs;
  if (
    !isDocumentId(jobId) ||
    snapshot.id !== reviewerId ||
    !isDocumentId(reviewerId) ||
    !isDocumentId(targetUserId) ||
    !Number.isInteger(rating) ||
    (rating as number) < 1 ||
    (rating as number) > 5 ||
    typeof createdAtMs !== "number" ||
    !Number.isFinite(createdAtMs)
  ) {
    return null;
  }
  const target = expectedTarget(collection, reviewerId, jobs.get(jobId) ?? {});
  if (target !== targetUserId) return null;

  return publicReviewFromData(snapshot.id, data);
}

async function updateRatingSummary(
  db: Firestore,
  jobId: string,
  collection: ReviewCollection,
  reviewerId: string,
  createdReview: DocumentSnapshot,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const jobRef = db.collection("jobs").doc(jobId);
    const jobSnapshot = await transaction.get(jobRef);
    if (!jobSnapshot.exists) {
      logger.warn({ jobId }, "Skipping rating aggregation: job does not exist");
      return;
    }

    const targetUserId = expectedTarget(
      collection,
      reviewerId,
      jobSnapshot.data() as JobRecord,
    );
    const createdData = createdReview.data() as Record<string, unknown> | undefined;
    if (
      !targetUserId ||
      !createdData ||
      createdData.jobId !== jobId ||
      createdData.reviewerId !== reviewerId ||
      createdData.targetUserId !== targetUserId
    ) {
      logger.warn({ jobId, collection, reviewerId }, "Skipping malformed review");
      return;
    }

    const reviewSnapshots = await Promise.all(
      REVIEW_COLLECTIONS.map((name) =>
        transaction.get(
          db.collectionGroup(name).where("targetUserId", "==", targetUserId),
        ),
      ),
    );
    const candidateSnapshots = reviewSnapshots.flatMap((snapshot) =>
      snapshot.docs.map((review) => ({
        review,
        collection: review.ref.parent.id as ReviewCollection,
      })),
    );

    const jobIds = new Set<string>();
    for (const { review } of candidateSnapshots) {
      const candidateJobId = review.data().jobId;
      if (isDocumentId(candidateJobId)) jobIds.add(candidateJobId);
    }
    jobIds.delete(jobId);

    const candidateJobIds = [...jobIds];
    const jobRefs = candidateJobIds.map((candidateJobId) =>
      db.collection("jobs").doc(candidateJobId),
    );
    const jobSnapshots = jobRefs.length > 0 ? await transaction.getAll(...jobRefs) : [];
    const jobs = new Map<string, JobRecord>([[jobId, jobSnapshot.data() as JobRecord]]);
    for (let i = 0; i < jobSnapshots.length; i += 1) {
      if (jobSnapshots[i].exists) jobs.set(candidateJobIds[i], jobSnapshots[i].data() as JobRecord);
    }

    const userRef = db.collection("users").doc(targetUserId);
    const publicProfileRef = db.collection("publicProfiles").doc(targetUserId);
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) {
      throw new Error(`Cannot aggregate ratings: target user ${targetUserId} does not exist`);
    }

    const validReviews = candidateSnapshots
      .filter(({ collection: candidateCollection }) =>
        REVIEW_COLLECTIONS.includes(candidateCollection),
      )
      .map(({ review, collection: candidateCollection }) =>
        reviewFromSnapshot(review, candidateCollection, jobs),
      )
      .filter((review): review is RatingReview => review !== null);
    const summary = buildRatingSummary(validReviews);
    transaction.set(userRef, summary, { merge: true });
    transaction.set(
      publicProfileRef,
      { ...publicProfileFromUser(userSnapshot.data() as Record<string, unknown>), ...summary },
      { merge: true },
    );

    logger.info(
      {
        jobId,
        targetUserId,
        ratingCount: summary.ratingCount,
      },
      "Updated rating summary",
    );
  });
}

export const aggregateProviderRating = onDocumentCreated(
  "jobs/{jobId}/review/{reviewerId}",
  async (event) => {
    if (!event.data) return;
    await updateRatingSummary(
      getFirestore(),
      event.params.jobId,
      "review",
      event.params.reviewerId,
      event.data,
    );
  },
);

export const aggregateEmployerRating = onDocumentCreated(
  "jobs/{jobId}/employerReview/{reviewerId}",
  async (event) => {
    if (!event.data) return;
    await updateRatingSummary(
      getFirestore(),
      event.params.jobId,
      "employerReview",
      event.params.reviewerId,
      event.data,
    );
  },
);