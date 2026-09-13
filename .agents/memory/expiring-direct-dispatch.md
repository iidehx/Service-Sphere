---
name: Expiring direct dispatch
description: Security and concurrency rules for time-limited requests sent to one selected marketplace provider.
---

Time-limited direct requests must grant recipient access only while the request is pending. Expiry, acceptance, and decline must update the request, listing access fields, and recipient reservation transactionally. Cleanup must re-read current state so it cannot overwrite a response or delete a replacement reservation.

**Why:** Client-time query bounds are not reliably provable in Firestore rules, and unconditional scheduled cleanup can race with responses or newer reservations. Trusted selection must also use authoritative private account state so stale public mirrors cannot select disabled users.

**How to apply:** For any future dispatch-style feature, keep recipient selection server-side, use one active reservation per recipient, make responses idempotent, throttle by sender across records, and use server-maintained pending/expired state for rule-compatible reads.