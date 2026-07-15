import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientPage = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const adminPage = readFileSync(new URL('../src/pages/AdminPages.jsx', import.meta.url), 'utf8');
const clientDashboard = readFileSync(new URL('../src/components/ClientVerificationDashboard.jsx', import.meta.url), 'utf8');
const adminReview = readFileSync(new URL('../src/components/ClientVerificationReview.jsx', import.meta.url), 'utf8');

test('client portal always exposes verification while protected tabs require verified permissions', () => {
  assert.match(clientPage, /id: 'verification', label: 'Verification'/);
  assert.match(clientPage, /clientPermissions\.canScheduleInterviews[\s\S]*id: 'interviews'/);
  assert.match(clientPage, /clientPermissions\.canViewFullDocuments[\s\S]*id: 'billing'/);
  assert.match(clientPage, /appView === 'verification'[\s\S]*ClientVerificationDashboard/);
});

test('client dashboard requires all four evidence categories and regulated business proof', () => {
  for (const label of [
    'Valid government ID',
    'Liveness selfie',
    'Profile picture',
    'US EIN Letter (CP575)',
    'State Business Registration',
    'EU VAT Certificate',
  ]) {
    assert.match(clientDashboard, new RegExp(label.replace(/[()]/g, '\\$&')));
  }

  assert.match(clientDashboard, /backendApi\.client\.uploadVerificationDocument/);
  assert.match(clientDashboard, /backendApi\.client\.submitVerification/);
  assert.match(clientDashboard, /FileDropzone/);
  assert.match(clientDashboard, /handleUpload\(config\.kind, file\)/);
  assert.match(clientDashboard, /role="status"|aria-live="polite"/);
  assert.match(clientDashboard, /<div[^>]*role="status"[^>]*>[\s\S]*Loading verification requirements/);
  assert.match(clientDashboard, /verifiedBusinessName/);
  assert.match(clientDashboard, /proper attire/i);
  assert.match(clientDashboard, /exact Legal Business Name/i);
});

test('admin console exposes the client verification review queue', () => {
  assert.match(adminPage, /id: 'client-verifications', label: 'Client Verification'/);
  assert.match(adminPage, /activeTab === 'client-verifications'[\s\S]*ClientVerificationReview/);
  assert.match(adminReview, /verifiedBusinessNameConfirmation/);
  assert.match(adminReview, /businessProofAccepted/);
  assert.match(adminReview, /profilePhotoMatches/);
  assert.match(adminReview, /backendApi\.admin\.decideClientVerification/);
  assert.match(adminReview, /backendApi\.admin\.resetClientVerification/);
});
