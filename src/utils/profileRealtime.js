const EMPTY_LIST = Object.freeze([]);

const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);

  return EMPTY_LIST;
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const hasMeaningfulPendingProfile = (pendingProfile) => (
  Object.entries(asRecord(pendingProfile)).some(([key, value]) => (
    key !== '__draftOnly'
    && value !== null
    && value !== undefined
    && !(Array.isArray(value) && value.length === 0)
    && !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
    && value !== ''
  ))
);

const hasOwn = (source, key) => Object.hasOwn(asRecord(source), key);

export const mergeRealtimeTalentProfile = (
  currentProfile,
  row,
  { includeDraftPending = false, usePending = true } = {}
) => {
  const current = asRecord(currentProfile);
  const profileRow = asRecord(row);

  if (!profileRow.user_id) return currentProfile;

  const pendingProfile = asRecord(profileRow.pending_profile);
  const hasDraftPending = pendingProfile.__draftOnly === true;
  const reviewStatus = profileRow.review_status || (profileRow.status === 'pending_review' ? 'pending_review' : null);
  const canShowPending = usePending && (
    includeDraftPending
    || (!hasDraftPending && (profileRow.review_status === 'pending_review' || profileRow.status === 'pending_review'))
  );
  const pending = canShowPending ? pendingProfile : {};
  const viewProfile = {
    ...profileRow,
    ...pending,
  };
  const canShowWorkPreferences = includeDraftPending || canShowPending || profileRow.status !== 'draft';
  const workPreferences = asRecord(canShowWorkPreferences ? viewProfile.work_preferences : {});
  const pendingHasTitles = hasOwn(pending, 'titles') || hasOwn(pending, 'title');
  const titles = pendingHasTitles
    ? asList(pending.titles ?? pending.title)
    : asList(viewProfile.titles ?? current.titles ?? current.title);
  const yearsExperience = toNumber(viewProfile.years_experience ?? current.yearsExperience);
  const hourlyRate = toNumber(viewProfile.hourly_rate ?? current.rate ?? current.hourlyRate);
  const title = titles.length ? titles.join(', ') : (current.title || current.role || '');
  const fullName = pending.full_name || current.fullName || current.name || 'Unnamed profile';

  return {
    ...current,
    available: viewProfile.availability || current.available || 'Immediate Start',
    availability: viewProfile.availability || current.availability || 'Immediate Start',
    bio: viewProfile.bio ?? current.bio ?? '',
    certifications: asList(viewProfile.certifications ?? current.certifications),
    exp: yearsExperience ? `${yearsExperience}+ yrs` : current.exp || '',
    experience: yearsExperience ? `${yearsExperience}+ years` : current.experience || '',
    externalLinks: asList(workPreferences.externalLinks),
    fullName,
    hasPendingChanges: hasMeaningfulPendingProfile(pendingProfile),
    id: profileRow.user_id,
    industries: asList(viewProfile.industries ?? current.industries),
    location: viewProfile.location || viewProfile.country || current.location || '',
    name: fullName,
    pendingDraftOnly: hasDraftPending,
    rate: hourlyRate,
    resume: workPreferences.resume || null,
    reviewCount: profileRow.review_count ?? current.reviewCount ?? 0,
    reviewStatus,
    role: title,
    skills: asList(viewProfile.skills ?? current.skills),
    status: usePending ? (reviewStatus || profileRow.status || current.status) : (profileRow.status || current.status),
    supportingDocuments: asList(workPreferences.supportingDocuments),
    title,
    titles,
    tools: asList(viewProfile.tools ?? current.tools),
    workPreferences,
    yearsExperience,
  };
};

export const mergeRealtimeTalentProfileList = (
  currentProfiles,
  row,
  options = {}
) => {
  const profiles = Array.isArray(currentProfiles) ? currentProfiles : EMPTY_LIST;
  const rowUserId = asRecord(row).user_id;

  if (!rowUserId) return currentProfiles;

  let matched = false;
  const nextProfiles = profiles.map((profile) => {
    if (profile?.id !== rowUserId) return profile;

    matched = true;
    return mergeRealtimeTalentProfile(profile, row, options);
  });

  return matched ? nextProfiles : currentProfiles;
};
