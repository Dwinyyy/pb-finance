import assert from 'node:assert/strict';
import test from 'node:test';

import { __testing } from '../api/index.js';

const professionalProfile = {
  availability: 'Part-time',
  bio: 'Senior finance operator.',
  certifications: ['CPA'],
  country: 'Philippines',
  hourly_rate: 45,
  identity_verification_notes: 'passport matched',
  identity_verification_status: 'approved',
  industries: ['SaaS'],
  location: 'Manila',
  pending_profile: {
    work_preferences: {
      resume: {
        fileName: 'pending-resume.pdf',
        key: 'resume-pending',
        path: 'private/pending-resume.pdf',
        status: 'pending_review',
        uploadedAt: '2026-06-01T00:00:00.000Z',
      },
    },
  },
  professional_tier: 'verified',
  profile_visibility: 'visible',
  rating: 4.8,
  review_count: 7,
  review_status: 'approved',
  skills: ['Forecasting'],
  status: 'approved',
  titles: ['Controller'],
  tools: ['QuickBooks'],
  updated_at: '2026-06-01T00:00:00.000Z',
  user_id: '11111111-1111-4111-8111-111111111111',
  verified_at: '2026-06-01T00:00:00.000Z',
  work_preferences: {
    externalLinks: [{ label: 'Portfolio', url: 'https://example.com' }],
    resume: {
      contentType: 'application/pdf',
      fileName: 'approved-resume.pdf',
      fileSize: 12345,
      key: 'resume-approved',
      label: 'Approved resume',
      path: 'private/approved-resume.pdf',
      status: 'approved',
      storageKey: 'storage-secret',
      uploadedAt: '2026-05-01T00:00:00.000Z',
    },
    supportingDocuments: [
      {
        contentType: 'application/pdf',
        fileName: 'approved-cert.pdf',
        key: 'cert-approved',
        kind: 'certification',
        label: 'CPA license',
        path: 'private/approved-cert.pdf',
        status: 'approved',
        uploadedAt: '2026-05-02T00:00:00.000Z',
      },
      {
        contentType: 'application/pdf',
        fileName: 'pending-tax-clearance.pdf',
        key: 'tax-pending',
        kind: 'other_document',
        label: 'Tax clearance',
        path: 'private/pending-tax-clearance.pdf',
        status: 'pending_review',
        uploadedAt: '2026-05-03T00:00:00.000Z',
      },
    ],
  },
  years_experience: 8,
};

const owner = {
  email: 'pro@example.com',
  full_name: 'Pat Books',
  id: professionalProfile.user_id,
  title: 'Controller',
};

test('basic clients receive explicit nulls for restricted professional profile fields', () => {
  const profile = __testing.mapTalentProfileForViewer(professionalProfile, owner, {
    role: 'client',
    clientTier: 'basic',
  });

  assert.equal(profile.id, professionalProfile.user_id);
  assert.equal(profile.canViewFullDocuments, false);
  assert.equal(profile.email, null);
  assert.equal(profile.externalLinks, null);
  assert.equal(profile.resume, null);
  assert.equal(profile.supportingDocuments, null);
  assert.equal(profile.workPreferences, null);
  assert.equal(profile.identityVerificationNotes, null);
  assert.equal(profile.profileVisibility, null);
});

test('verified clients receive only approved document metadata without storage paths', () => {
  const profile = __testing.mapTalentProfileForViewer(professionalProfile, owner, {
    role: 'client',
    clientTier: 'verified',
  });

  assert.equal(profile.canViewFullDocuments, true);
  assert.equal(profile.resume.fileName, 'approved-resume.pdf');
  assert.equal(profile.resume.path, undefined);
  assert.equal(profile.resume.storageKey, undefined);
  assert.deepEqual(
    profile.supportingDocuments.map((document) => document.fileName),
    ['approved-cert.pdf']
  );
  assert.equal(profile.supportingDocuments[0].path, undefined);
  assert.equal(profile.workPreferences.resume.fileName, 'approved-resume.pdf');
});
