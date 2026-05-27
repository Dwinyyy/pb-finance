const asList = (value) => (Array.isArray(value) ? value : []);

const getActionUrlTab = (actionUrl) => {
  const rawUrl = String(actionUrl || '').trim();

  if (!rawUrl) return '';

  try {
    const baseUrl = typeof window === 'undefined' ? 'https://pbfinance.local' : window.location.origin;
    const url = new URL(rawUrl, baseUrl);

    return url.searchParams.get('tab') || '';
  } catch {
    return '';
  }
};

export const getNotificationTab = (notification, tabIds, fallbackByType = {}) => {
  const allowedTabs = new Set(asList(tabIds));
  const explicitTab = getActionUrlTab(notification?.actionUrl);
  const metadataTab = notification?.metadata?.tab;
  const fallbackTab = fallbackByType[notification?.type];

  if (allowedTabs.has(explicitTab)) return explicitTab;
  if (allowedTabs.has(metadataTab)) return metadataTab;
  if (allowedTabs.has(fallbackTab)) return fallbackTab;

  return '';
};

export const countUnreadNotificationsByTab = (notifications, tabIds, fallbackByType = {}) => (
  asList(notifications).reduce((counts, notification) => {
    if (notification.isRead) return counts;

    const tab = getNotificationTab(notification, tabIds, fallbackByType);

    if (!tab) return counts;

    return {
      ...counts,
      [tab]: (counts[tab] || 0) + 1,
    };
  }, {})
);

export const getUnreadNotificationsForTab = (notifications, activeTab, tabIds, fallbackByType = {}) => (
  asList(notifications).filter((notification) => (
    !notification.isRead
    && getNotificationTab(notification, tabIds, fallbackByType) === activeTab
  ))
);
