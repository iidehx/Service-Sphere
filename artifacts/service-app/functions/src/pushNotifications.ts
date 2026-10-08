/**
 * Derives push notifications from a job document's before/after state.
 *
 * Pushes are computed from trusted Firestore state changes rather than client
 * requests, so a client cannot choose a recipient, forge message text, or
 * trigger a push without making the corresponding (rules-checked) write.
 */

export type JobPushEvent =
  | "emergency_requested"
  | "job_accepted"
  | "quote_proposed"
  | "quote_accepted"
  | "quote_declined"
  | "payment_updated"
  | "payment_refunded"
  | "job_completed"
  | "review_submitted";

export type JobPush = {
  event: JobPushEvent;
  recipientId: string;
  title: string;
  body: string;
  /** Quote pushes respect the recipient's "Quote notifications" setting. */
  isQuoteUpdate: boolean;
};

type JobData = Record<string, unknown>;

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function price(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function deriveJobPushes(before: JobData, after: JobData): JobPush[] {
  const pushes: JobPush[] = [];
  const title = text(after.title, "Job");
  const employerId = text(after.employerId, "");
  const employeeId = text(after.employeeId, "");
  const employerName = text(after.employerName, "Employer");
  const employeeName = text(after.employeeName, "Provider");
  const nameOf = (uid: string) => (uid === employerId ? employerName : employeeName);
  const otherThan = (uid: string) => (uid === employerId ? employeeId : employerId);

  if (
    after.emergencyRequestStatus === "pending"
    && before.emergencyRequestStatus !== "pending"
    && typeof after.emergencyRequestedProviderId === "string"
  ) {
    pushes.push({
      event: "emergency_requested",
      recipientId: after.emergencyRequestedProviderId,
      title: "Emergency job request",
      body: `"${title}" needs help nearby. Accept or decline within 15 minutes.`,
      isQuoteUpdate: false,
    });
  }

  if (!before.employeeId && employeeId && after.status === "negotiating") {
    pushes.push({
      event: "job_accepted",
      recipientId: employerId,
      title: "Provider accepted your job",
      body: `${employeeName} accepted "${title}". Open the chat to agree on a quote.`,
      isQuoteUpdate: false,
    });
  }

  const proposed = price(after.proposedPrice);
  const quoteBy = text(after.quoteBy, "");
  if (
    proposed !== null
    && quoteBy
    && (proposed !== before.proposedPrice || quoteBy !== before.quoteBy)
    && after.employerQuoteAccepted !== true
    && after.employeeQuoteAccepted !== true
  ) {
    pushes.push({
      event: "quote_proposed",
      recipientId: otherThan(quoteBy),
      title: "New quote received",
      body: `${nameOf(quoteBy)} proposed ${formatUsd(proposed)} for "${title}".`,
      isQuoteUpdate: true,
    });
  }

  const acceptedBy = [
    before.employerQuoteAccepted !== true && after.employerQuoteAccepted === true ? employerId : null,
    before.employeeQuoteAccepted !== true && after.employeeQuoteAccepted === true ? employeeId : null,
  ].filter((uid): uid is string => Boolean(uid));
  const bothAccepted = after.employerQuoteAccepted === true && after.employeeQuoteAccepted === true;
  for (const uid of acceptedBy) {
    const agreed = price(after.agreedPrice);
    pushes.push({
      event: "quote_accepted",
      recipientId: otherThan(uid),
      title: bothAccepted ? "Job confirmed" : "Quote accepted",
      body: bothAccepted && agreed !== null
        ? `"${title}" is confirmed at ${formatUsd(agreed)}.`
        : `${nameOf(uid)} accepted the quote for "${title}".`,
      isQuoteUpdate: true,
    });
  }

  if (
    price(before.proposedPrice) !== null
    && price(after.proposedPrice) === null
    && after.status === "negotiating"
    && typeof before.quoteBy === "string"
  ) {
    pushes.push({
      event: "quote_declined",
      recipientId: before.quoteBy,
      title: "Quote declined",
      body: `Your quote for "${title}" was declined. You can send a new one in the chat.`,
      isQuoteUpdate: true,
    });
  }

  if (
    before.paymentStatus !== after.paymentStatus
    && (after.paymentStatus === "paid" || after.paymentStatus === "refunded")
    && employeeId
  ) {
    const label = after.paymentStatus;
    pushes.push({
      event: label === "paid" ? "payment_updated" : "payment_refunded",
      recipientId: employeeId,
      title: `Payment ${label}`,
      body: `${employerName} marked "${title}" as ${label}.`,
      isQuoteUpdate: false,
    });
  }

  if (before.status !== "completed" && after.status === "completed" && employeeId) {
    pushes.push({
      event: "job_completed",
      recipientId: employeeId,
      title: "Job completed",
      body: `${employerName} marked "${title}" as completed. Leave a review!`,
      isQuoteUpdate: false,
    });
  }

  const reviewedBefore = Array.isArray(before.reviewedBy) ? before.reviewedBy : [];
  const reviewedAfter = Array.isArray(after.reviewedBy) ? after.reviewedBy : [];
  for (const reviewer of reviewedAfter) {
    if (typeof reviewer !== "string" || reviewedBefore.includes(reviewer)) continue;
    pushes.push({
      event: "review_submitted",
      recipientId: otherThan(reviewer),
      title: "New review received",
      body: `${nameOf(reviewer)} left you a review on "${title}".`,
      isQuoteUpdate: false,
    });
  }

  return pushes.filter((push) => push.recipientId.length > 0);
}

export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/.test(token);
}
