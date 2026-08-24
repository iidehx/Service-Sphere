---
name: Metro image-size compatibility
description: Keep Metro's image-size interface compatible while applying parser hardening.
---

Use a locally patched `image-size` v1.2.1 rather than overriding it to v2 for Metro/Expo projects.

**Why:** Metro consumes the v1 buffer-oriented interface during asset bundling. The v2 override caused Metro to return HTTP 500 for standard PNG assets, blocking static iOS and Android Expo bundles.

**How to apply:** Keep any parser safety guards as a `pnpm` patch against v1.2.1, and rerun the static Expo build after changing that dependency.