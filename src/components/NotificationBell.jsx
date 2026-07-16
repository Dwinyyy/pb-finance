import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

import { useNotifications } from '../hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';

export function NotificationBell({ notificationState, unreadClassName = 'bg-action', userId }) {
  const internalNotificationState = useNotifications(userId, { enabled: !notificationState });
  const { unreadCount } = notificationState || internalNotificationState;
  const [isOpen, setIsOpen] = useState(false);
  const disclosureRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const handlePointerDown = (event) => {
      if (!disclosureRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={disclosureRef} className="relative flex h-11 w-11 items-center justify-center">
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Notifications"
        aria-describedby={unreadCount > 0 ? 'standalone-notification-unread-count' : undefined}
        aria-expanded={isOpen}
        aria-controls="standalone-notification-panel"
        title="Notifications"
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <>
            <span
              aria-hidden="true"
              className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black leading-none text-white ${unreadClassName}`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            <span id="standalone-notification-unread-count" className="sr-only">
              {unreadCount} unread notifications
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div
          id="standalone-notification-panel"
          className="absolute right-0 top-11 z-[80] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-border-subtle bg-surface shadow-modal"
        >
          <NotificationPanel
            notificationState={notificationState || internalNotificationState}
            onRequestClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
