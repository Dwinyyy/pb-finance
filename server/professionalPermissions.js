const PROFESSIONAL_TIERS = new Set(['unverified', 'verified']);
const PROFESSIONAL_PERMISSION_SELECT = [
  'tier',
  'label',
  'can_access_dashboard',
  'can_appear_in_talent_pool',
  'can_view_full_client_profiles',
  'can_comment_on_job_posts',
  'can_contact_clients_from_jobs',
  'can_toggle_profile_visibility',
].join(',');
const PROFESSIONAL_PERMISSION_FIELDS = [
  ['canAccessDashboard', 'can_access_dashboard'],
  ['canAppearInTalentPool', 'can_appear_in_talent_pool'],
  ['canCommentOnJobPosts', 'can_comment_on_job_posts'],
  ['canContactClientsFromJobs', 'can_contact_clients_from_jobs'],
  ['canToggleProfileVisibility', 'can_toggle_profile_visibility'],
  ['canViewFullClientProfiles', 'can_view_full_client_profiles'],
];
const PROFESSIONAL_TIER_LABELS = {
  unverified: 'Unverified',
  verified: 'Verified',
};

export const normalizeProfessionalTier = (value) => {
  const tier = String(value || '').trim().toLowerCase();

  return PROFESSIONAL_TIERS.has(tier) ? tier : 'unverified';
};

export const getProfessionalTierFromProfile = (profile) => (
  profile?.professional_tier === 'verified'
    && profile?.status === 'approved'
    && profile?.identity_verification_status === 'approved'
    ? 'verified'
    : 'unverified'
);

export const mapProfessionalTierPermissions = (tierValue, row) => {
  const tier = normalizeProfessionalTier(tierValue);
  const rowTier = String(row?.tier || '').trim().toLowerCase();
  const configuredRow = rowTier === tier ? row : null;
  const permissions = Object.fromEntries(PROFESSIONAL_PERMISSION_FIELDS.map(([camelName, snakeName]) => [
    camelName,
    configuredRow
      ? (Object.hasOwn(configuredRow, snakeName)
        ? configuredRow[snakeName] === true
        : configuredRow[camelName] === true)
      : false,
  ]));

  return {
    ...permissions,
    label: String(configuredRow?.label || '').trim() || PROFESSIONAL_TIER_LABELS[tier],
    tier,
  };
};

export const loadProfessionalTierPermissions = async (tierValue, requestRows) => {
  const tier = normalizeProfessionalTier(tierValue);

  try {
    const rows = await requestRows(
      `/professional_tier_permissions?tier=eq.${tier}&select=${PROFESSIONAL_PERMISSION_SELECT}&limit=1`
    );

    return mapProfessionalTierPermissions(tier, Array.isArray(rows) ? rows[0] : null);
  } catch {
    return mapProfessionalTierPermissions(tier, null);
  }
};
