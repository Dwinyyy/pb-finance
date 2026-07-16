import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BellRing, CheckCheck, Loader2 } from 'lucide-react';

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
} from '../services/pushNotifications';
import { getNotificationNavigationTarget } from '../utils/notificationNavigation';
import { Button } from './ui/Button';

const formatTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
};

export function NotificationPanel({
  notificationState,
  onBack = null,
  onNotificationOpened = null,
  onRequestClose,
}) {
  const navigate = useNavigate();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushState, setPushState] = useState(null);
  const {
    error,
    isLoading,
    loadNotifications,
    markAllRead,
    markRead,
    notifications,
    unreadCount,
  } = notificationState;

  useEffect(() => {
    loadNotifications({ showLoading: true });
    getPushNotificationState()
      .then(setPushState)
      .catch((error) => setPushMessage(error.message || 'Unable to check push notification settings.'));
  }, [loadNotifications]);

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

  const openNotification = async (notification) => {
    await markRead(notification);
    onNotificationOpened?.(notification);
    onRequestClose?.();

    const target = getNotificationNavigationTarget(notification.actionUrl, window.location.origin);

    if (target.kind === 'external') window.location.assign(target.href);
    if (target.kind === 'internal') navigate(target.href);
  };

  return (
    <section
      aria-labelledby="notification-panel-title"
      className="max-h-[min(32rem,calc(100dvh-8rem))] overflow-hidden bg-surface text-text-primary"
    >
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              onClick={onBack}
              aria-label="Back to account actions"
              className="size-11 shrink-0 p-0"
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </Button>
          )}
          <div>
            <h2 id="notification-panel-title" className="text-sm font-black">Notifications</h2>
            <p className="text-xs text-text-muted">{unreadCount} unread</p>
          </div>
        </div>
        <Button
          variant="ghost"
          disabled={!unreadCount}
          onClick={markAllRead}
          aria-label="Mark all notifications read"
          className="size-11 shrink-0 p-0"
        >
          <CheckCheck size={17} aria-hidden="true" />
        </Button>
      </header>

      {pushState?.supported && pushState.configured && (
        <div className="border-b border-border-subtle bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-text-primary">
                <BellRing size={14} aria-hidden="true" />
                Browser push alerts
              </div>
              <div className="mt-1 text-[11px] font-medium text-text-muted">
                {pushState.enabled
                  ? 'Enabled on this browser.'
                  : 'Get compliance alerts even when PB Finance is closed.'}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pushBusy || pushState.permission === 'denied'}
              onClick={togglePushNotifications}
              className="min-h-11 shrink-0 px-3 py-2 text-[11px] text-action"
            >
              {pushBusy ? 'Saving...' : pushState.enabled ? 'Disable' : 'Enable push alerts'}
            </Button>
          </div>
          {(pushMessage || pushState.permission === 'denied') && (
            <div
              className={`mt-2 text-[11px] font-semibold ${
                pushState.permission === 'denied' ? 'text-danger' : 'text-text-muted'
              }`}
            >
              {pushState.permission === 'denied'
                ? 'Notifications are blocked in this browser. Update the site permission to enable them.'
                : pushMessage}
            </div>
          )}
        </div>
      )}

      <div
        aria-live="polite"
        className="max-h-[min(27rem,calc(100dvh-13rem))] overflow-y-auto overscroll-contain"
      >
        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-5 text-sm font-semibold text-text-muted">
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            Loading notifications
          </div>
        )}

        {!isLoading && error && (
          <div role="alert" className="space-y-3 px-4 py-5 text-sm font-semibold text-danger">
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={() => loadNotifications({ showLoading: true })}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <p className="px-4 py-8 text-center text-sm font-semibold text-text-muted">No notifications yet.</p>
        )}

        {!isLoading && !error && notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => openNotification(notification)}
            className={`min-h-11 w-full border-b border-border-subtle px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-muted ${
              notification.isRead ? 'bg-surface' : 'bg-info-surface'
            }`}
          >
            <span className="mb-1 flex items-start justify-between gap-3">
              <span className="text-sm font-black leading-snug text-text-primary">{notification.title}</span>
              <span className="shrink-0 text-[11px] font-bold text-text-muted">
                {formatTime(notification.createdAt)}
              </span>
            </span>
            <span className="block text-xs font-medium leading-relaxed text-text-muted">{notification.body}</span>
            <span className="sr-only">{notification.isRead ? 'Read' : 'Unread'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
