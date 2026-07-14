# Client Onboarding and Verification Design

**Date:** 2026-07-14

**Status:** Approved for implementation planning

## Objective

Build a client onboarding and verification workflow that requires identity, liveness, profile-photo, and regulated business evidence before PB Finance grants verified-client capabilities. PB Finance admins review the evidence manually and transcribe the exact Legal Business Name from the accepted business document into a protected backend field exposed as `verifiedBusinessName`.

## Product Decisions

- PB Finance admins perform the initial identity, liveness, and business-document review. No external OCR, KYC, or liveness vendor is included in this version.
- Pending and rejected clients retain limited Basic browsing.
- Jobs, interviews, full professional documents, verification-dependent billing, and other Verified or VIP capabilities remain unavailable until approval.
- The client must provide all of the following:
  - A valid government ID.
  - A liveness selfie captured specifically for review.
  - A profile picture.
  - Exactly one accepted business proof: a US EIN Letter (CP575), State Business Registration, or EU VAT Certificate.
- The editable display-company name and the verified legal business name are separate values with different trust levels.
- Approved evidence is locked. Replacing or removing approved evidence requires an admin-controlled reset and a new review.

## Existing System Fit

PB Finance already has a React/Vite client portal, a single Vercel API router, Supabase Auth and application data, private document-preview helpers, admin review surfaces, and a professional identity-verification workflow. The client workflow will reuse the established upload, signed-preview, role-check, notification, and tier-gating patterns without storing client verification data inside professional-profile records.

The client portal currently models `basic`, `verified`, and `vip` tiers. Verification approval promotes a Basic client to `verified`. A separately granted VIP client must still have an approved client-verification record; resetting or rejecting verification removes protected access and returns the account to `basic` until reapproval.

## Chosen Architecture

Use dedicated verification records rather than extending the mutable `client_companies` profile or introducing a generic cross-product verification framework.

### `client_verifications`

One current verification case per client, containing:

- `client_id`: owner and primary key.
- `status`: `draft`, `pending_review`, `approved`, or `rejected`.
- `verified_business_name`: the protected Legal Business Name copied by an admin from the accepted business proof.
- `decision_reason`: the client-visible rejection or reset reason.
- `internal_review_notes`: optional admin-only notes that are never returned by client endpoints or included in client notifications.
- `submitted_at`, `reviewed_at`, and `reviewed_by`.
- `reset_at` and `reset_by` for an admin-controlled re-verification cycle.
- Standard creation and update timestamps.

`verified_business_name` must be null unless the case is approved. It is mapped to the camel-case API field `verifiedBusinessName` only by trusted server code.

### `client_verification_documents`

Store immutable evidence metadata separately from the case:

- `id` and `client_id`.
- `kind`: `valid_id`, `liveness_selfie`, `profile_photo`, or `business_proof`.
- `business_document_type`: null for non-business evidence and one of `cp575_ein_letter`, `state_business_registration`, or `eu_vat_certificate` for `business_proof`.
- Private storage path, original safe filename, detected content type, byte size, and SHA-256 digest.
- `status`: `draft`, `submitted`, `approved`, `rejected`, or `superseded`.
- Upload, submission, review, rejection, and supersession timestamps.
- Reviewer and rejection-reason fields.

Only one current, non-superseded artifact may exist for each required `kind`. Replacing draft or rejected evidence marks the prior record `superseded`; it does not erase history.

### `client_verification_events`

Append an audit entry for submission, approval, rejection, reset, upload replacement, and protected-name changes. Each event records the client, actor, event type, reason, safe metadata, and timestamp. Storage contents, raw IDs, and private signed URLs are never copied into event metadata.

## Protected Legal Business Name Contract

The trusted source variable is `verifiedBusinessName` in server-side JavaScript and `verified_business_name` in Postgres.

- Clients cannot send this field through create, upload, submission, profile, company, or verification APIs.
- The admin approval endpoint requires `verifiedBusinessName` and `verifiedBusinessNameConfirmation`; the two values must match exactly.
- Server validation removes leading and trailing whitespace and rejects control characters. It preserves capitalization, punctuation, suffixes, accents, and internal spacing exactly as entered from the document.
- The approval operation atomically sets the protected name, approved status, reviewer, review time, evidence status, audit event, and verified client tier.
- A database guard rejects owner-originated changes to verification status, reviewer fields, approval timestamps, or `verified_business_name`.
- A later correction requires an admin reset followed by a new approval. The previous value remains discoverable through the audit event history.
- UI code may display `verifiedBusinessName` after approval but may never treat it as an editable form default.

The editable `profiles.company` and `client_companies.name` fields remain display and onboarding values. Neither field can populate or overwrite `verifiedBusinessName` after account creation.

## Payment Middleware Contract

Expose one server-only accessor with the semantic contract:

