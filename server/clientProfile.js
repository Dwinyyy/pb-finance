export const CLIENT_PROFILE_PATCH_FIELDS = Object.freeze(['company', 'fullName', 'requestReason']);
export const DIRECT_NAME_STATUSES = new Set(['draft', 'rejected']);
export const PROTECTED_NAME_STATUSES = new Set(['pending_review', 'approved']);

const CLIENT_PERMISSION_FIELDS = Object.freeze([
  'canDiscoverAgencies',
  'canReadReviews',
  'canReviewProfessionals',
  'canScheduleInterviews',
  'canUseMatchmaker',
  'canViewBasicProfiles',
  'canViewFullDocuments',
  'label',
  'matchmakerLevel',
  'monthlyBackgroundCheckLimit',
  'monthlyJobLimit',
  'shortlistLimit',
  'tier',
]);

const asRecord = (value) => (
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
);

const cleanText = (value, maxLength = 1000) => String(value || '').trim().slice(0, maxLength);

const hasControlCharacters = (value) => [...String(value || '')].some((character) => {
  const codePoint = character.codePointAt(0);
  return codePoint <= 31 || codePoint === 127;
});

const firstValue = (record, ...keys) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

export const validateClientProfilePatch = (input = {}, context = {}) => {
  const value = asRecord(input);
  const safeContext = asRecord(context);
  const errors = [];
  const unexpected = Object.keys(value).filter((key) => !CLIENT_PROFILE_PATCH_FIELDS.includes(key));
  const fullName = String(value.fullName || '').trim();
  const company = String(value.company || '').trim();
  const requestReason = String(value.requestReason || '').trim();
  const currentName = String(safeContext.currentName || '').trim();
  const verificationStatus = String(safeContext.verificationStatus || 'draft').trim().toLowerCase();
  const nameChanged = fullName !== currentName;

  if (unexpected.length) errors.push(`Unsupported client profile fields: ${unexpected.join(', ')}.`);
  if (fullName.length < 2 || fullName.length > 160) errors.push('Full name must contain 2 to 160 characters.');
  if (hasControlCharacters(fullName)) errors.push('Full name cannot contain control characters.');
  if (company.length < 1 || company.length > 180) errors.push('Display company must contain 1 to 180 characters.');
  if (hasControlCharacters(company)) errors.push('Display company cannot contain control characters.');

  let nameOutcome = 'unchanged';
  if (nameChanged && DIRECT_NAME_STATUSES.has(verificationStatus)) nameOutcome = 'updated';
  if (nameChanged && PROTECTED_NAME_STATUSES.has(verificationStatus)) nameOutcome = 'pending_approval';
  if (
    nameChanged
    && !DIRECT_NAME_STATUSES.has(verificationStatus)
    && !PROTECTED_NAME_STATUSES.has(verificationStatus)
  ) {
    errors.push('The current verification state cannot accept a name change.');
  }

  if (nameOutcome === 'pending_approval' && (requestReason.length < 1 || requestReason.length > 1000)) {
    errors.push('A 1 to 1,000 character explanation is required for this protected name change.');
  }
  if (nameOutcome === 'pending_approval' && hasControlCharacters(requestReason)) {
    errors.push('The name-change explanation cannot contain control characters.');
  }

  const pendingNameRequest = asRecord(safeContext.pendingNameRequest);
  const pendingRequestedName = String(firstValue(
    pendingNameRequest,
    'requestedFullName',
    'requested_full_name',
  ) || '').trim();

  if (pendingRequestedName && nameChanged && pendingRequestedName !== fullName) {
    errors.push('A different full-name change is already pending.');
  }

  return {
    errors,
    nameOutcome,
    valid: errors.length === 0,
    value: {
      company,
      fullName,
      requestReason: nameOutcome === 'pending_approval' ? requestReason : null,
    },
  };
};

export const validateClientNameDecision = (input = {}) => {
  const value = asRecord(input);
  const decision = String(value.decision || '').trim().toLowerCase();
  const reviewNote = String(value.reviewNote ?? value.decisionReason ?? '').trim();
  const errors = [];

  if (!['approved', 'rejected'].includes(decision)) {
    errors.push('Decision must be approved or rejected.');
  }
  if (decision === 'rejected' && !reviewNote) {
    errors.push('A client-visible rejection reason is required.');
  }
  if (reviewNote.length > 1000) {
    errors.push('The review note must contain no more than 1,000 characters.');
  }
  if (hasControlCharacters(reviewNote)) {
    errors.push('The review note cannot contain control characters.');
  }

  return {
    errors,
    valid: errors.length === 0,
    value: {
      decision,
      decisionReason: reviewNote || null,
    },
  };
};

