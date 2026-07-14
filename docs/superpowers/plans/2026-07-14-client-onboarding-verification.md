# Client Onboarding and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure PB Finance client-verification workflow whose admin-approved Legal Business Name is stored as `verified_business_name`, exposed as `verifiedBusinessName`, and available to future payment middleware without falling back to editable company data.

**Architecture:** Add focused verification-domain helpers, three RLS-protected Supabase tables, service-role-only decision RPCs, and private Storage evidence. Extend the existing Vercel API router with client/admin endpoints, then add isolated client and admin React components that reuse the current portal and document-preview patterns.

**Tech Stack:** React 19, Vite 8, Node.js test runner, Vercel Functions, Supabase Postgres/Auth/Storage, Tailwind CSS 4, Lucide React.

## Global Constraints

- PB Finance admins perform manual review; no external OCR, automated KYC, or automated liveness provider is added.
- Valid ID, liveness selfie, profile picture, and exactly one CP575 EIN Letter, State Business Registration, or EU VAT Certificate are required.
- Pending, rejected, and reset clients retain only Basic access.
- Clients cannot create, edit, or overwrite `verifiedBusinessName`.
- `verifiedBusinessName` preserves case, punctuation, accents, suffixes, and internal spacing after boundary whitespace is trimmed.
- Approved evidence is locked until an admin reset.
- Payment identity lookup never falls back to `profiles.company`, `client_companies.name`, user metadata, invoice names, or cardholder names.
- All exposed verification tables use RLS; private evidence uses short-lived signed access only.
- The Professional Onboarding audit remains a separate follow-up after client delivery.

---

## File Structure

- Create `server/clientVerification.js`: verification constants, upload validation, requirement/state mapping, exact-name validation, and payment identity shaping.
- Create `src/utils/clientVerification.js`: client/admin UI state derivation and accepted-file helpers.
- Create `src/components/ClientVerificationDashboard.jsx`: client evidence upload, submission, status, and locked-state UI.
- Create `src/components/ClientVerificationAdmin.jsx`: admin queue, evidence review, attestations, exact-name confirmation, decision, and reset UI.
- Create `tests/client-verification.test.js`: domain and protected-name tests.
- Create `tests/client-verification-ui.test.js`: frontend state-model tests.
- Create `tests/client-verification-schema.test.js`: schema/RLS/RPC contract checks.
- Modify `supabase/schema.sql`: verification tables, constraints, RLS, audit, and service-role-only decision RPCs.
- Modify `api/index.js`: storage/data helpers, client/admin verification routes, signed preview authorization, and `getVerifiedBusinessIdentity`.
- Modify `src/services/api.js`: typed-by-convention client/admin verification methods.
- Modify `src/pages/ClientPages.jsx`: Verification tab, verification status banner, and billing gate.
- Modify `src/pages/AdminPages.jsx`: Client Verification admin tab.
- Modify `package.json`: add a complete Node test script.
- Modify `README.md`: document new routes, schema objects, storage bucket, and payment identity contract.

---

### Task 1: Verification Domain Contract

**Files:**
- Create: `server/clientVerification.js`
- Create: `tests/client-verification.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `CLIENT_VERIFICATION_DOCUMENT_KINDS`, `CLIENT_BUSINESS_DOCUMENT_TYPES`, `parseClientVerificationUpload(body)`, `getClientVerificationRequirements(documents)`, `validateClientVerificationSubmission(documents)`, `validateClientVerificationDecision(input)`, `mapClientVerification(caseRow, documentRows)`, and `toVerifiedBusinessIdentity(caseRow)`.
- Consumes: only Node built-ins and plain records.

- [ ] **Step 1: Add the test command and failing domain tests**

```json
{
  "scripts": {
    "test": "node --test",
    "test:client-verification": "node --test tests/client-verification.test.js tests/client-verification-ui.test.js tests/client-verification-schema.test.js"
  }
}
```

```js
test('submission requires every verification artifact', () => {
  const result = validateClientVerificationSubmission([
    document('valid_id'),
    document('liveness_selfie'),
    document('profile_photo'),
  ]);
  assert.deepEqual(result.missingKinds, ['business_proof']);
  assert.equal(result.valid, false);
});

