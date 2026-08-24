---
name: Expo logout routing
description: Keep Firebase logout navigation stable with URL-transparent Expo route groups.
---

Use an explicit login route when sending an authenticated user out of the tab group.

**Why:** The tab group and root index both resolve to `/`, so replacing the root URL can leave the tab navigator mounted with blank content after Firebase clears the session.

**How to apply:** Route to the dedicated login screen after sign-out and keep authentication redirects centralized at the root navigator.