```js
getVerifiedBusinessIdentity(clientId)
// Approved: { verificationStatus: 'approved', verifiedBusinessName: 'Exact Legal Name, LLC' }
// Otherwise: { verificationStatus: 'draft|pending_review|rejected', verifiedBusinessName: null }
```

The accessor reads only the approved verification record and never falls back to `profiles.company`, `client_companies.name`, cardholder names, invoice names, or user metadata. Future Stripe middleware must call it before comparing a Stripe billing name. Comparison code may derive a temporary normalized comparison value, but it must never mutate or replace the stored exact name.

No Stripe API integration or automatic billing-name comparison is part of this implementation.

## Client Experience

Add a persistent `Verification` destination to the client portal and a verification-status banner on protected views.

For draft or rejected clients, the Verification dashboard presents four requirement cards:

1. Valid government ID.
2. Liveness selfie.
3. Profile picture.
4. Business proof with an explicit document-type selector limited to the three accepted categories.

Each card shows missing, uploaded, rejected, under-review, or approved state. Upload controls explain accepted formats and limits before selection. Business-proof copy explicitly says that one accepted document is required; no other business-document category can be submitted.

The submit action remains disabled until all four current artifacts exist and the business proof has an accepted type. Successful submission changes the case to `pending_review`, locks every artifact, and shows the submission time and expected manual-review state.

Rejected cases show the admin's client-visible reason and reopen only the rejected requirements. Replacing any reopened artifact returns the case to `draft`; the client must resubmit the complete case.

Approved cases show a Verified badge, approval date, and read-only `verifiedBusinessName`. Approved upload controls are replaced by locked-state messaging. An admin reset changes the client back to Basic access and reopens the required evidence flow.

Unverified clients may navigate Basic discovery and existing Basic shortlist behavior. Attempts to use protected actions receive a consistent verification-required response and a link to the Verification dashboard. The Billing view shows verification status instead of payment controls until approval.

## Admin Experience

Add a client-verification queue to the admin console with filters for draft, pending, approved, and rejected cases, plus a recently-reset audit filter. A reset case immediately returns to `draft`; reset is an event, not a fifth case status. The review detail includes:

- Client identity and display-company context, clearly labeled as unverified context.
- Signed, short-lived previews for the current valid ID, liveness selfie, profile photo, and business proof.
- Business-document category, original filename, upload time, and digest metadata.
- Independent attestations that the ID is valid, the liveness evidence is acceptable, the profile picture matches, and the business proof is acceptable.
- Two blank Legal Business Name inputs. Neither is prefilled from editable client profile data.
- Approve and reject actions. Rejection requires a client-visible reason and selection of at least one rejected requirement.

Approval is disabled until all attestations are checked, both legal-name entries match, and all four artifacts are current and submitted. Admin previews must use the existing authenticated document-preview pattern and must not expose permanent object URLs.

Approved cases expose a separate reset action that requires an admin reason. Resetting invalidates verified access immediately, preserves evidence and events for audit, and opens a new verification cycle.

## API Surface

Extend the existing backend client and admin namespaces with focused endpoints:

- `GET /client/verification`: return the owner's case, safe document metadata, allowed document types, and computed requirement state.
- `POST /client/verification/uploads`: validate and store one required artifact, superseding an eligible draft or rejected artifact of the same kind.
- `POST /client/verification/submit`: validate all requirements and move the complete case to `pending_review`.
- `GET /admin/client-verifications`: list safe verification summaries for admins.
- `GET /admin/client-verifications/:clientId`: return an admin review view with safe metadata.
- `POST /admin/client-verifications/:clientId/decision`: approve or reject a submitted case.
- `POST /admin/client-verifications/:clientId/reset`: reset an approved or rejected case with an audit reason.
- Existing authenticated document-preview endpoints are extended to authorize client-verification evidence for its owner and admins.

The exact route encoding may follow the single-router query/body conventions already used by the project if dynamic path segments would complicate Vercel routing. The authorization and response contracts remain unchanged.

## Upload and Storage Security

- Use a private `client-verification-documents` bucket for ID, liveness, and business evidence.
- Store the profile picture through the existing profile-photo mechanism while recording the approved verification artifact metadata and digest in `client_verification_documents`.
- Accept only explicitly configured PDF, JPEG, and PNG combinations appropriate to each evidence kind. The backend validates declared MIME type, decoded bytes, extension, file size, and basic file signature.
- Generate storage object names server-side from client ID, evidence kind, random identifier, and safe extension. Never use the submitted filename as an object path.
- Never accept a client-supplied storage path, reviewer, status, digest, or owner ID.
- Use short-lived signed previews and `Cache-Control: no-store` for regulated evidence.
- Owners can retrieve safe metadata and authorized previews for their own records but cannot query or mutate verification tables directly. All mutations pass through authenticated backend handlers.
- Admin handlers require the existing admin role check before any service-role database or storage operation.
- Approval and reset use narrowly scoped service-role database operations that apply the case, evidence, tier, and audit changes atomically. Any database function used for this purpose revokes execution from `PUBLIC`, `anon`, and `authenticated` and grants it only to `service_role`.
- RLS remains enabled on all exposed tables. Direct `anon` and `authenticated` mutations of protected verification fields are denied.

