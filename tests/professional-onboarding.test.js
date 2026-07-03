import assert from 'node:assert/strict';
import test from 'node:test';

import { __testing } from '../api/index.js';

const professionalId = '22222222-2222-4222-8222-222222222222';
const owner = {
  email: 'verified@example.com',
  full_name: 'Vera Ledger',
  id: professionalId,
  title: 'Controller',
};

const baseProfile = {
  availability: 'Immediate Start',
  bio: 'Finance operations leader.',
  identity_verification_status: 'pending',
  professional_tier: 'verified',
  profile_visibility: 'visible',
  review_count: 0,
  skills: ['Forecasting'],
  status: 'approved',
  titles: ['Controller'],
  tools: ['QuickBooks'],
  user_id: professionalId,
  work_preferences: {
    resume: {
      contentType: 'application/pdf',
      expiryDate: '2026-09-01',
      fileName: 'resume.pdf',
      key: 'resume',
      label: 'Resume',
      path: `${professionalId}/resume/resume.pdf`,
      status: 'approved',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    },
    supportingDocuments: [
      {
        contentType: 'application/pdf',
        expiryDate: '2026-08-02',
        fileName: 'license.pdf',
        key: 'certification:CPA License',
        kind: 'certification',
        label: 'CPA License',
        path: `${professionalId}/license/license.pdf`,
        status: 'approved',
        uploadedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        contentType: 'application/pdf',
        expiryDate: '2026-08-02',
        fileName: 'pending-proof.pdf',
        key: 'pending-proof',
        kind: 'other_document',
        label: 'Pending proof',
        path: `${professionalId}/pending/pending-proof.pdf`,
        status: 'pending_review',
        uploadedAt: '2026-01-03T00:00:00.000Z',
      },
    ],
  },
};

test('professional review submission requires valid ID and liveness selfie artifacts', () => {
  assert.match(
    __testing.getIdentitySubmissionBlocker({ identity_verification_documents: {} }),
    /valid id/i
  );

  assert.match(
    __testing.getIdentitySubmissionBlocker({
      identity_verification_documents: {
        validIdFront: {
          fileName: 'id-front.jpg',
          path: 'identity/id-front.jpg',
          status: 'draft',
          uploadedAt: '2026-07-03T00:00:00.000Z',
        },
      },
    }),
    /liveness/i
  );

  assert.equal(
    __testing.getIdentitySubmissionBlocker({
      identity_verification_documents: {
        livenessSelfie: {
          fileName: 'selfie.jpg',
          path: 'identity/selfie.jpg',
          status: 'draft',
          uploadedAt: '2026-07-03T00:00:00.000Z',
        },
        validIdFront: {
          fileName: 'id-front.jpg',
          path: 'identity/id-front.jpg',
          status: 'draft',
          uploadedAt: '2026-07-03T00:00:00.000Z',
        },
      },
    }),
    ''
  );
});

test('owner preview maps professional profile exactly as basic and verified clients see it', () => {
  const basicPreview = __testing.mapTalentProfilePreviewForTier(baseProfile, owner, 'basic');

  assert.equal(basicPreview.canViewFullDocuments, false);
  assert.equal(basicPreview.resume, null);
  assert.equal(basicPreview.supportingDocuments, null);
  assert.equal(basicPreview.workPreferences, null);

  const verifiedPreview = __testing.mapTalentProfilePreviewForTier(baseProfile, owner, 'verified');

  assert.equal(verifiedPreview.canViewFullDocuments, true);
  assert.equal(verifiedPreview.resume.fileName, 'resume.pdf');
  assert.deepEqual(
    verifiedPreview.supportingDocuments.map((document) => document.fileName),
    ['license.pdf']
  );
  assert.equal(verifiedPreview.supportingDocuments[0].path, undefined);
});

test('document expiration actions are thresholded and idempotent by document/date/event', () => {
  const now = new Date('2026-07-03T00:00:00.000Z');
  const sentKeys = new Set([
    __testing.getDocumentExpirationEventKey({
      documentKey: 'resume',
      eventType: 'reminder_60',
      expiryDate: '2026-09-01',
      professionalId,
    }),
    __testing.getDocumentExpirationEventKey({
      documentKey: 'certification:CPA License',
      eventType: 'reminder_30',
      expiryDate: '2026-08-02',
      professionalId,
    }),
  ]);
  const actions = __testing.getDocumentExpirationActions(baseProfile, {
    now,
    sentKeys,
  });

  assert.deepEqual(actions.map((action) => action.eventType), []);

  const freshActions = __testing.getDocumentExpirationActions(baseProfile, {
    now,
    sentKeys: new Set(),
  });

  assert.deepEqual(freshActions.map((action) => action.eventType), ['reminder_60', 'reminder_30']);
  assert.equal(freshActions[0].document.fileName, 'resume.pdf');
  assert.equal(freshActions[1].document.fileName, 'license.pdf');

  const expiredActions = __testing.getDocumentExpirationActions(
    {
      ...baseProfile,
      work_preferences: {
        ...baseProfile.work_preferences,
        resume: {
          ...baseProfile.work_preferences.resume,
          expiryDate: '2026-07-01',
        },
      },
    },
    {
      now,
      sentKeys: new Set(),
    }
  );

  assert.deepEqual(expiredActions.map((action) => action.eventType), ['expired']);
  assert.deepEqual(__testing.getProfessionalDowngradePayload(), {
    professional_tier: 'unverified',
    profile_visibility: 'hidden',
    review_status: 'pending_review',
    status: 'pending_review',
    verified_at: null,
  });
});
