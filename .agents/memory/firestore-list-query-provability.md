---
name: Firestore list-query provability for role-scoped rules
description: Why splitting a Firestore security rule's `allow read` OR-branches by caller role breaks naive collection queries, and how to fix both the rule and its client queries/tests.
---

When a `match /coll/{id} { allow read: if condA() || (roleCheck() && condB()) || condC(); }` rule branch depends on `resource.data` (e.g. `status == 'open'`), a client **list** query only passes Firestore's security-rule provability check if the query has a `where` clause that structurally guarantees the same condition for every possible result (e.g. `where('status','==','open')`). An unconstrained `collection(db, 'coll')` query — or one scoped to a *different* field than the rule branch relies on — is rejected outright, even if every document happens to satisfy the rule at runtime. Rules provability is evaluated against the query's shape, not the actual data.

**Why:** Learned while scoping job reads by employer/provider role in a marketplace app (task: "Protect employer job privacy"). The original rule allowed any active user to read any job; splitting it into owner-only / open-marketplace / assigned-provider branches required rewriting every client subscription as one `where`-filtered query per branch (no single query can satisfy all three), and any lingering unconstrained `getDocs(collection(...))` in tests or app code immediately started failing with `PERMISSION_DENIED`.

**How to apply:** When tightening a Firestore rule's `allow read`/`allow list` to be role- or ownership-scoped:
- Give each OR-branch its own client query with a matching `where` clause; do not rely on one broad listener plus client-side filtering for enforcement — the query itself is the enforcement boundary.
- If a rule branch should apply to a specific *role* rather than "any signed-in user," gate it explicitly (e.g. `isProvider() && resource.data.status == 'open'`) — leaving off the role check silently reopens that branch to every role, since the query filter alone doesn't restrict who can run it.
- Rule helper functions that call `get(userPath(uid))` throw if the user's own doc doesn't exist — real accounts always have one, but rules-emulator tests that skip full signup/seeding for a given user will fail with a "Null value"/`evaluation error` rather than a permission error; seed the user doc even in minimal test fixtures.
- Audit and update every existing `getDocs(collection(...))` call (app code and rules-emulator tests) against the tightened collection — they're the ones most likely to silently break.
