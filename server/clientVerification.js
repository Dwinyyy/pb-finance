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

export const MAX_CLIENT_VERIFICATION_UPLOAD_BYTES = 3 * 1024 * 1024;

const DOCUMENT_LABELS = Object.freeze({
  business_proof: 'Business proof',
  liveness_selfie: 'Liveness selfie',
  profile_photo: 'Profile picture',
  valid_id: 'Valid government ID',
});

const ACCEPTED_DOCUMENT_STATUSES = new Set(['draft', 'submitted', 'approved']);
const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);
const DOCUMENT_CONTENT_TYPES = new Set(['application/pdf', ...IMAGE_CONTENT_TYPES]);
const BUSINESS_DOCUMENT_TYPE_SET = new Set(CLIENT_BUSINESS_DOCUMENT_TYPES);
const DOCUMENT_KIND_SET = new Set(CLIENT_VERIFICATION_DOCUMENT_KINDS);

const asRecord = (value) => (
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
);

const cleanText = (value, maxLength = 500) => String(value || '').trim().slice(0, maxLength);

const safeFileName = (value) => {
  const name = cleanText(value, 220)
    .replace(/.*[\\/]/, '')
    .replace(/[^a-z0-9._ -]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 180);

  return name || 'verification-upload';
};

const getFileExtension = (fileName) => (
  String(fileName || '').toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || ''
);

const detectContentType = (bytes) => {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }

  return '';
};

const parseDataUrl = (body) => {
  const fileData = String(body.fileData || body.dataUrl || '');
  const match = fileData.match(/^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i);

  if (!match) {
    throw new Error('A valid base64 file upload is required.');
  }

  return {
    bytes: Buffer.from(match[2].replace(/\s/g, ''), 'base64'),
    dataUrlContentType: cleanText(match[1], 120).toLowerCase(),
  };
};

export const parseClientVerificationUpload = (input) => {
  const body = asRecord(input);
  const kind = cleanText(body.kind || body.documentKind, 80).toLowerCase();

  if (!DOCUMENT_KIND_SET.has(kind)) {
    throw new Error('A valid verification document kind is required.');
  }

  const businessDocumentType = cleanText(
    body.businessDocumentType || body.business_document_type,
    80
  ).toLowerCase();

  if (kind === 'business_proof' && !BUSINESS_DOCUMENT_TYPE_SET.has(businessDocumentType)) {
    throw new Error('Choose an approved business document type.');
  }

  if (kind !== 'business_proof' && businessDocumentType) {
    throw new Error('Business document type is only allowed for business proof.');
  }

  const { bytes, dataUrlContentType } = parseDataUrl(body);

  if (!bytes.length || bytes.length > MAX_CLIENT_VERIFICATION_UPLOAD_BYTES) {
    throw new Error('Upload must be 3 MB or smaller.');
  }

  const declaredContentType = cleanText(body.contentType || dataUrlContentType, 120).toLowerCase();
  const detectedContentType = detectContentType(bytes);
  const allowedContentTypes = ['liveness_selfie', 'profile_photo'].includes(kind)
    ? IMAGE_CONTENT_TYPES
    : DOCUMENT_CONTENT_TYPES;

  if (!allowedContentTypes.has(declaredContentType)) {
    throw new Error(
      ['liveness_selfie', 'profile_photo'].includes(kind)
        ? `${DOCUMENT_LABELS[kind]} must be a JPG or PNG image.`
        : `${DOCUMENT_LABELS[kind]} must be a PDF, JPG, or PNG file.`
    );
  }

  if (!detectedContentType || detectedContentType !== declaredContentType || dataUrlContentType !== declaredContentType) {
    throw new Error('The declared file type does not match the uploaded file.');
  }

  const fileName = safeFileName(body.fileName || body.name);
  const extension = getFileExtension(fileName);
  const allowedExtensions = detectedContentType === 'application/pdf'
    ? new Set(['.pdf'])
    : detectedContentType === 'image/jpeg'
      ? new Set(['.jpg', '.jpeg'])
      : new Set(['.png']);

  if (!allowedExtensions.has(extension)) {
    throw new Error('The file extension does not match the uploaded file.');
  }

  return {
    businessDocumentType: kind === 'business_proof' ? businessDocumentType : null,
    bytes,
    contentType: detectedContentType,
    fileName,
    fileSha256: createHash('sha256').update(bytes).digest('hex'),
    fileSize: bytes.length,
    kind,
  };
};

const cleanDocument = (value) => {
  const document = asRecord(value);

  return {
    businessDocumentType: cleanText(
      document.businessDocumentType || document.business_document_type,
      80
    ),
    contentType: cleanText(document.contentType || document.content_type, 120),
    fileName: cleanText(document.fileName || document.file_name, 220),
    fileSize: Number(document.fileSize ?? document.file_size ?? 0),
    id: cleanText(document.id, 100),
    isCurrent: document.isCurrent ?? document.is_current ?? true,
    kind: cleanText(document.kind, 80),
    rejectedReason: cleanText(document.rejectedReason || document.rejection_reason, 1000),
    status: cleanText(document.status, 40) || 'draft',
    uploadedAt: cleanText(document.uploadedAt || document.uploaded_at, 80),
  };
};

