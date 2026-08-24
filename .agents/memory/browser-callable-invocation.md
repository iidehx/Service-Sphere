---
name: Browser callable invocation
description: Deployment and security boundary for Firebase HTTPS callables reached from a browser.
---

A Firebase HTTPS callable used directly by browser clients must allow public Cloud Run invocation so browser CORS preflight can reach the callable. Keep Firebase Authentication enforcement inside the callable before it performs any data access.

**Why:** Cloud Run IAM is evaluated before the function executes. A private invoker policy returns 403 to the browser's OPTIONS request, so CORS and the callable's authentication checks never run.

**How to apply:** Configure the callable for public invocation and CORS, then verify the deployed Cloud Run service has the public invoker binding and its unauthenticated callable request is still rejected by application code. Do not treat public transport access as permission to remove `request.auth` authorization.