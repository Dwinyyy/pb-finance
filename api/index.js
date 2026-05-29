import { getRoutePath, handleOptions, readJson, sendError, sendJson } from '../server/http.js';
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
import { requestRegistrationVerification, verifyRegistrationOtp } from '../server/registrationVerification.js';
import { getSessionUser } from '../server/session.js';
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

const getDataOptions = (req) => ({
  token: getBearerToken(req),
  useServiceRole: Boolean(req.useServiceRole),
});

const asList = (value) => (Array.isArray(value) ? value : []);
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const CREDENTIAL_UPLOAD_BUCKET = 'professional-documents';
const MAX_CREDENTIAL_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_CREDENTIAL_MIME_TYPES = new Set([
  'application/msword',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);
const DOCUMENT_TYPE_FILE_RULES = {
  certification: {
    extensions: new Set(['.pdf', '.jpg', '.jpeg', '.png']),
    mimeTypes: new Set(['application/pdf', 'image/jpeg', 'image/png']),
    message: 'Certification uploads must be a PDF, JPG, or PNG.',
  },
  other_document: {
    extensions: new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']),
    mimeTypes: ALLOWED_CREDENTIAL_MIME_TYPES,
    message: 'Supporting document uploads must be a PDF, Word document, JPG, or PNG.',
  },
  resume: {
    extensions: new Set(['.pdf', '.doc', '.docx']),
    mimeTypes: new Set([
      'application/msword',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
    message: 'Resume uploads must be a PDF or Word document.',
  },
};
const credentialReviewStatuses = new Set(['pending_review', 'approved', 'rejected']);

const cleanString = (value, maxLength = 500) => String(value || '').trim().slice(0, maxLength);
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
  const url = cleanString(value, 500);

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
  const uploadedAt = cleanString(record.uploadedAt, 80);

  if (!fileName || !uploadedAt) return null;

  return {
    contentType: cleanString(record.contentType, 120),
    fileName,
    fileSize: toNumber(record.fileSize),
    id: cleanString(record.id, 80),
    key: cleanString(record.key, 180),
    kind: cleanString(record.kind, 80),
    label: cleanString(record.label, 180),
    path: cleanString(record.path, 700),
    rejectedAt: cleanString(record.rejectedAt, 80),
    rejectionReason: cleanString(record.rejectionReason, 1000),
    changeRequest: cleanRecord(record.changeRequest),
    changeRequestStatus: cleanString(record.changeRequestStatus, 40),
    reviewMessage: cleanString(record.reviewMessage, 1000),
    reviewedAt: cleanString(record.reviewedAt, 80),
    reviewedBy: cleanString(record.reviewedBy, 80),
    status: cleanString(record.status, 60) || 'pending_review',
    storageKey: cleanString(record.storageKey, 120),
    uploadedAt,
    expiryDate: cleanString(record.expiryDate, 80),
    inputValue: cleanString(record.inputValue, 200),
  };
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

const getProfileUserForSession = async (session) => {
  const user = publicUser(session.user);

  if (!user.id) {
    return user;
  }

  try {
    const rows = await supabaseRestRequest(
      `/profiles?id=eq.${user.id}&select=id,email,full_name,company,role,title&limit=1`,
      {
        token: session.access_token,
        useServiceRole: false,
      }
    );
    const profile = asList(rows)[0];

    if (!profile) {
      return user;
    }

    return {
      ...user,
      company: profile.company || user.company,
      email: profile.email || user.email,
      name: profile.full_name || user.name,
      role: profile.role || user.role,
      title: profile.title || user.title,
    };
  } catch {
    return user;
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

  return user;
};

const requireAdmin = async (req, res) => {
  const user = await requireSession(req, res, ['admin']);

  if (!user) return null;

  if (!hasServiceRoleKey()) {
    sendError(res, 500, 'Admin routes require SUPABASE_SERVICE_ROLE_KEY on the server.');
    return null;
  }

  req.useServiceRole = true;
  return user;
};

const readRows = (req, path) => supabaseRestRequest(path, getDataOptions(req));

const writeRows = (req, path, body, { method = 'POST', prefer = 'return=representation' } = {}) => (
  supabaseRestRequest(path, {
    ...getDataOptions(req),
    body,
    method,
    prefer,
  })
);

const patchRows = (req, path, body, { prefer = 'return=representation' } = {}) => (
  writeRows(req, path, body, { method: 'PATCH', prefer })
);

const byIdFilter = (ids) => `in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`;

const loadProfilesById = async (req, ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  let rows;

  try {
    rows = await readRows(
      req,
      `/profiles?id=${byIdFilter(uniqueIds)}&select=id,email,full_name,company,role,title,manual_triage_required,manual_triage_status,manual_triage_reason,manual_triage_domain`
    );
  } catch (error) {
    if (!String(error.message || '').includes('manual_triage')) {
      throw error;
    }

    rows = await readRows(
      req,
      `/profiles?id=${byIdFilter(uniqueIds)}&select=id,email,full_name,company,role,title`
    );
  }

  return new Map(asList(rows).map((profile) => [profile.id, profile]));
};

const hasPendingProfile = (profile) => (
  profile?.pending_profile && Object.keys(profile.pending_profile).length > 0
);

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

const mapTalentProfile = (profile, owner = {}, { usePending = false } = {}) => {
  const pending = usePending && profile.pending_profile ? profile.pending_profile : {};
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
  const workPreferences = cleanWorkPreferences(viewProfile.work_preferences);

  return {
    available: viewProfile.availability || 'Immediate Start',
    availability: viewProfile.availability || 'Immediate Start',
    bio: viewProfile.bio || '',
    certifications: asList(viewProfile.certifications),
    email: owner.email || '',
    exp: years ? `${years}+ yrs` : '',
    experience: years ? `${years}+ years` : '',
    fullName: displayName,
    id: profile.user_id,
    hasPendingChanges: hasPendingProfile(profile),
    industries: asList(viewProfile.industries),
    location: viewProfile.location || viewProfile.country || '',
    manualTriageDomain: owner.manual_triage_domain || '',
    manualTriageReason: owner.manual_triage_reason || '',
    manualTriageRequired: Boolean(owner.manual_triage_required),
    manualTriageStatus: owner.manual_triage_status || 'clear',
    name: displayName,
    rate: hourlyRate,
    rating: toNumber(viewProfile.rating),
    reviewCount: profile.review_count || 0,
    reviewStatus,
    role: title,
    skills: asList(viewProfile.skills),
    status: usePending ? (reviewStatus || profile.status) : profile.status,
    title,
    titles,
    tools: asList(viewProfile.tools),
    externalLinks: asList(workPreferences.externalLinks),
    resume: workPreferences.resume || null,
    supportingDocuments: asList(workPreferences.supportingDocuments),
    workPreferences,
    yearsExperience: years,
  };
};

const loadTalentProfiles = async (req, { ids, onlyApproved = false, usePending = false } = {}) => {
  if (ids && ids.length === 0) {
    return [];
  }

  const filters = [];

  if (ids?.length) {
    filters.push(`user_id=${byIdFilter([...new Set(ids)])}`);
  }

  if (onlyApproved) {
    filters.push('status=eq.approved');
  }

  const query = filters.length ? `?${filters.join('&')}&` : '?';
  const rows = await readRows(
    req,
    `/professional_profiles${query}select=*&order=updated_at.desc&limit=100`
  );
  const profileRows = asList(rows);
  const owners = await loadProfilesById(req, profileRows.map((row) => row.user_id));

  return profileRows.map((profile) => mapTalentProfile(profile, owners.get(profile.user_id), { usePending }));
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

const getProfessionalProfile = async (req, professionalId, { requireApproved = false } = {}) => {
  if (!isUuid(professionalId)) {
    return null;
  }

  const filters = [`user_id=eq.${professionalId}`];

  if (requireApproved) {
    filters.push('status=eq.approved');
  }

  const rows = await readRows(
    req,
    `/professional_profiles?${filters.join('&')}&select=*&limit=1`
  );

  return asList(rows)[0] || null;
};

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

const normalizeStatus = (status, allowedStatuses, fallback = 'pending_review') => {
  const value = cleanString(status, 40);
  return allowedStatuses.has(value) ? value : fallback;
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
    `/interviews?${filters.join('&')}&status=in.(requesting,requested,scheduled)&select=*&limit=1`
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
    }
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
      { prefer: 'return=minimal' }
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

const parseCredentialUpload = (body) => {
  const fileData = String(body.fileData || body.dataUrl || '');
  const dataUrlMatch = fileData.match(/^data:([^;]+);base64,(.+)$/);

  if (!dataUrlMatch) {
    throw new Error('A valid file upload is required.');
  }

  const documentType = cleanString(body.documentType || body.kind || 'credential', 80);
  const rule = getCredentialFileRule(documentType);
  const fileName = safeFileName(body.fileName || body.name);
  const extension = getFileExtension(fileName);
  const declaredContentType = cleanString(body.contentType || dataUrlMatch[1], 120);
  const contentType = ALLOWED_CREDENTIAL_MIME_TYPES.has(declaredContentType)
    ? declaredContentType
    : '';

  if (!contentType || !rule.mimeTypes.has(contentType) || !rule.extensions.has(extension)) {
    throw new Error(rule.message);
  }

  const bytes = Buffer.from(dataUrlMatch[2], 'base64');

  if (!bytes.length || bytes.length > MAX_CREDENTIAL_UPLOAD_BYTES) {
    throw new Error('Upload must be 3 MB or smaller.');
  }

  return {
    bytes,
    contentType,
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

const uploadCredentialFile = async ({ body, userId }) => {
  const { bytes, contentType, fileName } = parseCredentialUpload(body);
  const documentType = cleanString(body.documentType || body.kind || 'credential', 80);
  const rawDocumentKey = cleanString(body.documentKey || body.key || documentType, 140);
  const documentKey = rawDocumentKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'credential';
  const label = cleanString(body.documentLabel || body.label || fileName, 180);
  const uploadedAt = new Date().toISOString();
  const path = `${userId}/${documentKey}/${Date.now()}-${fileName}`;

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
    fileSize: bytes.length,
    id: `${documentKey}:${uploadedAt}`,
    key: rawDocumentKey || documentKey,
    kind: documentType,
    label,
    path,
    status: 'pending_review',
    storageKey: documentKey,
    uploadedAt,
  };
};

const getSupabaseStorageSignedUrl = async (path) => {
  const storagePath = cleanString(path, 700);

  if (!storagePath) {
    throw new Error('A document path is required.');
  }

  const signed = await supabaseStorageRequest(
    `/object/sign/${CREDENTIAL_UPLOAD_BUCKET}/${encodeStoragePath(storagePath)}`,
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

const findCredentialRecord = (profile, { documentKey, documentType, path }) => {
  const { workPreferences } = getReviewableWorkPreferences(profile);
  const targetKey = cleanString(documentKey, 180);
  const targetPath = cleanString(path, 700);
  const targetType = cleanString(documentType, 80);
  const documents = [
    ...(workPreferences.resume ? [{ ...workPreferences.resume, documentType: 'resume' }] : []),
    ...asList(workPreferences.supportingDocuments).map((document) => ({
      ...document,
      documentType: document.kind || 'supporting_document',
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
  ));
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

  return {
    ...credential,
    changeRequest: {
      ...currentRequest,
      reviewedAt,
      reviewedBy: adminId,
      reviewMessage: cleanString(message, 1000),
      status,
    },
    changeRequestStatus: status,
  };
};

const getReviewableWorkPreferences = (profile) => {
  const pendingProfile = cleanRecord(profile.pending_profile);
  const usePendingProfile = Object.keys(pendingProfile).length > 0 && hasOwn(pendingProfile, 'work_preferences');

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
  const hasPendingTitles = hasOwn(pendingProfile, 'titles') || hasOwn(pendingProfile, 'title');

  return cleanProfessionalTitles(
    hasPendingTitles ? (pendingProfile.titles ?? pendingProfile.title) : profile.titles,
    cleanProfessionalTitles(profile.title)
  );
};

const getRequiredCredentialLabels = (profile) => [
  ...new Set(getReviewableProfessionalTitles(profile)
    .flatMap((title) => asList(PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS[title]))),
];

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

  if (!resume) {
    return 'Upload your resume before requesting verification.';
  }

  if (missingDocuments.length) {
    return `${missingDocuments.length} required certification document${missingDocuments.length === 1 ? '' : 's'} still need to be uploaded.`;
  }

  if (rejectedDocuments.length) {
    return `${rejectedDocuments.length} required document${rejectedDocuments.length === 1 ? '' : 's'} need a replacement upload.`;
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
      reviewedCredential = buildCredentialReviewRecord(documents[documentIndex], { adminId, message, status });
    }
    nextWorkPreferences = {
      ...workPreferences,
      supportingDocuments: documents.map((document, index) => (
        index === documentIndex ? reviewedCredential : document
      )),
    };
  }

  const payload = usePendingProfile
    ? {
      pending_profile: {
        ...pendingProfile,
        work_preferences: nextWorkPreferences,
      },
    }
    : {
      work_preferences: nextWorkPreferences,
    };

  return {
    credential: reviewedCredential,
    payload,
    reviewKind,
    targetType,
  };
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

    sendJson(res, 200, { provider: 'supabase', user });
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

  'GET /admin/talent': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const profiles = await loadTalentProfiles(req, { usePending: true });
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
    const titlesUpdate = body.titles; // Optional array of titles
    const clearTriage = body.clearTriage; // Optional boolean to clear manual triage

    if (!isUuid(professionalId)) {
      sendError(res, 400, 'A valid professionalId is required.');
      return;
    }

    if (!status && !hasCredentialReview && !titlesUpdate && clearTriage === undefined) {
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

    if (hasCredentialReview) {
      let reviewResult;

      try {
        reviewResult = applyCredentialReview(existingProfile, credentialReview, user.id);
      } catch (error) {
        sendError(res, 400, error.message || 'Unable to review this document.');
        return;
      }

      const rows = await patchRows(
        req,
        `/professional_profiles?user_id=eq.${professionalId}`,
        reviewResult.payload
      );
      const saved = asList(rows)[0];

      if (!saved) {
        sendError(res, 404, 'Talent profile not found.');
        return;
      }

      const owners = await loadProfilesById(req, [professionalId]);
      const owner = owners.get(professionalId) || {};
      const mappedProfile = mapTalentProfile(saved, owner, { usePending: true });

      if (reviewResult.credential.status === 'rejected') {
        notifyUser({
          actionUrl: '/?tab=profile',
          body: `${reviewResult.credential.label || reviewResult.credential.fileName || 'A submitted document'} was rejected. ${reviewResult.credential.rejectionReason}`,
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
      } else if (reviewResult.reviewKind === 'change_request') {
        const approved = reviewResult.credential.changeRequestStatus === 'approved';
        notifyUser({
          actionUrl: '/?tab=profile',
          body: approved
            ? `${reviewResult.credential.label || reviewResult.credential.fileName || 'Your document'} change request was approved. You can now remove and upload a replacement.`
            : `${reviewResult.credential.label || reviewResult.credential.fileName || 'Your document'} change request was rejected.`,
          emailSubject: 'PB Finance document change request reviewed',
          metadata: {
            credentialId: reviewResult.credential.id,
            documentKey: reviewResult.credential.key,
            professionalId,
            status: reviewResult.credential.changeRequestStatus,
          },
          recipientEmail: owner.email,
          recipientId: professionalId,
          recipientName: owner.full_name,
          title: approved ? 'Document change approved' : 'Document change rejected',
          type: 'document_status_updated',
        }).catch(() => {});
      }

      sendJson(res, 200, mappedProfile);
      return;
    }

    if (status === 'approved') {
      const approvalBlocker = getCredentialApprovalBlocker(existingProfile);

      if (approvalBlocker) {
        sendError(res, 400, approvalBlocker);
        return;
      }
    }

    let payload = {
      ...(status ? { status } : {}),
      ...(status === 'approved' ? { published_at: new Date().toISOString() } : {}),
      ...(titlesUpdate ? { titles: titlesUpdate } : {}),
      ...(clearTriage ? { manualTriageRequired: false, manualTriageReason: null, manualTriageDomain: null } : {})
    };

    if (status === 'approved' && hasPendingChanges) {
      const pendingTitles = cleanProfessionalTitles(pendingProfile.titles ?? pendingProfile.title);

      await patchRows(req, `/profiles?id=eq.${professionalId}`, {
        ...(pendingProfile.full_name ? { full_name: pendingProfile.full_name } : {}),
        ...(Object.hasOwn(pendingProfile, 'titles') || Object.hasOwn(pendingProfile, 'title')
          ? { title: pendingTitles[0] || null }
          : {}),
      }, { prefer: 'return=minimal' });

      payload = {
        ...toProfilePatch(pendingProfile, existingProfile),
        pending_profile: {},
        published_at: new Date().toISOString(),
        review_status: null,
        review_submitted_at: null,
        status: 'approved',
      };
    } else if (status === 'rejected' && existingProfile.status === 'approved' && hasPendingChanges) {
      payload = {
        review_status: 'rejected',
      };
    } else if (status === 'pending_review' && existingProfile.status === 'approved' && hasPendingChanges) {
      payload = {
        review_status: 'pending_review',
      };
    } else if (['hidden', 'rejected'].includes(status)) {
      payload = {
        pending_profile: {},
        review_status: null,
        review_submitted_at: null,
        status,
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

    const owners = await loadProfilesById(req, [professionalId]);
    const owner = owners.get(professionalId) || {};
    const mappedProfile = mapTalentProfile(saved, owner, { usePending: true });

    if (['approved', 'rejected'].includes(status)) {
      notifyUser({
        actionUrl: '/?tab=profile',
        body: status === 'approved'
          ? 'Your professional profile has been approved and is now visible in the client talent directory.'
          : 'Your professional profile was not approved yet. Update your profile and submit it again when ready.',
        emailSubject: `PB Finance profile ${formatStatusLabel(status)}`,
        metadata: {
          professionalId,
          status,
        },
        recipientEmail: owner.email,
        recipientId: professionalId,
        recipientName: owner.full_name,
        title: `Profile ${formatStatusLabel(status)}`,
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
    const user = await requireSession(req, res);
    if (!user) return;

    const agencies = await readRows(
      req,
      '/agencies?status=eq.approved&select=*&order=updated_at.desc&limit=100'
    );

    sendJson(res, 200, asList(agencies).map(mapAgency));
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
    const owners = await loadProfilesById(req, rows.map((interview) => interview.professional_id));

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
      loadTalentProfiles(req, { ids: professionalIds }),
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
    const professionalProfile = await getProfessionalProfile(req, professionalId, { requireApproved: true });

    if (!professionalProfile) {
      sendError(res, 404, 'Approved talent profile not found.');
      return;
    }

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

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);
    const professionalProfile = await getProfessionalProfile(req, professionalId, { requireApproved: true });

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

    const owners = await loadProfilesById(req, [professionalId]);
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

    const owners = await loadProfilesById(req, [interview.professional_id]);
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

    const body = await readJson(req);
    const message = String(body.message || '').trim();

    if (!message) {
      sendError(res, 400, 'Tell the matchmaker what you need.');
      return;
    }

    const [talent, agencyRows] = await Promise.all([
      loadTalentProfiles(req, { onlyApproved: true }),
      readRows(req, '/agencies?status=eq.approved&select=*&order=updated_at.desc&limit=100'),
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
      message,
      result_count: matches.length,
    }, { prefer: 'return=minimal' }).catch(() => {});

    sendJson(res, 200, {
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
      const upload = await uploadCredentialFile({ body, userId: user.id });

      sendJson(res, 201, upload);
    } catch (error) {
      sendError(res, 400, error.message || 'Unable to upload this file.');
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
      ? mapTalentProfile(professionalProfile, {
        email: user.email,
        full_name: user.name,
        title: user.title,
      }, { usePending: true })
      : user);
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
    const workPreferences = cleanWorkPreferences(
      body.workPreferences ?? body.work_preferences ?? currentProfileView.work_preferences,
      currentProfile?.work_preferences
    );

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
      const submissionProfile = {
        ...(currentProfile || {}),
        pending_profile: currentProfile?.status === 'approved' ? profilePayload : {},
        ...toProfilePatch(profilePayload, currentProfile || {}),
        work_preferences: workPreferences,
      };
      const submissionBlocker = getCredentialSubmissionBlocker(submissionProfile);

      if (submissionBlocker) {
        sendError(res, 400, submissionBlocker);
        return;
      }
    }
    
    let manualTriageRequired = currentProfile?.manualTriageRequired;
    let manualTriageReason = currentProfile?.manualTriageReason;
    let manualTriageDomain = currentProfile?.manualTriageDomain;

    if (titles.includes('Certified Public Accountant')) {
      manualTriageRequired = true;
      manualTriageReason = 'PRC License Verification Required (https://online.prc.gov.ph/Verification)';
      manualTriageDomain = 'Credentials';
    }
    let rows;

    if (currentProfile?.status === 'approved') {
      rows = await patchRows(
        req,
        `/professional_profiles?user_id=eq.${user.id}`,
        {
          pending_profile: profilePayload,
          ...(submitForReview ? {
            review_status: 'pending_review',
            review_submitted_at: new Date().toISOString(),
          } : {}),
        }
      );
    } else {
      await patchRows(req, `/profiles?id=eq.${user.id}`, {
        full_name: fullName,
        title: primaryTitle || null,
      }, { prefer: 'return=minimal' });

      rows = await writeRows(
        req,
        '/professional_profiles?on_conflict=user_id',
        {
          ...toProfilePatch(profilePayload),
          pending_profile: {},
          review_status: null,
          review_submitted_at: submitForReview ? new Date().toISOString() : null,
          status: submitForReview ? 'pending_review' : (currentProfile?.status || 'draft'),
          user_id: user.id,
          manualTriageRequired,
          manualTriageReason,
          manualTriageDomain,
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
    }

    sendJson(res, 200, mapTalentProfile(savedProfile, {
      email: user.email,
      full_name: fullName,
      title: primaryTitle,
    }, { usePending: true }));
  },

  'GET /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const opportunities = await readRows(
      req,
      `/opportunities?professional_id=eq.${user.id}&status=neq.closed&select=*&order=received_at.desc&limit=50`
    );
    const opportunityRows = asList(opportunities);
    const clientProfiles = await loadProfilesById(
      req,
      opportunityRows.map((opportunity) => opportunity.client_id)
    );
    const opportunityIds = opportunityRows.map((opportunity) => opportunity.id);
    const interviewRows = opportunityIds.length
      ? await readRows(
        req,
        `/interviews?opportunity_id=${byIdFilter(opportunityIds)}&professional_id=eq.${user.id}&professional_hidden_at=is.null&select=*&limit=100`
      )
      : [];
    const interviewsByOpportunity = new Map(asList(interviewRows).map((interview) => [interview.opportunity_id, interview]));

    sendJson(res, 200, opportunityRows.map((opportunity) => {
      const client = clientProfiles.get(opportunity.client_id) || {};
      const interview = interviewsByOpportunity.get(opportunity.id) || {};
      const effectiveStatus = interview.status === 'cancelled' ? 'cancelled' : opportunity.status;

      const scheduledParts = getMonthDay(interview.scheduled_for);
      const interviewSchedule = interview.scheduled_for
        ? `${formatDate(interview.scheduled_for)} at ${scheduledParts.time}`
        : opportunity.schedule;

      return {
        cancellationReason: interview.cancellation_reason,
        cancelledAt: interview.cancelled_at,
        cancelledBy: interview.cancelled_by,
        clientName: opportunity.company_name || client.company || client.full_name,
        company: opportunity.company_name || client.company || client.full_name,
        date: formatDate(opportunity.received_at),
        description: opportunity.description,
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
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&select=*&limit=1`
    );

    const opportunity = asList(existing)[0];

    if (!opportunity) {
      sendError(res, 404, 'Opportunity not found.');
      return;
    }

    const interviewRows = await readRows(
      req,
      `/interviews?opportunity_id=eq.${opportunityId}&professional_id=eq.${user.id}&select=*&limit=1`
    );
    const interview = asList(interviewRows)[0];

    if (opportunity.status !== 'invited' || !['requesting', 'requested'].includes(interview?.status)) {
      sendError(res, 409, 'This interview request is no longer available.');
      return;
    }

    const rows = await patchRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&status=eq.invited`,
      { status }
    );

    if (!asList(rows)[0]) {
      sendError(res, 409, 'This interview request is no longer available.');
      return;
    }

    await patchRows(
      req,
      `/interviews?id=eq.${interview.id}&professional_id=eq.${user.id}&status=in.(requesting,requested)`,
      { status: status === 'accepted' ? 'scheduled' : 'cancelled' },
      { prefer: 'return=minimal' }
    ).catch(() => {});

    const clientProfiles = await loadProfilesById(req, [opportunity.client_id]);
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

    sendJson(res, 200, asList(rows)[0] || { ok: true, status });
  },

  'DELETE /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const body = await readJson(req);
    const opportunityId = cleanString(body.id || body.opportunityId || body.opportunity_id, 80);

    if (!isUuid(opportunityId)) {
      sendError(res, 400, 'A valid opportunity id is required.');
      return;
    }

    const existing = await readRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&status=in.(declined,cancelled)&select=*&limit=1`
    );

    if (!asList(existing)[0]) {
      sendError(res, 404, 'Removable opportunity not found.');
      return;
    }

    await patchRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}`,
      { status: 'closed' },
      { prefer: 'return=minimal' }
    );

    await patchRows(
      req,
      `/interviews?opportunity_id=eq.${opportunityId}&professional_id=eq.${user.id}`,
      { professional_hidden_at: new Date().toISOString() },
      { prefer: 'return=minimal' }
    ).catch(() => {});

    sendJson(res, 200, { ok: true });
  },

  'PATCH /talent/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

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

    const clientProfiles = await loadProfilesById(req, [interview.client_id]);
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

    sendJson(res, 200, interview);
  },

  'GET /talent/profiles': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const profiles = await loadTalentProfiles(req, { onlyApproved: true });
    sendJson(res, 200, profiles);
  },

  'POST /documents/url': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    try {
      const body = await readJson(req);
      const professionalId = cleanString(body.professionalId || body.professional_id || user.id, 80);

      if (!isUuid(professionalId)) {
        sendError(res, 400, 'A valid professional id is required.');
        return;
      }

      if (user.role !== 'admin' && professionalId !== user.id) {
        sendError(res, 403, 'You do not have access to this document.');
        return;
      }

      if (user.role === 'admin') {
        req.useServiceRole = true;
      }

      const profile = await getProfessionalProfile(req, professionalId);
      const document = profile ? findCredentialRecord(profile, {
        documentKey: body.documentKey || body.key || body.id,
        documentType: body.documentType || body.kind,
        path: body.path,
      }) : null;

      if (!document?.path) {
        sendError(res, 404, 'Document not found.');
        return;
      }

      sendJson(res, 200, {
        contentType: document.contentType,
        fileName: document.fileName,
        url: await getSupabaseStorageSignedUrl(document.path),
      });
    } catch (error) {
      sendError(res, 400, error.message || 'Unable to open this document.');
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
    const { pendingProfile, usePendingProfile, workPreferences } = getReviewableWorkPreferences(currentProfile || {});
    const targetType = cleanString(body.documentType || body.targetType || body.kind, 80);
    const targetKey = cleanString(body.documentKey || body.key || body.id || body.documentName, 180);
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
    
    sendJson(res, 200, mapTalentProfile(savedProfile, {
      email: user.email,
      full_name: user.name,
      title: user.title,
    }, { usePending: true }));
  },

  'POST /admin/check-expirations': async (req, res) => {
    // Scheduled endpoint to run daily
    const profiles = await loadTalentProfiles(req, { onlyApproved: true });
    const now = new Date();
    const notificationThresholds = [60, 30, 7];
    
    for (const profile of profiles) {
      if (profile.status !== 'approved') continue;
      
      const docs = [profile.resume, ...asList(profile.supportingDocuments)].filter(Boolean);
      let isExpired = false;
      
      for (const doc of docs) {
        if (!doc.expiryDate) continue;
        const expiry = new Date(doc.expiryDate);
        if (isNaN(expiry.getTime())) continue;
        
        const daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        
        if (daysToExpiry <= 0) {
           isExpired = true;
           notifyUser({
             actionUrl: '/?tab=profile',
             body: `Your verified document "${doc.label || doc.fileName}" has expired. Your profile verification status has been downgraded.`,
             emailSubject: `Document Expired: ${doc.label || doc.fileName}`,
             recipientEmail: profile.email,
             recipientId: profile.id,
             recipientName: profile.full_name,
             title: 'Document Expired',
             type: 'document_expired',
           }).catch(() => {});
        } else if (notificationThresholds.includes(daysToExpiry)) {
           notifyUser({
             actionUrl: '/?tab=profile',
             body: `Your verified document "${doc.label || doc.fileName}" will expire in ${daysToExpiry} days. Please upload a renewal to maintain your verified status.`,
             emailSubject: `Document Expiring Soon: ${doc.label || doc.fileName}`,
             recipientEmail: profile.email,
             recipientId: profile.id,
             recipientName: profile.full_name,
             title: 'Document Expiring Soon',
             type: 'document_expiring',
           }).catch(() => {});
        }
      }
      
      if (isExpired) {
        // Downgrade status if not already pending
        await patchRows(req, `/professional_profiles?user_id=eq.${profile.id}`, { status: 'pending_review' }, { useServiceRole: true });
      }
    }
    
    sendJson(res, 200, { ok: true, message: 'Expiration checks completed.' });
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
