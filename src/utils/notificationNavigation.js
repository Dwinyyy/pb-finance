export const getNotificationNavigationTarget = (actionUrl, origin) => {
  const rawUrl = String(actionUrl || '').trim();
  const safeOrigin = String(origin || '').trim();

  if (!rawUrl || !safeOrigin) return { href: '', kind: 'none' };

  try {
    const url = new URL(rawUrl, safeOrigin);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { href: '', kind: 'none' };
    }

    if (url.origin === new URL(safeOrigin).origin) {
      return { href: `${url.pathname}${url.search}${url.hash}` || '/', kind: 'internal' };
    }

    return { href: url.href, kind: 'external' };
  } catch {
    return { href: '', kind: 'none' };
  }
};
