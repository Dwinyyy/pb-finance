const SESSION_FIELD_ALIASES = Object.freeze({
  name: Object.freeze(['name', 'fullName', 'full_name']),
  company: Object.freeze(['company']),
  avatarUrl: Object.freeze(['avatarUrl', 'avatar_url']),
  title: Object.freeze(['title']),
  clientTier: Object.freeze(['clientTier', 'client_tier']),
  clientTierLabel: Object.freeze(['clientTierLabel', 'client_tier_label']),
  clientPermissions: Object.freeze(['clientPermissions', 'client_permissions']),
  professionalTier: Object.freeze(['professionalTier', 'professional_tier']),
  professionalTierLabel: Object.freeze(['professionalTierLabel', 'professional_tier_label']),
  professionalPermissions: Object.freeze(['professionalPermissions', 'professional_permissions']),
  profileVisibility: Object.freeze(['profileVisibility', 'profile_visibility']),
});

const CLIENT_PERMISSION_FIELDS = Object.freeze([
  'canDiscoverAgencies',
  'canScheduleInterviews',
  'canUseMatchmaker',
  'canViewFullDocuments',
  'label',
  'matchmakerLevel',
  'shortlistLimit',
  'tier',
]);

const PROFESSIONAL_PERMISSION_FIELDS = Object.freeze([
  'canAccessDashboard',
  'canAppearInTalentPool',
  'canCommentOnJobPosts',
  'canContactClientsFromJobs',
  'canToggleProfileVisibility',
  'canViewFullClientProfiles',
  'label',
  'tier',
]);

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const firstOwnEntry = (source, aliases) => {
  for (const alias of aliases) {
    if (Object.hasOwn(source, alias) && source[alias] !== undefined) {
      return { found: true, value: source[alias] };
    }
  }

  return { found: false, value: undefined };
};

const pickOwnFields = (source, fields) => {
  if (!isRecord(source)) return {};

  return fields.reduce((picked, field) => {
    if (Object.hasOwn(source, field) && source[field] !== undefined) {
      picked[field] = source[field];
    }

    return picked;
  }, {});
};

export const normalizeSessionSummary = (summary) => {
  if (!isRecord(summary)) return {};

  const normalized = {};

  if (Object.hasOwn(summary, 'id') && summary.id !== undefined) {
    normalized.id = summary.id;
  }

  for (const [field, aliases] of Object.entries(SESSION_FIELD_ALIASES)) {
    const entry = firstOwnEntry(summary, aliases);

    if (!entry.found) continue;

    if (field === 'clientPermissions') {
      normalized[field] = pickOwnFields(entry.value, CLIENT_PERMISSION_FIELDS);
    } else if (field === 'professionalPermissions') {
      normalized[field] = pickOwnFields(entry.value, PROFESSIONAL_PERMISSION_FIELDS);
    } else {
      normalized[field] = entry.value;
    }
  }

  return normalized;
};

export const mergeSessionSummary = (currentUser, summary) => {
  if (!isRecord(currentUser)) return currentUser;

  const normalized = normalizeSessionSummary(summary);

  if (!normalized.id || normalized.id !== currentUser.id) {
    return currentUser;
  }

  const { id: _identityGuard, ...updates } = normalized;
  return { ...currentUser, ...updates };
};
