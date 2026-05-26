import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

import { backendApi, isBackendConfigured } from '../services/api';

const asList = (value) => (Array.isArray(value) ? value : []);

const formatTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
};

export function NotificationBell({ unreadClassName = 'bg-primary-500' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(isBackendConfigured());
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const loadNotifications = useCallback(async ({ showLoading = false } = {}) => {
    if (!isBackendConfigured()) {
      setIsLoading(false);
      return;
    }

    setError('');

    if (showLoading || notifications.length === 0) {
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
    } catch (loadError) {
      setError(loadError.message || 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [notifications.length]);

  useEffect(() => {
    loadNotifications({ showLoading: true });

    const interval = window.setInterval(() => loadNotifications(), 15000);
    const handleFocus = () => loadNotifications();

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadNotifications]);

  const markAllRead = async () => {
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
  };

  const markRead = async (notification) => {
    if (notification.isRead) return;

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
  };

  return (
    <div className="relative flex h-5 w-5 items-center justify-center">
      <button
        className="relative flex h-5 w-5 items-center justify-center text-slate-400 transition-colors hover:text-white"
        onClick={() => {
          setIsOpen((current) => {
            const next = !current;

            if (next) {
              loadNotifications();
            }

            return next;
          });
        }}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black leading-none text-white ${unreadClassName}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-9 z-[80] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <div className="text-sm font-black">Notifications</div>
              <div className="text-xs font-medium text-slate-500">{unreadCount} unread</div>
            </div>
            <button
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
              disabled={!unreadCount}
              onClick={markAllRead}
              title="Mark all read"
            >
              <CheckCheck size={17} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center gap-2 px-4 py-5 text-sm font-semibold text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading notifications
              </div>
            )}

            {!isLoading && error && (
              <div className="px-4 py-5 text-sm font-semibold text-red-600">{error}</div>
            )}

            {!isLoading && !error && notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No notifications yet.</div>
            )}

            {!isLoading && !error && notifications.map((notification) => (
              <button
                key={notification.id}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${notification.isRead ? '' : 'bg-cyan-50/60 dark:bg-cyan-950/20'}`}
                onClick={() => markRead(notification)}
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="text-sm font-black leading-snug text-slate-950 dark:text-white">{notification.title}</div>
                  <div className="shrink-0 text-[11px] font-bold text-slate-400">{formatTime(notification.createdAt)}</div>
                </div>
                <div className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{notification.body}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
