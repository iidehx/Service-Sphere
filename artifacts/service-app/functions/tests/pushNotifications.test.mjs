import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveJobPushes, formatUsd, isExpoPushToken } from "../lib/pushNotifications.js";

const open = {
  title: "Fix door",
  employerId: "employer",
  employerName: "Erin",
  status: "open",
  paymentStatus: "pending",
  employerQuoteAccepted: false,
  employeeQuoteAccepted: false,
  reviewedBy: [],
};
const negotiating = { ...open, employeeId: "provider", employeeName: "Pat", status: "negotiating" };
const quoted = { ...negotiating, proposedPrice: 110, quoteBy: "provider" };
const accepted = {
  ...quoted,
  status: "accepted",
  employerQuoteAccepted: true,
  employeeQuoteAccepted: true,
  agreedPrice: 110,
};
const summary = (pushes) => pushes.map(({ event, recipientId }) => `${event}->${recipientId}`);

test("a provider claiming a job notifies the employer", () => {
  assert.deepEqual(summary(deriveJobPushes(open, negotiating)), ["job_accepted->employer"]);
});

test("a new quote notifies the other participant and is a quote update", () => {
  const [push] = deriveJobPushes(negotiating, quoted);
  assert.equal(push.event, "quote_proposed");
  assert.equal(push.recipientId, "employer");
  assert.equal(push.isQuoteUpdate, true);
  assert.match(push.body, /Pat proposed \$110/);
});

test("one-sided and mutual quote acceptance notify the other side", () => {
  const providerAccepted = { ...quoted, employeeQuoteAccepted: true };
  assert.deepEqual(summary(deriveJobPushes(quoted, providerAccepted)), ["quote_accepted->employer"]);
  const [confirmed] = deriveJobPushes(providerAccepted, accepted);
  assert.equal(confirmed.recipientId, "provider");
  assert.equal(confirmed.title, "Job confirmed");
});

test("declining a quote notifies whoever proposed it", () => {
  const { proposedPrice, quoteBy, ...declined } = quoted;
  assert.deepEqual(summary(deriveJobPushes(quoted, declined)), ["quote_declined->provider"]);
});

test("payment, completion, and reviews notify the right participant", () => {
  assert.deepEqual(summary(deriveJobPushes(accepted, { ...accepted, paymentStatus: "paid" })), [
    "payment_updated->provider",
  ]);
  const completed = { ...accepted, status: "completed" };
  assert.deepEqual(summary(deriveJobPushes(accepted, completed)), ["job_completed->provider"]);
  assert.deepEqual(summary(deriveJobPushes(completed, { ...completed, reviewedBy: ["provider"] })), [
    "review_submitted->employer",
  ]);
});

test("an emergency request notifies only the selected provider", () => {
  const emergency = { ...open, status: "emergency_pending", emergency: true };
  const pending = { ...emergency, emergencyRequestStatus: "pending", emergencyRequestedProviderId: "provider" };
  assert.deepEqual(summary(deriveJobPushes(emergency, pending)), ["emergency_requested->provider"]);
});

test("unrelated edits send nothing", () => {
  assert.deepEqual(deriveJobPushes(open, { ...open, details: "New details" }), []);
  assert.deepEqual(deriveJobPushes(accepted, { ...accepted }), []);
});

test("money and token formatting", () => {
  assert.equal(formatUsd(104.5), "$104.50");
  assert.equal(formatUsd(110), "$110");
  assert.equal(isExpoPushToken("ExponentPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("https://evil.example"), false);
});
