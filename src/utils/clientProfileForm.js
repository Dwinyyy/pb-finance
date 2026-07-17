const DIRECT_NAME_STATUSES = new Set(['draft', 'rejected']);
const PROTECTED_NAME_STATUSES = new Set(['pending_review', 'approved']);

const asRecord = (value) => (
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
);

const hasControlCharacters = (value) => [...String(value || '')].some((character) => {
  const codePoint = character.codePointAt(0);
  return codePoint <= 31 || codePoint === 127;
});

export const createClientProfileDraft = (account = {}) => ({
  company: account.company || '',
  fullName: account.fullName || '',
  requestReason: '',
});

export const shouldRequestProtectedNameReason = (draft = {}, context = {}) => (
  PROTECTED_NAME_STATUSES.has(String(context.verificationStatus || 'draft').toLowerCase())
  && String(draft.fullName || '').trim() !== String(context.activeFullName || '').trim()
);

export const validateClientProfileDraft = (draft = {}, context = {}) => {
  const value = asRecord(draft);
  const safeContext = asRecord(context);
  const errors = {};
  const fullName = String(value.fullName || '').trim();
  const company = String(value.company || '').trim();
  const requestReason = String(value.requestReason || '').trim();
  const activeFullName = String(safeContext.activeFullName || '').trim();
  const verificationStatus = String(safeContext.verificationStatus || 'draft').trim().toLowerCase();
  const nameChanged = fullName !== activeFullName;

  if (fullName.length < 2 || fullName.length > 160) {
    errors.fullName = 'Full name must contain 2 to 160 characters.';
  } else if (hasControlCharacters(fullName)) {
    errors.fullName = 'Full name cannot contain control characters.';
  }

  if (company.length < 1 || company.length > 180) {
    errors.company = 'Display company must contain 1 to 180 characters.';
  } else if (hasControlCharacters(company)) {
    errors.company = 'Display company cannot contain control characters.';
  }

  const requiresReason = shouldRequestProtectedNameReason(value, safeContext);
  if (requiresReason && (requestReason.length < 1 || requestReason.length > 1000)) {
    errors.requestReason = 'A 1 to 1,000 character explanation is required for this protected name change.';
  } else if (requiresReason && hasControlCharacters(requestReason)) {
    errors.requestReason = 'The name-change explanation cannot contain control characters.';
  }

  if (
    nameChanged
    && !DIRECT_NAME_STATUSES.has(verificationStatus)
    && !PROTECTED_NAME_STATUSES.has(verificationStatus)
    && !errors.fullName
  ) {
    errors.fullName = 'The current verification state cannot accept a name change.';
  }

  const pendingNameRequest = asRecord(safeContext.pendingNameRequest);
  const pendingRequestedName = String(
    pendingNameRequest.requestedFullName || pendingNameRequest.requested_full_name || '',
  ).trim();
  if (pendingRequestedName && nameChanged && pendingRequestedName !== fullName && !errors.fullName) {
    errors.fullName = 'A different full-name change is already pending.';
  }

  return errors;
};
