---
name: Firebase account lifecycle security
description: Durable authorization constraints for email verification and account removal.
---

Marketplace access must be enforced with Firebase Auth’s verified-email claim in Firestore rules, while allowing only the minimal initial profile provisioning required before verification. Account deletion must be a trusted backend operation that removes the Auth identity as well as associated profile documents; direct client-side document deletion cannot free an email address.

**Why:** UI routing can be bypassed by direct Firestore calls, and deleting a Firestore profile alone leaves the Firebase Auth identity—and therefore the email address—behind.

**How to apply:** When adding a new marketplace write path, confirm its rule depends on verified authentication. When changing deletion, preserve the callable-only path, short recent-authentication requirement, retained server tombstone, and Auth-deletion cleanup trigger.