import { useCallback, useEffect, useMemo, useState } from 'react';

import { backendApi, isBackendConfigured } from '../services/api';
import { isRealtimeConfigured, subscribeToDatabaseChanges } from '../services/realtime';

const EMPTY_LIST = Object.freeze([]);
const asList = (value) => (Array.isArray(value) ? value : EMPTY_LIST);

export function useNotifications(userId, { enabled = true } = {}) {
  const shouldLoad = enabled && Boolean(userId) && isBackendConfigured();
  const [isLoading, setIsLoading] = useState(shouldLoad);
  const [notifications, setNotifications] = useState(EMPTY_LIST);
  const [error, setError] = useState('');
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const loadNotifications = useCallback(async ({ showLoading = false } = {}) => {
    if (!shouldLoad) {
      setIsLoading(false);
      return EMPTY_LIST;
    }

    setError('');

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const latest = asList(await backendApi.notifications.list());
      setNotifications((current) => {
        const readIds = new Set(current.filter((notification) => notification.isRead).map((notification) => notification.id));

        return latest.map((notification) => (
          readIds.has(notification.id)
            ? { ...notification, isRead: true, readAt: notification.readAt || new Date().toISOString() }
            : notification
        ));
      });
      return latest;
    } catch (loadError) {
      setError(loadError.message || 'Unable to load notifications.');
      return EMPTY_LIST;
    } finally {
      setIsLoading(false);
    }
  }, [shouldLoad]);

  useEffect(() => {
    setNotifications(EMPTY_LIST);
    setError('');
    setIsLoading(shouldLoad);
  }, [shouldLoad, userId]);

  useEffect(() => {
    if (!shouldLoad) {
      return undefined;
    }

    loadNotifications({ showLoading: true });

    const interval = window.setInterval(() => loadNotifications(), 60000);
    const handleFocus = () => loadNotifications();

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadNotifications, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !isRealtimeConfigured()) {
      return undefined;
    }

    return subscribeToDatabaseChanges({
      channelName: `notifications:${userId}`,
      changes: [
        {
          filter: `recipient_id=eq.${userId}`,
          table: 'notifications',
        },
      ],
      onChange: () => loadNotifications(),
    });
  }, [loadNotifications, shouldLoad, userId]);

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);

    if (!unreadIds.length) return;

    setNotifications((current) => current.map((notification) => ({
      ...notification,
      isRead: true,
      readAt: notification.readAt || new Date().toISOString(),
    })));

    try {
      await backendApi.notifications.markAllRead();
    } catch {
      setNotifications((current) => current.map((notification) => (
        unreadIds.includes(notification.id)
          ? { ...notification, isRead: false, readAt: null }
          : notification
      )));
    }
  }, [notifications]);

  const markRead = useCallback(async (notification) => {
    if (!notification || notification.isRead) return;

    setNotifications((current) => current.map((item) => (
      item.id === notification.id
        ? { ...item, isRead: true, readAt: new Date().toISOString() }
        : item
    )));

    try {
      await backendApi.notifications.markRead({ id: notification.id });
    } catch {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id
          ? { ...item, isRead: false, readAt: null }
          : item
      )));
    }
  }, []);

  return {
    error,
    isLoading,
    loadNotifications,
    markAllRead,
    markRead,
    notifications,
    unreadCount,
  };
}
