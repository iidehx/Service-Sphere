---
name: Firebase verification email delivery
description: Configuration and rebuild behavior for Firebase Auth verification emails.
---

Populate and save the Firebase Authentication **Email address verification** template's
**Sender name** and **Reply-to** fields before relying on built-in verification delivery.
Template changes are server-side and do not require rebuilding the client app.

**Why:** A live test initially accepted the send request without delivering the message; after
the blank template fields were filled, the verification emails reached the inbox.

**How to apply:** When setting up a new Firebase project, use a recognizable sender name and a
monitored reply mailbox. Rebuild only when client-bundled Firebase secrets or native app code
changes; template edits can be tested immediately in the current preview/development build.