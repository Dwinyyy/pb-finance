import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyClientProfileDatabaseError,
  mapAdminClientNameRequest,
  mapClientAccount,
  mapClientNameRequest,
  mapClientSessionSummary,
  validateClientNameDecision,
  validateClientProfilePatch,
} from '../server/clientProfile.js';
import {
  createClientProfileDraft,
  shouldRequestProtectedNameReason,
  validateClientProfileDraft,
} from '../src/utils/clientProfileForm.js';

const validPatch = {
  company: 'PB Advisory',
  fullName: 'Aldwin Gotingco',
  requestReason: 'Correcting my account name.',
};

test('draft and rejected names update while protected names request approval', () => {
  assert.equal(validateClientProfilePatch(validPatch, {
    currentName: 'A. Gotingco',
    verificationStatus: 'draft',
  }).nameOutcome, 'updated');
  assert.equal(validateClientProfilePatch(validPatch, {
    currentName: 'A. Gotingco',
    verificationStatus: 'rejected',
  }).nameOutcome, 'updated');
  assert.equal(validateClientProfilePatch(validPatch, {
    currentName: 'A. Gotingco',
    verificationStatus: 'pending_review',
  }).nameOutcome, 'pending_approval');
  assert.equal(validateClientProfilePatch(validPatch, {
    currentName: 'A. Gotingco',
    verificationStatus: 'approved',
  }).nameOutcome, 'pending_approval');
});

