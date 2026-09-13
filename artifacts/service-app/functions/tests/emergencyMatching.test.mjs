import assert from "node:assert/strict";
import { test } from "node:test";
import { hasScheduleConflict, rankEmergencyCandidates } from "../lib/emergencyMatching.js";

const now = Date.parse("2026-09-14T12:00:00.000Z");
const at = Date.parse("2026-09-14T16:00:00.000Z");
const candidate = (id, latE2, extra = {}) => ({
  id,
  name: id,
  categories: ["Plumbing"],
  availableForWork: true,
  emergencyOptIn: true,
  availability: "Weekdays 8am-6pm",
  availabilityUpdatedAtMs: now,
  availabilityTimezoneOffsetMinutes: 0,
  areaCoordinates: { latE2, lngE2: -9774 },
  ...extra,
});

test("orders eligible providers by distance and uses id for exact ties", () => {
  const ranked = rankEmergencyCandidates({
    candidates: [candidate("z", 3030), candidate("b", 3027), candidate("a", 3027)],
    jobs: [],
    category: "Plumbing",
    location: { latE2: 3026, lngE2: -9774 },
    requestedAtMs: at,
    nowMs: now,
  });
  assert.deepEqual(ranked.map(({ id }) => id), ["a", "b", "z"]);
});

test("excludes stale, opted-out, unavailable, unlocated, off-schedule, and busy providers", () => {
  const candidates = [
    candidate("eligible", 3027),
    candidate("stale", 3027, { availabilityUpdatedAtMs: now - 25 * 60 * 60_000 }),
    candidate("opted-out", 3027, { emergencyOptIn: false }),
    candidate("busy-toggle", 3027, { availableForWork: false }),
    candidate("unlocated", 3027, { areaCoordinates: undefined }),
    candidate("weekend-only", 3027, { availability: "Weekends only" }),
    candidate("appointment", 3027),
  ];
  const ranked = rankEmergencyCandidates({
    candidates,
    jobs: [{ employeeId: "appointment", status: "accepted", scheduledAt: new Date(at + 60_000).toISOString() }],
    category: "Plumbing",
    location: { latE2: 3026, lngE2: -9774 },
    requestedAtMs: at,
    nowMs: now,
  });
  assert.deepEqual(ranked.map(({ id }) => id), ["eligible"]);
});

test("schedule conflict excludes overlaps but permits the two-hour boundary", () => {
  assert.equal(hasScheduleConflict("p", at, [{ employeeId: "p", status: "negotiating", scheduledAt: new Date(at + 7_199_999).toISOString() }]), true);
  assert.equal(hasScheduleConflict("p", at, [{ employeeId: "p", status: "accepted", scheduledAt: new Date(at + 7_200_000).toISOString() }]), false);
  assert.equal(hasScheduleConflict("p", at, [{ employeeId: "p", status: "completed", scheduledAt: new Date(at).toISOString() }]), false);
});

test("numeric work hours and timezone offsets are enforced", () => {
  const outsideHours = rankEmergencyCandidates({
    candidates: [candidate("outside", 3027)],
    jobs: [],
    category: "Plumbing",
    location: { latE2: 3026, lngE2: -9774 },
    requestedAtMs: Date.parse("2026-09-14T22:00:00.000Z"),
    nowMs: now,
  });
  assert.deepEqual(outsideHours, []);
  const localAfternoon = rankEmergencyCandidates({
    candidates: [candidate("local", 3027, { availabilityTimezoneOffsetMinutes: 360 })],
    jobs: [],
    category: "Plumbing",
    location: { latE2: 3026, lngE2: -9774 },
    requestedAtMs: Date.parse("2026-09-14T22:00:00.000Z"),
    nowMs: now,
  });
  assert.deepEqual(localAfternoon.map(({ id }) => id), ["local"]);
});

test("excludes providers outside the nearby matching radius", () => {
  const ranked = rankEmergencyCandidates({
    candidates: [candidate("nearby", 3027), candidate("far-away", 3126)],
    jobs: [],
    category: "Plumbing",
    location: { latE2: 3026, lngE2: -9774 },
    requestedAtMs: at,
    nowMs: now,
  });
  assert.deepEqual(ranked.map(({ id }) => id), ["nearby"]);
});