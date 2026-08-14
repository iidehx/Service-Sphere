import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { pushTokens, sentNotifications } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyFirebaseIdToken, extractBearerToken } from "../lib/firebaseAuth";
import { logger } from "../lib/logger";

const router = Router();

// Valid Expo push token prefixes (both current and legacy format).
function isValidExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

// ---------------------------------------------------------------------------
// Firestore REST helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "";

/** Converts a Firestore REST API field value to a plain JS value. */
function fromFirestoreValue(v: Record<string, unknown>): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) {
    const arr = (v.arrayValue as { values?: Record<string, unknown>[] })?.values ?? [];
    return arr.map(fromFirestoreValue);
  }
  if ("mapValue" in v) {
    const fields = (v.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields ?? {};
    return fromFirestoreFields(fields);
  }
  return undefined;
}

function fromFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

/**
 * Reads a Firestore document using the caller's Firebase ID token.
 * Firestore security rules are applied server-side, so only documents the
 * caller can legitimately read will succeed (e.g. actual job participants).
 * Returns null if the document doesn't exist or the caller lacks access.
 */
async function readFirestoreDoc(
  idToken: string,
  collection: string,
  docId: string,
): Promise<Record<string, unknown> | null> {
  if (!PROJECT_ID) return null;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
      `/databases/(default)/documents/${collection}/${docId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
    if (!body.fields) return null;
    return fromFirestoreFields(body.fields);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notification content + authorization
// ---------------------------------------------------------------------------

type EventType =
  | "job_accepted"
  | "quote_proposed"
  | "quote_accepted"
  | "quote_declined"
  | "payment_updated"
  | "payment_refunded"
  | "job_completed"
  | "review_submitted";

type NotificationPayload = {
  recipientId: string;
  title: string;
  body: string;
};

/**
 * Validates that the current job state is consistent with the claimed event
 * and that the caller has the role allowed to emit it. Returns an error
 * string if the check fails, or null if the event is legitimate.
 *
 * The Firestore document is read *after* the client has already written the
 * state transition, so the checks reflect the post-action state.
 */
function validateEventState(
  callerUid: string,
  job: Record<string, unknown>,
  event: EventType,
): string | null {
  const employerId = String(job.employerId ?? "");
  const employeeId = String(job.employeeId ?? "");
  const status = String(job.status ?? "");
  const proposedPrice = Number(job.proposedPrice ?? 0);
  const quoteBy = String(job.quoteBy ?? "");
  const paymentStatus = String(job.paymentStatus ?? "");
  const reviewedBy = Array.isArray(job.reviewedBy) ? (job.reviewedBy as string[]) : [];
  const isEmployer = callerUid === employerId;
  const isEmployee = callerUid === employeeId;

  switch (event) {
    case "job_accepted":
      // Provider accepted: caller must be the newly-assigned employee,
      // and the job must now be in negotiating state.
      if (!isEmployee) return "Only the assigned provider can send this event.";
      if (status !== "negotiating") return "Job must be in negotiating state after acceptance.";
      return null;

    case "quote_proposed":
      // Quote sent: caller must be the participant who sent the quote (quoteBy),
      // and a pending proposedPrice must exist.
      if (!isEmployer && !isEmployee) return "Only job participants can propose quotes.";
      if (proposedPrice <= 0) return "No active quote found on this job.";
      if (quoteBy !== callerUid) return "Caller did not propose this quote.";
      return null;

    case "quote_accepted":
      // Either participant accepted: job must have an active proposed price.
      if (!isEmployer && !isEmployee) return "Only job participants can accept quotes.";
      if (proposedPrice <= 0 && status !== "accepted")
        return "No active quote to accept.";
      return null;

    case "quote_declined":
      // Either participant declined: proposedPrice should now be cleared
      // (the client removes it as part of declineQuote). Status stays negotiating.
      if (!isEmployer && !isEmployee) return "Only job participants can decline quotes.";
      if (proposedPrice > 0) return "Quote is still active — decline may not have been applied yet.";
      if (status !== "negotiating") return "Job must be in negotiating state.";
      return null;

    case "payment_updated":
      // Employer marked payment as paid.
      if (!isEmployer) return "Only the employer can send payment notifications.";
      if (paymentStatus !== "paid") return "Payment is not marked as paid.";
      return null;

    case "payment_refunded":
      // Employer issued a refund.
      if (!isEmployer) return "Only the employer can send payment notifications.";
      if (paymentStatus !== "refunded") return "Payment is not marked as refunded.";
      return null;

    case "job_completed":
      // Employer marked the job complete.
      if (!isEmployer) return "Only the employer can complete a job.";
      if (status !== "completed") return "Job must be in completed state.";
      return null;

    case "review_submitted":
      // Either participant submitted a review; they must appear in reviewedBy.
      if (!isEmployer && !isEmployee) return "Only job participants can submit reviews.";
      if (status !== "completed") return "Reviews require the job to be completed.";
      if (!reviewedBy.includes(callerUid)) return "Caller has not submitted a review on this job.";
      return null;

    default:
      return "Unknown event type.";
  }
}

/** Derives recipient and message from verified Firestore job state. */
function deriveJobNotification(
  callerUid: string,
  job: Record<string, unknown>,
  event: EventType,
): NotificationPayload | null {
  const employerId = String(job.employerId ?? "");
  const employeeId = String(job.employeeId ?? "");
  const title = String(job.title ?? "Job");
  const employerName = String(job.employerName ?? "Employer");
  const employeeName = String(job.employeeName ?? "Provider");
  const proposedPrice = Number(job.proposedPrice ?? 0);
  const agreedPrice = Number(job.agreedPrice ?? 0);
  const employerAccepted = Boolean(job.employerQuoteAccepted);
  const employeeAccepted = Boolean(job.employeeQuoteAccepted);
  const paymentStatus = String(job.paymentStatus ?? "");

  const isEmployer = callerUid === employerId;
  const isEmployee = callerUid === employeeId;
  const otherId = isEmployer ? employeeId : employerId;
  if (!otherId) return null;

  switch (event) {
    case "job_accepted":
      return {
        recipientId: employerId,
        title: "Provider accepted your job",
        body: `${employeeName} accepted "${title}". Open the chat to agree on a quote.`,
      };

    case "quote_proposed": {
      const senderName = isEmployer ? employerName : employeeName;
      return {
        recipientId: otherId,
        title: "New quote received",
        body: `${senderName} proposed $${proposedPrice} for "${title}".`,
      };
    }

    case "quote_accepted": {
      const bothAccepted = employerAccepted && employeeAccepted;
      const senderName = isEmployer ? employerName : employeeName;
      return {
        recipientId: otherId,
        title: bothAccepted ? "Job confirmed" : "Quote accepted",
        body: bothAccepted
          ? `"${title}" is confirmed at $${agreedPrice}.`
          : `${senderName} accepted the quote for "${title}".`,
      };
    }

    case "quote_declined": {
      const senderName = isEmployer ? employerName : employeeName;
      return {
        recipientId: otherId,
        title: "Quote declined",
        body: `${senderName} declined the quote for "${title}".`,
      };
    }

    case "payment_updated":
    case "payment_refunded": {
      if (!isEmployer || !employeeId) return null;
      const label = paymentStatus === "refunded" ? "refunded" : "paid";
      return {
        recipientId: employeeId,
        title: `Payment ${label}`,
        body: `${employerName} marked "${title}" as ${label}.`,
      };
    }

    case "job_completed":
      if (!isEmployer || !employeeId) return null;
      return {
        recipientId: employeeId,
        title: "Job completed",
        body: `${employerName} marked "${title}" as completed. Leave a review!`,
      };

    case "review_submitted": {
      const reviewerName = isEmployer ? employerName : employeeName;
      return {
        recipientId: otherId,
        title: "New review received",
        body: `${reviewerName} left you a review on "${title}".`,
      };
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// POST /api/notifications/register-token
// ---------------------------------------------------------------------------

const RegisterTokenSchema = z.object({
  token: z.string().min(1),
});

/**
 * Called by the mobile app after notification permission is granted.
 * Stores the Expo push token server-side (never in Firestore or exposed to
 * other users).
 *
 * Requires: Authorization: Bearer <firebase-id-token>
 */
router.post("/notifications/register-token", async (req, res) => {
  const idToken = extractBearerToken(req.headers.authorization);
  const callerUid = idToken ? await verifyFirebaseIdToken(idToken) : null;
  if (!callerUid) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }

  const parsed = RegisterTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.flatten() });
    return;
  }

  const { token } = parsed.data;
  if (!isValidExpoPushToken(token)) {
    res.status(400).json({ ok: false, error: "Invalid Expo push token format." });
    return;
  }

  try {
    await db
      .insert(pushTokens)
      .values({ userId: callerUid, token, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pushTokens.userId,
        set: { token, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    logger.warn({ err }, "Failed to persist push token — DB unavailable");
    // Return a 503 so the client knows registration failed and can retry.
    res.status(503).json({ ok: false, error: "Database unavailable. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Idempotency key generation
// ---------------------------------------------------------------------------

/**
 * Derives an idempotency key from the job's current state + event + caller.
 *
 * Keys are constructed so that they uniquely identify each *distinct*
 * state transition, preventing the same push from being delivered twice.
 *
 * For events that can repeat (quote_proposed, quote_declined, quote_accepted)
 * the key encodes the state fingerprint (proposedPrice, quoteBy) or a
 * 5-minute time bucket so the same quote round cannot spam the recipient but
 * new rounds produce new keys.
 */
function idempotencyKey(
  callerUid: string,
  jobId: string,
  event: EventType,
  job: Record<string, unknown>,
): string {
  const employeeId = String(job.employeeId ?? "");
  const proposedPrice = Number(job.proposedPrice ?? 0);
  const quoteBy = String(job.quoteBy ?? "");
  const agreedPrice = Number(job.agreedPrice ?? 0);
  const paymentStatus = String(job.paymentStatus ?? "");

  switch (event) {
    case "job_accepted":
      // Unique per employee assignment — can't accept twice.
      return `job_accepted:${jobId}:${employeeId}`;

    case "quote_proposed":
      // Unique per proposer + price — a new quote amount produces a new key.
      return `quote_proposed:${jobId}:${quoteBy}:${proposedPrice}`;

    case "quote_accepted": {
      // Unique per caller + agreed price (or proposed if not yet agreed).
      const price = agreedPrice > 0 ? agreedPrice : proposedPrice;
      return `quote_accepted:${jobId}:${callerUid}:${price}`;
    }

    case "quote_declined": {
      // Quotes can recur; use a 5-minute bucket to prevent rapid-fire but
      // allow notification of genuinely separate decline rounds.
      const bucket = Math.floor(Date.now() / 300_000);
      return `quote_declined:${jobId}:${callerUid}:${bucket}`;
    }

    case "payment_updated":
    case "payment_refunded":
      // Payment status changes at most once per value.
      return `payment:${jobId}:${paymentStatus}`;

    case "job_completed":
      return `job_completed:${jobId}`;

    case "review_submitted":
      return `review_submitted:${jobId}:${callerUid}`;

    default:
      return `${event}:${jobId}:${callerUid}:${Date.now()}`;
  }
}

// ---------------------------------------------------------------------------
// POST /api/notifications/send
// ---------------------------------------------------------------------------

const SendSchema = z.object({
  event: z.enum([
    "job_accepted",
    "quote_proposed",
    "quote_accepted",
    "quote_declined",
    "payment_updated",
    "payment_refunded",
    "job_completed",
    "review_submitted",
  ]),
  jobId: z.string().min(1),
});

/**
 * Sends a push notification for a job lifecycle event.
 *
 * Authorization is two-layer:
 *   1. Firebase ID token — caller must be an authenticated app user.
 *   2. Firestore read + state validation — the job is fetched *using the
 *      caller's own ID token* so Firestore rules verify participation, and
 *      server-side predicates confirm the current job state matches the
 *      claimed event (preventing event replay when state has not changed).
 *
 * Notification recipient and content are derived entirely server-side from
 * verified Firestore state — the client supplies only the event type + jobId.
 *
 * Requires: Authorization: Bearer <firebase-id-token>
 */
router.post("/notifications/send", async (req, res) => {
  const idToken = extractBearerToken(req.headers.authorization);
  const callerUid = idToken ? await verifyFirebaseIdToken(idToken) : null;
  if (!callerUid || !idToken) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }

  const parsed = SendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.flatten() });
    return;
  }

  const { event, jobId } = parsed.data;

  // Read the job from Firestore using the caller's ID token.
  // Firestore rules only allow participants to read their jobs, so this acts
  // as a first participation check. Non-participants get null.
  const job = await readFirestoreDoc(idToken, "jobs", jobId);
  if (!job) {
    res.status(403).json({ ok: false, error: "Not a participant or job not found." });
    return;
  }

  // Validate that the current job state is consistent with the claimed event
  // and that the caller has the required role for it.
  const stateError = validateEventState(callerUid, job, event);
  if (stateError) {
    res.status(403).json({ ok: false, error: stateError });
    return;
  }

  // Derive notification payload from verified Firestore state.
  const payload = deriveJobNotification(callerUid, job, event);
  if (!payload) {
    res.status(403).json({ ok: false, error: "Cannot determine notification target." });
    return;
  }

  // Generate an idempotency key for this specific state transition.
  const idemKey = idempotencyKey(callerUid, jobId, event, job);

  // Look up the recipient's push token + check idempotency atomically.
  let expoPushToken: string | null = null;
  try {
    // Try to claim the idempotency slot. If the key already exists, another
    // request (or a replay) already sent this push — skip silently.
    try {
      await db
        .insert(sentNotifications)
        .values({ key: idemKey, sentAt: new Date() });
    } catch {
      // Primary-key conflict → already sent. Return success without sending.
      res.json({ ok: true, info: "Notification already delivered for this transition." });
      return;
    }

    // Slot claimed — look up the recipient's token.
    const row = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, payload.recipientId))
      .limit(1);
    expoPushToken = row[0]?.token ?? null;
  } catch (err) {
    logger.warn({ err }, "DB unavailable when looking up push token");
    res.json({ ok: true, warning: "Push skipped — database unavailable." });
    return;
  }

  if (!expoPushToken) {
    // Recipient has no registered device token; in-app notification already handled.
    res.json({ ok: true, info: "No push token registered for recipient." });
    return;
  }

  try {
    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: expoPushToken,
        title: payload.title,
        body: payload.body,
        sound: "default",
        data: { jobId, event },
        channelId: "default",
      }),
    });

    if (!expoRes.ok) {
      const text = await expoRes.text();
      res.status(502).json({ ok: false, error: `Expo push error: ${text}` });
      return;
    }

    const result = await expoRes.json();
    res.json({ ok: true, result });
  } catch (err) {
    logger.error({ err }, "Failed to reach Expo push service");
    res.status(500).json({ ok: false, error: "Failed to reach Expo push service." });
  }
});

export default router;
