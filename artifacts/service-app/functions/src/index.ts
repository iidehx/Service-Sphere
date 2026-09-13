import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { auth as authFunctions } from "firebase-functions/v1";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { publicProfileFromUser } from "./publicProfile.js";
import { deleteAccountResources } from "./accountDeletion.js";
import {
  buildRatingSummary,
  publicReviewFromData,
  type RatingReview,
} from "./ratingAggregate.js";
import { rankEmergencyCandidates, usableCoordinates, type BusyJob, type EmergencyCandidate } from "./emergencyMatching.js";

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

const EMERGENCY_REQUEST_TTL_MS = 15 * 60_000;
const EMERGENCY_RATE_WINDOW_MS = 10 * 60_000;

function profileIsComplete(data: Record<string, unknown>, role: "employer" | "provider"): boolean {
  const shared = typeof data.name === "string" && data.name.trim().length >= 2
    && typeof data.workArea === "string" && data.workArea.trim().length >= 2
    && typeof data.availability === "string" && data.availability.trim().length >= 2;
  if (!shared) return false;
  if (role === "provider") {
    return Array.isArray(data.categories) && data.categories.length > 0
      && typeof data.priceRange === "string" && data.priceRange.trim().length >= 2;
  }
  return (typeof data.bio === "string" && data.bio.trim().length >= 2)
    || (typeof data.companyInfo === "string" && data.companyInfo.trim().length >= 2);
}

async function requireActiveProfile(db: Firestore, uid: string, role: "employer" | "provider") {
  const snapshot = await db.collection("users").doc(uid).get();
  const data = snapshot.data() as Record<string, unknown> | undefined;
  if (!data || data.role !== role || data.disabled === true || !profileIsComplete(data, role)) {
    throw new HttpsError("permission-denied", `An active, complete ${role} profile is required.`);
  }
  return data;
}