## State and Access Rules

### Draft

- Client can upload or replace draft/rejected requirements.
- `verifiedBusinessName` is null.
- Client tier remains Basic.

### Pending Review

- All current artifacts are locked.
- Only admins can decide or reset the case.
- `verifiedBusinessName` remains null.
- Client tier remains Basic.

### Approved

- All submitted artifacts are approved and locked.
- `verifiedBusinessName` is non-empty and protected.
- A Basic client becomes Verified. VIP access can be granted separately only while verification remains approved.

### Rejected

- `verifiedBusinessName` is null.
- The account has Basic access.
- The rejected requirement set and client-visible reason are exposed to the owner.
- Reopened evidence can be replaced, after which the case returns to Draft and requires full resubmission.

## Error Handling and Consistency

- Invalid type, size, file signature, or business-document category returns a field-specific `400` response without changing the current case.
- A submission with missing or rejected evidence returns the full missing-requirements list and stays Draft.
- Upload or submission attempts during `pending_review` or `approved` return `409` and do not replace evidence.
- An approval against a non-pending or stale case returns `409` and creates no partial approval data.
- Exact-name mismatch or an unacknowledged attestation returns `400` before the approval transaction.
- Storage succeeds before metadata becomes current. If metadata persistence fails, the backend attempts to remove the orphaned object and reports a retryable failure.
- Replacing evidence changes the current record only after the new object and metadata are valid, so a failed replacement does not destroy the prior usable artifact.
- Notifications are best-effort after the database state is committed; notification failure does not roll back a valid review decision.

## Notifications

- Notify PB Finance admins when a client submits a complete case.
- Notify the client when the case is approved, rejected, or reset.
- Rejection and reset notifications include the client-visible reason and link to the Verification dashboard.
- Use the existing in-app notification and email helpers. No new external notification provider is required.

## Testing Strategy

### Backend unit and route tests

- Every missing requirement blocks submission independently.
- Only `cp575_ein_letter`, `state_business_registration`, and `eu_vat_certificate` are accepted for `business_proof`.
- Non-business evidence cannot carry a business-document type, and business proof must carry one.
- Upload validation rejects mismatched MIME type, extension, signature, oversized data, client-supplied paths, and client-supplied protected fields.
- Clients cannot approve, reject, reset, assign a reviewer, or set `verifiedBusinessName`.
- Admin approval requires a pending case, four submitted artifacts, all attestations, and two exactly matching legal-name entries.
- Casing, punctuation, accents, suffixes, and internal spacing are preserved in `verifiedBusinessName`.
- Approval and reset update verification state, client tier, evidence state, and audit events consistently.
- The payment identity accessor returns the protected name only for an approved case and never falls back to display-company data.
- Pending and rejected users retain Basic capabilities but fail protected capability checks.
- Approved-document replacement returns `409` until an admin reset.

### Database security tests

- RLS prevents cross-client reads and all direct owner mutations of protected fields.
- Database constraints reject illegal status/name and kind/business-document-type combinations.
- Owner-originated updates cannot change review fields or `verified_business_name`.
- Service-only approval performs the complete state transition without exposing execution to `anon` or `authenticated` roles.

### Frontend tests

- Requirement cards and status states render from API data.
- Submit is disabled until all requirements are current.
- Pending and approved states remove upload controls.
- Rejection shows the reason and reopens only selected requirements.
- Verified legal name is read-only and never appears as an editable input.
- Protected client views show a verification-required state for Basic clients.
- Admin approval remains disabled until attestations and exact-name confirmation are complete.

### Completion verification

Run the focused backend and frontend tests, the full test suite, lint, production build, Supabase schema/security checks available in the local environment, and a browser walkthrough of client submission, admin rejection/resubmission, admin approval, access gating, and the read-only verified-name display.

## Out of Scope

- Automated OCR or extraction of the Legal Business Name.
- Third-party automated KYC or liveness scoring.
- Stripe API calls or automatic billing-name enforcement.
- Multiple business entities under one client account.
- Automatic government-registry validation.
- Changes to the existing Professional Onboarding module. That module will be audited separately against the supplied professional requirements after the client module is delivered.

## Acceptance Criteria

The feature is acceptable when a client can submit all four required evidence categories, an admin can approve or reject the complete case, and approval alone produces an immutable trusted `verifiedBusinessName` and verified access. No client-controlled input or fallback profile field can create or overwrite that trusted value. Future payment code has one server-only accessor that returns the exact approved name or null, and all pending, rejected, reset, and failure states preserve Basic-only access and auditable evidence history.
