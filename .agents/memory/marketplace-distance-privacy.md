---
name: Marketplace distance privacy
description: Privacy boundary for distance calculations in the pre-acceptance job marketplace.
---

Pre-acceptance distance filters may use only optional centroids for public coarse areas. Store them as integer hundredths of latitude/longitude so security rules can enforce roughly one-kilometer precision. Never use or expose exact coordinates from a job's participant-restricted private location.

**Why:** Providers need useful travel-range filtering, but exact job coordinates are as sensitive as a street address and must not become readable to every marketplace browser.

**How to apply:** Treat missing coarse centroids as not geocoded and explain the uncertainty. Opt-in device-area capture or a trusted future geocoder may populate centroids; exact places remain limited to the employer and assigned provider.