test('admin decision preserves the exact legal name', () => {
  const result = validateClientVerificationDecision({
    attestations: {
      businessProofAccepted: true,
      idAccepted: true,
      livenessAccepted: true,
      profilePhotoMatches: true,
    },
    verifiedBusinessName: '  Acme Holdings, S.A.  ',
    verifiedBusinessNameConfirmation: 'Acme Holdings, S.A.',
  });
  assert.equal(result.verifiedBusinessName, 'Acme Holdings, S.A.');
});

test('payment identity never falls back to unapproved names', () => {
  assert.deepEqual(toVerifiedBusinessIdentity({
    status: 'pending_review',
    verified_business_name: 'Editable Company',
  }), {
    verificationStatus: 'pending_review',
    verifiedBusinessName: null,
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/client-verification.test.js`

Expected: FAIL because `server/clientVerification.js` does not exist.

- [ ] **Step 3: Implement the minimal domain module**

```js
import { createHash } from 'node:crypto';

export const CLIENT_VERIFICATION_DOCUMENT_KINDS = Object.freeze([
  'valid_id',
  'liveness_selfie',
  'profile_photo',
  'business_proof',
]);

export const CLIENT_BUSINESS_DOCUMENT_TYPES = Object.freeze([
  'cp575_ein_letter',
  'state_business_registration',
  'eu_vat_certificate',
]);

export const toVerifiedBusinessIdentity = (row = {}) => ({
  verificationStatus: row.status || 'draft',
  verifiedBusinessName: row.status === 'approved'
    ? String(row.verified_business_name || '').trim() || null
    : null,
});
```

Complete the same module with strict PDF/JPEG/PNG signature detection, a 3 MB limit matching the existing request ceiling, SHA-256 calculation, exact-name confirmation, attestation validation, requirement mapping, safe document metadata mapping, and no display-company fallback.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run: `node --test tests/client-verification.test.js`

Expected: all verification-domain tests pass with zero warnings.

- [ ] **Step 5: Commit the domain contract**

```powershell
git add package.json server/clientVerification.js tests/client-verification.test.js
git commit -m "feat: define client verification contract"
```

### Task 2: Supabase Verification Schema and Security

**Files:**
- Modify: `supabase/schema.sql`
- Create: `tests/client-verification-schema.test.js`

**Interfaces:**
- Consumes: the exact statuses and document types from Task 1.
- Produces: `client_verifications`, `client_verification_documents`, `client_verification_events`, and RPCs `approve_client_verification`, `reject_client_verification`, and `reset_client_verification`.

- [ ] **Step 1: Write the failing schema-contract test**

```js
const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

test('client verification schema protects the legal business name', () => {
  assert.match(schema, /create table if not exists public\.client_verifications/i);
  assert.match(schema, /verified_business_name text/i);
  assert.match(schema, /status <> 'approved'.*verified_business_name is null/is);
  assert.match(schema, /revoke execute on function public\.approve_client_verification/i);
  assert.match(schema, /grant execute on function public\.approve_client_verification.*service_role/i);
});
```

- [ ] **Step 2: Run the schema test and confirm RED**

Run: `node --test tests/client-verification-schema.test.js`

Expected: FAIL because the tables and RPCs are absent.

- [ ] **Step 3: Add tables, constraints, indexes, RLS, and audit**

```sql
create table if not exists public.client_verifications (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  verified_business_name text,
  decision_reason text,
  internal_review_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reset_at timestamptz,
  reset_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'approved' and nullif(btrim(verified_business_name), '') is not null)
    or (status <> 'approved' and verified_business_name is null)
  )
);
```

Add the immutable evidence and event tables, an `is_current` partial unique index per client/kind, kind/business-type cross-field constraints, updated-at triggers, RLS policies, explicit grants, and denial of direct owner mutations.

- [ ] **Step 4: Add service-role-only atomic decision RPCs**

```sql
create or replace function public.approve_client_verification(
  p_client_id uuid,
  p_reviewer_id uuid,
  p_verified_business_name text,
  p_internal_review_notes text default null
) returns public.client_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.client_verifications;
begin
  update public.client_verifications
  set status = 'approved',
      verified_business_name = p_verified_business_name,
      internal_review_notes = p_internal_review_notes,
      decision_reason = null,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      updated_at = now()
  where client_id = p_client_id and status = 'pending_review'
  returning * into saved;
  if saved.client_id is null then
    raise exception 'Pending client verification not found';
  end if;
  update public.client_verification_documents
  set status = 'approved', reviewed_at = now(), reviewed_by = p_reviewer_id
  where client_id = p_client_id and is_current and status = 'submitted';
  update public.profiles set client_tier = 'verified', updated_at = now()
  where id = p_client_id and role = 'client';
  insert into public.client_verification_events(client_id, actor_id, event_type)
  values (p_client_id, p_reviewer_id, 'approved');
  return saved;
end;
$$;
```

Add rejection and reset RPCs with the same transaction boundary. Revoke execution from `PUBLIC`, `anon`, and `authenticated`; grant only to `service_role`.

- [ ] **Step 5: Run schema verification and confirm GREEN**

Run: `node --test tests/client-verification-schema.test.js`

Expected: all schema-contract tests pass.

- [ ] **Step 6: Commit schema security**

```powershell
git add supabase/schema.sql tests/client-verification-schema.test.js
git commit -m "feat: secure client verification data"
```

### Task 3: Client and Admin Verification API

**Files:**
- Modify: `api/index.js`
- Modify: `src/services/api.js`
- Modify: `tests/client-verification.test.js`

**Interfaces:**
- Consumes: Task 1 domain functions and Task 2 tables/RPCs.
- Produces: client GET/upload/submit routes, admin list/decision/reset routes, signed evidence preview authorization, and `getVerifiedBusinessIdentity(clientId)`.

- [ ] **Step 1: Add failing API helper tests**

```js
test('client verification payload omits private storage fields', () => {
  const payload = __testing.mapClientVerification(
    { client_id: clientId, status: 'draft' },
    [{ client_id: clientId, kind: 'valid_id', storage_path: 'private/id.png', is_current: true }]
  );
  assert.equal(payload.documents.valid_id.storagePath, undefined);
});

test('verified identity accessor shape is payment-middleware safe', () => {
  assert.deepEqual(__testing.toVerifiedBusinessIdentity({
    status: 'approved',
    verified_business_name: 'Ledger Works LLC',
  }), {
    verificationStatus: 'approved',
    verifiedBusinessName: 'Ledger Works LLC',
  });
});
```

- [ ] **Step 2: Run API tests and confirm RED**

Run: `node --test tests/client-verification.test.js`

Expected: FAIL because the API testing exports and routes are absent.

- [ ] **Step 3: Add storage and data helpers**

In `api/index.js`, import the Task 1 module, add a private `client-verification-documents` bucket initializer, use random server-generated object names, and persist only server-derived content type, byte length, SHA-256 digest, owner, kind, and business-document type.

Use service-role reads after `requireSession` or `requireAdmin`; map all client responses through `mapClientVerification` so paths, digests, internal notes, reviewer IDs, and private events are excluded.

- [ ] **Step 4: Add exact routes**

```js
'GET /client/verification'
'POST /client/verification/uploads'
'POST /client/verification/submit'
'GET /admin/client-verifications'
'POST /admin/client-verifications/decision'
'POST /admin/client-verifications/reset'
```

The decision route validates all four attestations and the double-entered legal name before calling the approval RPC. Rejection requires a reason and at least one rejected kind. Reset requires a reason. Submission marks four current draft artifacts `submitted`, locks them, and notifies admins only after persistence.

- [ ] **Step 5: Extend signed document access**

Authorize evidence preview when the caller is the matching client owner or an admin. Return short-lived signed URLs or blobs with `Cache-Control: no-store`; never accept a client-provided path.

- [ ] **Step 6: Add frontend service methods**

```js
verification: {
  get: () => request('/client/verification'),
  upload: (payload) => request('/client/verification/uploads', { method: 'POST', body: payload }),
  submit: () => request('/client/verification/submit', { method: 'POST' }),
},
clientVerifications: {
  list: () => request('/admin/client-verifications'),
  decide: (payload) => request('/admin/client-verifications/decision', { method: 'POST', body: payload }),
  reset: (payload) => request('/admin/client-verifications/reset', { method: 'POST', body: payload }),
},
```

- [ ] **Step 7: Run API tests and backend import check**

Run: `node --test tests/client-verification.test.js`

Run: `npm run check:backend`

Expected: both commands exit 0.

- [ ] **Step 8: Commit the API**

```powershell
git add api/index.js src/services/api.js tests/client-verification.test.js
git commit -m "feat: add client verification API"
```

### Task 4: Client Verification Dashboard and Access Gates

**Files:**
- Create: `src/utils/clientVerification.js`
- Create: `src/components/ClientVerificationDashboard.jsx`
- Create: `tests/client-verification-ui.test.js`
- Modify: `src/pages/ClientPages.jsx`

**Interfaces:**
- Consumes: `backendApi.client.verification` and safe verification response objects.
- Produces: `getVerificationUiState(verification)`, `readFileAsDataUrl(file)`, and the `ClientVerificationDashboard` component.

- [ ] **Step 1: Write failing UI-state tests**

```js
test('pending review locks every upload', () => {
  const state = getVerificationUiState({ status: 'pending_review', requirements: completeRequirements });
  assert.equal(state.canSubmit, false);
  assert.equal(state.uploadsLocked, true);
});

test('approved state exposes only the read-only verified name', () => {
  const state = getVerificationUiState({
    status: 'approved',
    verifiedBusinessName: 'Exact Books LLC',
    requirements: completeRequirements,
  });
  assert.equal(state.verifiedBusinessName, 'Exact Books LLC');
  assert.equal(state.canEditVerifiedBusinessName, false);
});
```

- [ ] **Step 2: Run UI-state tests and confirm RED**

Run: `node --test tests/client-verification-ui.test.js`

Expected: FAIL because the UI state module is absent.

- [ ] **Step 3: Implement UI state and file validation**

Export accepted extensions, display labels, status copy, missing-count logic, locked-state logic, and data-URL conversion. Client code performs friendly preflight checks, while the server remains authoritative.

- [ ] **Step 4: Build the dashboard component**

Render four independent requirement cards, the three-value business-document selector, status banner, upload progress/errors, rejection reasons, submission confirmation, approved lock state, approval date, and read-only `verifiedBusinessName`. Profile-photo copy recommends professional attire, a neutral background, centered face, and a clear head-and-shoulders pose.

- [ ] **Step 5: Integrate portal navigation and gates**

Add `verification` to `CLIENT_TABS` and `availableTabs`, render the dashboard, and show a persistent verification banner for Basic clients. Preserve Basic Discover and shortlist behavior. Keep agencies, interviews, full documents, job creation, and payment controls behind existing Verified/VIP permissions; render a verification-required Billing state for Basic clients.

- [ ] **Step 6: Run UI-state tests, lint, and build**

Run: `node --test tests/client-verification-ui.test.js`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands exit 0.

- [ ] **Step 7: Commit client UI**

```powershell
git add src/utils/clientVerification.js src/components/ClientVerificationDashboard.jsx src/pages/ClientPages.jsx tests/client-verification-ui.test.js
git commit -m "feat: add client verification dashboard"
```

### Task 5: Admin Verification Review

**Files:**
- Create: `src/components/ClientVerificationAdmin.jsx`
- Modify: `src/pages/AdminPages.jsx`
- Modify: `tests/client-verification-ui.test.js`

**Interfaces:**
- Consumes: `backendApi.admin.clientVerifications`, document preview API, and Task 4 UI-state helpers.
- Produces: the admin queue, review detail, decision form, and reset flow.

- [ ] **Step 1: Add failing admin-decision state tests**

```js
test('admin approval requires four attestations and matching exact names', () => {
  const result = getAdminDecisionState({
    attestations: { idAccepted: true },
    verifiedBusinessName: 'Exact Books LLC',
    verifiedBusinessNameConfirmation: 'Exact Books, LLC',
  });
  assert.equal(result.canApprove, false);
});
```

- [ ] **Step 2: Run UI-state tests and confirm RED**

Run: `node --test tests/client-verification-ui.test.js`

Expected: FAIL because `getAdminDecisionState` is absent.

- [ ] **Step 3: Implement admin decision state**

Add exact-match, attestation, rejected-kind, and reason validation with no automatic company-name prefilling.

- [ ] **Step 4: Build admin queue and review component**

Render status filters, client context marked unverified, safe evidence metadata, signed-preview buttons, four attestations, two blank Legal Business Name fields, internal notes, rejection kind selection, client-visible reason, approve/reject actions, and an approved-case reset modal requiring a reason.

- [ ] **Step 5: Add the admin tab**

Extend Admin navigation and route validation with `client-verifications`, then render `ClientVerificationAdmin`. Keep the existing Talent Review unchanged.

- [ ] **Step 6: Run UI tests, lint, and build**

Run: `node --test tests/client-verification-ui.test.js`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands exit 0.

- [ ] **Step 7: Commit admin UI**

```powershell
git add src/utils/clientVerification.js src/components/ClientVerificationAdmin.jsx src/pages/AdminPages.jsx tests/client-verification-ui.test.js
git commit -m "feat: add client verification admin review"
```

### Task 6: Documentation and End-to-End Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-14-client-onboarding-verification.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: deployment guidance and fresh completion evidence.

- [ ] **Step 1: Document deployment and payment identity behavior**

Document the six API routes, three tables, private bucket, required environment variables, schema application step, RLS/service-role boundary, admin review lifecycle, and the server-only `getVerifiedBusinessIdentity` contract.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Run: `npm run check:backend`

Run: `npm run lint`

Run: `npm run build`

Expected: every command exits 0 with zero failing tests and zero lint errors.

- [ ] **Step 3: Verify the schema contract**

Run: `node --test tests/client-verification-schema.test.js`

If a linked local Supabase environment exists, also run the locally supported schema reset and advisory commands discovered through `npx supabase --help`. Record any unavailable environment prerequisite without claiming a live database verification.

- [ ] **Step 4: Run browser verification**

Start `npm run dev`, then verify:

1. A Basic client can open Verification and upload each required category.
2. Submission remains blocked until all four categories exist.
3. Pending submission locks all evidence.
4. An admin sees the queue, previews evidence, and cannot approve without attestations and exact-name confirmation.
5. Rejection reopens selected requirements and displays the client-visible reason.
6. Resubmission and approval produce a read-only exact `verifiedBusinessName`.
7. Approved clients gain Verified access; reset returns them to Basic access.
8. Browser console has no uncaught errors.

- [ ] **Step 5: Review the final diff against every acceptance criterion**

Confirm there is no client write path for `verifiedBusinessName`, no company-name fallback in payment identity lookup, no public evidence URL, no unprotected RPC execution, and no missing required evidence category.

- [ ] **Step 6: Commit documentation and plan tracking**

```powershell
git add README.md docs/superpowers/plans/2026-07-14-client-onboarding-verification.md
git commit -m "docs: document client verification operations"
```

## Plan Self-Review

- Spec coverage: Tasks 1-5 cover identity, liveness, profile photo, regulated business proof, exact legal-name protection, payment middleware exposure, admin review, Basic access, locking, rejection, reset, audit, RLS, notifications, and UI.
- Scope: Stripe API calls, automated OCR/KYC, government registry checks, multiple business entities, and Professional Onboarding changes remain excluded from this client implementation.
- Type consistency: database `verified_business_name` maps only to API/server `verifiedBusinessName`; document kinds and business-document types use the same literals in domain, schema, API, and UI.
- Execution mode: inline execution in this session because subagent delegation was not requested.
