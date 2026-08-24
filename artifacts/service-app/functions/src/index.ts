import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  getFirestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { auth as authFunctions } from "firebase-functions/v1";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { publicProfileFromUser } from "./publicProfile.js";
import { deleteAccountResources } from "./accountDeletion.js";
import {
  buildRatingSummary,
  publicReviewFromData,
  type RatingReview,
} from "./ratingAggregate.js";

initializeApp();

/**
 * Account profile documents are private to their owner while Firebase Auth
 * owns the actual sign-in identity. Delete both through Admin SDK credentials
 * so a removed account no longer reserves its email address.
 */
// Callable endpoints must allow the browser to reach the function so its
// Firebase Auth token can be verified below. The callable still rejects every
// unauthenticated request before touching account data.
export const deleteAccount = onCall({ cors: true, invoker: "public" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in before deleting your account.");
  }
  const authTime = request.auth?.token.auth_time;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof authTime !== "number" || nowInSeconds - authTime > 5 * 60) {
    throw new HttpsError(
      "failed-precondition",
      "Sign out and sign in again before deleting your account.",
    );
  }

  const db = getFirestore();
  try {
    await deleteAccountResources({
      markDeleting: async () => {
        await db.collection("accountTombstones").doc(uid).set({
          requestedAtMs: Date.now(),
        });
      },
      deleteIdentity: async () => {
        try {
          await getAuth().deleteUser(uid);
        } catch (error) {
          const code = (error as { code?: unknown })?.code;
          if (code !== "auth/user-not-found") throw error;
          logger.warn({ uid }, "Account identity was already deleted");
        }
      },
      deleteProfiles: async () => {
        const batch = db.batch();
        batch.delete(db.collection("users").doc(uid));
        batch.delete(db.collection("publicProfiles").doc(uid));
        await batch.commit();
      },
    });
    logger.info({ uid }, "Deleted account identity and profile documents");
    return { ok: true };
  } catch (error) {
    logger.error({ uid, error }, "Account deletion failed");
    throw new HttpsError(
      "internal",
      "We could not delete your account. Please try again after signing in again.",
    );
  }
});

/**
 * Covers interrupted callable executions: once Firebase Auth confirms an
 * identity was deleted, retry profile cleanup independently of the client.
 * The tombstone deliberately remains so an old cached session cannot recreate
 * documents for the removed UID.
 */
export const cleanDeletedAccountProfiles = authFunctions.user().onDelete(async (user) => {
  const db = getFirestore();
  const batch = db.batch();
  batch.delete(db.collection("users").doc(user.uid));
  batch.delete(db.collection("publicProfiles").doc(user.uid));
  await batch.commit();
  logger.info({ uid: user.uid }, "Cleaned profiles after Auth account deletion");
});

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