export const requestEmergencyMatch = onCall({ cors: true, invoker: "public" }, async (request) => {
  const uid = request.auth?.uid;
  const jobId = request.data?.jobId;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in before requesting a match.");
  if (!isDocumentId(jobId)) throw new HttpsError("invalid-argument", "A valid job is required.");
  const db = getFirestore();
  const now = Date.now();
  await requireActiveProfile(db, uid, "employer");
  const jobRef = db.collection("jobs").doc(jobId);
  const jobSnap = await jobRef.get();
  const job = jobSnap.data() as Record<string, unknown> | undefined;
  if (!job || job.employerId !== uid) throw new HttpsError("permission-denied", "Only the job owner can request matching.");
  if (job.emergency !== true || job.status !== "emergency_pending") throw new HttpsError("failed-precondition", "This job is not open for emergency matching.");
  const scheduledAtMs = new Date(typeof job.scheduledAt === "string" ? job.scheduledAt : "").getTime();
  if (!Number.isFinite(scheduledAtMs) || scheduledAtMs <= now || !usableCoordinates(job.areaCoordinates)) {
    throw new HttpsError("failed-precondition", "Emergency jobs need a future time and rounded area location.");
  }

  const requestRef = db.collection("emergencyRequests").doc(jobId);
  const existing = await requestRef.get();
  const existingData = existing.data();
  if (existingData?.status === "pending" && existingData.expiresAtMs > now) return { matched: true };
  const rateRef = db.collection("emergencyRateLimits").doc(uid);
  await db.runTransaction(async (transaction) => {
    const rate = await transaction.get(rateRef);
    const lastRequestAtMs = rate.data()?.lastRequestAtMs;
    if (typeof lastRequestAtMs === "number" && now - lastRequestAtMs < EMERGENCY_RATE_WINDOW_MS) {
      throw new HttpsError("resource-exhausted", "Please wait before requesting another emergency match.");
    }
    transaction.set(rateRef, { lastRequestAtMs: now });
  });

  const [profilesSnap, activeJobsSnap, pendingRequestsSnap] = await Promise.all([
    db.collection("users").where("role", "==", "provider").where("availableForWork", "==", true).get(),
    db.collection("jobs").where("status", "in", ["negotiating", "accepted"]).get(),
    db.collection("emergencyRequests").where("status", "==", "pending").get(),
  ]);
  const pendingProviderIds = new Set(
    pendingRequestsSnap.docs
      .map((snapshot) => snapshot.data())
      .filter((data) => data.expiresAtMs > now && typeof data.providerId === "string")
      .map((data) => data.providerId as string),
  );
  const candidates: EmergencyCandidate[] = profilesSnap.docs.map((snapshot) => ({
    id: snapshot.id,
    name: typeof snapshot.data().name === "string" ? snapshot.data().name : "Provider",
    categories: Array.isArray(snapshot.data().categories) ? snapshot.data().categories : [],
    availableForWork: snapshot.data().availableForWork === true,
    emergencyOptIn: snapshot.data().emergencyOptIn === true,
    availability: typeof snapshot.data().availability === "string" ? snapshot.data().availability : "",
    availabilityUpdatedAtMs: typeof snapshot.data().availabilityUpdatedAtMs === "number" ? snapshot.data().availabilityUpdatedAtMs : 0,
    availabilityTimezoneOffsetMinutes: snapshot.data().availabilityTimezoneOffsetMinutes,
    areaCoordinates: snapshot.data().areaCoordinates,
  })).filter((candidate) => {
    const data = profilesSnap.docs.find((snapshot) => snapshot.id === candidate.id)?.data() as Record<string, unknown> | undefined;
    return data?.disabled !== true
      && Boolean(data && profileIsComplete(data, "provider"))
      && !pendingProviderIds.has(candidate.id);
  });
  const jobs: BusyJob[] = activeJobsSnap.docs.map((snapshot) => snapshot.data());
  const selected = rankEmergencyCandidates({
    candidates,
    jobs,
    category: String(job.category ?? ""),
    location: job.areaCoordinates,
    requestedAtMs: scheduledAtMs,
    nowMs: now,
  })[0];

  if (!selected) {
    await Promise.all([
      requestRef.set({ jobId, employerId: uid, status: "no_match", createdAtMs: now, updatedAtMs: now }),
      jobRef.set({
        emergencyRequestStatus: "no_match",
        emergencyRequestedProviderId: FieldValue.delete(),
        emergencyRequestExpiresAtMs: FieldValue.delete(),
      }, { merge: true }),
      db.collection("notifications").doc(`emergency-no-match-${jobId}`).set({
        userId: uid,
        kind: "system",
        title: "No emergency match found",
        body: `"${String(job.title ?? "Emergency job")}" was not broadcast. You can review it from your jobs.`,
        jobId,
        read: false,
        createdAtMs: now,
      }),
    ]);
    return { matched: false };
  }

  const expiresAtMs = now + EMERGENCY_REQUEST_TTL_MS;
  const reservationRef = db.collection("emergencyProviderReservations").doc(selected.id);
  const notificationRef = db.collection("notifications").doc();
  await db.runTransaction(async (transaction) => {
    const [freshJob, freshRequest, reservation] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(requestRef),
      transaction.get(reservationRef),
    ]);
    if (freshJob.data()?.status !== "emergency_pending" || freshJob.data()?.employerId !== uid) {
      throw new HttpsError("aborted", "The job changed before matching completed.");
    }
    if (freshRequest.data()?.status === "pending" && freshRequest.data()?.expiresAtMs > now) return;
    if (reservation.data()?.expiresAtMs > now) {
      throw new HttpsError("aborted", "The selected provider just received another request. Try again shortly.");
    }
    transaction.set(requestRef, {
      jobId,
      employerId: uid,
      providerId: selected.id,
      status: "pending",
      createdAtMs: now,
      updatedAtMs: now,
      expiresAtMs,
    });
    transaction.set(reservationRef, { jobId, providerId: selected.id, expiresAtMs });
    transaction.set(jobRef, {
      emergencyRequestStatus: "pending",
      emergencyRequestedProviderId: selected.id,
      emergencyRequestExpiresAtMs: expiresAtMs,
    }, { merge: true });
    transaction.create(notificationRef, {
      userId: selected.id,
      kind: "job",
      title: "Emergency job request",
      body: `"${String(job.title ?? "Emergency job")}" needs help nearby. Accept or decline within 15 minutes.`,
      jobId,
      read: false,
      createdAtMs: now,
    });
  });
  logger.info({ jobId, providerId: selected.id }, "Created direct emergency request");
  return { matched: true };
});

