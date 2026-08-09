import { createHash, randomUUID } from 'node:crypto';

import { getRoutePath, handleOptions, readJson, sendError, sendJson, setCorsHeaders } from '../server/http.js';
import {
  completePasswordSetupWithGoogle,
  getPasswordSetupRequirement,
  requestGooglePasswordLinkVerification,
  requestPasswordSetupVerification,
  verifyGooglePasswordLinkOtp,
  verifyPasswordSetupOtp,
} from '../server/accountLinking.js';
import { finalizeOAuthAccount, flagGoogleProfessionalAccount, getAuthProviders } from '../server/authTriage.js';
import { notifyAdmins, notifyUser } from '../server/notifications.js';
import { getWebPushConfig, normalizePushSubscription } from '../server/pushNotifications.js';
import { requestRegistrationVerification, verifyRegistrationOtp } from '../server/registrationVerification.js';
import { getSessionUser, toActiveSessionSummary } from '../server/session.js';
import {
  getProfessionalTierFromProfile,
  loadProfessionalTierPermissions,
  mapProfessionalTierPermissions,
  normalizeProfessionalTier,
} from '../server/professionalPermissions.js';
import {
  mapClientVerification,
  parseClientVerificationUpload,
  validateClientVerificationDecision,
  validateClientVerificationRejection,
  validateClientVerificationSubmission,
} from '../server/clientVerification.js';
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
  getOwnedProfilePhotoStoragePath,
  parseProfileImageUpload,
} from '../server/profileImageUpload.js';
import {
  getBearerToken,
  getOAuthSignInUrl,
  getSupabaseUser,
  normalizeEmail,
  publicUser,
  refreshSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabaseRestRequest,
  supabaseStorageRequest,
  updateCurrentSupabaseUser,
} from '../server/supabase.js';
import { PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS, REGULATED_TITLE_REQUIREMENTS } from '../src/data/constants.js';

const hasServiceRoleKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const getDataOptions = (req, { useServiceRole = false } = {}) => ({
  token: getBearerToken(req),
  useServiceRole: Boolean(req.useServiceRole || useServiceRole),
});

const asList = (value) => (Array.isArray(value) ? value : []);
const CANONICAL_ROLES = new Set(['admin', 'client', 'professional']);
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const CREDENTIAL_UPLOAD_BUCKET = 'professional-documents';
const CLIENT_VERIFICATION_UPLOAD_BUCKET = 'client-verification-documents';
const MAX_CREDENTIAL_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_CREDENTIAL_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
]);
const PROFILE_PHOTO_BUCKET = 'profile-photos';
const IDENTITY_UPLOAD_KINDS = new Set(['valid_id_front', 'valid_id_back', 'liveness_selfie']);
const IDENTITY_UPLOAD_KEYS = Object.freeze({
  liveness_selfie: 'livenessSelfie',
  valid_id_back: 'validIdBack',
  valid_id_front: 'validIdFront',
});
const IDENTITY_UPLOAD_LABELS = Object.freeze({
  liveness_selfie: 'Liveness selfie',
  valid_id_back: 'Valid ID back',
  valid_id_front: 'Valid ID front',
});
const DOCUMENT_TYPE_FILE_RULES = {
  certification: {
    extensions: new Set(['.pdf', '.jpg', '.jpeg', '.png']),
    mimeTypes: new Set(['application/pdf', 'image/jpeg', 'image/png']),
    message: 'Certification uploads must be a PDF, JPG, or PNG.',
  },
  other_document: {
    extensions: new Set(['.pdf', '.jpg', '.jpeg', '.png']),
    mimeTypes: ALLOWED_CREDENTIAL_MIME_TYPES,
    message: 'Supporting document uploads must be a PDF, JPG, or PNG.',
  },
  resume: {
    extensions: new Set(['.pdf', '.jpg', '.jpeg', '.png']),
    mimeTypes: ALLOWED_CREDENTIAL_MIME_TYPES,
    message: 'Resume uploads must be a PDF, JPG, or PNG.',
  },
};
const credentialReviewStatuses = new Set(['pending_review', 'approved', 'rejected']);
const PROFESSIONAL_PROFILE_PRIVATE_SELECT = '*';
const PROFESSIONAL_PROFILE_DIRECTORY_SELECT = [
  'user_id',
  'bio',
  'location',
  'country',
  'years_experience',
  'hourly_rate',
  'availability',
  'status',
  'rating',
  'review_count',
  'titles',
  'tools',
  'skills',
  'certifications',
  'industries',
  'published_at',
  'updated_at',
].join(',');
const PROFILE_OWNER_BASE_SELECT = ['id', 'avatar_url', 'full_name', 'role', 'title'];
const PROFILE_OWNER_CONTACT_SELECT = ['id', 'avatar_url', 'email', 'full_name', 'company', 'role', 'title', 'client_tier'];
const PROFILE_OWNER_MANUAL_TRIAGE_SELECT = [
  ...PROFILE_OWNER_CONTACT_SELECT,
  'manual_triage_required',
  'manual_triage_status',
  'manual_triage_reason',
  'manual_triage_domain',
];
const talentPrivateVisibilities = new Set(['admin', 'internal', 'owner']);
const talentCredentialVisibilities = new Set(['admin', 'internal', 'owner', 'client_full']);
const talentOwnerContactVisibilities = new Set(['admin', 'internal', 'owner']);
const basicClientRestrictedTalentProfileFields = Object.freeze([
  'email',
  'externalLinks',
  'hasPendingChanges',
  'identityVerificationNotes',
  'identityVerificationDocuments',
  'identityVerificationStatus',
  'pendingDraftOnly',
  'professionalPermissions',
  'professionalTier',
  'professionalTierLabel',
  'profileVisibility',
  'resume',
  'reviewStatus',
  'supportingDocuments',
  'verifiedAt',
  'workPreferences',
]);
const basicClientRestrictedTalentProfileNulls = Object.freeze(Object.fromEntries(
  basicClientRestrictedTalentProfileFields.map((field) => [field, null])
));
const CLIENT_PROFILE_SELECT = 'id,avatar_url,email,full_name,company,role,title,client_tier';
const CLIENT_ACCOUNT_PROFILE_SELECT = 'id,avatar_url,email,full_name,company,role,client_tier';
const CLIENT_VERIFICATION_SUMMARY_SELECT = 'client_id,status,verified_business_name,submitted_at,reviewed_at';
const CLIENT_NAME_REQUEST_SELECT = 'id,client_id,current_full_name,requested_full_name,request_reason,status,decision_reason,created_at,reviewed_at';
const CLIENT_TIERS = new Set(['basic', 'verified', 'vip']);
const CLIENT_TIER_PERMISSIONS = Object.freeze({
  basic: Object.freeze({
    canDiscoverAgencies: false,
    canReadReviews: true,
    canReviewProfessionals: false,
    canScheduleInterviews: false,
    canUseMatchmaker: false,
    canViewBasicProfiles: true,
    canViewFullDocuments: false,
    label: 'Basic',
    matchmakerLevel: 'none',
    monthlyBackgroundCheckLimit: 0,
    monthlyJobLimit: 0,
    shortlistLimit: 5,
  }),
  verified: Object.freeze({
    canDiscoverAgencies: true,
    canReadReviews: true,
    canReviewProfessionals: true,
    canScheduleInterviews: true,
    canUseMatchmaker: true,
    canViewBasicProfiles: true,
    canViewFullDocuments: true,
    label: 'Verified',
    matchmakerLevel: 'basic',
    monthlyBackgroundCheckLimit: 0,
    monthlyJobLimit: 10,
    shortlistLimit: null,
  }),
  vip: Object.freeze({
    canDiscoverAgencies: true,
    canReadReviews: true,
    canReviewProfessionals: true,
    canScheduleInterviews: true,
    canUseMatchmaker: true,
    canViewBasicProfiles: true,
    canViewFullDocuments: true,
    label: 'VIP',
    matchmakerLevel: 'pro',
    monthlyBackgroundCheckLimit: null,
    monthlyJobLimit: null,
    shortlistLimit: null,
  }),
});
const cleanString = (value, maxLength = 500) => String(value || '').trim().slice(0, maxLength);
const cleanBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const normalizeClientTier = (value) => {
  const tier = cleanString(value, 40).toLowerCase();

  return CLIENT_TIERS.has(tier) ? tier : 'basic';
};
const getClientTier = (user) => (user?.role === 'client' ? normalizeClientTier(user.clientTier || user.client_tier) : 'basic');
const getClientPermissions = (user) => {
  const tier = getClientTier(user);
  const permissions = CLIENT_TIER_PERMISSIONS[tier] || CLIENT_TIER_PERMISSIONS.basic;

  return {
    ...permissions,
    tier,
  };
};
const withClientPermissions = (user) => {
  if (!user || user.role !== 'client') {
    return user;
  }

  const permissions = getClientPermissions(user);

  return {
    ...user,
    clientPermissions: permissions,
    clientTier: permissions.tier,
    clientTierLabel: permissions.label,
    client_tier: permissions.tier,
  };
};
const getProfessionalPermissions = (userOrProfile, permissionRow) => {
  const tier = userOrProfile?.user_id
    ? getProfessionalTierFromProfile(userOrProfile)
    : normalizeProfessionalTier(userOrProfile?.professionalTier || userOrProfile?.professional_tier);
  return mapProfessionalTierPermissions(
    tier,
    permissionRow || userOrProfile?.professionalPermissions
  );
};
const withProfessionalPermissions = (user, profile, permissionRow) => {
  if (!user || user.role !== 'professional') {
    return user;
  }

  const tier = profile
    ? getProfessionalTierFromProfile(profile)
    : normalizeProfessionalTier(user.professionalTier || user.professional_tier);
  const permissions = mapProfessionalTierPermissions(
    tier,
    permissionRow || (!profile ? user.professionalPermissions : null)
  );

  return {
    ...user,
    professionalPermissions: permissions,
    professionalTier: permissions.tier,
    professionalTierLabel: permissions.label,
    professional_tier: permissions.tier,
    profileVisibility: profile?.profile_visibility || user.profileVisibility || user.profile_visibility || 'hidden',
    profile_visibility: profile?.profile_visibility || user.profileVisibility || user.profile_visibility || 'hidden',
  };
};
const withRolePermissions = (user, professionalProfile, professionalPermissions) => withProfessionalPermissions(
  withClientPermissions(user),
  professionalProfile,
  professionalPermissions
);
const placeholderTitles = new Set(['Complete your profile', 'Finance Professional']);
const cleanProfileTitle = (value) => {
  const title = cleanString(value, 160);

  return title && !placeholderTitles.has(title) ? title : '';
};