export const mapClientAccount = (input = {}) => {
  const source = asRecord(input);
  const profile = asRecord(source.profile || source.account || source);
  const verification = asRecord(source.verification);
  const status = cleanText(firstValue(verification, 'status'), 40) || 'draft';
  const clientTier = cleanText(firstValue(profile, 'clientTier', 'client_tier'), 40) || 'basic';
  const clientTierLabel = cleanText(
    firstValue(profile, 'clientTierLabel', 'client_tier_label')
      ?? firstValue(source, 'clientTierLabel', 'client_tier_label'),
    80,
  ) || (clientTier === 'vip' ? 'VIP' : clientTier[0].toUpperCase() + clientTier.slice(1));

  return {
    account: {
      avatarUrl: cleanText(firstValue(profile, 'avatarUrl', 'avatar_url'), 2000) || null,
      clientTier,
      clientTierLabel,
      company: cleanText(firstValue(profile, 'company'), 180),
      email: cleanText(firstValue(profile, 'email'), 320),
      fullName: cleanText(firstValue(profile, 'fullName', 'full_name', 'name'), 160),
      id: cleanText(firstValue(profile, 'id'), 100),
      role: cleanText(firstValue(profile, 'role'), 40) || 'client',
    },
    verification: {
      reviewedAt: cleanText(firstValue(verification, 'reviewedAt', 'reviewed_at'), 100) || null,
      status,
      submittedAt: cleanText(firstValue(verification, 'submittedAt', 'submitted_at'), 100) || null,
      verifiedBusinessName: status === 'approved'
        ? cleanText(firstValue(verification, 'verifiedBusinessName', 'verified_business_name'), 240) || null
        : null,
    },
  };
};

export const mapClientNameRequest = (row) => {
  const source = asRecord(row);
  if (!Object.keys(source).length) return null;

  return {
    clientId: cleanText(firstValue(source, 'clientId', 'client_id'), 100),
    createdAt: cleanText(firstValue(source, 'createdAt', 'created_at'), 100) || null,
    currentFullName: cleanText(firstValue(source, 'currentFullName', 'current_full_name'), 160),
    decisionReason: cleanText(firstValue(source, 'decisionReason', 'decision_reason'), 1000) || null,
    id: cleanText(firstValue(source, 'id'), 100),
    requestReason: cleanText(firstValue(source, 'requestReason', 'request_reason'), 1000),
    requestedFullName: cleanText(firstValue(source, 'requestedFullName', 'requested_full_name'), 160),
    reviewedAt: cleanText(firstValue(source, 'reviewedAt', 'reviewed_at'), 100) || null,
    status: cleanText(firstValue(source, 'status'), 40) || 'pending',
  };
};

export const mapAdminClientNameRequest = (row, context = {}) => {
  const request = mapClientNameRequest(row);
  if (!request) return null;

  const source = asRecord(row);
  const safeContext = asRecord(context);
  const profile = asRecord(safeContext.profile || safeContext.client || source.client);
  const verification = asRecord(safeContext.verification);

  return {
    ...request,
    client: {
      company: cleanText(firstValue(profile, 'company') ?? firstValue(source, 'client_company'), 180),
      email: cleanText(firstValue(profile, 'email') ?? firstValue(source, 'client_email'), 320),
    },
    verificationStatus: cleanText(
      firstValue(safeContext, 'verificationStatus', 'verification_status')
        ?? firstValue(verification, 'status')
        ?? firstValue(source, 'verificationStatus', 'verification_status'),
      40,
    ) || 'draft',
  };
};

const mapClientPermissions = (value) => {
  const source = asRecord(value);

  return Object.fromEntries(CLIENT_PERMISSION_FIELDS
    .filter((key) => Object.hasOwn(source, key))
    .map((key) => [key, source[key]]));
};

export const mapClientSessionSummary = (account = {}) => {
  const sourceValue = asRecord(account);
  const source = asRecord(sourceValue.account || sourceValue);

  return {
    avatarUrl: cleanText(firstValue(source, 'avatarUrl', 'avatar_url'), 2000) || null,
    clientPermissions: mapClientPermissions(firstValue(source, 'clientPermissions', 'client_permissions')),
    clientTier: cleanText(firstValue(source, 'clientTier', 'client_tier'), 40) || 'basic',
    clientTierLabel: cleanText(firstValue(source, 'clientTierLabel', 'client_tier_label'), 80) || 'Basic',
    company: cleanText(firstValue(source, 'company'), 180),
    id: cleanText(firstValue(source, 'id'), 100),
    name: cleanText(firstValue(source, 'name', 'fullName', 'full_name'), 160),
  };
};

export const classifyClientProfileDatabaseError = (error = {}) => {
  const source = asRecord(error);
  const body = asRecord(source.body || source.data);
  const code = cleanText(firstValue(source, 'code') ?? firstValue(body, 'code'), 80);
  const searchable = [
    firstValue(source, 'message'),
    firstValue(source, 'details'),
    firstValue(body, 'message'),
    firstValue(body, 'details'),
  ].map((value) => String(value || '')).join(' ');

  if (searchable.includes('PB_CLIENT_NAME_CHANGE_PENDING')) {
    return { message: 'A different full-name change is already pending.', status: 409 };
  }
  if (searchable.includes('PB_CLIENT_NAME_CHANGE_STALE')) {
    return { message: 'This full-name change request is no longer current.', status: 409 };
  }
  if (code === '23505') {
    return { message: 'A full-name change is already pending.', status: 409 };
  }

  const status = Number(firstValue(source, 'status') ?? firstValue(body, 'status'));

  return {
    message: cleanText(firstValue(source, 'message') ?? firstValue(body, 'message'), 1000)
      || 'Unable to update the client profile.',
    status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500,
  };
};
