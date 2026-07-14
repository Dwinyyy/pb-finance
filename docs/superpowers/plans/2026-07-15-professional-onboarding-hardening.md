# Professional Onboarding Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Professional Onboarding audit gaps with valid-ID expiration, distinct required evidence, resilient compliance reminders, locked approved identity documents, configured email, and opt-in browser Web Push.

**Architecture:** Extend the existing professional JSON evidence contract with server-derived SHA-256 and expiry metadata, keep expiration decisions in pure server helpers, and add a service-role-only Supabase subscription store plus a focused Web Push delivery module. Reuse the current Vercel API router, notification bell, admin notifications, and Professional Verification Center rather than introducing a parallel onboarding system.

**Tech Stack:** React 19, Vite 8, Node.js test runner, Vercel Functions/Cron, Supabase Postgres/Auth, Brevo, `web-push`, Tailwind CSS 4.

## Global Constraints

- PB Finance admins remain the only approvers.
- Valid ID front, liveness selfie, resume, regulated inputs, and every separately required certification must be complete before approval.
- Valid ID front requires a future expiration date.
- Identical file bytes cannot satisfy two required certification slots.
- Approved identity and credential evidence remains locked until admin action.
- Reminder bands are 60, 30, and 7 days and are idempotent by professional, document, event type, and expiration date.
- Direct browser access to push subscription rows is denied; the authenticated backend uses `service_role`.
- Email sends when Brevo is configured unless `NOTIFICATION_EMAILS_DISABLED=true`.
- Browser push permission is requested only after explicit user action.

---

### Task 1: Professional Compliance Domain

**Files:**
- Modify: `api/index.js`
- Modify: `tests/professional-onboarding.test.js`

**Interfaces:**
- Produces: `getIdentitySubmissionBlocker(profile, { now })`, `getDuplicateRequiredCredentialBlocker(profile)`, `getDocumentExpirationActions(profile, options)`, and sanitized `fileSha256`/`expiryDate` metadata.

- [x] Write failing tests for missing, invalid, and expired ID expiry; duplicate certification digests; 59/29/6-day reminder recovery; mixed expiry/reminder actions; and approved identity expiration.
- [x] Run `node --test tests/professional-onboarding.test.js` and confirm the failures are caused by the missing behavior.
- [x] Derive SHA-256 from decoded bytes, preserve the digest through sanitization, compare only required certification slots, and reject duplicate required evidence at upload and submission/approval validation.
- [x] Require a future `validIdFront.expiryDate` and include approved ID evidence in expiration actions.
- [x] Replace exact-day reminder matching with the 60/30/7 urgency bands while retaining existing event-key idempotence.
- [x] Run the focused tests and attempt `npm run check:backend`; tests pass and the live check reports the isolated worktree's missing Supabase environment values.
- [x] Commit as `feat: harden professional compliance evidence`.

### Task 2: Push Subscription Schema and Delivery

**Files:**
- Create: `server/pushNotifications.js`
- Create: `tests/professional-notifications.test.js`
- Create: `tests/professional-notification-schema.test.js`
- Create: `supabase/migrations/<generated>_professional_verification_hardening.sql`
- Modify: `supabase/schema.sql`
- Modify: `server/notifications.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `getWebPushConfig()`, `sendPushNotifications(payload)`, `shouldSendNotificationEmail(env)`, and `public.push_subscriptions`.

- [x] Add failing tests for explicit email disable, configured-by-default email, missing VAPID configuration, successful sends, stale-subscription cleanup, and protected schema grants.
- [x] Run the notification and schema tests and confirm RED.
- [x] Use `npx supabase migration new professional_verification_hardening` to create the migration, then add the RLS-enabled subscription table, indexes, updated-at trigger, explicit service-role grant, and revoked browser grants to both schema sources.
- [x] Install and pin `web-push`, configure VAPID from server environment variables, send safe JSON payloads, and delete 404/410 subscriptions.
- [x] Change Brevo notification email semantics so only the exact case-insensitive string `true` disables configured email delivery.
- [x] Extend `notifyUser` with independent Web Push delivery results.
- [x] Run focused and schema tests; all pass, while the live backend check remains unavailable without Supabase environment values.
- [x] Commit as `feat: add professional push notifications`.

### Task 3: API and Professional UI

**Files:**
- Create: `public/pb-push-sw.js`
- Create: `src/services/pushNotifications.js`
- Modify: `api/index.js`
- Modify: `src/services/api.js`
- Modify: `src/components/NotificationBell.jsx`
- Modify: `src/pages/ProfessionalPages.jsx`
- Modify: `tests/professional-onboarding.test.js`
- Modify: `tests/professional-notifications.test.js`

**Interfaces:**
- Produces: push config/upsert/delete endpoints, browser subscription helpers, ID expiry upload, identity change requests, and approved identity lock UI.

- [x] Add failing static contract tests for the three push routes, service-worker opt-in, ID expiry input/payload, approved identity lock, and Request Change/Removal wording.
- [x] Run focused tests and confirm RED.
- [x] Add authenticated push config, upsert, and delete handlers with structural subscription validation and service-role persistence.
- [x] Add explicit push opt-in status/actions to the notification menu and implement same-origin service-worker click navigation.
- [x] Add ID expiry controls, pass expiry on identity upload, block ready state without it, and replace approved identity upload controls with Request Change/Removal.
- [x] Extend the document-request handler to record reasons on approved identity evidence and notify admins without unlocking the document.
- [x] Run focused tests, `npm run lint`, and `npm run build`; all pass.
- [x] Commit as `feat: complete professional verification controls`.

### Task 4: Operations and End-to-End Verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-15-professional-onboarding-hardening.md`

**Interfaces:**
- Documents: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, `NOTIFICATION_EMAILS_DISABLED`, migration deployment, and VAPID generation.

- [x] Document environment and deployment requirements, daily UTC cron behavior, push opt-in, and admin-only identity change handling.
- [x] Run `npm test`, `npm run check:backend`, `npm run lint`, and `npm run build`; tests, lint, and build pass, while the live backend check reports missing local Supabase environment values.
- [x] Run the available Supabase migration-list/advisor discovery; the CLI confirms this isolated worktree is not linked to a Supabase project, so no live migration or advisor result is claimed.
- [x] Start the Vite server and verify the Professional Verification Center, ID expiry inputs, Verify gating, Profile Settings modal, View Profile As modal, and clean browser console. Approved-lock and configured-push states are covered by automated contracts because authenticated Supabase state is unavailable locally.
- [x] Review the final diff for protected digests, subscription secrets, service-role-only grants, cron authorization, notification best-effort boundaries, and all original Professional prompt requirements.
- [x] Commit as `docs: document professional verification operations`.

## Plan Self-Review

- Spec coverage: the four tasks cover every audit gap and preserve all already-compliant Professional prompt requirements.
- Placeholder scan: the generated migration filename is intentionally produced by the required Supabase CLI command before editing; every behavior and verification command is otherwise explicit.
- Type consistency: persisted evidence uses `fileSha256` and `expiryDate`; database push fields use snake_case and are mapped only inside server code.
- Execution mode: inline in the existing isolated feature worktree because this task does not authorize subagent delegation.