const cleanList = (value, maxItems = 20) => {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',');

  return [...new Set(list
    .map((item) => cleanString(item, 80))
    .filter(Boolean))]
    .slice(0, maxItems);
};
const cleanRecord = (value) => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {});
const cleanUrl = (value) => {
  const rawUrl = cleanString(value, 500);
  const url = rawUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;

  if (!url) return '';

  try {
    const parsed = new URL(url);

    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
};
const cleanExternalLinks = (links) => asList(links)
  .map((link) => ({
    id: cleanString(link.id, 40),
    label: cleanString(link.label, 80),
    url: cleanUrl(link.url),
  }))
  .filter((link) => link.label && link.url)
  .slice(0, 8);
const cleanCredentialFileRecord = (file) => {
  const record = cleanRecord(file);
  const fileName = cleanString(record.fileName || record.name, 220);
  const fileSha256 = cleanString(record.fileSha256 || record.file_sha256, 64).toLowerCase();
  const uploadedAt = cleanString(record.uploadedAt, 80);

  if (!fileName || !uploadedAt) return null;

  return {
    contentType: cleanString(record.contentType, 120),
    fileName,
    fileSha256: /^[a-f0-9]{64}$/.test(fileSha256) ? fileSha256 : '',
    fileSize: toNumber(record.fileSize),
    id: cleanString(record.id, 80),
    key: cleanString(record.key, 180),
    kind: cleanString(record.kind, 80),
    label: cleanString(record.label, 180),
    path: cleanString(record.path, 700),
    rejectedAt: cleanString(record.rejectedAt, 80),
    rejectionReason: cleanString(record.rejectionReason, 1000),
    previousFileName: cleanString(record.previousFileName, 220),
    previousStatus: cleanString(record.previousStatus, 60),
    changeRequest: cleanRecord(record.changeRequest),
    changeRequestStatus: cleanString(record.changeRequestStatus, 40),
    replacedAt: cleanString(record.replacedAt, 80),
    replacedDocumentId: cleanString(record.replacedDocumentId, 80),
    replacedDocumentPath: cleanString(record.replacedDocumentPath, 700),
    reviewMessage: cleanString(record.reviewMessage, 1000),
    reviewedAt: cleanString(record.reviewedAt, 80),
    reviewedBy: cleanString(record.reviewedBy, 80),
    status: cleanString(record.status, 60) || 'draft',
    storageKey: cleanString(record.storageKey, 120),
    uploadedAt,
    expiryDate: cleanString(record.expiryDate, 80),
    noExpiryRequired: cleanBoolean(record.noExpiryRequired ?? record.no_expiry_required),
    inputValue: cleanString(record.inputValue, 200),
  };
};
const cleanIdentityVerificationDocuments = (documents) => {
  const record = cleanRecord(documents);

  return {
    livenessSelfie: cleanCredentialFileRecord(record.livenessSelfie || record.liveness_selfie),
    validIdBack: cleanCredentialFileRecord(record.validIdBack || record.valid_id_back),
    validIdFront: cleanCredentialFileRecord(record.validIdFront || record.valid_id_front),
  };
};
const hasCredentialArtifact = (credential) => {
  const record = cleanCredentialFileRecord(credential);

  return Boolean(record?.path || record?.fileName);
};
const getIdentitySubmissionBlocker = (profile, { now = new Date() } = {}) => {
  const documents = cleanIdentityVerificationDocuments(profile?.identity_verification_documents || profile?.identityVerificationDocuments);

  if (!hasCredentialArtifact(documents.validIdFront)) {
    return 'Upload a valid ID before requesting verification.';
  }

  if (!hasCredentialArtifact(documents.livenessSelfie)) {
    return 'Complete the liveness selfie check before requesting verification.';
  }

  const expiryDate = normalizeExpiryDate(documents.validIdFront?.expiryDate);

  if (!expiryDate) {
    return 'Add the valid ID expiration date before requesting verification.';
  }

  if (getDaysUntilDate(expiryDate, now) <= 0) {
    return 'The valid ID is expired. Upload a current ID before requesting verification.';
  }

  return '';
};
const markIdentityVerificationDocumentsSubmitted = (documents) => {
  const cleanDocuments = cleanIdentityVerificationDocuments(documents);

  return Object.fromEntries(
    Object.entries(cleanDocuments)
      .filter(([, document]) => document?.path)
      .map(([key, document]) => [
        key,
        {
          ...document,
          status: document.status === 'approved' ? 'approved' : 'pending_review',
        },
      ])
  );
};
const cleanSupportingDocuments = (documents) => asList(documents)
  .map((document) => cleanCredentialFileRecord(document))
  .filter(Boolean)
  .slice(0, 20);
const cleanWorkPreferences = (value, fallback = {}) => {
  const preferences = cleanRecord(value);
  const fallbackPreferences = cleanRecord(fallback);
  const hasPreferenceField = (key) => Object.hasOwn(preferences, key);
  const resume = hasPreferenceField('resume')
    ? cleanCredentialFileRecord(preferences.resume)
    : cleanCredentialFileRecord(fallbackPreferences.resume);

  return {
    ...fallbackPreferences,
    ...preferences,
    externalLinks: cleanExternalLinks(hasPreferenceField('externalLinks') ? preferences.externalLinks : fallbackPreferences.externalLinks),
    regulatedInputs: cleanRecord(hasPreferenceField('regulatedInputs') ? preferences.regulatedInputs : fallbackPreferences.regulatedInputs),
    resume,
    supportingDocuments: cleanSupportingDocuments(hasPreferenceField('supportingDocuments') ? preferences.supportingDocuments : fallbackPreferences.supportingDocuments),
  };
};
const normalizeCredentialReviewStatus = (status) => {
  const value = cleanString(status, 40);

  return credentialReviewStatuses.has(value) ? value : '';
};
const markCredentialFileSubmitted = (credential) => {
  const record = cleanCredentialFileRecord(credential);

  if (!record) return null;

  return {
    ...record,
    status: ['approved', 'rejected'].includes(record.status) ? record.status : 'pending_review',
  };
};
const canReviewCredentialStatus = (credential, status) => {
  const currentStatus = credential?.status || 'pending_review';

  if (status === 'pending_review') return currentStatus === 'approved';

  return currentStatus === 'pending_review';
};
const markWorkPreferencesSubmitted = (workPreferences) => {
  const preferences = cleanWorkPreferences(workPreferences);

  return {
    ...preferences,
    resume: preferences.resume ? markCredentialFileSubmitted(preferences.resume) : null,
    supportingDocuments: asList(preferences.supportingDocuments)
      .map((document) => markCredentialFileSubmitted(document))
      .filter(Boolean),
  };
};
const cleanProfessionalTitles = (value, fallback = []) => {
  const source = value === undefined ? fallback : value;
  const rawTitles = Array.isArray(source)
    ? source
    : String(source || '').split(',');

  return [...new Set(rawTitles
    .map(cleanProfileTitle)
    .filter(Boolean))]
    .slice(0, 8);
};
const formatProfessionalTitles = (titles) => cleanProfessionalTitles(titles).join(', ');
const withoutCanonicalRole = (user) => ({
  ...user,
  role: null,
});

const getProfileUserForSession = async (session) => {
  const user = publicUser(session.user);

  if (!user.id) {
    return withoutCanonicalRole(user);
  }

  try {
    const rows = await supabaseRestRequest(
      `/profiles?id=eq.${user.id}&select=${CLIENT_PROFILE_SELECT}&limit=1`,
      {
        token: session.access_token,
        useServiceRole: false,
      }
    );
    const profile = asList(rows)[0];

    if (!profile) {
      return withoutCanonicalRole(user);
    }

    const canonicalRole = CANONICAL_ROLES.has(profile.role) ? profile.role : null;

    const baseUser = {
      ...user,
      company: profile.company || user.company,
      email: profile.email || user.email,
      avatarUrl: profile.avatar_url || user.avatarUrl,
      avatar_url: profile.avatar_url || user.avatar_url,
      name: profile.full_name || user.name,
      role: canonicalRole,
      clientTier: normalizeClientTier(profile.client_tier),
      title: profile.title || user.title,
    };
    if (baseUser.role !== 'professional') {
      return withRolePermissions(baseUser);
    }

    let professionalProfile = null;

    try {
      const professionalRows = await supabaseRestRequest(
        `/professional_profiles?user_id=eq.${baseUser.id}&select=professional_tier,status,profile_visibility,identity_verification_status&limit=1`,
        {
          token: session.access_token,
          useServiceRole: false,
        }
      );
      professionalProfile = asList(professionalRows)[0] || null;
    } catch {
      return withRolePermissions(
        baseUser,
        null,
        mapProfessionalTierPermissions('unverified', null)
      );
    }

    const tier = getProfessionalTierFromProfile(professionalProfile);
    const permissions = await loadProfessionalTierPermissions(
      tier,
      (path) => supabaseRestRequest(path, {
        token: session.access_token,
        useServiceRole: false,
      })
    );

    return withRolePermissions(baseUser, professionalProfile, permissions);
  } catch {
    return withoutCanonicalRole(user);
  }
};

const sessionPayload = async (session) => ({
  expiresIn: session.expires_in,
  provider: 'supabase',
  refreshToken: session.refresh_token,
  token: session.access_token,
  user: await getProfileUserForSession(session),
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getMonthDay = (value) => {
  if (!value) {
    return { day: '--', month: 'TBD', time: 'Time pending' };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { day: '--', month: 'TBD', time: 'Time pending' };
  }

  return {
    day: date.toLocaleDateString('en-US', { day: '2-digit' }),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
};

const requireSession = async (req, res, allowedRoles = []) => {
  const user = await getSessionUser(req);

  if (!user) {
    sendError(res, 401, 'Authentication required.');
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    sendError(res, 403, 'You do not have access to this resource.');
    return null;
  }

  return withRolePermissions(user);
};

const requireAdmin = async (req, res) => {
  const user = await requireSession(req, res, ['admin']);

  if (!user) return null;

  if (!hasServiceRoleKey()) {
    sendError(res, 500, 'Admin routes require SUPABASE_SERVICE_ROLE_KEY on the server.');
    return null;
  }

  req.useServiceRole = true;
  return withRolePermissions(user);
};

const requireAdminOrCronSecret = async (req, res) => {
  const expectedSecret = cleanString(process.env.PB_CRON_SECRET || process.env.CRON_SECRET, 500);
  const authHeader = cleanString(req.headers.authorization || req.headers.Authorization, 700);
  const bearerSecret = authHeader.replace(/^Bearer\s+/i, '');
  const headerSecret = cleanString(req.headers['x-cron-secret'] || req.headers['x-pb-cron-secret'], 500);

  if (expectedSecret && (headerSecret === expectedSecret || bearerSecret === expectedSecret)) {
    req.useServiceRole = true;
    return { id: 'cron', role: 'admin' };
  }

  return requireAdmin(req, res);
};

const readRows = (req, path, options = {}) => supabaseRestRequest(path, getDataOptions(req, options));

const writeRows = (req, path, body, { method = 'POST', prefer = 'return=representation', useServiceRole = false } = {}) => (
  supabaseRestRequest(path, {
    ...getDataOptions(req, { useServiceRole }),
    body,
    method,
    prefer,
  })
);

const patchRows = (req, path, body, { prefer = 'return=representation', useServiceRole = false } = {}) => (
  writeRows(req, path, body, { method: 'PATCH', prefer, useServiceRole })
);

const isMissingSchemaError = (error, names = []) => {
  const message = String(error?.message || '').toLowerCase();

  return names.some((name) => message.includes(String(name).toLowerCase()));
};
const readRowsIfPresent = async (req, path, missingNames, options = {}) => {
  try {
    return await readRows(req, path, options);
  } catch (error) {
    if (isMissingSchemaError(error, missingNames)) {
      return [];
    }

    throw error;
  }
};
const getDocumentExpirationSentKeys = async (req) => {
  const rows = await readRowsIfPresent(
    req,
    '/document_expiration_events?select=professional_id,document_key,event_type,expiry_date&limit=5000',
    ['document_expiration_events'],
    { useServiceRole: true }
  );

  return new Set(asList(rows).map((row) => getDocumentExpirationEventKey({
    documentKey: row.document_key,
    eventType: row.event_type,
    expiryDate: row.expiry_date,
    professionalId: row.professional_id,
  })));
};
const recordDocumentExpirationEvent = async (req, action) => {
  try {
    await writeRows(
      req,
      '/document_expiration_events?on_conflict=professional_id,document_key,event_type,expiry_date',
      {
        document_file_name: action.document.fileName || '',
        document_key: action.documentKey,
        document_label: action.document.label || action.document.fileName || '',
        event_type: action.eventType,
        expiry_date: action.expiryDate,
        professional_id: action.professionalId,
      },
      { prefer: 'resolution=ignore-duplicates,return=minimal', useServiceRole: true }
    );
  } catch (error) {
    if (!isMissingSchemaError(error, ['document_expiration_events'])) {
      throw error;
    }
  }
};
const notifyDocumentExpirationAction = async (profile, action) => {
  const documentLabel = action.document.label || action.document.fileName || 'Required document';
  const isExpired = action.eventType === 'expired';

  return notifyUser({
    actionUrl: '/?tab=profile',
    body: isExpired
      ? `Your verified document "${documentLabel}" has expired. Your professional verification has been downgraded until you upload a renewal and PB Finance approves it.`
      : `Your verified document "${documentLabel}" will expire in ${action.daysToExpiry} days. Upload a renewal before it expires to keep verified access.`,
    emailSubject: isExpired
      ? `Document expired: ${documentLabel}`
      : `Document expiring in ${action.daysToExpiry} days: ${documentLabel}`,
    metadata: {
      documentKey: action.documentKey,
      eventType: action.eventType,
      expiryDate: action.expiryDate,
      professionalId: action.professionalId,
    },
    recipientEmail: profile.email,
    recipientId: profile.id || profile.user_id,
    recipientName: profile.fullName || profile.name,
    title: isExpired ? 'Document expired' : 'Document expiring soon',
    type: isExpired ? 'document_expired' : 'document_expiring',
  });
};
const runDocumentExpirationCheck = async (req) => {
  const profiles = await loadTalentProfiles(req, { onlyApproved: true, visibility: 'internal' });
  const sentKeys = await getDocumentExpirationSentKeys(req);
  const now = new Date();
  const downgradedProfessionalIds = new Set();
  let notifications = 0;

  for (const profile of profiles) {
    const actions = getDocumentExpirationActions(profile, { now, sentKeys });

    for (const action of actions) {
      await notifyDocumentExpirationAction(profile, action);
      notifications += 1;

      if (action.eventType === 'expired' && !downgradedProfessionalIds.has(action.professionalId)) {
        await patchRows(
          req,
          `/professional_profiles?user_id=eq.${action.professionalId}`,
          {
            ...getProfessionalDowngradePayload(),
            review_submitted_at: now.toISOString(),
          },
          { useServiceRole: true }
        );
        downgradedProfessionalIds.add(action.professionalId);
      }

      await recordDocumentExpirationEvent(req, action);
      sentKeys.add(action.eventKey);
    }
  }

  return {
    checked: profiles.length,
    downgraded: downgradedProfessionalIds.size,
    notifications,
    ok: true,
  };
};
const getMonthStartIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};
const getSearchParams = (req) => new URL(
  req.url || '/api',
  `https://${req.headers.host || 'localhost'}`
).searchParams;
const getClientMonthlyJobUsage = async (req, user) => {
  const monthStart = getMonthStartIso();
  const [jobs, opportunities] = await Promise.all([
    readRowsIfPresent(
      req,
      `/client_jobs?client_id=eq.${user.id}&created_at=gte.${encodeURIComponent(monthStart)}&select=id&limit=100`,
      ['client_jobs'],
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/opportunities?client_id=eq.${user.id}&created_at=gte.${encodeURIComponent(monthStart)}&select=id&limit=100`,
      { useServiceRole: true }
    ),
  ]);

  return asList(jobs).length + asList(opportunities).length;
};
const getClientShortlistUsage = async (req, user) => {
  const rows = await readRows(
    req,
    `/shortlists?client_id=eq.${user.id}&status=neq.archived&select=professional_id&limit=100`,
    { useServiceRole: true }
  );

  return asList(rows);
};
const getClientMonthlyBackgroundCheckUsage = async (req, user) => {
  const monthStart = getMonthStartIso();
  const rows = await readRowsIfPresent(
    req,
    `/client_background_checks?client_id=eq.${user.id}&created_at=gte.${encodeURIComponent(monthStart)}&select=id&limit=100`,
    ['client_background_checks'],
    { useServiceRole: true }
  );

  return asList(rows).length;
};
const requireClientCapability = (res, user, capability, message) => {
  const permissions = getClientPermissions(user);

  if (permissions[capability]) {
    return permissions;
  }

  sendError(res, 403, message || 'Your client tier does not include this feature.');
  return null;
};
const requireClientJobPostPermission = async (req, res, user) => {
  const permissions = getClientPermissions(user);
  const limit = permissions.monthlyJobLimit;

  if (limit === null) {
    return { permissions, usage: null };
  }

  if (limit <= 0) {
    sendError(res, 403, 'Basic clients cannot post jobs.');
    return null;
  }

  const usage = await getClientMonthlyJobUsage(req, user);

  if (usage >= limit) {
    sendError(res, 403, `${permissions.label} clients can post ${limit} jobs per month. This month's limit has been reached.`);
    return null;
  }

  return { permissions, usage };
};
const requireClientShortlistPermission = async (req, res, user, professionalId) => {
  const permissions = getClientPermissions(user);
  const limit = permissions.shortlistLimit;

  if (limit === null) {
    return { permissions, usage: null };
  }

  const shortlist = await getClientShortlistUsage(req, user);

  if (shortlist.some((row) => row.professional_id === professionalId)) {
    return { permissions, usage: shortlist.length };
  }

  if (shortlist.length >= limit) {
    sendError(res, 403, `Basic clients can save up to ${limit} professionals.`);
    return null;
  }

  return { permissions, usage: shortlist.length };
};
const requireClientBackgroundCheckPermission = async (req, res, user) => {
  const permissions = getClientPermissions(user);
  const limit = permissions.monthlyBackgroundCheckLimit;

  if (limit === null) {
    return { permissions, usage: null };
  }

  if (limit <= 0) {
    sendError(res, 403, 'Only VIP clients can request background checks.');
    return null;
  }

  const usage = await getClientMonthlyBackgroundCheckUsage(req, user);

  if (usage >= limit) {
    sendError(res, 403, `${permissions.label} clients have reached their monthly background check limit.`);
    return null;
  }

  return { permissions, usage };
};

const byIdFilter = (ids) => `in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`;

const loadProfilesById = async (req, ids, {
  includeContact = false,
  includeManualTriage = false,
  useServiceRole = false,
} = {}) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  let rows;
  const selectFields = includeManualTriage
    ? PROFILE_OWNER_MANUAL_TRIAGE_SELECT
    : includeContact
      ? PROFILE_OWNER_CONTACT_SELECT
      : PROFILE_OWNER_BASE_SELECT;

  try {
    rows = await readRows(
      req,
      `/profiles?id=${byIdFilter(uniqueIds)}&select=${selectFields.join(',')}`,
      { useServiceRole }
    );
  } catch (error) {
    if (!String(error.message || '').includes('manual_triage')) {
      throw error;
    }

    rows = await readRows(
      req,
      `/profiles?id=${byIdFilter(uniqueIds)}&select=${(includeContact ? PROFILE_OWNER_CONTACT_SELECT : PROFILE_OWNER_BASE_SELECT).join(',')}`,
      { useServiceRole }
    );
  }

  return new Map(asList(rows).map((profile) => [profile.id, profile]));
};

const hasPendingProfile = (profile) => (
  profile?.pending_profile && Object.keys(profile.pending_profile).length > 0
);
const isDraftPendingProfile = (profile) => cleanRecord(profile?.pending_profile).__draftOnly === true;
const asDraftPendingProfile = (profilePayload) => ({
  ...profilePayload,
  __draftOnly: true,
});

const hasOwn = (value, key) => Object.hasOwn(cleanRecord(value), key);
const valueOrFallback = (value, fallback, key) => (hasOwn(value, key) ? value[key] : fallback?.[key]);

const toProfilePatch = (profile, fallback = {}) => ({
  availability: valueOrFallback(profile, fallback, 'availability'),
  bio: valueOrFallback(profile, fallback, 'bio'),
  certifications: cleanList(valueOrFallback(profile, fallback, 'certifications')),
  country: valueOrFallback(profile, fallback, 'country'),
  hourly_rate: toNumber(valueOrFallback(profile, fallback, 'hourly_rate')),
  industries: cleanList(valueOrFallback(profile, fallback, 'industries')),
  location: valueOrFallback(profile, fallback, 'location'),
  skills: cleanList(valueOrFallback(profile, fallback, 'skills')),
  titles: cleanProfessionalTitles(valueOrFallback(profile, fallback, 'titles') ?? profile?.title),
  tools: cleanList(valueOrFallback(profile, fallback, 'tools')),
  work_preferences: cleanWorkPreferences(
    valueOrFallback(profile, fallback, 'work_preferences'),
    fallback.work_preferences
  ),
  years_experience: toNumber(valueOrFallback(profile, fallback, 'years_experience')),
});

const toPendingProfessionalIdentity = (profilePayload, pendingProfile = {}) => {
  const profile = cleanRecord(profilePayload);
  const pendingIdentity = { ...cleanRecord(pendingProfile) };

  if (hasOwn(profile, 'full_name')) {
    pendingIdentity.full_name = cleanString(profile.full_name, 160);
  }

  if (hasOwn(profile, 'titles') || hasOwn(profile, 'title')) {
    pendingIdentity.titles = cleanProfessionalTitles(profile.titles ?? profile.title);
  }

  return pendingIdentity;
};

const getApprovedProfessionalIdentity = (profile = {}) => {
  const currentProfile = cleanRecord(profile);
  const approvedSource = hasPendingProfile(currentProfile)
    ? { ...currentProfile, ...cleanRecord(currentProfile.pending_profile) }
    : currentProfile;

  return {
    fullName: cleanString(approvedSource.full_name, 160),
    titles: cleanProfessionalTitles(
      approvedSource.titles ?? approvedSource.title,
      cleanProfessionalTitles(currentProfile.titles)
    ),
  };
};

const buildApprovedProfessionalDraftPatch = ({
  currentProfile = {},
  now = new Date().toISOString(),
  profilePayload = {},
  shouldReflectCredentialDraft = false,
} = {}) => {
  if (!shouldReflectCredentialDraft) {
    return {
      pending_profile: asDraftPendingProfile(profilePayload),
      review_status: currentProfile.review_status || null,
      review_submitted_at: currentProfile.review_submitted_at || null,
    };
  }

  const { titles: _pendingTitles, ...activeProfilePatch } = toProfilePatch(profilePayload, currentProfile);

  return {
    ...activeProfilePatch,
    pending_profile: toPendingProfessionalIdentity(profilePayload, currentProfile.pending_profile),
    review_status: 'pending_review',
    review_submitted_at: currentProfile.review_submitted_at || now,
  };
};

const isClientVisibleCredential = (credential) => {
  const record = cleanCredentialFileRecord(credential);

  return record && record.status === 'approved' ? record : null;
};
const toClientCredentialMetadata = (credential, documentType) => {
  const record = isClientVisibleCredential(credential);

  if (!record) return null;

  return {
    contentType: record.contentType,
    documentType: documentType || record.kind || 'supporting_document',
    expiryDate: record.expiryDate,
    fileName: record.fileName,
    fileSize: record.fileSize,
    id: record.id,
    key: record.key,
    kind: record.kind,
    label: record.label || record.fileName,
    noExpiryRequired: record.noExpiryRequired,
    status: record.status,
    uploadedAt: record.uploadedAt,
  };
};
const toClientVisibleWorkPreferences = (workPreferences) => {
  const preferences = cleanWorkPreferences(workPreferences);

  return {
    externalLinks: [],
    resume: toClientCredentialMetadata(preferences.resume, 'resume'),
    supportingDocuments: asList(preferences.supportingDocuments)
      .map((document) => toClientCredentialMetadata(document, document.kind || 'supporting_document'))
      .filter(Boolean),
  };
};

const mapTalentProfile = (profile, owner = {}, {
  includeDraftPending = false,
  professionalPermissions: configuredProfessionalPermissions,
  usePending = false,
  visibility = 'directory',
} = {}) => {
  const includePrivateProfileData = talentPrivateVisibilities.has(visibility);
  const includeCredentialData = talentCredentialVisibilities.has(visibility);
  const includeOwnerContact = talentOwnerContactVisibilities.has(visibility);
  const includeManualTriage = visibility === 'admin';
  const includeClientCredentialData = visibility === 'client_full';
  const hasDraftPending = isDraftPendingProfile(profile);
  const canShowPending = usePending && (
    includeDraftPending
    || (!hasDraftPending && (
      profile.review_status === 'pending_review'
      || profile.status === 'pending_review'
    ))
  );
  const pending = canShowPending && profile.pending_profile ? profile.pending_profile : {};
  const viewProfile = { ...profile, ...pending };
  const displayName = pending.full_name || owner.full_name || owner.name || 'Unnamed profile';
  const pendingHasTitles = Object.hasOwn(pending, 'titles') || Object.hasOwn(pending, 'title');
  const titles = pendingHasTitles
    ? cleanProfessionalTitles(pending.titles ?? pending.title)
    : cleanProfessionalTitles(viewProfile.titles, cleanProfessionalTitles(owner.title));
  const title = formatProfessionalTitles(titles);
  const hourlyRate = toNumber(viewProfile.hourly_rate);
  const years = toNumber(viewProfile.years_experience);
  const reviewStatus = profile.review_status || (profile.status === 'pending_review' ? 'pending_review' : null);
  const canShowWorkPreferences = includeCredentialData && (includeDraftPending || canShowPending || profile.status !== 'draft');
  const workPreferences = cleanWorkPreferences(canShowWorkPreferences ? viewProfile.work_preferences : {});
  const visibleWorkPreferences = includeClientCredentialData
    ? toClientVisibleWorkPreferences(workPreferences)
    : workPreferences;
  const professionalPermissions = getProfessionalPermissions(
    profile,
    configuredProfessionalPermissions
  );

  const mapped = {
    available: viewProfile.availability || 'Immediate Start',
    availability: viewProfile.availability || 'Immediate Start',
    avatarUrl: owner.avatar_url || owner.avatarUrl || '',
    avatar_url: owner.avatar_url || owner.avatarUrl || '',
    bio: viewProfile.bio || '',
    certifications: asList(viewProfile.certifications),
    exp: years ? `${years}+ yrs` : '',
    experience: years ? `${years}+ years` : '',
    fullName: displayName,
    id: profile.user_id,
    industries: asList(viewProfile.industries),
    location: viewProfile.location || viewProfile.country || '',
    name: displayName,
    rate: hourlyRate,
    rating: toNumber(viewProfile.rating),
    reviewCount: profile.review_count || 0,
    role: title,
    skills: asList(viewProfile.skills),
    status: usePending && includePrivateProfileData ? (reviewStatus || profile.status) : profile.status,
    title,
    titles,
    tools: asList(viewProfile.tools),
    yearsExperience: years,
  };

  if (visibility === 'client_full') {
    mapped.canViewFullDocuments = true;
  }

  if (includeOwnerContact) {
    mapped.email = owner.email || '';
  }

  if (includeManualTriage) {
    mapped.manualTriageDomain = owner.manual_triage_domain || '';
    mapped.manualTriageReason = owner.manual_triage_reason || '';
    mapped.manualTriageRequired = Boolean(owner.manual_triage_required);
    mapped.manualTriageStatus = owner.manual_triage_status || 'clear';
  }

  if (includePrivateProfileData) {
    mapped.hasPendingChanges = hasPendingProfile(profile);
    mapped.identityVerificationNotes = profile.identity_verification_notes || '';
    mapped.identityVerificationStatus = profile.identity_verification_status || 'pending';
    mapped.identityVerificationDocuments = cleanIdentityVerificationDocuments(profile.identity_verification_documents);
    mapped.pendingDraftOnly = hasDraftPending;
    mapped.professionalPermissions = professionalPermissions;
    mapped.professionalTier = professionalPermissions.tier;
    mapped.professionalTierLabel = professionalPermissions.label;
    mapped.profileVisibility = profile.profile_visibility || 'hidden';
    mapped.reviewStatus = reviewStatus;
    mapped.verifiedAt = profile.verified_at || null;
  }

  if (includeCredentialData) {
    mapped.externalLinks = asList(visibleWorkPreferences.externalLinks);
    mapped.resume = visibleWorkPreferences.resume || null;
    mapped.supportingDocuments = asList(visibleWorkPreferences.supportingDocuments);
    mapped.workPreferences = visibleWorkPreferences;
  }

  return mapped;
};

const mapTalentProfileWithConfiguredPermissions = async (req, profile, owner = {}, options = {}) => {
  const professionalPermissions = options.professionalPermissions
    || await loadProfessionalTierPermissions(
      getProfessionalTierFromProfile(profile),
      (path) => readRows(req, path, { useServiceRole: options.visibility !== 'owner' })
    );

  return mapTalentProfile(profile, owner, {
    ...options,
    professionalPermissions,
  });
};

const getTalentProfileVisibilityForViewer = (viewer, fallback = 'directory') => {
  if (viewer?.role !== 'client') {
    return fallback;
  }

  return getClientPermissions(viewer).canViewFullDocuments ? 'client_full' : 'directory';
};

const scrubTalentProfileForViewer = (profile, viewer) => {
  if (viewer?.role !== 'client') {
    return profile;
  }

  const permissions = getClientPermissions(viewer);

  if (permissions.canViewFullDocuments) {
    return {
      ...profile,
      canViewFullDocuments: true,
    };
  }

  return {
    ...profile,
    ...basicClientRestrictedTalentProfileNulls,
    canViewFullDocuments: false,
  };
};

const mapTalentProfileForViewer = (profile, owner = {}, viewer = {}, options = {}) => {
  const visibility = options.visibility || getTalentProfileVisibilityForViewer(
    viewer,
    options.defaultVisibility || 'directory'
  );

  return scrubTalentProfileForViewer(
    mapTalentProfile(profile, owner, {
      ...options,
      visibility,
    }),
    viewer
  );
};

const mapTalentProfilePreviewForTier = (profile, owner = {}, tier = 'basic') => mapTalentProfileForViewer(
  profile,
  owner,
  {
    clientTier: normalizeClientTier(tier),
    client_tier: normalizeClientTier(tier),
    id: 'profile-preview-client',
    role: 'client',
  },
  {
    usePending: false,
  }
);

const loadTalentProfiles = async (req, {
  ids,
  onlyApproved = false,
  usePending = false,
  visibility = 'directory',
} = {}) => {
  if (ids && ids.length === 0) {
    return [];
  }

  const filters = [];

  if (ids?.length) {
    filters.push(`user_id=${byIdFilter([...new Set(ids)])}`);
  }

  if (onlyApproved) {
    filters.push('status=eq.approved');
    filters.push('professional_tier=eq.verified');
    filters.push('identity_verification_status=eq.approved');
    filters.push('profile_visibility=eq.visible');
  }

  const query = filters.length ? `?${filters.join('&')}&` : '?';
  const includePrivateProfileData = talentPrivateVisibilities.has(visibility);
  const includeCredentialData = talentCredentialVisibilities.has(visibility);
  const includeOwnerContact = talentOwnerContactVisibilities.has(visibility);
  const useServiceRole = visibility !== 'owner';
  const select = includePrivateProfileData || includeCredentialData ? PROFESSIONAL_PROFILE_PRIVATE_SELECT : PROFESSIONAL_PROFILE_DIRECTORY_SELECT;
  const rows = await readRows(
    req,
    `/professional_profiles${query}select=${select}&order=updated_at.desc&limit=100`,
    { useServiceRole }
  );
  const profileRows = asList(rows);
  const owners = await loadProfilesById(req, profileRows.map((row) => row.user_id), {
    includeContact: includeOwnerContact,
    includeManualTriage: visibility === 'admin',
    useServiceRole,
  });

  if (!includePrivateProfileData) {
    return profileRows.map((profile) => mapTalentProfile(
      profile,
      owners.get(profile.user_id),
      { usePending, visibility }
    ));
  }

  const permissionsByTier = new Map();

  return Promise.all(profileRows.map(async (profile) => {
    const tier = getProfessionalTierFromProfile(profile);

    if (!permissionsByTier.has(tier)) {
      permissionsByTier.set(tier, loadProfessionalTierPermissions(
        tier,
        (path) => readRows(req, path, { useServiceRole })
      ));
    }

    return mapTalentProfile(profile, owners.get(profile.user_id), {
      professionalPermissions: await permissionsByTier.get(tier),
      usePending,
      visibility,
    });
  }));
};

const loadTalentProfilesForViewer = async (req, viewer, options = {}) => {
  const visibility = options.visibility || getTalentProfileVisibilityForViewer(
    viewer,
    options.defaultVisibility || 'directory'
  );
  const profiles = await loadTalentProfiles(req, {
    ...options,
    visibility,
  });

  return profiles.map((profile) => scrubTalentProfileForViewer(profile, viewer));
};

const mapAgency = (agency) => ({
  certs: asList(agency.certifications),
  certifications: asList(agency.certifications),
  description: agency.description || '',
  id: agency.id,
  location: agency.location || '',
  monthlyRate: toNumber(agency.monthly_rate),
  name: agency.name || 'Unnamed agency',
  rate: toNumber(agency.monthly_rate),
  rating: toNumber(agency.rating),
  reviewCount: agency.review_count || 0,
  size: agency.team_size || '',
  specialty: agency.specialty || '',
  status: agency.status,
  tools: asList(agency.tools),
});

const tokenize = (value) => String(value || '')
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter((word) => word.length > 2);

const scoreMatch = (messageTokens, record, fields) => {
  const haystack = tokenize(fields.map((field) => {
    const value = record[field];
    return Array.isArray(value) ? value.join(' ') : value;
  }).join(' '));
  const haystackSet = new Set(haystack);

  return messageTokens.reduce((score, token) => score + (haystackSet.has(token) ? 1 : 0), 0);
};

const getProfessionalProfile = async (req, professionalId, {
  includeSensitive = true,
  requireApproved = false,
  useServiceRole = false,
} = {}) => {
  if (!isUuid(professionalId)) {
    return null;
  }

  const filters = [`user_id=eq.${professionalId}`];

  if (requireApproved) {
    filters.push('status=eq.approved');
    filters.push('professional_tier=eq.verified');
    filters.push('identity_verification_status=eq.approved');
    filters.push('profile_visibility=eq.visible');
  }

  const rows = await readRows(
    req,
    `/professional_profiles?${filters.join('&')}&select=${includeSensitive ? PROFESSIONAL_PROFILE_PRIVATE_SELECT : PROFESSIONAL_PROFILE_DIRECTORY_SELECT}&limit=1`,
    { useServiceRole }
  );

  return asList(rows)[0] || null;
};

const requireProfessionalCapability = async (req, res, user, capability, message) => {
  const profile = await getProfessionalProfile(req, user?.id, {
    includeSensitive: true,
    useServiceRole: true,
  });
  const tier = profile
    ? getProfessionalTierFromProfile(profile)
    : normalizeProfessionalTier(user?.professionalTier || user?.professional_tier);
  const permissions = await loadProfessionalTierPermissions(
    tier,
    (path) => readRows(req, path, { useServiceRole: true })
  );

  if (!profile || !permissions[capability]) {
    sendError(res, 403, message || 'Your professional verification status does not include this feature.');
    return null;
  }

  return { permissions, profile };
};

const requireVerifiedProfessional = (req, res, user, message) => requireProfessionalCapability(
  req,
  res,
  user,
  'canAccessDashboard',
  message || 'Only verified professionals can access the professional dashboard.'
);

const getPrimaryClientCompanyName = async (req, clientId, fallback = '') => {
  const rows = await readRows(
    req,
    `/client_companies?owner_id=eq.${clientId}&select=name&order=created_at.asc&limit=1`
  );

  return asList(rows)[0]?.name || fallback || 'Client company';
};

const normalizeAvailability = (value) => {
  return value || 'Immediate Start';
};

const talentStatuses = new Set(['draft', 'pending_review', 'approved', 'hidden', 'rejected']);
const agencyStatuses = new Set(['draft', 'pending_review', 'approved', 'hidden', 'rejected']);
const identityVerificationStatuses = new Set(['pending', 'approved', 'rejected']);

const normalizeStatus = (status, allowedStatuses, fallback = 'pending_review') => {
  const value = cleanString(status, 40);
  return allowedStatuses.has(value) ? value : fallback;
};
const normalizeIdentityVerificationStatus = (status, fallback = '') => {
  const value = cleanString(status, 40);
  return identityVerificationStatuses.has(value) ? value : fallback;
};

const formatStatusLabel = (value) => cleanString(value, 80).replace(/_/g, ' ');

const mapNotification = (notification) => ({
  actionUrl: notification.action_url,
  body: notification.body,
  createdAt: notification.created_at,
  id: notification.id,
  isRead: Boolean(notification.read_at),
  metadata: notification.metadata || {},
  readAt: notification.read_at,
  title: notification.title,
  type: notification.type,
});

const mapClientJob = (job) => ({
  clientId: job.client_id,
  createdAt: job.created_at,
  description: job.description || '',
  employmentType: job.employment_type || '',
  id: job.id,
  location: job.location || '',
  status: job.status,
  title: job.title,
  updatedAt: job.updated_at,
});

const mapJobComment = (comment) => ({
  comment: comment.comment || '',
  createdAt: comment.created_at,
  id: comment.id,
  jobId: comment.job_id,
  professionalId: comment.professional_id,
  status: comment.status,
  updatedAt: comment.updated_at,
});

const mapJobContact = (contact) => ({
  createdAt: contact.created_at,
  id: contact.id,
  jobId: contact.job_id,
  message: contact.message || '',
  professionalId: contact.professional_id,
  status: contact.status,
  updatedAt: contact.updated_at,
});

const mapClientJobForProfessional = (job, client = {}, { comments = [], contact = null } = {}) => ({
  ...mapClientJob(job),
  clientProfile: {
    clientTier: client.client_tier || 'basic',
    company: client.company || '',
    email: client.email || '',
    id: client.id || job.client_id,
    name: client.full_name || client.name || '',
    role: client.role || 'client',
    title: client.title || '',
  },
  comments: comments.map(mapJobComment),
  contact: contact ? mapJobContact(contact) : null,
});

const mapProfessionalReview = (review) => ({
  clientId: review.client_id,
  createdAt: review.created_at,
  id: review.id,
  professionalId: review.professional_id,
  rating: review.rating,
  review: review.review || '',
  status: review.status,
  updatedAt: review.updated_at,
});

const mapBackgroundCheck = (check) => ({
  clientId: check.client_id,
  completedAt: check.completed_at,
  createdAt: check.created_at,
  id: check.id,
  package: check.package,
  professionalId: check.professional_id,
  requestedAt: check.requested_at,
  resultSummary: check.result_summary || '',
  status: check.status,
  updatedAt: check.updated_at,
});

const opportunityStatusPriority = {
  accepted: 5,
  active: 5,
  invited: 4,
  cancelled: 3,
  declined: 2,
  closed: 1,
};

const interviewStatusPriority = {
  scheduled: 5,
  requesting: 4,
  requested: 4,
  completed: 3,
  cancelled: 2,
  no_show: 1,
};

const setPreferredByStatus = (map, row, priorityMap) => {
  const current = map.get(row.professional_id);
  const currentPriority = current ? priorityMap[current.status] || 0 : -1;
  const nextPriority = priorityMap[row.status] || 0;

  if (!current || nextPriority > currentPriority) {
    map.set(row.professional_id, row);
  }
};

const cancelInterview = async (req, {
  actor,
  allowedRole,
  interviewId,
  opportunityId,
  reason,
}) => {
  const actorColumn = allowedRole === 'client' ? 'client_id' : 'professional_id';
  const filters = [`${actorColumn}=eq.${actor.id}`];

  if (interviewId) {
    filters.push(`id=eq.${interviewId}`);
  }

  if (opportunityId) {
    filters.push(`opportunity_id=eq.${opportunityId}`);
  }

  const rows = await readRows(
    req,
    `/interviews?${filters.join('&')}&status=in.(requesting,requested,scheduled)&select=*&limit=1`,
    { useServiceRole: true }
  );
  const interview = asList(rows)[0];

  if (!interview) {
    return null;
  }

  const cancellationReason = cleanString(reason, 1000);
  const cancelledAt = new Date().toISOString();
  const updatedRows = await patchRows(
    req,
    `/interviews?id=eq.${interview.id}&${actorColumn}=eq.${actor.id}`,
    {
      cancellation_reason: cancellationReason,
      cancelled_at: cancelledAt,
      cancelled_by: actor.id,
      status: 'cancelled',
    },
    { useServiceRole: true }
  );
  const updatedInterview = asList(updatedRows)[0] || {
    ...interview,
    cancellation_reason: cancellationReason,
    cancelled_at: cancelledAt,
    cancelled_by: actor.id,
    status: 'cancelled',
  };

  if (interview.opportunity_id) {
    await patchRows(
      req,
      `/opportunities?id=eq.${interview.opportunity_id}`,
      { status: 'cancelled' },
      { prefer: 'return=minimal', useServiceRole: true }
    ).catch(() => {});
  }

  return updatedInterview;
};

const buildAgencyPayload = (body, fallback = {}) => {
  const monthlyRate = toNumber(body.monthlyRate ?? body.monthly_rate ?? fallback.monthly_rate);
  const ownerId = cleanString(body.ownerId || body.owner_id || fallback.owner_id, 80);
  const reviewCount = Number(body.reviewCount ?? body.review_count ?? fallback.review_count ?? 0);

  return {
    certifications: cleanList(body.certifications ?? fallback.certifications),
    description: cleanString(body.description ?? fallback.description, 1600),
    location: cleanString(body.location ?? fallback.location, 180),
    monthly_rate: monthlyRate,
    name: cleanString(body.name ?? fallback.name, 180),
    owner_id: isUuid(ownerId) ? ownerId : null,
    rating: toNumber(body.rating ?? fallback.rating),
    review_count: Number.isFinite(reviewCount) ? reviewCount : 0,
    slug: cleanString(body.slug ?? fallback.slug, 180) || null,
    specialty: cleanString(body.specialty ?? fallback.specialty, 180),
    status: normalizeStatus(body.status ?? fallback.status, agencyStatuses, 'pending_review'),
    team_size: cleanString(body.teamSize ?? body.team_size ?? fallback.team_size, 80),
    tools: cleanList(body.tools ?? fallback.tools),
  };
};

let credentialBucketReady = false;
let clientVerificationBucketReady = false;
let profilePhotoBucketReady = false;

const encodeStoragePath = (path) => path
  .split('/')
  .map((part) => encodeURIComponent(part))
  .join('/');

const safeFileName = (value) => {
  const name = cleanString(value, 220)
    .replace(/[^a-z0-9._ -]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 180);

  return name || 'credential-upload';
};

const getFileExtension = (fileName) => {
  const match = String(fileName || '').toLowerCase().match(/\.[a-z0-9]+$/);

  return match ? match[0] : '';
};

const getCredentialFileRule = (documentType) => (
  DOCUMENT_TYPE_FILE_RULES[documentType] || DOCUMENT_TYPE_FILE_RULES.other_document
);

const parseBase64Upload = (body) => {
  const fileData = String(body.fileData || body.dataUrl || '');
  const dataUrlMatch = fileData.match(/^data:([^;]+);base64,(.+)$/);

  if (!dataUrlMatch) {
    throw new Error('A valid file upload is required.');
  }

  return {
    bytes: Buffer.from(dataUrlMatch[2], 'base64'),
    declaredContentType: cleanString(body.contentType || dataUrlMatch[1], 120),
  };
};

const parseCredentialUpload = (body) => {
  const { bytes, declaredContentType } = parseBase64Upload(body);
  const documentType = cleanString(body.documentType || body.kind || 'credential', 80);
  const rule = getCredentialFileRule(documentType);
  const fileName = safeFileName(body.fileName || body.name);
  const extension = getFileExtension(fileName);
  const contentType = ALLOWED_CREDENTIAL_MIME_TYPES.has(declaredContentType)
    ? declaredContentType
    : '';

  if (!contentType || !rule.mimeTypes.has(contentType) || !rule.extensions.has(extension)) {
    throw new Error(rule.message);
  }

  if (!bytes.length || bytes.length > MAX_CREDENTIAL_UPLOAD_BYTES) {
    throw new Error('Upload must be 3 MB or smaller.');
  }

  return {
    bytes,
    contentType,
    fileSha256: createHash('sha256').update(bytes).digest('hex'),
    fileName,
  };
};

const ensureCredentialBucket = async () => {
  if (credentialBucketReady) return;

  try {
    await supabaseStorageRequest('/bucket', {
      body: {
        allowed_mime_types: [...ALLOWED_CREDENTIAL_MIME_TYPES],
        file_size_limit: MAX_CREDENTIAL_UPLOAD_BYTES,
        id: CREDENTIAL_UPLOAD_BUCKET,
        name: CREDENTIAL_UPLOAD_BUCKET,
        public: false,
      },
      method: 'POST',
    });
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('already exists')) {
      throw error;
    }
  }

  credentialBucketReady = true;
};

const ensureClientVerificationBucket = async () => {
  if (clientVerificationBucketReady) return;

  try {
    await supabaseStorageRequest('/bucket', {
      body: {
        allowed_mime_types: [...ALLOWED_CREDENTIAL_MIME_TYPES],
        file_size_limit: MAX_CREDENTIAL_UPLOAD_BYTES,
        id: CLIENT_VERIFICATION_UPLOAD_BUCKET,
        name: CLIENT_VERIFICATION_UPLOAD_BUCKET,
        public: false,
      },
      method: 'POST',
    });
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('already exists')) {
      throw error;
    }
  }

  clientVerificationBucketReady = true;
};

const ensureProfilePhotoBucket = async () => {
  if (profilePhotoBucketReady) return;

  try {
    await supabaseStorageRequest('/bucket', {
      body: {
        allowed_mime_types: [...ALLOWED_IMAGE_MIME_TYPES],
        file_size_limit: MAX_CREDENTIAL_UPLOAD_BYTES,
        id: PROFILE_PHOTO_BUCKET,
        name: PROFILE_PHOTO_BUCKET,
        public: true,
      },
      method: 'POST',
    });
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('already exists')) {
      throw error;
    }
  }

  profilePhotoBucketReady = true;
};

const uploadCredentialFile = async ({ body, profile, userId }) => {
  const { bytes, contentType, fileName, fileSha256 } = parseCredentialUpload(body);
  const documentType = cleanString(body.documentType || body.kind || 'credential', 80);
  const rawDocumentKey = cleanString(body.documentKey || body.key || documentType, 140);
  const documentKey = rawDocumentKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'credential';
  const label = cleanString(body.documentLabel || body.label || fileName, 180);
  const duplicateBlocker = getDuplicateRequiredCredentialUploadBlocker(profile, {
    documentKey: rawDocumentKey,
    fileSha256,
  });

  if (duplicateBlocker) {
    throw new Error(duplicateBlocker);
  }

  const uploadedAt = new Date().toISOString();
  const path = `${userId}/${documentKey}/${fileSha256}-${randomUUID()}-${fileName}`;

  await ensureCredentialBucket();
  await supabaseStorageRequest(
    `/object/${CREDENTIAL_UPLOAD_BUCKET}/${encodeStoragePath(path)}`,
    {
      body: bytes,
      contentType,
      headers: { 'x-upsert': 'true' },
      method: 'POST',
    }
  );

  return {
    contentType,
    fileName,
    fileSha256,
    fileSize: bytes.length,
    id: `${documentKey}:${uploadedAt}`,
    key: rawDocumentKey || documentKey,
    kind: documentType,
    label,
    path,
    status: 'draft',
    storageKey: documentKey,
    uploadedAt,
  };
};

const uploadIdentityVerificationFile = async ({ body, userId }) => {
  const kind = cleanString(body.kind || body.documentType || body.document_type, 80).toLowerCase();

  if (!IDENTITY_UPLOAD_KINDS.has(kind)) {
    throw new Error('Valid ID front, Valid ID back, or liveness selfie is required.');
  }

  const parsedUpload = kind === 'liveness_selfie'
    ? parseProfileImageUpload(body)
    : parseCredentialUpload({
      ...body,
      documentType: 'other_document',
    });
  const { bytes, contentType, fileName } = parsedUpload;
  const fileSha256 = parsedUpload.fileSha256 || createHash('sha256').update(bytes).digest('hex');
  const expiryDate = kind === 'liveness_selfie'
    ? ''
    : normalizeExpiryDate(body.expiryDate || body.expiry_date);

  if (kind !== 'liveness_selfie' && !expiryDate) {
    throw new Error('A valid ID expiration date is required.');
  }

  const uploadedAt = new Date().toISOString();
  const path = `${userId}/identity/${kind}/${fileSha256}-${randomUUID()}-${fileName}`;

  await ensureCredentialBucket();
  await supabaseStorageRequest(
    `/object/${CREDENTIAL_UPLOAD_BUCKET}/${encodeStoragePath(path)}`,
    {
      body: bytes,
      contentType,
      headers: { 'x-upsert': 'true' },
      method: 'POST',
    }
  );

  return {
    contentType,
    expiryDate,
    fileName,
    fileSha256,
    fileSize: bytes.length,
    id: `${kind}:${uploadedAt}`,
    key: IDENTITY_UPLOAD_KEYS[kind],
    kind,
    label: IDENTITY_UPLOAD_LABELS[kind],
    path,
    status: 'draft',
    storageKey: kind,
    uploadedAt,
  };
};

const getSupabasePublicStorageUrl = (bucket, path) => {
  const baseUrl = cleanString(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, 500).replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('SUPABASE_URL is required for public storage links.');
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`;
};

const uploadProfilePhotoFile = async ({ body, userId }) => {
  const { bytes, contentType, fileName, fileSize } = parseProfileImageUpload(body);
  const path = `${userId}/profile/${randomUUID()}-${fileName}`;

  await ensureProfilePhotoBucket();
  await supabaseStorageRequest(
    `/object/${PROFILE_PHOTO_BUCKET}/${encodeStoragePath(path)}`,
    {
      body: bytes,
      contentType,
      headers: { 'x-upsert': 'false' },
      method: 'POST',
    }
  );

  return {
    avatarUrl: getSupabasePublicStorageUrl(PROFILE_PHOTO_BUCKET, path),
    contentType,
    fileName,
    fileSize,
    path,
  };
};

const deleteProfilePhotoFile = (path) => supabaseStorageRequest(
  `/object/${PROFILE_PHOTO_BUCKET}/${encodeStoragePath(path)}`,
  { method: 'DELETE' }
);

const uploadClientVerificationFile = async ({ body, userId }) => {
  const upload = parseClientVerificationUpload(body);
  const path = `${userId}/${upload.kind}/${randomUUID()}-${upload.fileName}`;

  await ensureClientVerificationBucket();
  await supabaseStorageRequest(
    `/object/${CLIENT_VERIFICATION_UPLOAD_BUCKET}/${encodeStoragePath(path)}`,
    {
      body: upload.bytes,
      contentType: upload.contentType,
      headers: { 'x-upsert': 'false' },
      method: 'POST',
    }
  );

  return {
    ...upload,
    bytes: undefined,
    path,
    storageBucket: CLIENT_VERIFICATION_UPLOAD_BUCKET,
  };
};

const getSupabaseStorageSignedUrl = async (path, bucket = CREDENTIAL_UPLOAD_BUCKET) => {
  const storagePath = cleanString(path, 700);
  const storageBucket = cleanString(bucket, 120);

  if (!storagePath || !storageBucket) {
    throw new Error('A document path is required.');
  }

  const signed = await supabaseStorageRequest(
    `/object/sign/${encodeURIComponent(storageBucket)}/${encodeStoragePath(storagePath)}`,
    {
      body: { expiresIn: 300 },
      method: 'POST',
    }
  );
  const signedUrl = signed?.signedURL || signed?.signedUrl || signed?.url || '';

  if (!signedUrl) {
    throw new Error('Unable to create a document link.');
  }

  if (/^https?:\/\//i.test(signedUrl)) return signedUrl;

  const baseUrl = cleanString(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, 500).replace(/\/+$/, '');
  return `${baseUrl}/storage/v1${signedUrl.startsWith('/') ? signedUrl : `/${signedUrl}`}`;
};

const getSupabaseStorageObject = async (path, bucket = CREDENTIAL_UPLOAD_BUCKET) => {
  const signedUrl = await getSupabaseStorageSignedUrl(path, bucket);
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error('Unable to load this document.');
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
};

const findCredentialRecord = (profile, { documentKey, documentType, path }) => {
  const { workPreferences } = getReviewableWorkPreferences(profile);
  const identityDocuments = cleanIdentityVerificationDocuments(profile?.identity_verification_documents);
  const targetKey = cleanString(documentKey, 180);
  const targetPath = cleanString(path, 700);
  const targetType = cleanString(documentType, 80);
  const documents = [
    ...(workPreferences.resume ? [{ ...workPreferences.resume, documentType: 'resume' }] : []),
    ...asList(workPreferences.supportingDocuments).map((document) => ({
      ...document,
      documentType: document.kind || 'supporting_document',
    })),
    ...Object.entries(identityDocuments)
      .filter(([, document]) => document?.path)
      .map(([key, document]) => ({
        ...document,
        documentType: document.kind || key,
        identityDocument: true,
      })),
  ];

  return documents.find((document) => (
    (targetPath && document.path === targetPath)
    || (targetKey && (
      document.key === targetKey
      || document.id === targetKey
      || document.label === targetKey
    ))
    || (targetType === 'resume' && document.documentType === 'resume')
    || (targetType && targetType === document.documentType)
  ));
};

const getAccessibleCredentialDocument = async (req, user, body) => {
  const professionalId = cleanString(body.professionalId || body.professional_id || user.id, 80);

  if (!isUuid(professionalId)) {
    const error = new Error('A valid professional id is required.');
    error.status = 400;
    throw error;
  }

  const isAdmin = user.role === 'admin';
  const isProfessionalOwner = user.role === 'professional' && professionalId === user.id;
  const isClientViewer = user.role === 'client';
  const requestedPreviewTier = cleanString(body.previewTier || body.viewerTier || body.viewAs, 40);
  const professionalPreviewTier = isProfessionalOwner && requestedPreviewTier
    ? normalizeClientTier(requestedPreviewTier)
    : '';
  const isProfessionalPreview = Boolean(professionalPreviewTier);
  const clientPermissions = getClientPermissions(user);

  if (
    (isClientViewer && !clientPermissions.canViewFullDocuments)
    || (isProfessionalPreview && !CLIENT_TIER_PERMISSIONS[professionalPreviewTier].canViewFullDocuments)
  ) {
    const error = new Error('Basic clients cannot view resumes or required documents.');
    error.status = 403;
    throw error;
  }

  if (!isAdmin && !isProfessionalOwner && !isClientViewer) {
    const error = new Error('You do not have access to this document.');
    error.status = 403;
    throw error;
  }

  if (isAdmin || isClientViewer || isProfessionalPreview) {
    req.useServiceRole = true;
  }

  const profile = await getProfessionalProfile(req, professionalId, {
    requireApproved: isClientViewer,
    useServiceRole: isAdmin || isClientViewer || isProfessionalPreview,
  });
  if (profile && isProfessionalOwner) {
    profile.__includePendingProfile = true;
  }
  const document = profile ? findCredentialRecord(profile, {
    documentKey: body.documentKey || body.key || body.id,
    documentType: body.documentType || body.kind,
    path: body.path,
  }) : null;

  if (!document?.path) {
    const error = new Error('Document not found.');
    error.status = 404;
    throw error;
  }

  if ((isClientViewer || isProfessionalPreview) && (document.identityDocument || document.status !== 'approved')) {
    const error = new Error('Document not found.');
    error.status = 404;
    throw error;
  }

  return { document, professionalId };
};

const buildCredentialReviewRecord = (credential, { adminId, message, status }) => {
  const reviewedAt = new Date().toISOString();
  const reviewMessage = cleanString(message, 1000);

  return {
    ...credential,
    changeRequest: {},
    changeRequestStatus: '',
    rejectedAt: status === 'rejected' ? reviewedAt : '',
    rejectionReason: status === 'rejected' ? reviewMessage : '',
    reviewMessage,
    reviewedAt,
    reviewedBy: adminId,
    status,
  };
};

const buildDocumentChangeRequestRecord = (credential, { reason, userId }) => ({
  ...credential,
  changeRequest: {
    requestedAt: new Date().toISOString(),
    requestedBy: userId,
    reason: cleanString(reason, 1000),
    status: 'pending',
  },
  changeRequestStatus: 'pending',
});

const buildDocumentChangeRequestReviewRecord = (credential, { adminId, message, status }) => {
  const reviewedAt = new Date().toISOString();
  const currentRequest = cleanRecord(credential.changeRequest);
  const reviewMessage = cleanString(message, 1000);

  if (status === 'approved') {
    return buildCredentialReviewRecord(credential, {
      adminId,
      message: reviewMessage || 'Change request approved. Document reopened for review.',
      status: 'pending_review',
    });
  }

  return {
    ...credential,
    changeRequest: {
      ...currentRequest,
      reviewedAt,
      reviewedBy: adminId,
      reviewMessage,
      status,
    },
    changeRequestStatus: '',
    reviewMessage,
    reviewedAt,
    reviewedBy: adminId,
  };
};

const reopenApprovedCredential = (credential, { adminId, message }) => {
  const record = cleanCredentialFileRecord(credential);

  if (!record || record.status !== 'approved') return record;

  return buildCredentialReviewRecord(record, {
    adminId,
    message: message || 'Professional verification was reopened by admin.',
    status: 'pending_review',
  });
};

const reopenApprovedWorkPreferences = (workPreferences, options) => {
  const preferences = cleanWorkPreferences(workPreferences);

  return {
    ...preferences,
    resume: preferences.resume ? reopenApprovedCredential(preferences.resume, options) : null,
    supportingDocuments: asList(preferences.supportingDocuments)
      .map((document) => reopenApprovedCredential(document, options))
      .filter(Boolean),
  };
};

const credentialNotificationKey = (document, fallbackKey) => (
  document?.documentType === 'resume' || document?.kind === 'resume' || fallbackKey === 'resume'
    ? 'resume'
    : document?.key || document?.label || document?.id || fallbackKey
);

const listCredentialDocuments = (workPreferences) => {
  const preferences = cleanWorkPreferences(workPreferences);

  return [
    ...(preferences.resume ? [{ ...preferences.resume, documentType: 'resume' }] : []),
    ...asList(preferences.supportingDocuments).map((document, index) => ({
      ...document,
      documentType: document.kind || 'supporting_document',
      fallbackKey: `supporting:${index}`,
    })),
  ];
};

const normalizeExpiryDate = (value) => {
  const text = cleanString(value, 80);
  if (!text) return '';

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';

  return text.slice(0, 10);
};

const getDaysUntilDate = (dateText, now = new Date()) => {
  const expiryDate = new Date(`${normalizeExpiryDate(dateText)}T00:00:00.000Z`);
  const currentDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (Number.isNaN(expiryDate.getTime())) return null;

  return Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
};

const getDocumentExpirationEventKey = ({
  documentKey,
  eventType,
  expiryDate,
  professionalId,
}) => [
  cleanString(professionalId, 80),
  cleanString(documentKey, 180),
  cleanString(eventType, 80),
  normalizeExpiryDate(expiryDate),
].join('|');

const getProfessionalDowngradePayload = () => ({
  professional_tier: 'unverified',
  profile_visibility: 'hidden',
  review_status: 'pending_review',
  status: 'pending_review',
  verified_at: null,
});

const getDocumentExpirationActions = (profile, {
  now = new Date(),
  sentKeys = new Set(),
} = {}) => {
  const professionalId = profile?.id || profile?.user_id;
  const approvedCredentialDocuments = listCredentialDocuments(profile?.work_preferences || profile?.workPreferences)
    .map((document) => cleanCredentialFileRecord(document))
    .filter((document) => document?.status === 'approved' && !document.noExpiryRequired && normalizeExpiryDate(document.expiryDate));
  const identityDocuments = cleanIdentityVerificationDocuments(
    profile?.identity_verification_documents || profile?.identityVerificationDocuments
  );
  const approvedIdentityDocuments = profile?.identity_verification_status === 'approved'
    ? Object.entries(identityDocuments)
      .filter(([key, document]) => key !== 'livenessSelfie' && document && normalizeExpiryDate(document.expiryDate))
      .map(([key, document]) => ({
        ...document,
        documentType: 'identity',
        key: `identity:${key}`,
        status: 'approved',
      }))
    : [];
  const approvedDocuments = [...approvedCredentialDocuments, ...approvedIdentityDocuments];
  const actions = [];

  approvedDocuments.forEach((document) => {
    const expiryDate = normalizeExpiryDate(document.expiryDate);
    const daysToExpiry = getDaysUntilDate(expiryDate, now);
    const documentKey = credentialNotificationKey(document, document.fallbackKey);
    let eventType = '';

    if (daysToExpiry === null) return;
    if (daysToExpiry <= 0) {
      eventType = 'expired';
    } else if (daysToExpiry <= 7) {
      eventType = 'reminder_7';
    } else if (daysToExpiry <= 30) {
      eventType = 'reminder_30';
    } else if (daysToExpiry <= 60) {
      eventType = 'reminder_60';
    }

    if (!eventType) return;

    const eventKey = getDocumentExpirationEventKey({
      documentKey,
      eventType,
      expiryDate,
      professionalId,
    });

    if (sentKeys.has(eventKey)) return;

    actions.push({
      daysToExpiry,
      document,
      documentKey,
      eventKey,
      eventType,
      expiryDate,
      professionalId,
    });
  });

  return actions;
};

const getCredentialDocumentChanges = (beforeWorkPreferences, afterWorkPreferences) => {
  const beforeDocuments = listCredentialDocuments(beforeWorkPreferences);
  const afterDocuments = listCredentialDocuments(afterWorkPreferences);
  const beforeByKey = new Map(beforeDocuments.map((document) => [
    credentialNotificationKey(document, document.fallbackKey),
    document,
  ]));
  const afterKeys = new Set();
  const changes = [];

  afterDocuments.forEach((document) => {
    const key = credentialNotificationKey(document, document.fallbackKey);
    const previous = beforeByKey.get(key);
    afterKeys.add(key);

    if (document.path && previous?.path && document.path !== previous.path) {
      changes.push({
        action: 'replaced',
        document,
        previous,
      });
    } else if (document.path && document.replacedDocumentPath && document.replacedDocumentPath !== document.path) {
      changes.push({
        action: 'replaced',
        document,
        previous,
      });
    }
  });

  beforeDocuments.forEach((document) => {
    const key = credentialNotificationKey(document, document.fallbackKey);
    if (document.path && !afterKeys.has(key)) {
      changes.push({
        action: 'removed',
        document,
        previous: document,
      });
    }
  });

  return changes;
};

const preserveLockedApprovedCredentialExpiry = (beforeWorkPreferences, afterWorkPreferences) => {
  const preferences = cleanWorkPreferences(afterWorkPreferences);
  const beforeByKey = new Map(listCredentialDocuments(beforeWorkPreferences).map((document) => [
    credentialNotificationKey(document, document.fallbackKey),
    document,
  ]));
  const preserveDocument = (document, fallbackKey) => {
    const record = cleanCredentialFileRecord(document);
    const previous = beforeByKey.get(credentialNotificationKey(record, fallbackKey));

    if (!record || !previous || previous.status !== 'approved' || previous.changeRequestStatus === 'approved') {
      return record;
    }

    if (record.path && previous.path && record.path !== previous.path) {
      return record;
    }

    return {
      ...record,
      expiryDate: cleanString(previous.expiryDate, 80),
      noExpiryRequired: cleanBoolean(previous.noExpiryRequired),
    };
  };

  return {
    ...preferences,
    resume: preferences.resume ? preserveDocument(preferences.resume, 'resume') : null,
    supportingDocuments: asList(preferences.supportingDocuments)
      .map((document, index) => preserveDocument(document, `supporting:${index}`))
      .filter(Boolean),
  };
};

const getApprovedCredentialExpiryChangeBlocker = (beforeWorkPreferences, afterWorkPreferences) => {
  const beforeDocuments = listCredentialDocuments(beforeWorkPreferences);
  const beforeByKey = new Map(beforeDocuments.map((document) => [
    credentialNotificationKey(document, document.fallbackKey),
    document,
  ]));

  for (const document of listCredentialDocuments(afterWorkPreferences)) {
    const key = credentialNotificationKey(document, document.fallbackKey);
    const previous = beforeByKey.get(key);

    if (!previous || previous.status !== 'approved' || previous.changeRequestStatus === 'approved') {
      continue;
    }

    const expiryChanged = cleanString(document.expiryDate, 80) !== cleanString(previous.expiryDate, 80);
    const noExpiryChanged = cleanBoolean(document.noExpiryRequired) !== cleanBoolean(previous.noExpiryRequired);

    if (expiryChanged || noExpiryChanged) {
      return `Request change before updating expiration details for ${getCredentialDisplayLabel(previous)}.`;
    }
  }

  return '';
};

const getReviewableWorkPreferences = (profile) => {
  const pendingProfile = cleanRecord(profile.pending_profile);
  const hasDraftPending = isDraftPendingProfile(profile);
  const pendingSubmitted = Boolean(
    profile.__includePendingProfile
    || (!hasDraftPending && (
      profile.status === 'pending_review'
      || profile.review_status === 'pending_review'
    ))
  );
  const usePendingProfile = pendingSubmitted
    && Object.keys(pendingProfile).length > 0
    && hasOwn(pendingProfile, 'work_preferences');

  return {
    pendingProfile,
    usePendingProfile,
    workPreferences: cleanWorkPreferences(
      usePendingProfile ? pendingProfile.work_preferences : profile.work_preferences,
      profile.work_preferences
    ),
  };
};

const documentMatchesCredentialLabel = (document, label) => (
  document?.label === label
  || document?.key === label
  || String(document?.key || '').endsWith(`:${label}`)
);

const getReviewableProfessionalTitles = (profile) => {
  const pendingProfile = cleanRecord(profile.pending_profile);
  const hasDraftPending = isDraftPendingProfile(profile);
  const pendingSubmitted = Boolean(
    profile.__includePendingProfile
    || (!hasDraftPending && (
      profile.status === 'pending_review'
      || profile.review_status === 'pending_review'
    ))
  );
  const hasPendingTitles = pendingSubmitted && (hasOwn(pendingProfile, 'titles') || hasOwn(pendingProfile, 'title'));

  return cleanProfessionalTitles(
    hasPendingTitles ? (pendingProfile.titles ?? pendingProfile.title) : profile.titles,
    cleanProfessionalTitles(profile.title)
  );
};

const getRequiredCredentialLabels = (profile) => [
  ...new Set(getReviewableProfessionalTitles(profile)
    .flatMap((title) => asList(PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS[title]))),
];

const getRequiredCredentialDocuments = (profile) => {
  const { workPreferences } = getReviewableWorkPreferences(profile);
  const requiredLabels = getRequiredCredentialLabels(profile);

  return asList(workPreferences.supportingDocuments).filter((document) => (
    requiredLabels.some((label) => documentMatchesCredentialLabel(document, label))
  ));
};

const getDuplicateRequiredCredentialBlocker = (profile) => {
  const digestLabels = new Map();

  for (const document of getRequiredCredentialDocuments(profile)) {
    const record = cleanCredentialFileRecord(document);

    if (!record?.fileSha256) continue;

    const previousLabel = digestLabels.get(record.fileSha256);

    if (previousLabel) {
      return `${previousLabel} and ${getCredentialDisplayLabel(record)} must use a distinct file for each required certification.`;
    }

    digestLabels.set(record.fileSha256, getCredentialDisplayLabel(record));
  }

  return '';
};

const getDuplicateRequiredCredentialUploadBlocker = (profile, { documentKey, fileSha256 }) => {
  if (!profile || !fileSha256) return '';

  const requiredLabels = getRequiredCredentialLabels(profile);
  const targetLabel = requiredLabels.find((label) => (
    documentKey === label || documentKey === `certification:${label}` || String(documentKey || '').endsWith(`:${label}`)
  ));

  if (!targetLabel) return '';

  const duplicate = getRequiredCredentialDocuments(profile).find((document) => {
    const record = cleanCredentialFileRecord(document);

    return record?.fileSha256 === fileSha256 && !documentMatchesCredentialLabel(record, targetLabel);
  });

  return duplicate
    ? `${getCredentialDisplayLabel(duplicate)} already uses this upload. Choose a distinct file for ${targetLabel}.`
    : '';
};

const verifyRequiredCredentialDigests = async (profile, {
  loadDocument = getSupabaseStorageObject,
  userId,
} = {}) => {
  const workPreferences = cleanWorkPreferences(profile?.work_preferences || profile?.workPreferences);
  const requiredLabels = getRequiredCredentialLabels(profile);
  const ownerId = cleanString(userId, 80);
  const ownerPrefix = `${ownerId}/`;
  const supportingDocuments = await Promise.all(
    asList(workPreferences.supportingDocuments).map(async (document) => {
      const isRequired = requiredLabels.some((label) => documentMatchesCredentialLabel(document, label));

      if (!isRequired) return document;

      if (!ownerId || !document.path?.startsWith(ownerPrefix)) {
        throw new Error(`Upload ${getCredentialDisplayLabel(document)} again before verification.`);
      }

      const stored = await loadDocument(document.path, CREDENTIAL_UPLOAD_BUCKET);
      const bytes = Buffer.isBuffer(stored?.bytes) ? stored.bytes : Buffer.from(stored?.bytes || []);

      if (!bytes.length) {
        throw new Error(`Unable to verify the stored file for ${getCredentialDisplayLabel(document)}.`);
      }

      return {
        ...document,
        fileSha256: createHash('sha256').update(bytes).digest('hex'),
      };
    })
  );
  const verifiedWorkPreferences = {
    ...workPreferences,
    supportingDocuments,
  };
  const duplicateBlocker = getDuplicateRequiredCredentialBlocker({
    ...profile,
    pending_profile: {},
    review_status: null,
    status: 'draft',
    work_preferences: verifiedWorkPreferences,
  });

  if (duplicateBlocker) {
    throw new Error(duplicateBlocker);
  }

  return verifiedWorkPreferences;
};

const validateRegulatedInputValue = (field, value) => {
  const text = cleanString(value, 200);

  if (!field.required && !text) return true;
  if (field.id === 'prcLicenseNumber') return /^[0-9]{6,8}$/.test(text);
  if (field.id === 'irsPtin') return /^P[0-9]{8}$/i.test(text);
  if (field.id === 'hmrcAgentCode') return /^[A-Z0-9]{4,12}$/i.test(text);

  return Boolean(text);
};

const getRegulatedInputBlocker = (titles, regulatedInputs = {}) => {
  for (const title of titles) {
    const requirements = REGULATED_TITLE_REQUIREMENTS[title];
    if (requirements?.inputFields) {
      for (const field of requirements.inputFields) {
        const value = regulatedInputs?.[field.id];
        if (field.required && !cleanString(value, 200)) {
          return `Missing required regulatory input: ${field.label} for ${title}.`;
        }
        if (cleanString(value, 200) && !validateRegulatedInputValue(field, value)) {
          return `Invalid regulatory input: ${field.label} for ${title}.`;
        }
      }
    }
  }

  return '';
};

const requiredCredentialMissingExpiry = (document) => (
  Boolean(document)
  && !document.noExpiryRequired
  && !cleanString(document.expiryDate, 80)
);

const getCredentialDisplayLabel = (document, fallback = 'document') => (
  cleanString(document?.reviewLabel || document?.label || document?.fileName, 180) || fallback
);

const getRequiredExpiryBlocker = (documents) => {
  const missingExpiryDocuments = asList(documents).filter(requiredCredentialMissingExpiry);

  if (!missingExpiryDocuments.length) return '';

  if (missingExpiryDocuments.length === 1) {
    return `Add an expiry date for ${getCredentialDisplayLabel(missingExpiryDocuments[0])} or mark it no expiration date.`;
  }

  return `${missingExpiryDocuments.length} required documents need an expiry date or no-expiration confirmation.`;
};

const getCredentialApprovalBlocker = (profile) => {
  const { workPreferences } = getReviewableWorkPreferences(profile);
  const resume = workPreferences.resume;
  const supportingDocuments = asList(workPreferences.supportingDocuments);
  const requiredLabels = getRequiredCredentialLabels(profile);
  const missingDocuments = requiredLabels.filter((label) => (
    !supportingDocuments.some((document) => documentMatchesCredentialLabel(document, label))
  ));
  const requiredDocuments = [
    ...(resume ? [resume] : []),
    ...supportingDocuments.filter((document) => (
      requiredLabels.some((label) => documentMatchesCredentialLabel(document, label))
    )),
  ];
  const rejectedDocuments = requiredDocuments.filter((document) => document.status === 'rejected');
  const pendingDocuments = requiredDocuments.filter((document) => (document.status || 'pending_review') === 'pending_review');
  const expiryBlocker = getRequiredExpiryBlocker(requiredDocuments);
  const duplicateBlocker = getDuplicateRequiredCredentialBlocker(profile);

  if (profile?.identity_verification_status !== 'approved') {
    return 'Identity verification must be approved before this professional can be verified.';
  }

  if (!resume) {
    return 'Resume approval is required before this profile can be approved.';
  }

  if (missingDocuments.length) {
    return `${missingDocuments.length} required certification document${missingDocuments.length === 1 ? '' : 's'} still need to be uploaded.`;
  }

  if (rejectedDocuments.length) {
    return `${rejectedDocuments.length} required document${rejectedDocuments.length === 1 ? '' : 's'} need a replacement upload.`;
  }

  if (pendingDocuments.length) {
    return `${pendingDocuments.length} required document${pendingDocuments.length === 1 ? '' : 's'} still need admin review.`;
  }

  if (expiryBlocker) {
    return expiryBlocker;
  }

  if (duplicateBlocker) {
    return duplicateBlocker;
  }

  return getRegulatedInputBlocker(getReviewableProfessionalTitles(profile), workPreferences.regulatedInputs || {});
};

const getCredentialSubmissionBlocker = (profile) => {
  const { workPreferences } = getReviewableWorkPreferences(profile);
  const resume = workPreferences.resume;
  const supportingDocuments = asList(workPreferences.supportingDocuments);
  const requiredLabels = getRequiredCredentialLabels(profile);
  const missingDocuments = requiredLabels.filter((label) => (
    !supportingDocuments.some((document) => documentMatchesCredentialLabel(document, label))
  ));
  const rejectedDocuments = [
    ...(resume ? [resume] : []),
    ...supportingDocuments.filter((document) => (
      requiredLabels.some((label) => documentMatchesCredentialLabel(document, label))
    )),
  ].filter((document) => document.status === 'rejected');
  const requiredDocuments = [
    ...(resume ? [resume] : []),
    ...supportingDocuments.filter((document) => (
      requiredLabels.some((label) => documentMatchesCredentialLabel(document, label))
    )),
  ];
  const expiryBlocker = getRequiredExpiryBlocker(requiredDocuments);
  const duplicateBlocker = getDuplicateRequiredCredentialBlocker(profile);

  if (!resume) {
    return 'Upload your resume before requesting verification.';
  }

  if (missingDocuments.length) {
    return `${missingDocuments.length} required certification document${missingDocuments.length === 1 ? '' : 's'} still need to be uploaded.`;
  }

  if (rejectedDocuments.length) {
    return `${rejectedDocuments.length} required document${rejectedDocuments.length === 1 ? '' : 's'} need a replacement upload.`;
  }

  if (expiryBlocker) {
    return expiryBlocker;
  }

  if (duplicateBlocker) {
    return duplicateBlocker;
  }

  return getRegulatedInputBlocker(getReviewableProfessionalTitles(profile), workPreferences.regulatedInputs || {});
};

const applyCredentialReview = (profile, review, adminId) => {
  const targetType = cleanString(review.targetType || review.type || review.documentType || review.kind, 80);
  const targetKey = cleanString(review.documentKey || review.key || review.id, 180);
  const status = normalizeCredentialReviewStatus(review.status);
  const message = cleanString(review.message || review.rejectionMessage || review.reason || review.customMessage, 1000);
  const reviewKind = cleanString(review.reviewKind || review.action || review.requestType, 80);

  if (!status) {
    throw new Error('A valid document review status is required.');
  }

  if (status === 'rejected' && !message) {
    throw new Error('A rejection message is required.');
  }

  const {
    pendingProfile,
    usePendingProfile,
    workPreferences,
  } = getReviewableWorkPreferences(profile);
  let reviewedCredential = null;
  let nextWorkPreferences = workPreferences;

  if (targetType === 'resume') {
    if (!workPreferences.resume) {
      throw new Error('Resume upload not found.');
    }

    if (reviewKind === 'change_request') {
      if (workPreferences.resume.changeRequestStatus !== 'pending') {
        throw new Error('No pending change request was found for this document.');
      }
      reviewedCredential = buildDocumentChangeRequestReviewRecord(workPreferences.resume, { adminId, message, status });
    } else {
      if (!canReviewCredentialStatus(workPreferences.resume, status)) {
        throw new Error(status === 'pending_review'
          ? 'Only approved documents can be reopened.'
          : 'Only pending documents can be reviewed.');
      }
      reviewedCredential = buildCredentialReviewRecord(workPreferences.resume, { adminId, message, status });
    }
    nextWorkPreferences = {
      ...workPreferences,
      resume: reviewedCredential,
    };
  } else {
    const documents = asList(workPreferences.supportingDocuments);
    const documentIndex = documents.findIndex((document) => (
      document.key === targetKey
      || document.id === targetKey
      || document.label === targetKey
    ));

    if (documentIndex < 0) {
      throw new Error('Supporting document not found.');
    }

    if (reviewKind === 'change_request') {
      if (documents[documentIndex].changeRequestStatus !== 'pending') {
        throw new Error('No pending change request was found for this document.');
      }
      reviewedCredential = buildDocumentChangeRequestReviewRecord(documents[documentIndex], { adminId, message, status });
    } else {
      if (!canReviewCredentialStatus(documents[documentIndex], status)) {
        throw new Error(status === 'pending_review'
          ? 'Only approved documents can be reopened.'
          : 'Only pending documents can be reviewed.');
      }
      reviewedCredential = buildCredentialReviewRecord(documents[documentIndex], { adminId, message, status });
    }
    nextWorkPreferences = {
      ...workPreferences,
      supportingDocuments: documents.map((document, index) => (
        index === documentIndex ? reviewedCredential : document
      )),
    };
  }

  const requiredLabels = getRequiredCredentialLabels(profile);
  const isRequiredCredential = targetType === 'resume'
    || requiredLabels.some((label) => documentMatchesCredentialLabel(reviewedCredential, label));

  if (
    status === 'approved'
    && reviewKind !== 'change_request'
    && isRequiredCredential
    && requiredCredentialMissingExpiry(reviewedCredential)
  ) {
    throw new Error(`Add an expiry date for ${getCredentialDisplayLabel(reviewedCredential)} or mark it no expiration date before approval.`);
  }

  const payload = usePendingProfile
    ? {
      pending_profile: {
        ...pendingProfile,
        work_preferences: nextWorkPreferences,
      },
      ...(reviewedCredential?.status === 'pending_review' && profile.status === 'approved'
        ? {
          review_status: 'pending_review',
          review_submitted_at: profile.review_submitted_at || new Date().toISOString(),
        }
        : {}),
    }
    : {
      work_preferences: nextWorkPreferences,
      ...(reviewedCredential?.status === 'pending_review' && profile.status === 'approved'
        ? {
          review_status: 'pending_review',
          review_submitted_at: profile.review_submitted_at || new Date().toISOString(),
        }
        : {}),
    };

  return {
    credential: reviewedCredential,
    payload,
    reviewKind,
    targetType,
  };
};

const requireClientServiceSession = async (req, res, roles = ['client']) => {
  const user = await requireSession(req, res, roles);

  if (!user) return null;

  if (!hasServiceRoleKey()) {
    sendError(res, 500, 'Client services require SUPABASE_SERVICE_ROLE_KEY on the server.');
    return null;
  }

  req.useServiceRole = true;
  return user;
};

const loadClientVerification = async (req, clientId) => {
  const [caseRows, documentRows] = await Promise.all([
    readRows(
      req,
      `/client_verifications?client_id=eq.${clientId}&select=*&limit=1`,
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/client_verification_documents?client_id=eq.${clientId}&is_current=eq.true&select=*&order=uploaded_at.desc`,
      { useServiceRole: true }
    ),
  ]);

  return {
    caseRow: asList(caseRows)[0] || { client_id: clientId, status: 'draft' },
    documentRows: asList(documentRows),
  };
};