test('patch validation rejects unknown fields, bad boundaries, and control characters', () => {
  const result = validateClientProfilePatch({
    clientTier: 'vip',
    company: 'PB\u0000Advisory',
    fullName: 'A',
  }, {
    currentName: 'Aldwin Gotingco',
    verificationStatus: 'draft',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /clientTier/);
  assert.match(result.errors.join(' '), /2 to 160/);
  assert.match(result.errors.join(' '), /control/i);
});

test('protected changes require a reason and reject a second different pending request', () => {
  const missingReason = validateClientProfilePatch({
    company: 'PB',
    fullName: 'Aldwin Gotingco',
  }, {
    currentName: 'A. Gotingco',
    verificationStatus: 'approved',
  });
  assert.match(missingReason.errors.join(' '), /explanation/i);

  const duplicate = validateClientProfilePatch({
    company: 'PB',
    fullName: 'Another Name',
    requestReason: 'Correction',
  }, {
    currentName: 'A. Gotingco',
    pendingNameRequest: { requestedFullName: 'Aldwin Gotingco' },
    verificationStatus: 'approved',
  });
  assert.match(duplicate.errors.join(' '), /already pending/i);
});

test('unchanged names need no reason and unknown verification states fail closed for changes', () => {
  const unchanged = validateClientProfilePatch({
    company: 'PB Advisory',
    fullName: 'Aldwin Gotingco',
  }, {
    currentName: 'Aldwin Gotingco',
    verificationStatus: 'approved',
  });
  assert.equal(unchanged.valid, true);
  assert.equal(unchanged.nameOutcome, 'unchanged');
  assert.equal(unchanged.value.requestReason, null);

  const unknown = validateClientProfilePatch(validPatch, {
    currentName: 'A. Gotingco',
    verificationStatus: 'suspended',
  });
  assert.equal(unknown.valid, false);
  assert.match(unknown.errors.join(' '), /cannot accept/i);
});

test('admin name decisions accept only approved or rejected and validate review notes', () => {
  assert.equal(validateClientNameDecision({ decision: 'approved' }).valid, true);
  assert.equal(validateClientNameDecision({
    decision: 'rejected',
    reviewNote: 'The submitted name does not match the verified evidence.',
  }).valid, true);

  assert.match(validateClientNameDecision({ decision: 'approve' }).errors.join(' '), /approved or rejected/i);
  assert.match(validateClientNameDecision({ decision: 'rejected' }).errors.join(' '), /reason/i);
  assert.match(validateClientNameDecision({
    decision: 'rejected',
    reviewNote: 'x'.repeat(1001),
  }).errors.join(' '), /1,000/);
  assert.match(validateClientNameDecision({
    decision: 'rejected',
    reviewNote: 'No\u0000match',
  }).errors.join(' '), /control/i);
});

test('client account mapping exposes only response fields and hides unapproved legal identity', () => {
  const mapped = mapClientAccount({
    profile: {
      admin_notes: 'hidden',
      avatar_url: 'https://cdn.example/avatar.png',
      client_tier: 'verified',
      client_tier_label: 'Verified',
      company: 'Display Co',
      email: 'client@example.com',
      full_name: 'Client Name',
      id: 'client-1',
      role: 'client',
      storage_path: 'private/client-1/avatar.png',
    },
    verification: {
      reviewed_at: '2026-07-01T00:00:00.000Z',
      reviewed_by: 'admin-1',
      status: 'pending_review',
      submitted_at: '2026-06-30T00:00:00.000Z',
      verified_business_name: 'Hidden Legal Co',
    },
  });

  assert.deepEqual(Object.keys(mapped).sort(), ['account', 'verification']);
  assert.deepEqual(mapped.account, {
    avatarUrl: 'https://cdn.example/avatar.png',
    clientTier: 'verified',
    clientTierLabel: 'Verified',
    company: 'Display Co',
    email: 'client@example.com',
    fullName: 'Client Name',
    id: 'client-1',
    role: 'client',
  });
  assert.deepEqual(mapped.verification, {
    reviewedAt: '2026-07-01T00:00:00.000Z',
    status: 'pending_review',
    submittedAt: '2026-06-30T00:00:00.000Z',
    verifiedBusinessName: null,
  });
  assert.equal(mapped.verification.reviewedBy, undefined);
  assert.equal(mapped.storagePath, undefined);

  const approved = mapClientAccount({
    profile: { id: 'client-1' },
    verification: { status: 'approved', verified_business_name: 'Approved Legal Co' },
  });
  assert.equal(approved.verification.verifiedBusinessName, 'Approved Legal Co');
});

test('name request mappings allowlist client and admin queue fields', () => {
  const row = {
    actor_id: 'internal-actor',
    client_id: 'client-1',
    created_at: '2026-07-01T00:00:00.000Z',
    current_full_name: 'Current Name',
    decision_reason: 'Use the verified name.',
    id: 'request-1',
    internal_metadata: { secret: true },
    request_reason: 'Correcting a typo.',
    requested_full_name: 'Requested Name',
    reviewed_at: '2026-07-02T00:00:00.000Z',
    reviewed_by: 'admin-1',
    status: 'rejected',
  };

  assert.deepEqual(mapClientNameRequest(row), {
    clientId: 'client-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    currentFullName: 'Current Name',
    decisionReason: 'Use the verified name.',
    id: 'request-1',
    requestReason: 'Correcting a typo.',
    requestedFullName: 'Requested Name',
    reviewedAt: '2026-07-02T00:00:00.000Z',
    status: 'rejected',
  });

  const adminMapped = mapAdminClientNameRequest(row, {
    profile: { company: 'Display Co', email: 'client@example.com', internal_note: 'hidden' },
    verification: { status: 'approved', reviewed_by: 'admin-2' },
  });
  assert.deepEqual(adminMapped.client, { company: 'Display Co', email: 'client@example.com' });
  assert.equal(adminMapped.verificationStatus, 'approved');
  assert.equal(adminMapped.reviewedBy, undefined);
  assert.equal(adminMapped.internalMetadata, undefined);
});

test('session summary allowlists active account and known permission fields', () => {
  const summary = mapClientSessionSummary({
    avatarUrl: '/avatar.png',
    clientPermissions: {
      canDiscoverAgencies: true,
      canReadReviews: true,
      canUseMatchmaker: true,
      label: 'VIP',
      secretAdminOverride: true,
      tier: 'vip',
    },
    clientTier: 'vip',
    clientTierLabel: 'VIP',
    company: 'Display Co',
    email: 'client@example.com',
    fullName: 'Active Name',
    id: 'client-1',
    role: 'client',
    verifiedBusinessName: 'Do not include',
  });

  assert.deepEqual(Object.keys(summary).sort(), [
    'avatarUrl',
    'clientPermissions',
    'clientTier',
    'clientTierLabel',
    'company',
    'id',
    'name',
  ]);
  assert.equal(summary.name, 'Active Name');
  assert.equal(summary.email, undefined);
  assert.equal(summary.clientPermissions.secretAdminOverride, undefined);
  assert.equal(summary.clientPermissions.canUseMatchmaker, true);
});

test('database error classification maps stable conflicts and preserves other statuses', () => {
  assert.deepEqual(classifyClientProfileDatabaseError({
    message: 'PB_CLIENT_NAME_CHANGE_PENDING',
  }), {
    message: 'A different full-name change is already pending.',
    status: 409,
  });
  assert.equal(classifyClientProfileDatabaseError({
    body: { message: 'PB_CLIENT_NAME_CHANGE_STALE' },
  }).status, 409);
  assert.equal(classifyClientProfileDatabaseError({ code: '23505' }).status, 409);
  assert.deepEqual(classifyClientProfileDatabaseError({
    message: 'Service unavailable',
    status: 503,
  }), {
    message: 'Service unavailable',
    status: 503,
  });
});

test('browser draft helpers mirror protected-name and field-boundary rules', () => {
  assert.deepEqual(createClientProfileDraft({
    company: 'Display Co',
    fullName: 'Active Name',
    ignored: 'hidden',
  }), {
    company: 'Display Co',
    fullName: 'Active Name',
    requestReason: '',
  });

  const draft = { company: 'Display Co', fullName: 'Requested Name', requestReason: '' };
  assert.equal(shouldRequestProtectedNameReason(draft, {
    activeFullName: 'Active Name',
    verificationStatus: 'approved',
  }), true);
  assert.equal(shouldRequestProtectedNameReason(draft, {
    activeFullName: 'Active Name',
    verificationStatus: 'draft',
  }), false);

  const errors = validateClientProfileDraft({
    company: 'Display\u0000Co',
    fullName: 'A',
    requestReason: '',
  }, {
    activeFullName: 'Active Name',
    pendingNameRequest: { requestedFullName: 'Another Pending Name' },
    verificationStatus: 'approved',
  });
  assert.match(errors.fullName, /2 to 160|already pending/i);
  assert.match(errors.company, /control/i);
  assert.match(errors.requestReason, /explanation/i);
});