const documentSatisfiesRequirement = (document, kind) => (
  document.isCurrent !== false
  && document.kind === kind
  && ACCEPTED_DOCUMENT_STATUSES.has(document.status)
  && Boolean(document.fileName)
  && (
    kind !== 'business_proof'
    || BUSINESS_DOCUMENT_TYPE_SET.has(document.businessDocumentType)
  )
);

export const getClientVerificationRequirements = (documents = []) => {
  const cleanDocuments = Array.isArray(documents) ? documents.map(cleanDocument) : [];

  return Object.fromEntries(CLIENT_VERIFICATION_DOCUMENT_KINDS.map((kind) => {
    const currentDocument = cleanDocuments.find((document) => (
      document.isCurrent !== false && document.kind === kind
    ));
    const complete = Boolean(
      currentDocument && documentSatisfiesRequirement(currentDocument, kind)
    );

    return [kind, {
      complete,
      document: currentDocument || null,
      kind,
      label: DOCUMENT_LABELS[kind],
    }];
  }));
};

export const validateClientVerificationSubmission = (documents = []) => {
  const requirements = getClientVerificationRequirements(documents);
  const missingKinds = CLIENT_VERIFICATION_DOCUMENT_KINDS.filter((kind) => (
    !requirements[kind].complete
  ));

  return {
    missingKinds,
    requirements,
    valid: missingKinds.length === 0,
  };
};

const REQUIRED_ATTESTATIONS = Object.freeze([
  'businessProofAccepted',
  'idAccepted',
  'livenessAccepted',
  'profilePhotoMatches',
]);

export const validateClientVerificationDecision = (input) => {
  const value = asRecord(input);
  const attestations = asRecord(value.attestations);
  const verifiedBusinessName = String(value.verifiedBusinessName || '').trim();
  const confirmation = String(value.verifiedBusinessNameConfirmation || '').trim();
  const errors = [];

  if (!verifiedBusinessName) {
    errors.push('Legal Business Name is required.');
  } else if (verifiedBusinessName.length > 240) {
    errors.push('Legal Business Name must be 240 characters or fewer.');
  }

  if (/[\u0000-\u001f\u007f]/.test(verifiedBusinessName)) {
    errors.push('Legal Business Name cannot contain control characters.');
  }

  if (verifiedBusinessName !== confirmation) {
    errors.push('Legal Business Name entries must match exactly.');
  }

  if (!REQUIRED_ATTESTATIONS.every((key) => attestations[key] === true)) {
    errors.push('Every verification attestation is required.');
  }

  return {
    errors,
    valid: errors.length === 0,
    verifiedBusinessName: errors.length ? '' : verifiedBusinessName,
  };
};

const toSafeDocumentMetadata = (value) => {
  const document = cleanDocument(value);

  return {
    businessDocumentType: document.businessDocumentType || null,
    contentType: document.contentType,
    fileName: document.fileName,
    fileSize: document.fileSize,
    id: document.id,
    kind: document.kind,
    rejectedReason: document.rejectedReason,
    status: document.status,
    uploadedAt: document.uploadedAt,
  };
};

export const toVerifiedBusinessIdentity = (row = {}) => {
  const status = cleanText(row.status, 40) || 'draft';

  return {
    verificationStatus: status,
    verifiedBusinessName: status === 'approved'
      ? cleanText(row.verified_business_name || row.verifiedBusinessName, 240) || null
      : null,
  };
};

export const mapClientVerification = (caseRow = {}, documentRows = []) => {
  const currentDocuments = (Array.isArray(documentRows) ? documentRows : [])
    .map(cleanDocument)
    .filter((document) => document.isCurrent !== false);
  const documents = Object.fromEntries(
    currentDocuments.map((document) => [document.kind, toSafeDocumentMetadata(document)])
  );
  const submission = validateClientVerificationSubmission(currentDocuments);
  const status = cleanText(caseRow.status, 40) || 'draft';

  return {
    allowedBusinessDocumentTypes: [...CLIENT_BUSINESS_DOCUMENT_TYPES],
    canSubmit: ['draft', 'rejected'].includes(status) && submission.valid,
    decisionReason: cleanText(caseRow.decision_reason || caseRow.decisionReason, 1000),
    documents,
    requirements: submission.requirements,
    reviewedAt: cleanText(caseRow.reviewed_at || caseRow.reviewedAt, 80) || null,
    status,
    submittedAt: cleanText(caseRow.submitted_at || caseRow.submittedAt, 80) || null,
    verifiedBusinessName: toVerifiedBusinessIdentity(caseRow).verifiedBusinessName,
  };
};
