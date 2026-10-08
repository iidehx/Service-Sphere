---
name: Firebase download URL privacy
description: The distinction between private photo metadata and Firebase Storage bearer download links
---

Do not claim that Firebase Storage media is strictly participant-only merely because its `getDownloadURL()` URL is stored in a participant-restricted Firestore document.

**Why:** Firebase download URLs contain bearer tokens. The Firestore rule controls who learns the URL through the app; anyone who obtains the URL can potentially fetch the media independently of the authenticated Storage path rule.

**How to apply:** When evaluating job-photo privacy, distinguish metadata disclosure from object delivery. If strict participant-only delivery is required, use object paths with authenticated reads or a trusted authorization-checked delivery mechanism, and account for previously issued download tokens.
