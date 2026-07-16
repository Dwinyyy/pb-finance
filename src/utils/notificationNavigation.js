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

export const openNotificationSafely = async ({
  assign,
  markRead,
  navigate,
  notification,
  onNotificationOpened,
  onRequestClose,
  origin,
}) => {
  try {
    await markRead(notification);
  } catch {
    // Read tracking is best effort and must not trap the user in the panel.
  }

  try {
    await onNotificationOpened?.(notification);
  } catch {
    // Session refresh is best effort and must not block safe navigation.
  }

  onRequestClose?.();

  const target = getNotificationNavigationTarget(notification.actionUrl, origin);

  if (target.kind === 'external') assign(target.href);
  if (target.kind === 'internal') navigate(target.href);
};
