import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLIENT_BUSINESS_DOCUMENT_TYPES,
  CLIENT_VERIFICATION_DOCUMENT_KINDS,
  getClientVerificationRequirements,
  mapClientVerification,
  parseClientVerificationUpload,
  toVerifiedBusinessIdentity,
  validateClientVerificationDecision,
  validateClientVerificationSubmission,
} from '../server/clientVerification.js';

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);

const uploadBody = (overrides = {}) => ({
  contentType: 'image/png',
  fileData: `data:image/png;base64,${pngBytes.toString('base64')}`,
  fileName: 'evidence.png',
  kind: 'valid_id',
  ...overrides,
});

const document = (kind, overrides = {}) => ({
  business_document_type: kind === 'business_proof' ? 'cp575_ein_letter' : null,
  content_type: 'image/png',
  file_name: `${kind}.png`,
  file_size: 200,
  id: `${kind}-id`,
  is_current: true,
  kind,
  status: 'draft',
  uploaded_at: '2026-07-14T00:00:00.000Z',
  ...overrides,
});

test('verification contract exposes exactly four evidence kinds and three business types', () => {
  assert.deepEqual(CLIENT_VERIFICATION_DOCUMENT_KINDS, [
    'valid_id',
    'liveness_selfie',
    'profile_photo',
    'business_proof',
  ]);
  assert.deepEqual(CLIENT_BUSINESS_DOCUMENT_TYPES, [
    'cp575_ein_letter',
    'state_business_registration',
    'eu_vat_certificate',
  ]);
});

test('submission reports each missing verification artifact', () => {
  const result = validateClientVerificationSubmission([
    document('valid_id'),
    document('liveness_selfie'),
    document('profile_photo'),
  ]);

  assert.equal(result.valid, false);
  assert.deepEqual(result.missingKinds, ['business_proof']);
});

test('rejected and superseded artifacts do not satisfy requirements', () => {
  const requirements = getClientVerificationRequirements([
    document('valid_id', { status: 'rejected' }),
    document('liveness_selfie', { is_current: false, status: 'superseded' }),
  ]);

  assert.equal(requirements.valid_id.complete, false);
  assert.equal(requirements.liveness_selfie.complete, false);
});

test('complete current artifacts allow submission', () => {
  const result = validateClientVerificationSubmission(
    CLIENT_VERIFICATION_DOCUMENT_KINDS.map((kind) => document(kind))
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.missingKinds, []);
});

test('upload parser validates file signature and derives a digest', () => {
  const result = parseClientVerificationUpload(uploadBody());

  assert.equal(result.contentType, 'image/png');
  assert.equal(result.fileName, 'evidence.png');
  assert.equal(result.fileSize, pngBytes.length);
  assert.match(result.fileSha256, /^[a-f0-9]{64}$/);
});

test('liveness and profile photo reject PDF uploads', () => {
  const pdf = Buffer.from('%PDF-1.7\n');

  assert.throws(
    () => parseClientVerificationUpload(uploadBody({
      contentType: 'application/pdf',
      fileData: `data:application/pdf;base64,${pdf.toString('base64')}`,
      fileName: 'selfie.pdf',
      kind: 'liveness_selfie',
    })),
    /JPG or PNG/i
  );
});

test('business proof requires one approved regulated document type', () => {
  assert.throws(
    () => parseClientVerificationUpload(uploadBody({ kind: 'business_proof' })),
    /business document type/i
  );

  assert.throws(
    () => parseClientVerificationUpload(uploadBody({
      businessDocumentType: 'bank_statement',
      kind: 'business_proof',
    })),
    /business document type/i
  );
});

test('declared MIME type must match the decoded file signature', () => {
  assert.throws(
    () => parseClientVerificationUpload(uploadBody({
      contentType: 'image/jpeg',
      fileData: `data:image/jpeg;base64,${pngBytes.toString('base64')}`,
      fileName: 'evidence.jpg',
    })),
    /does not match/i
  );
});

test('admin approval preserves exact legal-name casing punctuation accents and spacing', () => {
  const result = validateClientVerificationDecision({
    attestations: {
      businessProofAccepted: true,
      idAccepted: true,
      livenessAccepted: true,
      profilePhotoMatches: true,
    },
    verifiedBusinessName: '  Élan  Finance, S.A.  ',
    verifiedBusinessNameConfirmation: 'Élan  Finance, S.A.',
  });

  assert.equal(result.valid, true);
  assert.equal(result.verifiedBusinessName, 'Élan  Finance, S.A.');
});

test('admin approval rejects mismatched names, missing attestations, and control characters', () => {
  const mismatch = validateClientVerificationDecision({
    attestations: {},
    verifiedBusinessName: 'Exact Books LLC',
    verifiedBusinessNameConfirmation: 'Exact Books, LLC',
  });
  const control = validateClientVerificationDecision({
    attestations: {
      businessProofAccepted: true,
      idAccepted: true,
      livenessAccepted: true,
      profilePhotoMatches: true,
    },
    verifiedBusinessName: 'Exact\u0000Books LLC',
    verifiedBusinessNameConfirmation: 'Exact\u0000Books LLC',
  });

  assert.equal(mismatch.valid, false);
  assert.match(mismatch.errors.join(' '), /match/i);
  assert.match(mismatch.errors.join(' '), /attestation/i);
  assert.equal(control.valid, false);
  assert.match(control.errors.join(' '), /control/i);
});

test('mapped client verification omits storage paths, digests, reviewer ids, and internal notes', () => {
  const result = mapClientVerification(
    {
      client_id: '11111111-1111-4111-8111-111111111111',
      internal_review_notes: 'private admin note',
      reviewed_by: '22222222-2222-4222-8222-222222222222',
      status: 'draft',
    },
    [document('valid_id', {
      file_sha256: 'secret-digest',
      storage_path: 'private/id.png',
    })]
  );

  assert.equal(result.documents.valid_id.storagePath, undefined);
  assert.equal(result.documents.valid_id.fileSha256, undefined);
  assert.equal(result.internalReviewNotes, undefined);
  assert.equal(result.reviewedBy, undefined);
});

test('payment identity returns the exact name only for approved verification', () => {
  assert.deepEqual(toVerifiedBusinessIdentity({
    status: 'pending_review',
    verified_business_name: 'Editable Company',
  }), {
    verificationStatus: 'pending_review',
    verifiedBusinessName: null,
  });

  assert.deepEqual(toVerifiedBusinessIdentity({
    status: 'approved',
    verified_business_name: 'Exact Legal Name, LLC',
  }), {
    verificationStatus: 'approved',
    verifiedBusinessName: 'Exact Legal Name, LLC',
  });
});
