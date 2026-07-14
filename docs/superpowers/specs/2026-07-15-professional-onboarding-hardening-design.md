# Professional Onboarding Hardening Design

**Date:** 2026-07-15

**Status:** Approved for implementation

## Objective

Complete the existing Professional Onboarding and Profile Setup module so PB Finance can reliably enforce valid identity evidence, distinct required credentials, manual approval, expiring-document compliance, locked approved documents, and email, in-app, and browser push notifications.

## Approved Scope

The existing professional workflow remains the foundation. This change closes the audit gaps without replacing the account-registration architecture:

- A professional account may be created before document upload, but the product treats the Verification Center as a mandatory onboarding stage and keeps the main dashboard locked until PB Finance approves the complete submission.
- Valid ID front and liveness selfie remain required. Valid ID front must include a future expiration date. An optional ID back may carry the same kind of expiry metadata.
- Every required PRC license, BOA accreditation, and tax certification remains a separate required slot. The same uploaded bytes cannot satisfy two required certification slots.
- Approved identity and credential records are locked. Professionals submit a reason through a Request Change/Removal action; only admin review can reopen or replace approved evidence.
- The daily expiration check sends the most urgent unsent 60-, 30-, or 7-day reminder band, and downgrades expired professionals from Verified to Basic/unverified. A missed exact calendar day must not skip a reminder permanently.
- In-app notifications remain the durable notification record. Configured Brevo email delivery is enabled unless explicitly disabled. Browser Web Push is opt-in and uses persistent VAPID subscriptions.
- Existing Bio, Rates, Skills, profile-photo guidance, Profile Settings modal, and View Profile As Basic/Verified behavior remain intact.

## Architecture

### Verification records

Keep professional evidence inside the existing `professional_profiles.identity_verification_documents` and `work_preferences` JSON records. Add server-derived `fileSha256` to all newly uploaded identity and credential files. The upload route compares the digest against other required certification slots, and final submission/approval validation repeats the check so legacy or bypassed records cannot be approved.

`cleanCredentialFileRecord` remains the single metadata sanitizer and preserves only server-generated digest and safe upload metadata. Clients cannot submit a trusted digest, path, review status, reviewer, or owner.

### Valid ID expiration

`validIdFront.expiryDate` is required, normalized to `YYYY-MM-DD`, and must be later than the current UTC date when the professional submits for review. The approved valid ID joins approved credentials in the expiration engine. Missing or expired ID evidence blocks approval; an expired approved ID generates the normal expired action and professional downgrade.

### Resilient expiration bands

For every approved expiring document:

- `daysToExpiry <= 0`: `expired`
- `1..7`: `reminder_7`
- `8..30`: `reminder_30`
- `31..60`: `reminder_60`
- `> 60`: no action

The existing event key remains `professional|document|eventType|expiryDate`, so retries are idempotent. Each document emits only its current most urgent unsent band. Expired and reminder actions for different documents may be processed in the same run.

### Web Push

Add an RLS-enabled `public.push_subscriptions` table containing `user_id`, unique endpoint, browser encryption keys, optional expiration time, user agent, and timestamps. The Vercel API writes it with the service role after authenticating the owner. Direct `anon` and `authenticated` table privileges are revoked; `service_role` receives explicit CRUD grants.

The notification server configures `web-push` with `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT`. `notifyUser` creates the in-app notification, attempts email, and sends the same safe title/body/action URL to every subscription. HTTP 404 and 410 push responses remove stale subscriptions. Notification-channel failures remain best effort and never roll back compliance state.

The browser registers `/pb-push-sw.js` only after a user clicks Enable push alerts. The service worker displays the notification and focuses or opens the same-origin action URL when clicked. No permission prompt appears automatically on page load.

### Document locking and requests

Approved credential and identity cards replace Upload/Replace controls with Request Change/Removal. The existing request modal captures a structured reason. The backend extends the current document-request route to store the request on identity evidence and notify PB Finance admins; it does not unlock or delete the document.

## API and UI Changes

- `GET /notifications/push-config`: authenticated response with `configured` and the VAPID public key.
- `POST /notifications/push-subscription`: authenticated upsert of the caller's validated PushSubscription.
- `DELETE /notifications/push-subscription`: authenticated deletion of the caller's endpoint.
- `POST /talent/uploads`: derives SHA-256 and rejects duplicate required certification evidence.
- `POST /talent/identity-uploads`: requires and stores ID expiry metadata and derives SHA-256.
- `POST /talent/document-request`: supports approved identity evidence as well as resume/supporting documents.
- Professional Verification Center adds ID expiry input, approved lock states, clearer Request Change/Removal wording, and push opt-in inside the existing notification menu.

## Security and Error Handling

- VAPID private keys and Supabase service-role credentials remain server-only.
- Subscription endpoints and encryption keys are never returned through professional profile responses.
- Push subscription payloads are structurally validated and bound to the authenticated user ID.
- Duplicate-file enforcement uses a server-computed SHA-256 digest, not a filename or client-provided hash.
- Failed storage or database operations do not silently mark a document complete.
- Approved evidence stays immutable until an admin acts on a recorded request.
- Cron access continues to require an authenticated admin or exact `CRON_SECRET` bearer value.

## Testing

- Domain tests cover future ID expiry, missing/expired ID blockers, SHA-256 preservation, duplicate required-credential detection, resilient threshold bands, idempotence, and mixed expired/reminder actions.
- Notification tests cover configured-by-default email semantics, explicit disable, Web Push configuration, successful delivery, and 404/410 cleanup.
- Schema tests cover the protected subscription table, RLS, explicit service-role grants, and no direct authenticated grants.
- Static UI/API contract tests cover push endpoints, service worker registration, ID expiry inputs, approved identity locking, and Request Change/Removal copy.
- Completion requires the full tests, backend import check, lint, build, and browser verification of Professional onboarding and notification opt-in states.

## Out of Scope

- Automated government registry verification, OCR, facial matching, or third-party KYC.
- Native mobile push providers.
- Automatic admin approval or automatic document removal.
- Replacing the existing PB Finance registration screens with pre-authenticated file uploads.

## Acceptance Criteria

The Professional dashboard remains locked until PB Finance approves a valid, unexpired ID, liveness evidence, resume, required regulated inputs, and every individually required certification. Identical file contents cannot satisfy multiple required certification slots. Approved documents cannot be replaced or removed by the professional. Expiration enforcement remains reliable after a missed cron day, and configured in-app, email, and opt-in browser push channels receive compliance notifications without exposing protected subscription or credential data.
