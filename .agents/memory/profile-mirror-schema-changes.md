---
name: Profile mirror schema changes
description: Safe rollout rules for fields mirrored between private users and public profiles.
---

Any new mirrored profile field must be written to the private user and public profile in the same atomic update. Trusted projection code must supply a safe default when older private documents do not contain the field.

**Why:** Firestore rules compare both documents after a batch. Omitting a new field from either side blocks onboarding, while strict trusted projection can permanently lose one-shot trigger work for legacy accounts.

**How to apply:** For every mirrored profile schema addition, update client projection keys, public projection helpers, rules equality checks, and tests for both a new account and a legacy document missing the field.