const toClientAccountProfileResponse = ({
  latestNameRequest,
  pendingNameRequest,
  profile,
  verification,
}) => ({
  ...mapClientAccount({ profile, verification }),
  pendingNameRequest: mapClientNameRequest(pendingNameRequest),
  latestNameRequest: mapClientNameRequest(latestNameRequest),
});

const toClientAccountSessionSummary = (account) => mapClientSessionSummary(withClientPermissions({
  avatarUrl: account.avatarUrl,
  clientTier: account.clientTier,
  company: account.company,
  id: account.id,
  name: account.fullName,
  role: account.role,
}));
const pickSessionSummaryFields = (summary, fields) => fields.reduce((picked, field) => {
  if (Object.hasOwn(summary, field)) picked[field] = summary[field];
  return picked;
}, {});

const loadClientAccountProfile = async (req, clientId) => {
  const [profileRows, verificationRows, pendingRequestRows, latestRequestRows] = await Promise.all([
    readRows(
      req,
      `/profiles?id=eq.${clientId}&select=${CLIENT_ACCOUNT_PROFILE_SELECT}&limit=1`,
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/client_verifications?client_id=eq.${clientId}&select=${CLIENT_VERIFICATION_SUMMARY_SELECT}&limit=1`,
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/client_name_change_requests?client_id=eq.${clientId}&status=eq.pending&select=${CLIENT_NAME_REQUEST_SELECT}&order=created_at.desc&limit=1`,
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/client_name_change_requests?client_id=eq.${clientId}&status=not.eq.pending&select=${CLIENT_NAME_REQUEST_SELECT}&order=created_at.desc&limit=1`,
      { useServiceRole: true }
    ),
  ]);
  const profile = asList(profileRows)[0];

  if (!profile || profile.id !== clientId || profile.role !== 'client') {
    const error = new Error('Client profile not found.');
    error.status = 404;
    throw error;
  }

  return toClientAccountProfileResponse({
    latestNameRequest: asList(latestRequestRows)[0],
    pendingNameRequest: asList(pendingRequestRows)[0],
    profile,
    verification: asList(verificationRows)[0] || { client_id: clientId, status: 'draft' },
  });
};

const compareClientNameRequests = (left, right) => {
  const pendingOrder = Number(right.status === 'pending') - Number(left.status === 'pending');
  if (pendingOrder) return pendingOrder;

  const leftTime = Date.parse(left.createdAt || '') || 0;
  const rightTime = Date.parse(right.createdAt || '') || 0;
  return rightTime - leftTime;
};

const loadAdminClientNameChangeContext = async (req, requestRows) => {
  const clientIds = [...new Set(asList(requestRows).map((row) => row.client_id).filter(isUuid))];

  if (!clientIds.length) {
    return { profilesById: new Map(), verificationsById: new Map() };
  }

  const idFilter = clientIds.join(',');
  const [profileRows, verificationRows] = await Promise.all([
    readRows(
      req,
      `/profiles?id=in.(${idFilter})&select=id,email,company`,
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/client_verifications?client_id=in.(${idFilter})&select=client_id,status`,
      { useServiceRole: true }
    ),
  ]);

  return {
    profilesById: new Map(asList(profileRows).map((profile) => [profile.id, profile])),
    verificationsById: new Map(asList(verificationRows).map((verification) => [
      verification.client_id,
      verification,
    ])),
  };
};