export const respondToEmergencyRequest = onCall({ cors: true, invoker: "public" }, async (request) => {
  const uid = request.auth?.uid;
  const jobId = request.data?.jobId;
  const response = request.data?.response;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in before responding.");
  if (!isDocumentId(jobId) || !["accept", "decline"].includes(response)) {
    throw new HttpsError("invalid-argument", "A valid response is required.");
  }
  const db = getFirestore();
  await requireActiveProfile(db, uid, "provider");
  const requestRef = db.collection("emergencyRequests").doc(jobId);
  const jobRef = db.collection("jobs").doc(jobId);
  const now = Date.now();
  let chatId: string | undefined;
  let expired = false;
  const responseNotificationRef = db.collection("notifications").doc();
  const messageRef = db.collection("chats").doc(`chat-${jobId}`).collection("messages").doc();
  await db.runTransaction(async (transaction) => {
    const reservationRef = db.collection("emergencyProviderReservations").doc(uid);
    const [requestSnap, jobSnap, reservationSnap] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(jobRef),
      transaction.get(reservationRef),
    ]);
    const requestData = requestSnap.data();
    const job = jobSnap.data();
    if (!requestData || requestData.providerId !== uid) throw new HttpsError("permission-denied", "This request was not sent to you.");
    if (requestData.status === "accepted" && response === "accept") {
      chatId = `chat-${jobId}`;
      return;
    }
    if (requestData.status === "declined" && response === "decline") return;
    if (requestData.status !== "pending") throw new HttpsError("already-exists", "This request already has a different response.");
    if (requestData.expiresAtMs <= now) {
      transaction.update(requestRef, { status: "expired", updatedAtMs: now });
      transaction.set(jobRef, {
        emergencyRequestStatus: "expired",
        emergencyRequestedProviderId: FieldValue.delete(),
        emergencyRequestExpiresAtMs: FieldValue.delete(),
      }, { merge: true });
      if (reservationSnap.data()?.jobId === jobId) transaction.delete(reservationRef);
      expired = true;
      return;
    }
    if (response === "decline") {
      transaction.update(requestRef, { status: "declined", updatedAtMs: now });
      transaction.set(jobRef, {
        emergencyRequestStatus: "declined",
        emergencyRequestedProviderId: FieldValue.delete(),
        emergencyRequestExpiresAtMs: FieldValue.delete(),
      }, { merge: true });
      if (reservationSnap.data()?.jobId === jobId) transaction.delete(reservationRef);
      transaction.create(responseNotificationRef, {
        userId: requestData.employerId,
        kind: "job",
        title: "Emergency request declined",
        body: "The requested provider declined. You can request another match from the job.",
        jobId,
        read: false,
        createdAtMs: now,
      });
      return;
    }
    if (!job || job.status !== "emergency_pending" || job.emergencyRequestedProviderId !== uid) {
      throw new HttpsError("failed-precondition", "This job is no longer available.");
    }
    chatId = `chat-${jobId}`;
    const providerSnap = await transaction.get(db.collection("users").doc(uid));
    const providerName = providerSnap.data()?.name ?? "Provider";
    transaction.update(requestRef, { status: "accepted", updatedAtMs: now });
    if (reservationSnap.data()?.jobId === jobId) transaction.delete(reservationRef);
    transaction.set(jobRef, {
      employeeId: uid,
      employeeName: providerName,
      status: "negotiating",
      emergencyRequestStatus: "accepted",
    }, { merge: true });
    transaction.set(db.collection("chats").doc(chatId), {
      jobId,
      jobTitle: job.title,
      participants: [job.employerId, uid],
      participantNames: { [job.employerId]: job.employerName, [uid]: providerName },
      lastMessage: `${providerName} accepted the emergency request. Discuss details and agree on a quote.`,
      lastMessageAtMs: now,
      lastSenderId: uid,
      lastReadAt: { [uid]: now },
      createdAtMs: now,
    });
    transaction.set(messageRef, {
      senderId: uid,
      senderName: providerName,
      text: `${providerName} accepted the emergency request. Discuss details and agree on a quote.`,
      kind: "system",
      createdAtMs: now,
    });
    transaction.create(responseNotificationRef, {
      userId: job.employerId,
      kind: "job",
      title: "Emergency request accepted",
      body: `${providerName} accepted "${job.title}". Open the chat to discuss details.`,
      jobId,
      chatId,
      read: false,
      createdAtMs: now,
    });
  });
  if (expired) throw new HttpsError("deadline-exceeded", "This emergency request has expired.");
  return { chatId };
});

export const expireEmergencyRequests = onSchedule("every 1 minutes", async () => {
  const db = getFirestore();
  const now = Date.now();
  const expired = await db.collection("emergencyRequests")
    .where("status", "==", "pending")
    .where("expiresAtMs", "<=", now)
    .limit(200)
    .get();
  if (expired.empty) return;
  await Promise.all(expired.docs.map((candidate) => db.runTransaction(async (transaction) => {
    const initial = candidate.data();
    if (typeof initial.jobId !== "string" || typeof initial.providerId !== "string") return;
    const jobRef = db.collection("jobs").doc(initial.jobId);
    const reservationRef = db.collection("emergencyProviderReservations").doc(initial.providerId);
    const [requestSnap, jobSnap, reservationSnap] = await Promise.all([
      transaction.get(candidate.ref),
      transaction.get(jobRef),
      transaction.get(reservationRef),
    ]);
    const requestData = requestSnap.data();
    if (requestData?.status !== "pending" || requestData.expiresAtMs > now) return;
    transaction.update(candidate.ref, { status: "expired", updatedAtMs: now });
    const job = jobSnap.data();
    if (
      job?.emergencyRequestStatus === "pending"
      && job?.emergencyRequestedProviderId === requestData.providerId
    ) {
      transaction.set(jobRef, {
        emergencyRequestStatus: "expired",
        emergencyRequestedProviderId: FieldValue.delete(),
        emergencyRequestExpiresAtMs: FieldValue.delete(),
      }, { merge: true });
    }
    if (reservationSnap.data()?.jobId === requestData.jobId) transaction.delete(reservationRef);
  })));
  logger.info({ count: expired.size }, "Expired stale emergency requests");
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