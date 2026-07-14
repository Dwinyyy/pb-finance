import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Loader2 } from 'lucide-react';

import { useNotifications } from '../hooks/useNotifications';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
} from '../services/pushNotifications';

const formatTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
};

const getNavigationTarget = (actionUrl) => {
  const rawUrl = String(actionUrl || '').trim();

  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl, window.location.origin);

    if (url.origin !== window.location.origin) {
      return url.href;
    }

    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  }
};

export function NotificationBell({ notificationState, unreadClassName = 'bg-primary-500', userId }) {
  const navigate = useNavigate();
  const internalNotificationState = useNotifications(userId, { enabled: !notificationState });
  const {
    error,
    isLoading,
    loadNotifications,
    markAllRead,
    markRead,
    notifications,
    unreadCount,
  } = notificationState || internalNotificationState;
  const [isOpen, setIsOpen] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushState, setPushState] = useState(null);

  const loadPushState = async () => {
    try {
      setPushState(await getPushNotificationState());
    } catch (pushError) {
      setPushMessage(pushError.message || 'Unable to check push notification settings.');
    }
  };

  const togglePushNotifications = async () => {
    setPushBusy(true);
    setPushMessage('');

    try {
      const nextState = pushState?.enabled
        ? await disablePushNotifications()
        : await enablePushNotifications();
      setPushState(nextState);
      setPushMessage(nextState.enabled ? 'Push alerts enabled.' : 'Push alerts disabled.');
    } catch (pushError) {
      setPushMessage(pushError.message || 'Unable to update push notification settings.');
    } finally {
      setPushBusy(false);
    }
  };

  const openNotification = (notification) => {
    markRead(notification);
    setIsOpen(false);

    const target = getNavigationTarget(notification.actionUrl);

    if (!target) return;

    if (/^https?:\/\//i.test(target)) {
      window.location.assign(target);
      return;
    }

    navigate(target);
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
              loadPushState();
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

          {pushState?.supported && pushState.configured && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200">
                    <BellRing size={14} />
                    Browser push alerts
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">
                    {pushState.enabled ? 'Enabled on this browser.' : 'Get compliance alerts even when PB Finance is closed.'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pushBusy || pushState.permission === 'denied'}
                  onClick={togglePushNotifications}
                  className="shrink-0 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-[11px] font-black text-cyan-700 transition-colors hover:bg-cyan-50 disabled:cursor-default disabled:opacity-50 dark:border-cyan-900/60 dark:bg-slate-900 dark:text-cyan-300"
                >
                  {pushBusy ? 'Saving...' : pushState.enabled ? 'Disable' : 'Enable push alerts'}
                </button>
              </div>
              {(pushMessage || pushState.permission === 'denied') && (
                <div className="mt-2 text-[11px] font-semibold text-slate-500">
                  {pushState.permission === 'denied'
                    ? 'Notifications are blocked in this browser. Update the site permission to enable them.'
                    : pushMessage}
                </div>
              )}
            </div>
          )}

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
                onClick={() => openNotification(notification)}
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