const mapAdminClientNameChangeRows = async (req, requestRows) => {
  const { profilesById, verificationsById } = await loadAdminClientNameChangeContext(req, requestRows);

  return asList(requestRows).map((row) => mapAdminClientNameRequest(row, {
    profile: profilesById.get(row.client_id),
    verification: verificationsById.get(row.client_id),
  })).filter(Boolean);
};

const loadAdminClientNameChangeQueue = async (req) => {
  const [pendingRows, decidedRows] = await Promise.all([
    readRows(
      req,
      `/client_name_change_requests?status=eq.pending&select=${CLIENT_NAME_REQUEST_SELECT}&order=created_at.desc`,
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/client_name_change_requests?status=neq.pending&select=${CLIENT_NAME_REQUEST_SELECT}&order=created_at.desc&limit=250`,
      { useServiceRole: true }
    ),
  ]);
  const requestRows = [...asList(pendingRows), ...asList(decidedRows)];
  const requests = await mapAdminClientNameChangeRows(req, requestRows);
  requests.sort(compareClientNameRequests);

  return {
    pendingCount: requests.filter((request) => request.status === 'pending').length,
    requests,
  };
};

const loadAdminClientNameChange = async (req, requestId) => {
  const requestRows = asList(await readRows(
    req,
    `/client_name_change_requests?id=eq.${requestId}&select=${CLIENT_NAME_REQUEST_SELECT}&limit=1`,
    { useServiceRole: true }
  ));
  const [request] = await mapAdminClientNameChangeRows(req, requestRows);

  if (!request) {
    const error = new Error('Client name-change request not found.');
    error.status = 404;
    throw error;
  }

  return request;
};

const mapAdminClientVerification = (caseRow, documentRows, profile = {}) => ({
  ...mapClientVerification(caseRow, documentRows),
  client: {
    avatarUrl: cleanString(profile.avatar_url, 700),
    company: cleanString(profile.company, 240),
    email: cleanString(profile.email, 320),
    id: caseRow.client_id,
    name: cleanString(profile.full_name, 240) || cleanString(profile.email, 320) || 'Client',
  },
  internalReviewNotes: cleanString(caseRow.internal_review_notes, 2000),
  reviewedBy: cleanString(caseRow.reviewed_by, 80) || null,
});

const loadAdminClientVerificationQueue = async (req) => {
  const caseRows = asList(await readRows(
    req,
    '/client_verifications?select=*&order=submitted_at.desc.nullslast,updated_at.desc&limit=250',
    { useServiceRole: true }
  ));

  if (!caseRows.length) return [];

  const clientIds = [...new Set(caseRows.map((row) => row.client_id).filter(isUuid))];
  const idFilter = clientIds.join(',');
  const [documentRows, profiles] = await Promise.all([
    readRows(
      req,
      `/client_verification_documents?client_id=in.(${idFilter})&is_current=eq.true&select=*&order=uploaded_at.desc`,
      { useServiceRole: true }
    ),
    readRows(
      req,
      `/profiles?id=in.(${idFilter})&select=id,email,full_name,company,avatar_url`,
      { useServiceRole: true }
    ),
  ]);
  const documentsByClient = asList(documentRows).reduce((grouped, row) => {
    const documents = grouped.get(row.client_id) || [];
    documents.push(row);
    grouped.set(row.client_id, documents);
    return grouped;
  }, new Map());
  const profilesById = new Map(asList(profiles).map((profile) => [profile.id, profile]));

  return caseRows.map((caseRow) => mapAdminClientVerification(
    caseRow,
    documentsByClient.get(caseRow.client_id) || [],
    profilesById.get(caseRow.client_id) || {}
  ));
};

const getAccessibleClientVerificationDocument = async (req, user, input) => {
  const documentId = cleanString(input.documentId || input.document_id || input.id, 80);

  if (!isUuid(documentId)) {
    const error = new Error('A valid verification document id is required.');
    error.status = 400;
    throw error;
  }

  const rows = await readRows(
    req,
    `/client_verification_documents?id=eq.${documentId}&select=*&limit=1`,
    { useServiceRole: true }
  );
  const document = asList(rows)[0];

  if (!document) {
    const error = new Error('Verification document not found.');
    error.status = 404;
    throw error;
  }

  if (user.role !== 'admin' && document.client_id !== user.id) {
    const error = new Error('You do not have access to this verification document.');
    error.status = 403;
    throw error;
  }

  if (document.storage_bucket !== CLIENT_VERIFICATION_UPLOAD_BUCKET) {
    const error = new Error('Verification document storage is invalid.');
    error.status = 409;
    throw error;
  }

  return document;
};

const handlers = {
  'GET /health': async (req, res) => {
    const checks = {
      anonKeyConfigured: Boolean(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY),
      serviceRoleConfigured: hasServiceRoleKey(),
      supabaseConnected: false,
      supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    };

    try {
      await supabaseRestRequest('/profiles?select=id&limit=1', {
        token: getBearerToken(req),
        useServiceRole: hasServiceRoleKey(),
      });

      sendJson(res, 200, {
        ok: checks.anonKeyConfigured && checks.supabaseUrlConfigured,
        checks: {
          ...checks,
          supabaseConnected: true,
        },
      });
    } catch (error) {
      sendJson(res, 503, {
        ok: false,
        checks,
        error: error.message || 'Supabase connectivity check failed.',
      });
    }
  },

  'GET /notifications': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const rows = await readRows(
      req,
      `/notifications?recipient_id=eq.${user.id}&select=*&order=created_at.desc&limit=50`
    );

    sendJson(res, 200, asList(rows).map(mapNotification));
  },

  'PATCH /notifications': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const body = await readJson(req);
    const notificationId = cleanString(body.id || body.notificationId || body.notification_id, 80);
    const readAt = body.isRead === false || body.read === false ? null : new Date().toISOString();
    const path = notificationId
      ? `/notifications?id=eq.${notificationId}&recipient_id=eq.${user.id}`
      : `/notifications?recipient_id=eq.${user.id}&read_at=is.null`;

    if (notificationId && !isUuid(notificationId)) {
      sendError(res, 400, 'A valid notification id is required.');
      return;
    }

    const rows = await patchRows(req, path, { read_at: readAt });
    sendJson(res, 200, asList(rows).map(mapNotification));
  },

  'GET /notifications/push-config': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    sendJson(res, 200, getWebPushConfig());
  },

  'POST /notifications/push-subscription': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    if (!hasServiceRoleKey()) {
      sendError(res, 500, 'Push notifications require SUPABASE_SERVICE_ROLE_KEY on the server.');
      return;
    }

    try {
      const body = await readJson(req);
      const subscription = normalizePushSubscription(body.subscription || body);
      const rows = await writeRows(
        req,
        '/push_subscriptions?on_conflict=endpoint',
        {
          auth: subscription.auth,
          endpoint: subscription.endpoint,
          expiration_time: subscription.expirationTime,
          p256dh: subscription.p256dh,
          user_agent: cleanString(req.headers['user-agent'], 500),
          user_id: user.id,
        },
        { prefer: 'resolution=merge-duplicates,return=representation', useServiceRole: true }
      );

      sendJson(res, 200, {
        enabled: Boolean(asList(rows)[0]),
      });
    } catch (error) {
      sendError(res, 400, error.message || 'Unable to enable push notifications.');
    }
  },

  'DELETE /notifications/push-subscription': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    if (!hasServiceRoleKey()) {
      sendError(res, 500, 'Push notifications require SUPABASE_SERVICE_ROLE_KEY on the server.');
      return;
    }

    try {
      const body = await readJson(req);
      const endpoint = cleanString(body.endpoint || body.subscription?.endpoint, 2000);
      const parsedEndpoint = new URL(endpoint);

      if (parsedEndpoint.protocol !== 'https:') {
        throw new Error('A valid push subscription endpoint is required.');
      }

      await supabaseRestRequest(
        `/push_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&endpoint=eq.${encodeURIComponent(parsedEndpoint.href)}`,
        {
          method: 'DELETE',
          prefer: 'return=minimal',
          useServiceRole: true,
        }
      );
      sendJson(res, 200, { enabled: false });
    } catch (error) {
      sendError(res, 400, error.message || 'Unable to disable push notifications.');
    }
  },

  'POST /auth/login': async (req, res) => {
    let email = '';

    try {
      const body = await readJson(req);
      email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const session = await signInWithPassword({ email, password });
      const providers = getAuthProviders(session.user);

      if (session.access_token && providers.includes('google') && !providers.includes('email')) {
        await updateCurrentSupabaseUser(session.access_token, { password }).catch(() => undefined);
      }

      sendJson(res, 200, await sessionPayload(session));
    } catch (error) {
      try {
        const setupRequirement = await getPasswordSetupRequirement(email);

        if (setupRequirement.requiresPasswordSetup) {
          sendJson(res, 409, {
            ...setupRequirement,
            code: 'password_setup_required',
          });
          return;
        }
      } catch {
        // Keep the normal invalid-login response if the account lookup is unavailable.
      }

      sendError(res, error.status || 401, error.message || 'Unable to sign in.');
    }
  },

  'POST /auth/logout': async (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    try {
      await signOut(token);
      sendJson(res, 200, { ok: true, provider: 'supabase' });
    } catch (error) {
      sendError(res, 500, error.message || 'Unable to sign out.');
    }
  },

  'GET /auth/me': async (req, res) => {
    const user = await getSessionUser(req);

    if (!user) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    const token = getBearerToken(req);

    try {
      const authUser = await getSupabaseUser(token);
      await flagGoogleProfessionalAccount({ authUser, sessionUser: user, token });
    } catch {
      // Account triage should never block an otherwise valid session.
    }

    sendJson(res, 200, { provider: 'supabase', user: withClientPermissions(user) });
  },

  'POST /auth/google': async (req, res) => {
    try {
      const body = await readJson(req);
      const redirectTo = cleanUrl(body.redirectTo) || cleanUrl(process.env.PUBLIC_APP_URL) || '';
      const requestedRole = body.role === 'professional' || body.role === 'client' ? body.role : '';
      const company = cleanString(body.company, 180);

      if (requestedRole === 'client' && !company) {
        sendError(res, 400, 'Company is required for Google client sign-up.');
        return;
      }

      sendJson(res, 200, {
        provider: 'google',
        requestedRole,
        url: getOAuthSignInUrl({
          provider: 'google',
          redirectTo,
        }),
      });
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to start Google Sign-In.');
    }
  },

  'POST /auth/oauth/finalize': async (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    try {
      const body = await readJson(req);
      const requestedRole = body.role === 'professional' || body.role === 'client' ? body.role : '';
      const company = cleanString(body.company, 180);
      const authUser = await getSupabaseUser(token);
      const oauthResult = await finalizeOAuthAccount({
        authUser,
        company,
        requestedRole,
        token,
      });

      if (oauthResult.linkRequirement?.requiresAccountLink) {
        sendJson(res, 200, {
          ...oauthResult.linkRequirement,
          provider: 'supabase',
        });
        return;
      }

      if (oauthResult.companyRequirement?.requiresCompany) {
        sendJson(res, 200, {
          ...oauthResult.companyRequirement,
          provider: 'supabase',
        });
        return;
      }

      const user = await getSessionUser(req);

      sendJson(res, 200, {
        provider: 'supabase',
        triage: oauthResult.triage,
        user,
      });
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to finalize Google Sign-In.');
    }
  },

  'POST /auth/refresh': async (req, res) => {
    try {
      const body = await readJson(req);
      const refreshToken = String(body.refreshToken || body.refresh_token || '');

      if (!refreshToken) {
        sendError(res, 400, 'Refresh token is required.');
        return;
      }

      const session = await refreshSession(refreshToken);
      sendJson(res, 200, await sessionPayload(session));
    } catch (error) {
      sendError(res, 401, error.message || 'Unable to refresh session.');
    }
  },

  'POST /auth/link/google/request': async (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      sendError(res, 401, 'Google session is required before linking.');
      return;
    }

    try {
      const body = await readJson(req);
      const requestedRole = body.role === 'professional' || body.role === 'client' ? body.role : '';
      const authUser = await getSupabaseUser(token);
      const verification = await requestGooglePasswordLinkVerification({
        authUser,
        company: cleanString(body.company, 180),
        password: String(body.password || ''),
        requestedRole,
        token,
      });

      sendJson(res, 202, {
        ...verification,
        message: 'Password accepted. Verification code sent. Enter it to link Google Sign-In.',
        provider: 'redis',
      });
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to start Google account linking.');
    }
  },

  'POST /auth/link/google/verify': async (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      sendError(res, 401, 'Google session is required before linking.');
      return;
    }

    try {
      const body = await readJson(req);
      const authUser = await getSupabaseUser(token);
      const result = await verifyGooglePasswordLinkOtp({
        authUser,
        otp: body.otp,
        token,
        verificationToken: body.verificationToken || body.token,
      });

      sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to verify Google account linking.');
    }
  },

  'POST /auth/password/setup/request': async (req, res) => {
    try {
      const body = await readJson(req);
      const verification = await requestPasswordSetupVerification({
        email: body.email,
        password: String(body.password || ''),
      });

      sendJson(res, 202, {
        ...verification,
        message: 'Verification code sent. Enter it to add email/password login.',
        provider: 'redis',
      });
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to start password setup.');
    }
  },

  'POST /auth/password/setup/verify': async (req, res) => {
    try {
      const body = await readJson(req);
      const result = await verifyPasswordSetupOtp({
        otp: body.otp,
        verificationToken: body.verificationToken || body.token,
      });

      sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to verify password setup.');
    }
  },

  'POST /auth/password/setup/complete': async (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      sendError(res, 401, 'Google session is required to finish password setup.');
      return;
    }

    try {
      const body = await readJson(req);
      const session = await completePasswordSetupWithGoogle({
        passwordSetupToken: body.passwordSetupToken,
        token,
      });

      sendJson(res, 200, await sessionPayload(session));
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to finish password setup.');
    }
  },

  'POST /auth/register': async (req, res) => {
    try {
      const body = await readJson(req);
      const verification = await requestRegistrationVerification(body);

      sendJson(res, 202, {
        ...verification,
        message: 'Verification code sent. Enter the 6-digit code to finish creating your account.',
        provider: 'redis',
      });
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to send verification code.');
    }
  },

  'POST /auth/register/verify': async (req, res) => {
    try {
      const body = await readJson(req);
      const registration = await verifyRegistrationOtp({
        otp: body.otp,
        verificationToken: body.verificationToken || body.token,
      });
      const session = await signUpWithPassword(registration);
      const user = session.user || session;

      if (!session.access_token) {
        sendJson(res, 202, {
          message: 'Email verified. Check your inbox to confirm your account before signing in.',
          provider: 'supabase',
          requiresEmailConfirmation: true,
          user: publicUser(user),
        });
        return;
      }

      sendJson(res, 201, await sessionPayload(session));
    } catch (error) {
      sendError(res, error.status || 500, error.message || 'Unable to verify registration.');
    }
  },

  'GET /admin/client-name-changes': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    sendJson(res, 200, await loadAdminClientNameChangeQueue(req));
  },

  'POST /admin/client-name-changes/decision': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const requestId = cleanString(body.requestId || body.request_id, 80);
    const validation = validateClientNameDecision(body);

    if (!isUuid(requestId)) {
      sendError(res, 400, 'A valid requestId is required.');
      return;
    }

    if (!validation.valid) {
      sendError(res, 400, validation.errors.join(' '));
      return;
    }

    const decisionValue = validation.value.decision;
    let decisionContext;

    try {
      decisionContext = await loadAdminClientNameChange(req, requestId);
    } catch (error) {
      const classified = classifyClientProfileDatabaseError(error);
      sendError(res, classified.status, classified.message);
      return;
    }

    let decidedRows;

    try {
      decidedRows = asList(await writeRows(
        req,
        '/rpc/decide_client_name_change',
        {
          p_decision: decisionValue,
          p_decision_reason: validation.value.decisionReason,
          p_request_id: requestId,
          p_reviewer_id: user.id,
        },
        { useServiceRole: true }
      ));
    } catch (error) {
      const classified = classifyClientProfileDatabaseError(error);
      sendError(res, classified.status, classified.message);
      return;
    }

    const fallbackDecisionRow = {
      client_id: decisionContext.clientId,
      created_at: decisionContext.createdAt,
      current_full_name: decisionContext.currentFullName,
      decision_reason: validation.value.decisionReason,
      id: decisionContext.id,
      request_reason: decisionContext.requestReason,
      requested_full_name: decisionContext.requestedFullName,
      reviewed_at: new Date().toISOString(),
      status: decisionValue,
    };
    const decidedRequest = mapAdminClientNameRequest(
      decidedRows[0] || fallbackDecisionRow,
      {
        client: decisionContext.client,
        verificationStatus: decisionContext.verificationStatus,
      }
    ) || {
      ...decisionContext,
      decisionReason: validation.value.decisionReason,
      reviewedAt: fallbackDecisionRow.reviewed_at,
      status: decisionValue,
    };

    notifyUser({
      actionUrl: '/?tab=profile&section=account',
      body: decisionValue === 'approved'
        ? `PB Finance approved your requested account name: ${decidedRequest.requestedFullName}.`
        : `PB Finance did not approve your requested account name. ${decidedRequest.decisionReason || ''}`.trim(),
      emailSubject: decisionValue === 'approved'
        ? 'Client account name approved'
        : 'Client account name request declined',
      metadata: { requestId: decidedRequest.id },
      recipientEmail: decidedRequest.client.email,
      recipientId: decidedRequest.clientId,
      recipientName: decidedRequest.requestedFullName,
      title: decisionValue === 'approved' ? 'Account name approved' : 'Account name not approved',
      type: decisionValue === 'approved'
        ? 'client_name_change_approved'
        : 'client_name_change_rejected',
    }).catch(() => {});

    sendJson(res, 200, decidedRequest);
  },

  'GET /admin/client-verifications': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    sendJson(res, 200, await loadAdminClientVerificationQueue(req));
  },

  'POST /admin/client-verifications/decision': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const clientId = cleanString(body.clientId || body.client_id, 80);
    const decision = cleanString(body.decision || body.status, 40).toLowerCase();

    if (!isUuid(clientId)) {
      sendError(res, 400, 'A valid clientId is required.');
      return;
    }

    const current = await loadClientVerification(req, clientId);

    if (current.caseRow.status !== 'pending_review') {
      sendError(res, 409, 'Only pending client verification cases can be reviewed.');
      return;
    }

    if (decision === 'approve') {
      const validation = validateClientVerificationDecision(body);

      if (!validation.valid) {
        sendError(res, 400, validation.errors.join(' '));
        return;
      }

      await writeRows(
        req,
        '/rpc/approve_client_verification',
        {
          p_client_id: clientId,
          p_internal_review_notes: cleanString(body.internalReviewNotes, 2000) || null,
          p_reviewer_id: user.id,
          p_verified_business_name: validation.verifiedBusinessName,
        },
        { useServiceRole: true }
      );
    } else if (decision === 'reject') {
      const validation = validateClientVerificationRejection(body);

      if (!validation.valid) {
        sendError(res, 400, validation.errors.join(' '));
        return;
      }

      await writeRows(
        req,
        '/rpc/reject_client_verification',
        {
          p_client_id: clientId,
          p_decision_reason: validation.decisionReason,
          p_internal_review_notes: cleanString(body.internalReviewNotes, 2000) || null,
          p_rejected_kinds: validation.rejectedKinds,
          p_reviewer_id: user.id,
        },
        { useServiceRole: true }
      );
    } else {
      sendError(res, 400, 'Decision must be approve or reject.');
      return;
    }

    const [updated, profileRows] = await Promise.all([
      loadClientVerification(req, clientId),
      readRows(
        req,
        `/profiles?id=eq.${clientId}&select=id,email,full_name,company,avatar_url&limit=1`,
        { useServiceRole: true }
      ),
    ]);
    const profile = asList(profileRows)[0] || {};
    const approved = decision === 'approve';

    notifyUser({
      actionUrl: '/?tab=profile&section=verification',
      body: approved
        ? 'PB Finance approved your client verification. Verified client features are now available.'
        : `PB Finance needs updated verification evidence. ${updated.caseRow.decision_reason || ''}`.trim(),
      emailSubject: approved ? 'Client verification approved' : 'Client verification needs updates',
      metadata: { clientId, decision },
      recipientEmail: profile.email,
      recipientId: clientId,
      recipientName: profile.full_name,
      title: approved ? 'Verification approved' : 'Verification needs updates',
      type: approved ? 'client_verification_approved' : 'client_verification_rejected',
    }).catch(() => {});

    sendJson(res, 200, mapAdminClientVerification(
      updated.caseRow,
      updated.documentRows,
      profile
    ));
  },

  'POST /admin/client-verifications/reset': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const clientId = cleanString(body.clientId || body.client_id, 80);
    const reason = cleanString(body.reason, 1000);

    if (!isUuid(clientId) || !reason) {
      sendError(res, 400, 'A valid clientId and reset reason are required.');
      return;
    }

    await writeRows(
      req,
      '/rpc/reset_client_verification',
      {
        p_client_id: clientId,
        p_reason: reason,
        p_reviewer_id: user.id,
      },
      { useServiceRole: true }
    );

    const [updated, profileRows] = await Promise.all([
      loadClientVerification(req, clientId),
      readRows(
        req,
        `/profiles?id=eq.${clientId}&select=id,email,full_name,company,avatar_url&limit=1`,
        { useServiceRole: true }
      ),
    ]);
    const profile = asList(profileRows)[0] || {};

    notifyUser({
      actionUrl: '/?tab=profile&section=verification',
      body: `PB Finance reset your client verification. Upload new evidence to continue. Reason: ${reason}`,
      emailSubject: 'Client verification reset',
      metadata: { clientId },
      recipientEmail: profile.email,
      recipientId: clientId,
      recipientName: profile.full_name,
      title: 'Verification reset',
      type: 'client_verification_reset',
    }).catch(() => {});

    sendJson(res, 200, mapAdminClientVerification(
      updated.caseRow,
      updated.documentRows,
      profile
    ));
  },

  'GET /admin/talent': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const profiles = await loadTalentProfiles(req, { usePending: true, visibility: 'admin' });
    sendJson(res, 200, profiles);
  },

  'PATCH /admin/talent': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id || body.id, 80);
    const status = normalizeStatus(body.status, talentStatuses, '');
    const credentialReview = cleanRecord(body.credentialReview || body.documentReview);
    const hasCredentialReview = Object.keys(credentialReview).length > 0;
    const identityVerification = cleanRecord(body.identityVerification || body.identity_verification);
    const hasIdentityVerification = Object.keys(identityVerification).length > 0;
    const titlesUpdate = body.titles; // Optional array of titles
    const clearTriage = body.clearTriage; // Optional boolean to clear manual triage

    if (!isUuid(professionalId)) {
      sendError(res, 400, 'A valid professionalId is required.');
      return;
    }

    if (!status && !hasCredentialReview && !hasIdentityVerification && !titlesUpdate && clearTriage === undefined) {
      sendError(res, 400, 'A valid talent status, review, or profile update is required.');
      return;
    }

    const existingRows = await readRows(
      req,
      `/professional_profiles?user_id=eq.${professionalId}&select=*&limit=1`
    );
    const existingProfile = asList(existingRows)[0];

    if (!existingProfile) {
      sendError(res, 404, 'Talent profile not found.');
      return;
    }

    const pendingProfile = existingProfile.pending_profile || {};
    const hasPendingChanges = hasPendingProfile(existingProfile);

    if (hasIdentityVerification && !status && !hasCredentialReview && !titlesUpdate && clearTriage === undefined) {
      const identityStatus = normalizeIdentityVerificationStatus(identityVerification.status);
      const now = new Date().toISOString();

      if (!identityStatus) {
        sendError(res, 400, 'Identity verification status must be pending, approved, or rejected.');
        return;
      }

      let identityPayload = {
        identity_verification_notes: cleanString(
          identityVerification.notes
            || identityVerification.note
            || identityVerification.reason
            || identityVerification.message,
          1000
        ),
        identity_verification_status: identityStatus,
      };

      if (identityStatus === 'approved') {
        const identityBlocker = getIdentitySubmissionBlocker(existingProfile);

        if (identityBlocker) {
          sendError(res, 400, identityBlocker);
          return;
        }

        identityPayload = {
          ...identityPayload,
          identity_verified_at: now,
          identity_verified_by: user.id,
        };

        const candidateProfile = {
          ...existingProfile,
          ...identityPayload,
        };

        if (existingProfile.status === 'approved' && !getCredentialApprovalBlocker(candidateProfile)) {
          identityPayload = {
            ...identityPayload,
            professional_tier: 'verified',
            profile_visibility: existingProfile.professional_tier === 'verified'
              && existingProfile.profile_visibility === 'hidden'
              ? 'hidden'
              : 'visible',
            verified_at: existingProfile.verified_at || now,
          };
        }
      } else {
        identityPayload = {
          ...identityPayload,
          identity_verified_at: null,
          identity_verified_by: null,
          professional_tier: 'unverified',
          profile_visibility: 'hidden',
          verified_at: null,
          ...(existingProfile.status === 'approved'
            ? {
              review_status: 'pending_review',
              review_submitted_at: now,
              status: 'pending_review',
            }
            : {}),
        };
      }

      const rows = await patchRows(
        req,
        `/professional_profiles?user_id=eq.${professionalId}`,
        identityPayload
      );
      const saved = asList(rows)[0];

      if (!saved) {
        sendError(res, 404, 'Talent profile not found.');
        return;
      }

      const owners = await loadProfilesById(req, [professionalId], {
        includeContact: true,
        includeManualTriage: true,
        useServiceRole: true,
      });
      const owner = owners.get(professionalId) || {};
      const mappedProfile = await mapTalentProfileWithConfiguredPermissions(
        req,
        saved,
        owner,
        { usePending: true, visibility: 'admin' }
      );

      notifyUser({
        actionUrl: '/?tab=profile',
        body: identityStatus === 'approved'
          ? 'Your identity verification was approved.'
          : identityStatus === 'rejected'
            ? 'Your identity verification was rejected. Update your documents and submit again when ready.'
            : 'Your identity verification was moved back to pending review.',
        emailSubject: `PB Finance identity verification ${formatStatusLabel(identityStatus)}`,
        metadata: {
          identityVerificationStatus: identityStatus,
          professionalId,
        },
        recipientEmail: owner.email,
        recipientId: professionalId,
        recipientName: owner.full_name,
        title: `Identity ${formatStatusLabel(identityStatus)}`,
        type: 'identity_verification_updated',
      }).catch(() => {});

      sendJson(res, 200, mappedProfile);
      return;
    }

    if (hasIdentityVerification) {
      sendError(res, 400, 'Update identity verification separately from profile status or document review actions.');
      return;
    }

    if (hasCredentialReview) {
      let reviewResult;

      try {
        reviewResult = applyCredentialReview(existingProfile, credentialReview, user.id);
      } catch (error) {
        sendError(res, 400, error.message || 'Unable to review this document.');
        return;
      }

      let reviewPayload = reviewResult.payload;
      const candidateProfile = {
        ...existingProfile,
        ...reviewPayload,
      };
      const shouldDowngradeVerification = existingProfile.professional_tier === 'verified'
        && Boolean(getCredentialApprovalBlocker(candidateProfile));

      if (shouldDowngradeVerification) {
        reviewPayload = {
          ...reviewPayload,
          professional_tier: 'unverified',
          profile_visibility: 'hidden',
          review_status: 'pending_review',
          review_submitted_at: existingProfile.review_submitted_at || new Date().toISOString(),
          status: 'pending_review',
          verified_at: null,
        };
      }

      const rows = await patchRows(
        req,
        `/professional_profiles?user_id=eq.${professionalId}`,
        reviewPayload
      );
      const saved = asList(rows)[0];

      if (!saved) {
        sendError(res, 404, 'Talent profile not found.');
        return;
      }

      const owners = await loadProfilesById(req, [professionalId], {
        includeContact: true,
        includeManualTriage: true,
        useServiceRole: true,
      });
      const owner = owners.get(professionalId) || {};
      const mappedProfile = await mapTalentProfileWithConfiguredPermissions(
        req,
        saved,
        owner,
        { usePending: true, visibility: 'admin' }
      );

      const reviewedDocumentLabel = reviewResult.credential.label || reviewResult.credential.fileName || 'Your document';

      if (reviewResult.credential.status === 'rejected') {
        notifyUser({
          actionUrl: '/?tab=profile',
          body: `${reviewedDocumentLabel} was rejected. ${reviewResult.credential.rejectionReason}`,
          emailSubject: 'PB Finance document needs attention',
          metadata: {
            credentialId: reviewResult.credential.id,
            documentKey: reviewResult.credential.key,
            professionalId,
            status: reviewResult.credential.status,
          },
          recipientEmail: owner.email,
          recipientId: professionalId,
          recipientName: owner.full_name,
          title: `${reviewResult.targetType === 'resume' ? 'Resume' : 'Document'} rejected`,
          type: reviewResult.targetType === 'resume' ? 'resume_status_updated' : 'document_status_updated',
        }).catch(() => {});
      } else if (reviewResult.reviewKind !== 'change_request' && reviewResult.credential.status === 'approved') {
        notifyUser({
          actionUrl: '/?tab=profile',
          body: `${reviewedDocumentLabel} was approved.`,
          emailSubject: 'PB Finance document approved',
          metadata: {
            credentialId: reviewResult.credential.id,
            documentKey: reviewResult.credential.key,
            professionalId,
            status: reviewResult.credential.status,
          },
          recipientEmail: owner.email,
          recipientId: professionalId,
          recipientName: owner.full_name,
          title: `${reviewResult.targetType === 'resume' ? 'Resume' : 'Document'} approved`,
          type: reviewResult.targetType === 'resume' ? 'resume_status_updated' : 'document_status_updated',
        }).catch(() => {});
      } else if (reviewResult.reviewKind === 'change_request') {
        const changeAllowed = reviewResult.credential.status === 'pending_review';
        notifyUser({
          actionUrl: '/?tab=profile',
          body: changeAllowed
            ? `${reviewedDocumentLabel} change request was approved. You can now remove or upload a replacement.`
            : `${reviewedDocumentLabel} change request was rejected.`,
          emailSubject: 'PB Finance document change request reviewed',
          metadata: {
            credentialId: reviewResult.credential.id,
            documentKey: reviewResult.credential.key,
            professionalId,
            status: changeAllowed ? reviewResult.credential.status : 'change_rejected',
          },
          recipientEmail: owner.email,
          recipientId: professionalId,
          recipientName: owner.full_name,
          title: changeAllowed ? 'Document change approved' : 'Document change rejected',
          type: 'document_status_updated',
        }).catch(() => {});
      } else if (reviewResult.credential.status === 'pending_review') {
        notifyUser({
          actionUrl: '/?tab=profile',
          body: `${reviewedDocumentLabel} approval was undone. You can remove or upload a replacement.`,
          emailSubject: 'PB Finance document reopened for review',
          metadata: {
            credentialId: reviewResult.credential.id,
            documentKey: reviewResult.credential.key,
            professionalId,
            status: reviewResult.credential.status,
          },
          recipientEmail: owner.email,
          recipientId: professionalId,
          recipientName: owner.full_name,
          title: 'Document reopened',
          type: 'document_status_updated',
        }).catch(() => {});
      }

      sendJson(res, 200, mappedProfile);
      return;
    }

    if (status === 'approved') {
      const submittedForReview = !isDraftPendingProfile(existingProfile)
        && (existingProfile.status === 'pending_review' || existingProfile.review_status === 'pending_review');

      if (!submittedForReview) {
        sendError(res, 400, 'The professional must click Verify before admin approval.');
        return;
      }

      const approvalBlocker = getCredentialApprovalBlocker(existingProfile);
      const identityApprovalBlocker = existingProfile.identity_verification_status === 'approved'
        ? getIdentitySubmissionBlocker(existingProfile)
        : 'Identity verification must be approved before approving this professional.';

      if (identityApprovalBlocker || approvalBlocker) {
        sendError(res, 400, identityApprovalBlocker || approvalBlocker);
        return;
      }
    }

    if (status === 'pending_review' && isDraftPendingProfile(existingProfile)) {
      sendError(res, 400, 'The professional must click Verify before admin review.');
      return;
    }

    if (clearTriage) {
      await patchRows(req, `/profiles?id=eq.${professionalId}`, {
        manual_triage_domain: null,
        manual_triage_reason: null,
        manual_triage_required: false,
        manual_triage_status: 'clear',
      }, { prefer: 'return=minimal' });
    }

    const now = new Date().toISOString();
    const {
      fullName: approvedFullName,
      titles: approvedTitles,
    } = getApprovedProfessionalIdentity(existingProfile);

    if (status === 'approved') {
      await patchRows(req, `/profiles?id=eq.${professionalId}`, {
        ...(approvedFullName ? { full_name: approvedFullName } : {}),
        title: approvedTitles[0] || null,
      }, { prefer: 'return=minimal' });
    }

    let payload = {
      ...(status ? { status } : {}),
      ...(status === 'approved'
        ? {
          professional_tier: 'verified',
          profile_visibility: 'visible',
          published_at: now,
          verified_at: existingProfile.verified_at || now,
        }
        : {}),
      ...(titlesUpdate ? { titles: titlesUpdate } : {}),
    };

    if (status === 'approved' && hasPendingChanges) {
      payload = {
        ...toProfilePatch(pendingProfile, existingProfile),
        pending_profile: {},
        professional_tier: 'verified',
        profile_visibility: 'visible',
        published_at: now,
        review_status: null,
        review_submitted_at: null,
        status: 'approved',
        verified_at: existingProfile.verified_at || now,
      };
    } else if (status === 'approved' && existingProfile.review_status === 'pending_review') {
      payload = {
        pending_profile: {},
        professional_tier: 'verified',
        profile_visibility: 'visible',
        published_at: now,
        review_status: null,
        review_submitted_at: null,
        status: 'approved',
        verified_at: existingProfile.verified_at || now,
      };
    } else if (status === 'rejected' && existingProfile.status === 'approved') {
      const { workPreferences } = getReviewableWorkPreferences(existingProfile);

      payload = {
        pending_profile: {},
        professional_tier: 'unverified',
        profile_visibility: 'hidden',
        review_status: null,
        review_submitted_at: now,
        status: 'pending_review',
        verified_at: null,
        work_preferences: reopenApprovedWorkPreferences(workPreferences, {
          adminId: user.id,
          message: 'Professional verification was rejected. Approved documents were reopened for review.',
        }),
      };
    } else if (status === 'pending_review' && existingProfile.status === 'approved' && hasPendingChanges) {
      payload = {
        review_status: 'pending_review',
      };
    } else if (['hidden', 'rejected'].includes(status)) {
      payload = {
        pending_profile: {},
        professional_tier: 'unverified',
        profile_visibility: 'hidden',
        review_status: null,
        review_submitted_at: null,
        status,
        verified_at: null,
      };
    }

    const rows = await patchRows(
      req,
      `/professional_profiles?user_id=eq.${professionalId}`,
      payload
    );
    const saved = asList(rows)[0];

    if (!saved) {
      sendError(res, 404, 'Talent profile not found.');
      return;
    }

    const owners = await loadProfilesById(req, [professionalId], {
      includeContact: true,
      includeManualTriage: true,
      useServiceRole: true,
    });
    const owner = owners.get(professionalId) || {};
    const mappedProfile = await mapTalentProfileWithConfiguredPermissions(
      req,
      saved,
      owner,
      { usePending: true, visibility: 'admin' }
    );

    if (['approved', 'rejected'].includes(status)) {
      const verificationReopened = status === 'rejected' && existingProfile.status === 'approved';
      notifyUser({
        actionUrl: '/?tab=profile',
        body: status === 'approved'
          ? 'Your professional profile has been verified.'
          : verificationReopened
            ? 'Your professional verification was reopened. Previously approved documents were moved back under review.'
            : 'Your professional profile was not approved yet. Update your profile and submit it again when ready.',
        emailSubject: verificationReopened
          ? 'PB Finance professional verification reopened'
          : `PB Finance profile ${formatStatusLabel(status)}`,
        metadata: {
          professionalId,
          status: verificationReopened ? 'pending_review' : status,
        },
        recipientEmail: owner.email,
        recipientId: professionalId,
        recipientName: owner.full_name,
        title: verificationReopened ? 'Verification reopened' : `Profile ${formatStatusLabel(status)}`,
        type: 'profile_status_updated',
      }).catch(() => {});
    }

    sendJson(res, 200, mappedProfile);
  },

  'GET /admin/agencies': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const agencies = await readRows(
      req,
      '/agencies?select=*&order=updated_at.desc&limit=200'
    );

    sendJson(res, 200, asList(agencies).map(mapAgency));
  },

  'POST /admin/agencies': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const payload = buildAgencyPayload(body);

    if (!payload.name) {
      sendError(res, 400, 'Agency name is required.');
      return;
    }

    const rows = await writeRows(req, '/agencies', payload);
    sendJson(res, 201, mapAgency(asList(rows)[0] || payload));
  },

  'PATCH /admin/agencies': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const agencyId = cleanString(body.id || body.agencyId || body.agency_id, 80);

    if (!isUuid(agencyId)) {
      sendError(res, 400, 'A valid agency id is required.');
      return;
    }

    const existingRows = await readRows(req, `/agencies?id=eq.${agencyId}&select=*&limit=1`);
    const existing = asList(existingRows)[0];

    if (!existing) {
      sendError(res, 404, 'Agency not found.');
      return;
    }

    const rows = await patchRows(
      req,
      `/agencies?id=eq.${agencyId}`,
      buildAgencyPayload(body, existing)
    );

    sendJson(res, 200, mapAgency(asList(rows)[0] || existing));
  },

  'GET /agencies': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const permissions = requireClientCapability(
      res,
      user,
      'canDiscoverAgencies',
      'Basic clients cannot access or view the discover agencies feature.'
    );
    if (!permissions) return;

    const agencies = await readRows(
      req,
      '/agencies?status=eq.approved&select=*&order=updated_at.desc&limit=100'
    );

    sendJson(res, 200, asList(agencies).map(mapAgency));
  },

  'GET /client/permissions': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const permissions = getClientPermissions(user);
    const [monthlyJobUsage, monthlyBackgroundCheckUsage, shortlistRows] = await Promise.all([
      getClientMonthlyJobUsage(req, user),
      getClientMonthlyBackgroundCheckUsage(req, user),
      getClientShortlistUsage(req, user),
    ]);

    sendJson(res, 200, {
      permissions,
      usage: {
        monthlyBackgroundChecks: monthlyBackgroundCheckUsage,
        monthlyJobs: monthlyJobUsage,
        shortlist: shortlistRows.length,
      },
    });
  },

  'GET /client/me': async (req, res) => {
    const user = await requireClientServiceSession(req, res);
    if (!user) return;

    try {
      sendJson(res, 200, await loadClientAccountProfile(req, user.id));
    } catch (error) {
      const classified = classifyClientProfileDatabaseError(error);
      sendError(res, classified.status, classified.message);
    }
  },

  'PATCH /client/me': async (req, res) => {
    const user = await requireClientServiceSession(req, res);
    if (!user) return;

    try {
      const body = await readJson(req);
      const current = await loadClientAccountProfile(req, user.id);
      const validation = validateClientProfilePatch(body, {
        currentName: current.account.fullName,
        pendingNameRequest: current.pendingNameRequest,
        verificationStatus: current.verification.status,
      });

      if (!validation.valid) {
        sendError(res, 400, validation.errors.join(' '));
        return;
      }

      const rpcRows = await writeRows(
        req,
        '/rpc/save_client_account_profile',
        {
          p_client_id: user.id,
          p_company: validation.value.company,
          p_full_name: validation.value.fullName,
          p_request_reason: validation.value.requestReason,
        },
        { useServiceRole: true }
      );
      const rpcResult = asList(rpcRows)[0] || {};
      const requestCreated = rpcResult.request_created === true;
      const nameOutcome = ['unchanged', 'updated', 'pending_approval'].includes(rpcResult.name_outcome)
        ? rpcResult.name_outcome
        : validation.nameOutcome;

      if (requestCreated) {
        notifyAdmins({
          actionUrl: '/?tab=client-verifications&section=name-changes',
          body: `${current.account.fullName || current.account.email || 'A client'} requested approval for a protected account-name change.`,
          emailSubject: 'Client account-name change requested',
          metadata: { clientId: user.id, requestId: rpcResult.request_id },
          title: 'Client account-name change requested',
          type: 'client_name_change_requested',
        }).catch(() => {});
      }

      const updated = await loadClientAccountProfile(req, user.id);
      sendJson(res, 200, {
        ...updated,
        nameOutcome,
        sessionSummary: pickSessionSummaryFields(
          toClientAccountSessionSummary(updated.account),
          ['id', 'name', 'company']
        ),
      });
    } catch (error) {
      const classified = classifyClientProfileDatabaseError(error);
      sendError(res, classified.status, classified.message);
    }
  },

  'POST /client/profile-photo': async (req, res) => {
    const user = await requireClientServiceSession(req, res);
    if (!user) return;

    const previousPhotoPath = getOwnedProfilePhotoStoragePath(
      user.avatar_url || user.avatarUrl,
      {
        baseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        bucket: PROFILE_PHOTO_BUCKET,
        userId: user.id,
      }
    );
    let upload;

    try {
      const body = await readJson(req);
      upload = await uploadProfilePhotoFile({ body, userId: user.id });
      const updatedProfiles = asList(await patchRows(
        req,
        `/profiles?id=eq.${user.id}`,
        { avatar_url: upload.avatarUrl },
        { prefer: 'return=representation', useServiceRole: true }
      ));

      if (updatedProfiles.length !== 1) {
        const error = new Error('Client profile not found.');
        error.status = 404;
        throw error;
      }

      if (previousPhotoPath && previousPhotoPath !== upload.path) {
        await deleteProfilePhotoFile(previousPhotoPath).catch(() => {});
      }
    } catch (error) {
      if (upload?.path) {
        await deleteProfilePhotoFile(upload.path).catch(() => {});
      }

      sendError(res, error.status || 400, error.message || 'Unable to upload profile photo.');
      return;
    }

    const updated = await loadClientAccountProfile(req, user.id);
    sendJson(res, 201, {
      avatarUrl: upload.avatarUrl,
      contentType: upload.contentType,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      sessionSummary: pickSessionSummaryFields(
        toClientAccountSessionSummary(updated.account),
        ['id', 'avatarUrl']
      ),
    });
  },

  'GET /client/verification': async (req, res) => {
    const user = await requireClientServiceSession(req, res);
    if (!user) return;

    const verification = await loadClientVerification(req, user.id);
    sendJson(res, 200, mapClientVerification(
      verification.caseRow,
      verification.documentRows
    ));
  },

  'POST /client/verification/uploads': async (req, res) => {
    const user = await requireClientServiceSession(req, res);
    if (!user) return;

    const current = await loadClientVerification(req, user.id);

    if (['pending_review', 'approved'].includes(current.caseRow.status)) {
      sendError(res, 409, 'Verification evidence is locked while pending or approved.');
      return;
    }

    const body = await readJson(req);
    let upload;

    try {
      upload = await uploadClientVerificationFile({ body, userId: user.id });
      await writeRows(
        req,
        '/rpc/register_client_verification_document',
        {
          p_business_document_type: upload.businessDocumentType,
          p_client_id: user.id,
          p_content_type: upload.contentType,
          p_file_sha256: upload.fileSha256,
          p_file_size: upload.fileSize,
          p_kind: upload.kind,
          p_original_file_name: upload.fileName,
          p_storage_bucket: upload.storageBucket,
          p_storage_path: upload.path,
        },
        { useServiceRole: true }
      );
    } catch (error) {
      if (upload?.path) {
        supabaseStorageRequest(
          `/object/${CLIENT_VERIFICATION_UPLOAD_BUCKET}/${encodeStoragePath(upload.path)}`,
          { method: 'DELETE' }
        ).catch(() => {});
      }

      sendError(res, error.status || 400, error.message || 'Unable to upload verification evidence.');
      return;
    }

    const updated = await loadClientVerification(req, user.id);
    sendJson(res, 201, mapClientVerification(updated.caseRow, updated.documentRows));
  },

  'POST /client/verification/submit': async (req, res) => {
    const user = await requireClientServiceSession(req, res);
    if (!user) return;

    const current = await loadClientVerification(req, user.id);
    const validation = validateClientVerificationSubmission(current.documentRows);

    if (!['draft', 'rejected'].includes(current.caseRow.status)) {
      sendError(res, 409, 'Only draft or rejected verification can be submitted.');
      return;
    }

    if (!validation.valid) {
      sendError(
        res,
        400,
        `Complete every verification requirement before submitting: ${validation.missingKinds.join(', ')}.`
      );
      return;
    }

    await writeRows(
      req,
      '/rpc/submit_client_verification',
      { p_client_id: user.id },
      { useServiceRole: true }
    );

    const updated = await loadClientVerification(req, user.id);

    notifyAdmins({
      actionUrl: '/?tab=client-verifications',
      body: `${user.name || user.email || 'A client'} submitted identity and business evidence for manual review.`,
      emailSubject: 'Client verification submitted',
      metadata: { clientId: user.id },
      title: 'Client verification submitted',
      type: 'client_verification_submitted',
    }).catch(() => {});

    sendJson(res, 200, mapClientVerification(updated.caseRow, updated.documentRows));
  },

  'POST /client/verification/document-url': async (req, res) => {
    const user = await requireClientServiceSession(req, res, ['admin', 'client']);
    if (!user) return;

    try {
      const body = await readJson(req);
      const document = await getAccessibleClientVerificationDocument(req, user, body);

      sendJson(res, 200, {
        contentType: document.content_type,
        fileName: document.original_file_name,
        url: await getSupabaseStorageSignedUrl(
          document.storage_path,
          document.storage_bucket
        ),
      });
    } catch (error) {
      sendError(res, error.status || 400, error.message || 'Unable to open this verification document.');
    }
  },

  'GET /client/jobs': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const rows = await readRowsIfPresent(
      req,
      `/client_jobs?client_id=eq.${user.id}&select=*&order=created_at.desc&limit=100`,
      ['client_jobs'],
      { useServiceRole: true }
    );

    sendJson(res, 200, asList(rows).map(mapClientJob));
  },

  'POST /client/jobs': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const allowance = await requireClientJobPostPermission(req, res, user);
    if (!allowance) return;

    const body = await readJson(req);
    const title = cleanString(body.title, 180);

    if (!title) {
      sendError(res, 400, 'Job title is required.');
      return;
    }

    const rows = await writeRows(req, '/client_jobs', {
      client_id: user.id,
      description: cleanString(body.description, 3000),
      employment_type: cleanString(body.employmentType || body.employment_type, 80),
      location: cleanString(body.location, 180),
      status: ['draft', 'open', 'closed', 'archived'].includes(body.status) ? body.status : 'open',
      title,
    });

    sendJson(res, 201, mapClientJob(asList(rows)[0]));
  },

  'GET /client/reviews': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const params = getSearchParams(req);
    const professionalId = cleanString(params.get('professionalId') || params.get('professional_id'), 80);
    const filters = ['status=eq.published'];

    if (professionalId) {
      if (!isUuid(professionalId)) {
        sendError(res, 400, 'A valid professionalId is required.');
        return;
      }

      filters.push(`professional_id=eq.${professionalId}`);
    }

    const rows = await readRowsIfPresent(
      req,
      `/professional_reviews?${filters.join('&')}&select=*&order=created_at.desc&limit=100`,
      ['professional_reviews'],
      { useServiceRole: true }
    );

    sendJson(res, 200, asList(rows).map(mapProfessionalReview));
  },

  'POST /client/reviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const permissions = requireClientCapability(
      res,
      user,
      'canReviewProfessionals',
      'Basic clients can read reviews but cannot leave them.'
    );
    if (!permissions) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);
    const rating = Number(body.rating);

    if (!isUuid(professionalId)) {
      sendError(res, 400, 'A valid professionalId is required.');
      return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      sendError(res, 400, 'Rating must be a whole number from 1 to 5.');
      return;
    }

    const professionalProfile = await getProfessionalProfile(req, professionalId, {
      includeSensitive: false,
      requireApproved: true,
      useServiceRole: true,
    });

    if (!professionalProfile) {
      sendError(res, 404, 'Approved talent profile not found.');
      return;
    }

    const rows = await writeRows(
      req,
      '/professional_reviews?on_conflict=client_id,professional_id',
      {
        client_id: user.id,
        professional_id: professionalId,
        rating,
        review: cleanString(body.review || body.comment, 2000),
        status: 'published',
      },
      { prefer: 'resolution=merge-duplicates,return=representation' }
    );

    sendJson(res, 201, mapProfessionalReview(asList(rows)[0]));
  },

  'GET /client/background-checks': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const allowance = await requireClientBackgroundCheckPermission(req, res, user);
    if (!allowance) return;

    const rows = await readRowsIfPresent(
      req,
      `/client_background_checks?client_id=eq.${user.id}&select=*&order=created_at.desc&limit=100`,
      ['client_background_checks'],
      { useServiceRole: true }
    );

    sendJson(res, 200, asList(rows).map(mapBackgroundCheck));
  },

  'POST /client/background-checks': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const allowance = await requireClientBackgroundCheckPermission(req, res, user);
    if (!allowance) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);

    if (!isUuid(professionalId)) {
      sendError(res, 400, 'A valid professionalId is required.');
      return;
    }

    const professionalProfile = await getProfessionalProfile(req, professionalId, {
      includeSensitive: false,
      requireApproved: true,
      useServiceRole: true,
    });

    if (!professionalProfile) {
      sendError(res, 404, 'Approved talent profile not found.');
      return;
    }

    const rows = await writeRows(req, '/client_background_checks', {
      client_id: user.id,
      package: cleanString(body.package, 80) || 'standard',
      professional_id: professionalId,
      status: 'requested',
    });

    sendJson(res, 201, mapBackgroundCheck(asList(rows)[0]));
  },

  'GET /client/billing': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const [contracts, invoices, paymentMethods] = await Promise.all([
      readRows(req, `/contracts?client_id=eq.${user.id}&select=*&order=created_at.desc&limit=50`),
      readRows(req, `/invoices?client_id=eq.${user.id}&select=*&order=issued_at.desc&limit=50`),
      readRows(req, `/payment_methods?client_id=eq.${user.id}&select=*&order=is_default.desc,created_at.desc&limit=10`),
    ]);

    sendJson(res, 200, {
      contracts: asList(contracts).map((contract) => ({
        amount: toNumber(contract.monthly_amount),
        billingInterval: contract.billing_interval || 'Monthly',
        id: contract.id,
        monthlyAmount: toNumber(contract.monthly_amount),
        name: contract.title,
        startDate: contract.start_date ? `Started ${formatDate(contract.start_date)}` : '',
        status: contract.status,
        title: contract.title,
      })),
      invoices: asList(invoices).map((invoice) => ({
        amount: toNumber(invoice.amount),
        date: formatDate(invoice.issued_at || invoice.created_at),
        downloadUrl: invoice.pdf_url,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
      })),
      paymentMethods: asList(paymentMethods).map((method) => ({
        brand: method.brand,
        expires: method.expires,
        holderName: method.holder_name,
        id: method.id,
        isDefault: method.is_default,
        last4: method.last4,
      })),
    });
  },

  'GET /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const interviews = await readRows(
      req,
      `/interviews?client_id=eq.${user.id}&client_hidden_at=is.null&status=in.(requesting,requested,scheduled,completed,cancelled)&select=*&order=updated_at.desc&limit=50`
    );
    const rows = asList(interviews);
    const owners = await loadProfilesById(req, rows.map((interview) => interview.professional_id), {
      useServiceRole: true,
    });

    sendJson(res, 200, rows.map((interview) => {
      const parts = getMonthDay(interview.scheduled_for);
      const professional = owners.get(interview.professional_id) || {};

      return {
        candidateName: professional.full_name,
        cancellationReason: interview.cancellation_reason,
        cancelledAt: interview.cancelled_at,
        cancelledBy: interview.cancelled_by,
        day: parts.day,
        id: interview.id,
        meetingUrl: interview.meeting_url,
        month: parts.month,
        name: professional.full_name,
        role: interview.role_title || professional.title,
        scheduledFor: interview.scheduled_for,
        status: interview.status === 'requested' ? 'requesting' : interview.status,
        time: parts.time,
        title: interview.role_title || professional.title,
      };
    }));
  },

  'GET /client/shortlist': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const shortlists = await readRows(
      req,
      `/shortlists?client_id=eq.${user.id}&select=*&order=created_at.desc&limit=100`
    );
    const rows = asList(shortlists);
    const professionalIds = rows.map((row) => row.professional_id);
    const [profiles, opportunities, interviews] = await Promise.all([
      loadTalentProfilesForViewer(req, user, { ids: professionalIds, onlyApproved: true }),
      professionalIds.length
        ? readRows(req, `/opportunities?client_id=eq.${user.id}&professional_id=${byIdFilter(professionalIds)}&status=in.(invited,accepted,active)&select=id,professional_id,status,title,received_at&order=received_at.desc&limit=100`)
        : [],
      professionalIds.length
        ? readRows(req, `/interviews?client_id=eq.${user.id}&professional_id=${byIdFilter(professionalIds)}&client_hidden_at=is.null&status=in.(requesting,requested,scheduled,cancelled)&select=id,professional_id,status,created_at,scheduled_for&order=created_at.desc&limit=100`)
        : [],
    ]);
    const shortlistByProfessional = new Map(rows.map((row) => [row.professional_id, row]));
    const latestOpportunityByProfessional = new Map();
    const latestInterviewByProfessional = new Map();

    asList(opportunities).forEach((opportunity) => {
      setPreferredByStatus(latestOpportunityByProfessional, opportunity, opportunityStatusPriority);
    });

    asList(interviews).forEach((interview) => {
      setPreferredByStatus(latestInterviewByProfessional, interview, interviewStatusPriority);
    });

    sendJson(res, 200, profiles.map((profile) => {
      const shortlist = shortlistByProfessional.get(profile.id);
      const latestOpportunity = latestOpportunityByProfessional.get(profile.id);
      const latestInterview = latestInterviewByProfessional.get(profile.id);

      return {
        ...profile,
        interviewStatus: latestInterview?.status,
        latestInterviewId: latestInterview?.id,
        latestOpportunityId: latestOpportunity?.id,
        opportunityStatus: latestOpportunity?.status,
        shortlistId: shortlist?.id,
        shortlistStatus: shortlist?.status,
      };
    }));
  },

  'POST /client/shortlist': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);
    const professionalProfile = await getProfessionalProfile(req, professionalId, {
      includeSensitive: false,
      requireApproved: true,
      useServiceRole: true,
    });

    if (!professionalProfile) {
      sendError(res, 404, 'Approved talent profile not found.');
      return;
    }

    const allowance = await requireClientShortlistPermission(req, res, user, professionalId);
    if (!allowance) return;

    const rows = await writeRows(
      req,
      '/shortlists?on_conflict=client_id,professional_id',
      {
        client_id: user.id,
        notes: cleanString(body.notes, 1000),
        professional_id: professionalId,
        status: 'saved',
      },
      { prefer: 'resolution=merge-duplicates,return=representation' }
    );

    sendJson(res, 201, asList(rows)[0] || { ok: true });
  },

  'DELETE /client/shortlist': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);

    if (!isUuid(professionalId)) {
      sendError(res, 400, 'A valid professionalId is required.');
      return;
    }

    await supabaseRestRequest(
      `/shortlists?client_id=eq.${user.id}&professional_id=eq.${professionalId}`,
      {
        ...getDataOptions(req),
        method: 'DELETE',
        prefer: 'return=minimal',
      }
    );

    sendJson(res, 200, { ok: true });
  },

  'POST /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const schedulePermissions = requireClientCapability(
      res,
      user,
      'canScheduleInterviews',
      'Basic clients cannot schedule interviews.'
    );
    if (!schedulePermissions) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);
    const professionalProfile = await getProfessionalProfile(req, professionalId, {
      includeSensitive: false,
      requireApproved: true,
      useServiceRole: true,
    });

    if (!professionalProfile) {
      sendError(res, 404, 'Approved talent profile not found.');
      return;
    }

    const [activeOpportunities, activeInterviews] = await Promise.all([
      readRows(
        req,
        `/opportunities?client_id=eq.${user.id}&professional_id=eq.${professionalId}&status=in.(invited,accepted,active)&select=id,status&limit=1`
      ),
      readRows(
        req,
        `/interviews?client_id=eq.${user.id}&professional_id=eq.${professionalId}&status=in.(requesting,requested,scheduled)&select=id,status&limit=1`
      ),
    ]);

    if (asList(activeInterviews).length) {
      sendError(res, 409, 'There is already an active interview request for this professional.');
      return;
    }

    const owners = await loadProfilesById(req, [professionalId], {
      includeContact: true,
      useServiceRole: true,
    });
    const professionalOwner = owners.get(professionalId) || {};
    const title = cleanString(body.title || body.roleTitle || professionalOwner.title || 'Finance interview', 160);
    const scheduledFor = cleanString(body.scheduledFor || body.scheduled_for, 80);
    const scheduledParts = getMonthDay(scheduledFor);
    const schedule = scheduledFor
      ? `Interview requested for ${formatDate(scheduledFor)} at ${scheduledParts.time}`
      : 'Interview requested';
    const companyName = await getPrimaryClientCompanyName(req, user.id, user.company);
    const durationMinutes = Number(body.durationMinutes || body.duration_minutes || 30);

    let opportunity = asList(activeOpportunities)[0];

    if (!opportunity) {
      const jobAllowance = await requireClientJobPostPermission(req, res, user);
      if (!jobAllowance) return;

      const opportunityRows = await writeRows(req, '/opportunities', {
        client_id: user.id,
        company_name: companyName,
        description: cleanString(body.description || `Interview requested by ${companyName}.`, 1000),
        hourly_rate: toNumber(body.hourlyRate || body.hourly_rate || professionalProfile.hourly_rate),
        professional_id: professionalId,
        schedule,
        status: 'invited',
        title,
      });
      opportunity = asList(opportunityRows)[0];
    }
    const interviewRows = await writeRows(req, '/interviews', {
      client_id: user.id,
      duration_minutes: Number.isFinite(durationMinutes) ? durationMinutes : 30,
      meeting_url: cleanString(body.meetingUrl || body.meeting_url, 500),
      opportunity_id: opportunity?.id,
      professional_id: professionalId,
      role_title: title,
      scheduled_for: scheduledFor || null,
      status: 'requesting',
    });
    const interview = asList(interviewRows)[0] || null;

    patchRows(
      req,
      `/shortlists?client_id=eq.${user.id}&professional_id=eq.${professionalId}`,
      { status: 'contacted' },
      { prefer: 'return=minimal' }
    ).catch(() => {});

    notifyUser({
      actionUrl: '/?tab=opportunities',
      body: `${companyName} requested an interview for ${title}.`,
      emailSubject: `New interview request from ${companyName}`,
      metadata: {
        clientId: user.id,
        interviewId: interview?.id,
        opportunityId: opportunity?.id,
        professionalId,
      },
      recipientEmail: professionalOwner.email,
      recipientId: professionalId,
      recipientName: professionalOwner.full_name,
      title: 'New interview request',
      type: 'interview_requested',
    }).catch(() => {});

    sendJson(res, 201, {
      interview,
      opportunity,
    });
  },

  'PATCH /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const interviewId = cleanString(body.id || body.interviewId || body.interview_id, 80);
    const reason = cleanString(body.reason || body.cancellationReason || body.cancellation_reason, 1000);

    if (!isUuid(interviewId)) {
      sendError(res, 400, 'A valid interview id is required.');
      return;
    }

    if (!reason) {
      sendError(res, 400, 'Cancellation reason is required.');
      return;
    }

    const interview = await cancelInterview(req, {
      actor: user,
      allowedRole: 'client',
      interviewId,
      reason,
    });

    if (!interview) {
      sendError(res, 404, 'Active interview not found.');
      return;
    }

    const owners = await loadProfilesById(req, [interview.professional_id], {
      includeContact: true,
      useServiceRole: true,
    });
    const professional = owners.get(interview.professional_id) || {};

    notifyUser({
      actionUrl: '/?tab=opportunities',
      body: `${user.company || user.name || 'A client'} cancelled an interview. Reason: ${reason}`,
      emailSubject: 'Interview cancelled',
      metadata: {
        cancelledBy: user.id,
        interviewId: interview.id,
        reason,
      },
      recipientEmail: professional.email,
      recipientId: interview.professional_id,
      recipientName: professional.full_name,
      title: 'Interview cancelled',
      type: 'interview_cancelled',
    }).catch(() => {});

    sendJson(res, 200, interview);
  },

  'DELETE /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const interviewId = cleanString(body.id || body.interviewId || body.interview_id, 80);

    if (!isUuid(interviewId)) {
      sendError(res, 400, 'A valid interview id is required.');
      return;
    }

    const rows = await patchRows(
      req,
      `/interviews?id=eq.${interviewId}&client_id=eq.${user.id}&status=eq.cancelled`,
      { client_hidden_at: new Date().toISOString() },
      { prefer: 'return=representation' }
    );

    if (!asList(rows)[0]) {
      sendError(res, 404, 'Cancelled interview not found.');
      return;
    }

    sendJson(res, 200, { ok: true });
  },

  'POST /matchmaker/suggestions': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const permissions = requireClientCapability(
      res,
      user,
      'canUseMatchmaker',
      'Basic clients cannot access the AI matchmaker.'
    );
    if (!permissions) return;

    const body = await readJson(req);
    const message = String(body.message || '').trim();

    if (!message) {
      sendError(res, 400, 'Tell the matchmaker what you need.');
      return;
    }

    const useProMatchmaker = permissions.matchmakerLevel === 'pro';
    const [talent, agencyRows] = await Promise.all([
      loadTalentProfiles(req, { onlyApproved: true }),
      useProMatchmaker
        ? readRows(req, '/agencies?status=eq.approved&select=*&order=updated_at.desc&limit=100')
        : [],
    ]);
    const agencies = asList(agencyRows).map(mapAgency);
    const tokens = tokenize(message);
    const talentMatches = talent
      .map((profile) => ({
        match: profile,
        score: scoreMatch(tokens, profile, ['title', 'role', 'bio', 'skills', 'tools', 'industries']),
        type: 'talent',
      }))
      .filter((item) => item.score > 0);
    const agencyMatches = agencies
      .map((agency) => ({
        match: agency,
        score: scoreMatch(tokens, agency, ['name', 'specialty', 'description', 'tools', 'certifications']),
        type: 'agency',
      }))
      .filter((item) => item.score > 0);
    const matches = [...talentMatches, ...agencyMatches]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    writeRows(req, '/match_requests', {
      client_id: user.id,
      matchmaker_level: permissions.matchmakerLevel,
      message,
      result_count: matches.length,
      tier: permissions.tier,
    }, { prefer: 'return=minimal' }).catch(() => {});

    sendJson(res, 200, {
      matchmakerLevel: permissions.matchmakerLevel,
      matches: matches.map((item) => item.match),
      message: matches.length
        ? `I found ${matches.length} relevant match${matches.length === 1 ? '' : 'es'} for that request.`
        : 'No recommendations are available yet.',
      type: matches[0]?.type || 'talent',
    });
  },

  'GET /talent/earnings': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireVerifiedProfessional(req, res, user);
    if (!access) return;

    const timesheets = await readRows(
      req,
      `/timesheets?professional_id=eq.${user.id}&select=*&order=period_end.desc&limit=100`
    );
    const currentYear = new Date().getFullYear();
    const rows = asList(timesheets);
    const amountFor = (statuses) => rows
      .filter((sheet) => statuses.includes(sheet.status))
      .reduce((total, sheet) => total + (toNumber(sheet.amount) || 0), 0);
    const totalEarnedYtd = rows
      .filter((sheet) => {
        const paidAt = sheet.paid_at || sheet.approved_at || sheet.period_end;
        return paidAt && new Date(paidAt).getFullYear() === currentYear;
      })
      .reduce((total, sheet) => total + (toNumber(sheet.amount) || 0), 0);

    sendJson(res, 200, {
      availableToWithdraw: amountFor(['approved']),
      pendingReview: amountFor(['submitted']),
      timesheets: rows.map((sheet) => ({
        amount: toNumber(sheet.amount),
        hours: toNumber(sheet.hours),
        id: sheet.id,
        period: sheet.period_start && sheet.period_end
          ? `${formatDate(sheet.period_start)} - ${formatDate(sheet.period_end)}`
          : 'Period pending',
        status: sheet.status ? sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1) : 'Pending',
      })),
      totalEarnedYtd,
    });
  },

  'POST /talent/uploads': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    try {
      const body = await readJson(req);
      const profile = await getProfessionalProfile(req, user.id, { useServiceRole: true });
      const upload = await uploadCredentialFile({ body, profile, userId: user.id });

      sendJson(res, 201, upload);
    } catch (error) {
      sendError(res, 400, error.message || 'Unable to upload this file.');
    }
  },

  'POST /talent/identity-uploads': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    try {
      const body = await readJson(req);
      const upload = await uploadIdentityVerificationFile({ body, userId: user.id });
      const key = IDENTITY_UPLOAD_KEYS[upload.kind];
      const currentProfile = await getProfessionalProfile(req, user.id, { useServiceRole: true });
      const currentDocuments = cleanIdentityVerificationDocuments(currentProfile?.identity_verification_documents);
      const nextDocuments = {
        ...Object.fromEntries(Object.entries(currentDocuments).filter(([, document]) => document?.path)),
        [key]: upload,
      };
      const now = new Date().toISOString();
      const profilePayload = {
        identity_verification_documents: nextDocuments,
        identity_verification_status: 'pending',
        identity_verified_at: null,
        identity_verified_by: null,
        professional_tier: 'unverified',
        profile_visibility: 'hidden',
        status: currentProfile?.status === 'approved' ? 'pending_review' : (currentProfile?.status || 'draft'),
        user_id: user.id,
        verified_at: null,
        ...(currentProfile?.status === 'approved'
          ? {
            review_status: 'pending_review',
            review_submitted_at: now,
          }
          : {}),
      };
      const rows = await writeRows(
        req,
        '/professional_profiles?on_conflict=user_id',
        profilePayload,
        { prefer: 'resolution=merge-duplicates,return=representation', useServiceRole: true }
      );
      const savedProfile = asList(rows)[0];

      sendJson(res, 201, await mapTalentProfileWithConfiguredPermissions(req, savedProfile, {
        avatar_url: user.avatar_url || user.avatarUrl,
        email: user.email,
        full_name: user.name,
        title: user.title,
      }, { includeDraftPending: true, usePending: true, visibility: 'owner' }));
    } catch (error) {
      sendError(res, 400, error.message || 'Unable to upload identity verification file.');
    }
  },

  'POST /talent/profile-photo': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const previousPhotoPath = getOwnedProfilePhotoStoragePath(
      user.avatar_url || user.avatarUrl,
      {
        baseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        bucket: PROFILE_PHOTO_BUCKET,
        userId: user.id,
      }
    );
    let upload;

    try {
      const body = await readJson(req);
      upload = await uploadProfilePhotoFile({ body, userId: user.id });

      const updatedProfiles = asList(await patchRows(
        req,
        `/profiles?id=eq.${user.id}`,
        { avatar_url: upload.avatarUrl },
        { prefer: 'return=representation', useServiceRole: true }
      ));

      if (updatedProfiles.length !== 1) {
        const error = new Error('Professional profile not found.');
        error.status = 404;
        throw error;
      }

      if (previousPhotoPath && previousPhotoPath !== upload.path) {
        await deleteProfilePhotoFile(previousPhotoPath).catch(() => {});
      }

      const activeSessionUser = await getSessionUser(req);
      sendJson(res, 201, {
        ...upload,
        sessionSummary: toActiveSessionSummary(activeSessionUser || user),
      });
    } catch (error) {
      if (upload?.path) {
        await deleteProfilePhotoFile(upload.path).catch(() => {});
      }

      sendError(res, error.status || 400, error.message || 'Unable to upload profile photo.');
    }
  },

  'GET /talent/me': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const profiles = await readRows(
      req,
      `/professional_profiles?user_id=eq.${user.id}&select=*&limit=1`
    );
    const professionalProfile = asList(profiles)[0];

    sendJson(res, 200, professionalProfile
      ? await mapTalentProfileWithConfiguredPermissions(req, professionalProfile, {
        avatar_url: user.avatar_url || user.avatarUrl,
        email: user.email,
        full_name: user.name,
        title: user.title,
      }, {
        includeDraftPending: true,
        professionalPermissions: user.professionalPermissions,
        usePending: true,
        visibility: 'owner',
      })
      : user);
  },

  'GET /talent/profile-preview': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const params = getSearchParams(req);
    const tier = normalizeClientTier(params.get('tier') || 'basic');
    const profile = await getProfessionalProfile(req, user.id, { useServiceRole: true });

    if (!profile) {
      sendError(res, 404, 'Professional profile not found.');
      return;
    }

    sendJson(res, 200, mapTalentProfilePreviewForTier(profile, {
      avatar_url: user.avatar_url || user.avatarUrl,
      email: user.email,
      full_name: user.name,
      title: user.title,
    }, tier));
  },

  'PATCH /talent/me': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const body = await readJson(req);
    const submitForReview = body.submitForReview === true || body.submit_for_review === true;
    const currentProfile = await getProfessionalProfile(req, user.id);
    const fullName = cleanString(body.fullName || body.name || user.name, 160);
    const existingPendingProfile = currentProfile?.pending_profile || {};
    const currentProfileView = {
      ...(currentProfile || {}),
      ...existingPendingProfile,
    };
    const fallbackTitles = cleanProfessionalTitles(
      existingPendingProfile.titles ?? existingPendingProfile.title,
      cleanProfessionalTitles(currentProfile?.titles, cleanProfessionalTitles(user.title))
    );
    const rawTitles = cleanProfessionalTitles(body.titles ?? body.title ?? body.role, fallbackTitles);
    const existingApprovedTitles = currentProfile?.titles || [];
    const EXECUTIVE_TITLES = ['Fractional CFO', 'FP&A Director'];
    const titles = rawTitles.filter(t => !EXECUTIVE_TITLES.includes(t) || existingApprovedTitles.includes(t));
    const primaryTitle = titles[0] || '';
    const hourlyRate = toNumber(body.hourlyRate ?? body.rate ?? body.hourly_rate ?? currentProfileView.hourly_rate);
    const yearsExperience = toNumber(body.yearsExperience ?? body.years_experience ?? body.experience ?? currentProfileView.years_experience);
    const draftWorkPreferences = cleanWorkPreferences(
      body.workPreferences ?? body.work_preferences ?? currentProfileView.work_preferences,
      currentProfile?.work_preferences
    );
    const previousReviewableWorkPreferences = getReviewableWorkPreferences({
      ...(currentProfile || {}),
      __includePendingProfile: true,
    }).workPreferences;
    const shouldReflectCredentialDraft = !submitForReview && Boolean(currentProfile) && (
      currentProfile.status === 'pending_review'
      || currentProfile.status === 'rejected'
      || currentProfile.review_status === 'pending_review'
    );
    let workPreferences = submitForReview || shouldReflectCredentialDraft
      ? markWorkPreferencesSubmitted(draftWorkPreferences)
      : draftWorkPreferences;

    if (currentProfile) {
      workPreferences = preserveLockedApprovedCredentialExpiry(currentProfile.work_preferences, workPreferences);
    }

    const expiryChangeBlocker = currentProfile
      ? getApprovedCredentialExpiryChangeBlocker(currentProfile.work_preferences, workPreferences)
      : '';

    if (expiryChangeBlocker) {
      sendError(res, 400, expiryChangeBlocker);
      return;
    }

    if (submitForReview) {
      try {
        workPreferences = await verifyRequiredCredentialDigests({
          ...(currentProfile || {}),
          pending_profile: {},
          status: 'draft',
          titles,
          work_preferences: workPreferences,
        }, { userId: user.id });
      } catch (error) {
        sendError(res, 400, error.message || 'Unable to verify required certification uploads.');
        return;
      }
    }

    const reflectedCredentialChanges = shouldReflectCredentialDraft
      ? getCredentialDocumentChanges(previousReviewableWorkPreferences, workPreferences)
      : [];

    const profilePayload = {
      availability: normalizeAvailability(body.availability || body.available || currentProfileView.availability),
      bio: cleanString(body.bio ?? currentProfileView.bio, 2000),
      certifications: cleanList(body.certifications ?? currentProfileView.certifications),
      country: cleanString(body.country || currentProfileView.country || 'Philippines', 100),
      full_name: fullName,
      hourly_rate: hourlyRate,
      industries: cleanList(body.industries ?? currentProfileView.industries),
      location: cleanString(body.location ?? currentProfileView.location, 160),
      skills: cleanList(body.skills ?? currentProfileView.skills),
      titles,
      tools: cleanList(body.tools ?? currentProfileView.tools),
      work_preferences: workPreferences,
      years_experience: yearsExperience,
    };

    if (submitForReview) {
      const submittedIdentityDocuments = currentProfile?.identity_verification_status === 'approved'
        ? cleanIdentityVerificationDocuments(currentProfile.identity_verification_documents)
        : markIdentityVerificationDocumentsSubmitted(currentProfile?.identity_verification_documents);
      const submissionProfile = {
        ...(currentProfile || {}),
        __includePendingProfile: true,
        identity_verification_documents: submittedIdentityDocuments,
        pending_profile: currentProfile?.status === 'approved' ? profilePayload : {},
        ...toProfilePatch(profilePayload, currentProfile || {}),
        work_preferences: workPreferences,
      };
      const identitySubmissionBlocker = getIdentitySubmissionBlocker(submissionProfile);
      const submissionBlocker = identitySubmissionBlocker || getCredentialSubmissionBlocker(submissionProfile);

      if (submissionBlocker) {
        sendError(res, 400, submissionBlocker);
        return;
      }
    }
    
    const ownerProfilePatch = titles.includes('Certified Public Accountant')
      ? {
        manual_triage_domain: 'Credentials',
        manual_triage_reason: 'PRC License Verification Required (https://online.prc.gov.ph/Verification)',
        manual_triage_required: true,
        manual_triage_status: 'required',
      }
      : {};
    const currentTitles = cleanProfessionalTitles(currentProfile?.titles, cleanProfessionalTitles(user.title));
    const titlesChanged = currentTitles.join('|') !== titles.join('|');
    let rows;

    if (Object.keys(ownerProfilePatch).length > 0 && (submitForReview || (currentProfile?.status === 'approved' && titlesChanged))) {
      await patchRows(req, `/profiles?id=eq.${user.id}`, ownerProfilePatch, { prefer: 'return=minimal' });
    }

    if (currentProfile?.status === 'approved') {
      rows = await patchRows(
        req,
        `/professional_profiles?user_id=eq.${user.id}`,
        submitForReview
          ? {
            identity_verification_documents: currentProfile?.identity_verification_status === 'approved'
              ? currentProfile.identity_verification_documents
              : markIdentityVerificationDocumentsSubmitted(currentProfile?.identity_verification_documents),
            pending_profile: profilePayload,
            review_status: 'pending_review',
            review_submitted_at: new Date().toISOString(),
          }
          : buildApprovedProfessionalDraftPatch({
            currentProfile,
            profilePayload,
            shouldReflectCredentialDraft,
          })
      );
    } else {
      rows = await writeRows(
        req,
        '/professional_profiles?on_conflict=user_id',
        submitForReview
          ? {
            ...toProfilePatch(profilePayload),
            identity_verification_documents: markIdentityVerificationDocumentsSubmitted(currentProfile?.identity_verification_documents),
            pending_profile: toPendingProfessionalIdentity(profilePayload),
            review_status: null,
            review_submitted_at: new Date().toISOString(),
            status: 'pending_review',
            user_id: user.id,
          }
          : shouldReflectCredentialDraft
            ? {
              ...toProfilePatch(profilePayload, currentProfile || {}),
              pending_profile: toPendingProfessionalIdentity(profilePayload, currentProfile?.pending_profile),
              review_status: currentProfile?.review_status || null,
              review_submitted_at: currentProfile?.review_submitted_at || new Date().toISOString(),
              status: currentProfile?.status || 'pending_review',
              user_id: user.id,
            }
          : {
            pending_profile: asDraftPendingProfile(profilePayload),
            review_status: null,
            review_submitted_at: null,
            status: currentProfile?.status || 'draft',
            user_id: user.id,
          },
        { prefer: 'resolution=merge-duplicates,return=representation' }
      );
    }

    const savedProfile = asList(rows)[0];
    const shouldNotifyAdmins = submitForReview && (
      savedProfile?.status === 'pending_review'
      || savedProfile?.review_status === 'pending_review'
    );

    if (shouldNotifyAdmins) {
      notifyAdmins({
        actionUrl: '/?tab=talent',
        body: `${fullName} submitted an updated professional profile for review.`,
        emailSubject: 'New PB Finance talent profile for review',
        metadata: {
          professionalId: user.id,
          status: savedProfile.status,
        },
        title: 'Talent profile pending review',
        type: 'talent_profile_submitted',
      }).catch(() => {});
    } else if (reflectedCredentialChanges.length) {
      const changedLabels = reflectedCredentialChanges
        .map((change) => change.document.label || change.previous?.label || change.document.fileName || 'Document')
        .slice(0, 4)
        .join(', ');

      notifyAdmins({
        actionUrl: '/?tab=talent',
        body: `${fullName} ${reflectedCredentialChanges.length === 1 ? reflectedCredentialChanges[0].action : 'updated'} ${changedLabels} for credential review.`,
        emailSubject: 'PB Finance document updated for review',
        metadata: {
          changeCount: reflectedCredentialChanges.length,
          professionalId: user.id,
          status: savedProfile.status,
        },
        title: 'Talent document updated',
        type: 'talent_profile_submitted',
      }).catch(() => {});
    }

    const activeSessionUser = await getSessionUser(req);
    const mappedProfile = await mapTalentProfileWithConfiguredPermissions(req, savedProfile, {
      avatar_url: user.avatar_url || user.avatarUrl,
      email: user.email,
      full_name: fullName,
      title: primaryTitle,
    }, {
      includeDraftPending: true,
      professionalPermissions: activeSessionUser?.professionalPermissions || user.professionalPermissions,
      usePending: true,
      visibility: 'owner',
    });

    sendJson(res, 200, {
      ...mappedProfile,
      sessionSummary: toActiveSessionSummary(activeSessionUser || user),
    });
  },

  'GET /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireVerifiedProfessional(req, res, user);
    if (!access) return;

    const opportunities = await readRows(
      req,
      `/opportunities?professional_id=eq.${user.id}&status=neq.closed&select=*&order=received_at.desc&limit=50`,
      { useServiceRole: true }
    );
    const opportunityRows = asList(opportunities);
    const opportunityIds = opportunityRows.map((opportunity) => opportunity.id);
    const [interviewRows, clientProfiles] = await Promise.all([
      opportunityIds.length
        ? readRows(
          req,
          `/interviews?opportunity_id=${byIdFilter(opportunityIds)}&professional_id=eq.${user.id}&professional_hidden_at=is.null&select=*&limit=100`,
          { useServiceRole: true }
        )
        : [],
      loadProfilesById(req, opportunityRows.map((opportunity) => opportunity.client_id), {
        includeContact: true,
        useServiceRole: true,
      }),
    ]);
    const interviewsByOpportunity = new Map(asList(interviewRows).map((interview) => [interview.opportunity_id, interview]));

    sendJson(res, 200, opportunityRows.map((opportunity) => {
      const interview = interviewsByOpportunity.get(opportunity.id) || {};
      const effectiveStatus = interview.status === 'cancelled' ? 'cancelled' : opportunity.status;
      const client = clientProfiles.get(opportunity.client_id) || {};
      const clientName = client.company || client.full_name || 'Client company';
      const clientIdentity = {
        clientIdentityVisible: true,
        clientName,
        clientProfile: {
          clientTier: client.client_tier || 'basic',
          company: client.company || '',
          email: client.email || '',
          id: client.id || opportunity.client_id,
          name: client.full_name || '',
          role: client.role || 'client',
          title: client.title || '',
        },
        company: client.company || clientName,
      };

      const scheduledParts = getMonthDay(interview.scheduled_for);
      const interviewSchedule = interview.scheduled_for
        ? `${formatDate(interview.scheduled_for)} at ${scheduledParts.time}`
        : opportunity.schedule;

      return {
        ...clientIdentity,
        cancellationReason: interview.cancellation_reason,
        cancelledAt: interview.cancelled_at,
        date: formatDate(opportunity.received_at),
        description: 'Interview request',
        duration: interviewSchedule,
        hourlyRate: toNumber(opportunity.hourly_rate),
        id: opportunity.id,
        interviewId: interview.id,
        interviewStatus: interview.status,
        rate: toNumber(opportunity.hourly_rate),
        receivedAt: formatDate(opportunity.received_at),
        role: opportunity.title,
        schedule: interviewSchedule,
        status: effectiveStatus,
        title: opportunity.title,
      };
    }));
  },

  'PATCH /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireVerifiedProfessional(req, res, user);
    if (!access) return;

    const body = await readJson(req);
    const opportunityId = cleanString(body.id || body.opportunityId || body.opportunity_id, 80);
    const status = cleanString(body.status, 40);

    if (!isUuid(opportunityId)) {
      sendError(res, 400, 'A valid opportunity id is required.');
      return;
    }

    if (!['accepted', 'declined'].includes(status)) {
      sendError(res, 400, 'Opportunity status must be accepted or declined.');
      return;
    }

    const existing = await readRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&select=*&limit=1`,
      { useServiceRole: true }
    );

    const opportunity = asList(existing)[0];

    if (!opportunity) {
      sendError(res, 404, 'Opportunity not found.');
      return;
    }

    const interviewRows = await readRows(
      req,
      `/interviews?opportunity_id=eq.${opportunityId}&professional_id=eq.${user.id}&select=*&limit=1`,
      { useServiceRole: true }
    );
    const interview = asList(interviewRows)[0];

    if (opportunity.status !== 'invited' || !['requesting', 'requested'].includes(interview?.status)) {
      sendError(res, 409, 'This interview request is no longer available.');
      return;
    }

    const rows = await patchRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&status=eq.invited`,
      { status },
      { useServiceRole: true }
    );

    if (!asList(rows)[0]) {
      sendError(res, 409, 'This interview request is no longer available.');
      return;
    }

    await patchRows(
      req,
      `/interviews?id=eq.${interview.id}&professional_id=eq.${user.id}&status=in.(requesting,requested)`,
      { status: status === 'accepted' ? 'scheduled' : 'cancelled' },
      { prefer: 'return=minimal', useServiceRole: true }
    ).catch(() => {});

    const clientProfiles = await loadProfilesById(req, [opportunity.client_id], {
      includeContact: true,
      useServiceRole: true,
    });
    const client = clientProfiles.get(opportunity.client_id) || {};

    notifyUser({
      actionUrl: '/?tab=interviews',
      body: `${user.name || 'A professional'} ${status} your interview request for ${opportunity.title}.`,
      emailSubject: `Interview request ${formatStatusLabel(status)}`,
      metadata: {
        clientId: opportunity.client_id,
        opportunityId,
        professionalId: user.id,
        status,
      },
      recipientEmail: client.email,
      recipientId: opportunity.client_id,
      recipientName: client.full_name,
      title: `Interview ${formatStatusLabel(status)}`,
      type: `interview_${status}`,
    }).catch(() => {});

    sendJson(res, 200, { id: opportunityId, ok: true, status });
  },

  'DELETE /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireVerifiedProfessional(req, res, user);
    if (!access) return;

    const body = await readJson(req);
    const opportunityId = cleanString(body.id || body.opportunityId || body.opportunity_id, 80);

    if (!isUuid(opportunityId)) {
      sendError(res, 400, 'A valid opportunity id is required.');
      return;
    }

    const existing = await readRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&status=in.(declined,cancelled)&select=*&limit=1`,
      { useServiceRole: true }
    );

    if (!asList(existing)[0]) {
      sendError(res, 404, 'Removable opportunity not found.');
      return;
    }

    await patchRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}`,
      { status: 'closed' },
      { prefer: 'return=minimal', useServiceRole: true }
    );

    await patchRows(
      req,
      `/interviews?opportunity_id=eq.${opportunityId}&professional_id=eq.${user.id}`,
      { professional_hidden_at: new Date().toISOString() },
      { prefer: 'return=minimal', useServiceRole: true }
    ).catch(() => {});

    sendJson(res, 200, { ok: true });
  },

  'PATCH /talent/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireVerifiedProfessional(req, res, user);
    if (!access) return;

    const body = await readJson(req);
    const interviewId = cleanString(body.id || body.interviewId || body.interview_id, 80);
    const opportunityId = cleanString(body.opportunityId || body.opportunity_id, 80);
    const reason = cleanString(body.reason || body.cancellationReason || body.cancellation_reason, 1000);

    if (!isUuid(interviewId) && !isUuid(opportunityId)) {
      sendError(res, 400, 'A valid interview id or opportunity id is required.');
      return;
    }

    if (!reason) {
      sendError(res, 400, 'Cancellation reason is required.');
      return;
    }

    const interview = await cancelInterview(req, {
      actor: user,
      allowedRole: 'professional',
      interviewId: isUuid(interviewId) ? interviewId : '',
      opportunityId: isUuid(opportunityId) ? opportunityId : '',
      reason,
    });

    if (!interview) {
      sendError(res, 404, 'Active interview not found.');
      return;
    }

    const clientProfiles = await loadProfilesById(req, [interview.client_id], {
      includeContact: true,
      useServiceRole: true,
    });
    const client = clientProfiles.get(interview.client_id) || {};

    notifyUser({
      actionUrl: '/?tab=interviews',
      body: `${user.name || 'A professional'} cancelled an interview. Reason: ${reason}`,
      emailSubject: 'Interview cancelled',
      metadata: {
        cancelledBy: user.id,
        interviewId: interview.id,
        reason,
      },
      recipientEmail: client.email,
      recipientId: interview.client_id,
      recipientName: client.full_name,
      title: 'Interview cancelled',
      type: 'interview_cancelled',
    }).catch(() => {});

    sendJson(res, 200, {
      cancellationReason: interview.cancellation_reason,
      cancelledAt: interview.cancelled_at,
      id: interview.id,
      ok: true,
      status: interview.status,
    });
  },

  'GET /talent/jobs': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireProfessionalCapability(
      req,
      res,
      user,
      'canViewFullClientProfiles',
      'Only verified professionals can view full client profiles on job posts.'
    );
    if (!access) return;

    const jobs = await readRowsIfPresent(
      req,
      '/client_jobs?status=eq.open&select=*&order=created_at.desc&limit=100',
      ['client_jobs'],
      { useServiceRole: true }
    );
    const jobRows = asList(jobs);
    const jobIds = jobRows.map((job) => job.id);
    const [clients, comments, contacts] = await Promise.all([
      loadProfilesById(req, jobRows.map((job) => job.client_id), {
        includeContact: true,
        useServiceRole: true,
      }),
      jobIds.length
        ? readRowsIfPresent(
          req,
          `/client_job_comments?job_id=${byIdFilter(jobIds)}&status=eq.published&select=*&order=created_at.asc&limit=200`,
          ['client_job_comments'],
          { useServiceRole: true }
        )
        : [],
      jobIds.length
        ? readRowsIfPresent(
          req,
          `/client_job_contacts?job_id=${byIdFilter(jobIds)}&professional_id=eq.${user.id}&select=*&limit=100`,
          ['client_job_contacts'],
          { useServiceRole: true }
        )
        : [],
    ]);
    const commentsByJob = new Map();
    asList(comments).forEach((comment) => {
      commentsByJob.set(comment.job_id, [...(commentsByJob.get(comment.job_id) || []), comment]);
    });
    const contactsByJob = new Map(asList(contacts).map((contact) => [contact.job_id, contact]));

    sendJson(res, 200, jobRows.map((job) => mapClientJobForProfessional(
      job,
      clients.get(job.client_id),
      {
        comments: commentsByJob.get(job.id) || [],
        contact: contactsByJob.get(job.id) || null,
      }
    )));
  },

  'POST /talent/job-comments': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireProfessionalCapability(
      req,
      res,
      user,
      'canCommentOnJobPosts',
      'Only verified professionals can comment on job posts.'
    );
    if (!access) return;

    const body = await readJson(req);
    const jobId = cleanString(body.jobId || body.job_id, 80);
    const comment = cleanString(body.comment || body.message, 2000);

    if (!isUuid(jobId)) {
      sendError(res, 400, 'A valid job id is required.');
      return;
    }

    if (!comment) {
      sendError(res, 400, 'Comment is required.');
      return;
    }

    const jobRows = await readRowsIfPresent(
      req,
      `/client_jobs?id=eq.${jobId}&status=eq.open&select=*&limit=1`,
      ['client_jobs'],
      { useServiceRole: true }
    );
    const job = asList(jobRows)[0];

    if (!job) {
      sendError(res, 404, 'Open job post not found.');
      return;
    }

    const rows = await writeRows(
      req,
      '/client_job_comments',
      {
        comment,
        job_id: jobId,
        professional_id: user.id,
        status: 'published',
      },
      { useServiceRole: true }
    );
    const saved = asList(rows)[0];

    notifyUser({
      actionUrl: '/?tab=jobs',
      body: `${user.name || 'A verified professional'} commented on your job post: ${job.title}.`,
      emailSubject: 'New comment on your PB Finance job post',
      metadata: {
        commentId: saved?.id,
        jobId,
        professionalId: user.id,
      },
      recipientId: job.client_id,
      title: 'New job comment',
      type: 'job_comment_created',
    }).catch(() => {});

    sendJson(res, 201, mapJobComment(saved));
  },

  'POST /talent/job-contacts': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireProfessionalCapability(
      req,
      res,
      user,
      'canContactClientsFromJobs',
      'Only verified professionals can initiate client contact from a job post.'
    );
    if (!access) return;

    const body = await readJson(req);
    const jobId = cleanString(body.jobId || body.job_id, 80);
    const message = cleanString(body.message || body.note, 2000);

    if (!isUuid(jobId)) {
      sendError(res, 400, 'A valid job id is required.');
      return;
    }

    const jobRows = await readRowsIfPresent(
      req,
      `/client_jobs?id=eq.${jobId}&status=eq.open&select=*&limit=1`,
      ['client_jobs'],
      { useServiceRole: true }
    );
    const job = asList(jobRows)[0];

    if (!job) {
      sendError(res, 404, 'Open job post not found.');
      return;
    }

    const rows = await writeRows(
      req,
      '/client_job_contacts?on_conflict=job_id,professional_id',
      {
        job_id: jobId,
        message,
        professional_id: user.id,
        status: 'requested',
      },
      { prefer: 'resolution=merge-duplicates,return=representation', useServiceRole: true }
    );
    const saved = asList(rows)[0];

    notifyUser({
      actionUrl: '/?tab=jobs',
      body: `${user.name || 'A verified professional'} initiated contact from your job post: ${job.title}.`,
      emailSubject: 'A PB Finance professional contacted you',
      metadata: {
        contactId: saved?.id,
        jobId,
        professionalId: user.id,
      },
      recipientId: job.client_id,
      title: 'New professional contact',
      type: 'job_contact_requested',
    }).catch(() => {});

    sendJson(res, 201, mapJobContact(saved));
  },

  'PATCH /talent/visibility': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const access = await requireProfessionalCapability(
      req,
      res,
      user,
      'canToggleProfileVisibility',
      'Only verified professionals can toggle profile visibility.'
    );
    if (!access) return;

    const body = await readJson(req);
    const visibility = cleanString(body.visibility || body.profileVisibility || body.profile_visibility, 40).toLowerCase();

    if (!['hidden', 'visible'].includes(visibility)) {
      sendError(res, 400, 'Profile visibility must be hidden or visible.');
      return;
    }

    const rows = await patchRows(
      req,
      `/professional_profiles?user_id=eq.${user.id}`,
      { profile_visibility: visibility },
      { useServiceRole: true }
    );
    const savedProfile = asList(rows)[0];

    sendJson(res, 200, await mapTalentProfileWithConfiguredPermissions(req, savedProfile, {
      avatar_url: user.avatar_url || user.avatarUrl,
      email: user.email,
      full_name: user.name,
      title: user.title,
    }, {
      includeDraftPending: true,
      professionalPermissions: access.permissions,
      usePending: true,
      visibility: 'owner',
    }));
  },

  'GET /talent/profiles': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const profiles = await loadTalentProfilesForViewer(req, user, { onlyApproved: true });
    sendJson(res, 200, profiles);
  },

  'POST /documents/url': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    try {
      const body = await readJson(req);
      const { document } = await getAccessibleCredentialDocument(req, user, body);

      sendJson(res, 200, {
        contentType: document.contentType,
        fileName: document.fileName,
        url: await getSupabaseStorageSignedUrl(document.path),
      });
    } catch (error) {
      sendError(res, error.status || 400, error.message || 'Unable to open this document.');
    }
  },

  'POST /documents/blob': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    try {
      const body = await readJson(req);
      const { document } = await getAccessibleCredentialDocument(req, user, body);
      const object = await getSupabaseStorageObject(document.path);
      const contentType = document.contentType || object.contentType || 'application/octet-stream';
      const fileName = (document.fileName || 'document').replace(/["\r\n]/g, '');

      setCorsHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.end(object.bytes);
    } catch (error) {
      sendError(res, error.status || 400, error.message || 'Unable to open this document.');
    }
  },

  'POST /talent/document-request': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;
    const body = await readJson(req);
    const reason = cleanString(body.reason, 1000);

    if (!reason) {
      sendError(res, 400, 'A reason is required.');
      return;
    }

    const currentProfile = await getProfessionalProfile(req, user.id);
    const targetType = cleanString(body.documentType || body.targetType || body.kind, 80);
    const targetKey = cleanString(body.documentKey || body.key || body.id || body.documentName, 180);

    if (targetType === 'identity') {
      if (currentProfile?.identity_verification_status !== 'approved') {
        sendError(res, 409, 'Only approved identity documents are locked for change requests.');
        return;
      }

      const identityDocuments = cleanIdentityVerificationDocuments(currentProfile.identity_verification_documents);
      const identityEntry = Object.entries(identityDocuments).find(([key, document]) => (
        key === targetKey
        || document?.key === targetKey
        || document?.id === targetKey
        || document?.label === targetKey
      ));

      if (!identityEntry?.[1]) {
        sendError(res, 404, 'Identity document not found.');
        return;
      }

      if (identityEntry[1].changeRequestStatus === 'pending') {
        sendError(res, 409, 'A change request for this identity document is already pending.');
        return;
      }

      const [identityKey, identityDocument] = identityEntry;
      const updatedDocument = buildDocumentChangeRequestRecord(identityDocument, { reason, userId: user.id });
      const rows = await patchRows(
        req,
        `/professional_profiles?user_id=eq.${user.id}`,
        {
          identity_verification_documents: {
            ...Object.fromEntries(Object.entries(identityDocuments).filter(([, document]) => document?.path)),
            [identityKey]: updatedDocument,
          },
        }
      );
      const savedProfile = asList(rows)[0];

      notifyAdmins({
        actionUrl: '/?tab=talent',
        body: `${user.name || user.full_name || user.email || 'A professional'} requested to change or remove their approved identity document: ${updatedDocument.label || updatedDocument.fileName}. Reason: ${reason}`,
        emailSubject: 'Identity document change request',
        metadata: {
          documentKey: updatedDocument.key,
          documentType: 'identity',
          professionalId: user.id,
        },
        title: 'Identity document change request',
        type: 'talent_profile_submitted',
      }).catch(() => {});

      sendJson(res, 200, await mapTalentProfileWithConfiguredPermissions(req, savedProfile, {
        avatar_url: user.avatar_url || user.avatarUrl,
        email: user.email,
        full_name: user.name,
        title: user.title,
      }, { includeDraftPending: true, usePending: true, visibility: 'owner' }));
      return;
    }

    const { pendingProfile, usePendingProfile, workPreferences } = getReviewableWorkPreferences(currentProfile || {});
    let updatedDocument = null;
    let nextWorkPreferences = workPreferences;

    if (targetType === 'resume') {
      if (!workPreferences.resume) {
        sendError(res, 404, 'Resume upload not found.');
        return;
      }
      updatedDocument = buildDocumentChangeRequestRecord(workPreferences.resume, { reason, userId: user.id });
      nextWorkPreferences = {
        ...workPreferences,
        resume: updatedDocument,
      };
    } else {
      const documents = asList(workPreferences.supportingDocuments);
      const documentIndex = documents.findIndex((document) => (
        document.key === targetKey
        || document.id === targetKey
        || document.label === targetKey
      ));

      if (documentIndex < 0) {
        sendError(res, 404, 'Supporting document not found.');
        return;
      }

      updatedDocument = buildDocumentChangeRequestRecord(documents[documentIndex], { reason, userId: user.id });
      nextWorkPreferences = {
        ...workPreferences,
        supportingDocuments: documents.map((document, index) => (
          index === documentIndex ? updatedDocument : document
        )),
      };
    }

    const rows = await patchRows(
      req,
      `/professional_profiles?user_id=eq.${user.id}`,
      usePendingProfile
        ? {
          pending_profile: {
            ...pendingProfile,
            work_preferences: nextWorkPreferences,
          },
        }
        : { work_preferences: nextWorkPreferences }
    );
    const savedProfile = asList(rows)[0];

    notifyAdmins({
      actionUrl: '/?tab=talent',
      body: `${user.name || user.full_name || user.email || 'A professional'} requested to change or remove their approved document: ${updatedDocument.label || updatedDocument.fileName}. Reason: ${reason}`,
      emailSubject: 'Document change request',
      metadata: {
        documentKey: updatedDocument.key,
        documentType: targetType || updatedDocument.kind,
        professionalId: user.id,
      },
      title: 'Document change request',
      type: 'talent_profile_submitted',
    }).catch(() => {});
    
    sendJson(res, 200, await mapTalentProfileWithConfiguredPermissions(req, savedProfile, {
      avatar_url: user.avatar_url || user.avatarUrl,
      email: user.email,
      full_name: user.name,
      title: user.title,
    }, { includeDraftPending: true, usePending: true, visibility: 'owner' }));
  },

  'POST /admin/check-expirations': async (req, res) => {
    const user = await requireAdminOrCronSecret(req, res);
    if (!user) return;

    sendJson(res, 200, await runDocumentExpirationCheck(req));
  },

  'GET /admin/check-expirations': async (req, res) => {
    const user = await requireAdminOrCronSecret(req, res);
    if (!user) return;

    sendJson(res, 200, await runDocumentExpirationCheck(req));
  },
};

const allowedMethodsForPath = (routePath) => Object.keys(handlers)
  .map((key) => key.split(' '))
  .filter(([, path]) => path === routePath)
  .map(([method]) => method);

const requestCounts = new Map();
const checkRateLimit = (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const record = requestCounts.get(ip);
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return true;
  }

  record.count += 1;
  if (record.count > 150) {
    sendError(res, 429, 'Too many requests, please try again later.');
    return false;
  }
  return true;
};

export const __testing = {
  buildApprovedProfessionalDraftPatch,
  getApprovedProfessionalIdentity,
  getDuplicateRequiredCredentialBlocker,
  getDocumentExpirationActions,
  getDocumentExpirationEventKey,
  getIdentitySubmissionBlocker,
  getProfessionalDowngradePayload,
  mapTalentProfilePreviewForTier,
  mapTalentProfileForViewer,
  scrubTalentProfileForViewer,
  toPendingProfessionalIdentity,
  toClientVisibleWorkPreferences,
  verifyRequiredCredentialDigests,
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!checkRateLimit(req, res)) return;

  const routePath = getRoutePath(req);
  const route = handlers[`${req.method} ${routePath}`];

  if (route) {
    try {
      await route(req, res);
    } catch (error) {
      sendError(res, 500, error.message || 'Request failed.');
    }
    return;
  }

  const allowedMethods = allowedMethodsForPath(routePath);

  if (allowedMethods.length) {
    res.setHeader('Allow', allowedMethods.join(', '));
    sendError(res, 405, 'Method not allowed.');
    return;
  }

  sendError(res, 404, 'API route not found.');
}
