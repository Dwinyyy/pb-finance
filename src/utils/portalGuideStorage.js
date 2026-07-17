export const PORTAL_GUIDE_VERSIONS = Object.freeze({
  client: 'v2',
  professional: 'v1',
});

export const getPortalGuideStorageKey = (role, user) => {
  const version = PORTAL_GUIDE_VERSIONS[role];
  const userId = String(user?.id || user?.email || '').trim();

  return version && userId
    ? `pb-finance:portal-guide:${role}:${encodeURIComponent(userId)}:${version}`
    : '';
};

export const shouldShowPortalGuide = (role, user, storage) => {
  const key = getPortalGuideStorageKey(role, user);
  if (!key || !storage) return true;

  try {
    return storage.getItem(key) !== 'seen';
  } catch {
    return true;
  }
};

export const markPortalGuideSeen = (role, user, storage) => {
  const key = getPortalGuideStorageKey(role, user);
  if (!key || !storage) return false;

  try {
    storage.setItem(key, 'seen');
    return true;
  } catch {
    return false;
  }
};
