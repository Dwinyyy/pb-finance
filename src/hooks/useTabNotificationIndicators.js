import { useEffect, useMemo, useState } from 'react';

import { getNotificationTab } from '../utils/notificationRouting';

const EMPTY_LIST = Object.freeze([]);
const asList = (value) => (Array.isArray(value) ? value : EMPTY_LIST);

const readSeenIds = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeSeenIds = (storageKey, ids) => {
  if (!storageKey || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids.slice(-500)));
  } catch {
    // Page indicators should still work for the current session if storage is unavailable.
  }
};

export function useTabNotificationIndicators({
  activeTab,
  fallbackByType = {},
  notifications,
  storageKey,
  tabIds,
}) {
  const [seenIds, setSeenIds] = useState(() => readSeenIds(storageKey));

  useEffect(() => {
    setSeenIds(readSeenIds(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!activeTab) return;

    const activeUnreadIds = asList(notifications)
      .filter((notification) => (
        !notification.isRead
        && getNotificationTab(notification, tabIds, fallbackByType) === activeTab
      ))
      .map((notification) => notification.id)
      .filter(Boolean)
      .map(String);

    if (!activeUnreadIds.length) return;

    setSeenIds((current) => {
      const next = [...new Set([...current, ...activeUnreadIds])].slice(-500);

      if (next.length === current.length) return current;

      writeSeenIds(storageKey, next);
      return next;
    });
  }, [activeTab, fallbackByType, notifications, storageKey, tabIds]);

  return useMemo(() => {
    const seenSet = new Set(seenIds);

    return asList(notifications).reduce((counts, notification) => {
      if (notification.isRead || seenSet.has(String(notification.id))) return counts;

      const tab = getNotificationTab(notification, tabIds, fallbackByType);

      if (!tab) return counts;

      return {
        ...counts,
        [tab]: (counts[tab] || 0) + 1,
      };
    }, {});
  }, [fallbackByType, notifications, seenIds, tabIds]);
}
