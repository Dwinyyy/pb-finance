import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Bell,
  BookOpen,
  LogOut,
  Moon,
  Sparkles,
  Sun,
  UserRound,
} from 'lucide-react';

import {
  ACCOUNT_MENU_CLOSE_DELAY_MS,
  createDashboardAccountMenuState,
  dashboardAccountMenuReducer,
  isDashboardAccountMenuOpen,
  shouldUseHoverPreview,
} from './dashboardAccountMenuState';
import { NotificationPanel } from './NotificationPanel';

const ACCOUNT_MENU_WIDTH_CLASS = 'w-[min(286px,calc(100vw-36px))]';
const hoverQuery = '(hover: hover) and (pointer: fine)';

const ACTION_STRUCTURE_CLASS = 'flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 motion-reduce:transition-none';
const ACTION_TONE_CLASS = 'text-text-primary hover:bg-surface-muted';
const DANGER_ACTION_TONE_CLASS = 'bg-danger-surface text-danger hover:bg-danger-surface/80';

const getInitials = (name) => {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'A';
};

export function DashboardAccountMenu({
  accountTypeLabel,
  avatarUrl,
  companyOrContext,
  isDarkMode,
  matchmakerAction = null,
  name,
  notificationState,
  onGuide,
  onLogout,
  onNotificationOpened,
  onProfile,
  onThemeToggle,
  role,
}) {
  const [state, dispatch] = useReducer(
    dashboardAccountMenuReducer,
    undefined,
    createDashboardAccountMenuState,
  );
  const [panelTop, setPanelTop] = useState(null);
  const prefersReducedMotion = useReducedMotion();
  const generatedId = useId();
  const panelId = `${generatedId}-dashboard-account-panel`;
  const unreadDescriptionId = `${generatedId}-dashboard-account-unread`;
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const escapeFrameRef = useRef(null);
  const guideFrameRef = useRef(null);
  const suppressFocusOpenRef = useRef(false);
  const preserveGuideInteractionRef = useRef(false);
  const isOpen = isDashboardAccountMenuOpen(state);
  const unreadCount = Number(notificationState?.unreadCount) || 0;
  const motionClass = prefersReducedMotion
    ? 'transition-none'
    : 'duration-200 ease-pb-fluid';

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const updatePanelTop = useCallback(() => {
    const triggerBottom = triggerRef.current?.getBoundingClientRect().bottom;
    if (Number.isFinite(triggerBottom)) setPanelTop(Math.round(triggerBottom));
  }, []);

  const scheduleHoverClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      dispatch({ type: 'hover-close-expired' });
    }, ACCOUNT_MENU_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handlePointerEnter = (event) => {
    clearCloseTimer();
    updatePanelTop();
    const hoverCapable = window.matchMedia(hoverQuery).matches;

    if (shouldUseHoverPreview({ hoverCapable, pointerType: event.pointerType })) {
      dispatch({ type: 'hover-enter' });
    }
  };

  const handleFocusCapture = () => {
    if (suppressFocusOpenRef.current) return;

    updatePanelTop();

    if (preserveGuideInteractionRef.current) {
      preserveGuideInteractionRef.current = false;
      if (guideFrameRef.current !== null) {
        window.cancelAnimationFrame(guideFrameRef.current);
        guideFrameRef.current = null;
      }
    }

    dispatch({ type: 'focus-enter' });
  };

  const handleBlurCapture = (event) => {
    if (wrapperRef.current?.contains(event.relatedTarget)) return;
    if (preserveGuideInteractionRef.current) return;
    dispatch({ type: 'focus-leave' });
  };

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    if (escapeFrameRef.current !== null) window.cancelAnimationFrame(escapeFrameRef.current);
    if (guideFrameRef.current !== null) window.cancelAnimationFrame(guideFrameRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    window.addEventListener('resize', updatePanelTop);
    window.addEventListener('scroll', updatePanelTop, true);

    return () => {
      window.removeEventListener('resize', updatePanelTop);
      window.removeEventListener('scroll', updatePanelTop, true);
    };
  }, [isOpen, updatePanelTop]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleDocumentPointerDown = (event) => {
      if (preserveGuideInteractionRef.current) return;
      if (!wrapperRef.current?.contains(event.target)) dispatch({ type: 'dismiss' });
    };

    const handleDocumentKeyDown = (event) => {
      if (event.key !== 'Escape' || preserveGuideInteractionRef.current) return;
      event.preventDefault();
      suppressFocusOpenRef.current = true;
      dispatch({ type: 'dismiss' });
      triggerRef.current?.focus();
      escapeFrameRef.current = window.requestAnimationFrame(() => {
        suppressFocusOpenRef.current = false;
        escapeFrameRef.current = null;
      });
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [isOpen]);

  const dismissThen = (callback) => {
    dispatch({ type: 'dismiss' });
    callback?.();
  };

  const handleTriggerClick = () => {
    updatePanelTop();
    dispatch({ type: 'toggle-pin' });
  };

  const openGuide = () => {
    preserveGuideInteractionRef.current = true;
    if (!state.pinned) dispatch({ type: 'toggle-pin' });
    onGuide?.();

    guideFrameRef.current = window.requestAnimationFrame(() => {
      if (!document.querySelector('[role="dialog"][aria-modal="true"]')) {
        preserveGuideInteractionRef.current = false;
      }
      guideFrameRef.current = null;
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="relative flex justify-end"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={scheduleHoverClose}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${isOpen ? 'Close' : 'Open'} account menu for ${name}`}
        aria-describedby={unreadCount > 0 ? unreadDescriptionId : undefined}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={handleTriggerClick}
        className={`relative flex min-h-11 min-w-11 items-center justify-start overflow-hidden rounded-full border bg-surface text-text-primary transition-[width,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 motion-reduce:transition-none ${motionClass} ${
          isOpen
            ? `${ACCOUNT_MENU_WIDTH_CLASS} border-focus shadow-modal ring-4 ring-focus/20`
            : 'w-11 border-border-subtle shadow-card hover:border-focus hover:ring-4 hover:ring-focus/15'
        }`}
      >
        <span className="relative size-11 shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${name} profile`}
              className="size-11 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-action text-sm font-black text-white"
            >{getInitials(name)}</span>
          )}

          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-black leading-none text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>

        {isOpen && (
          <span className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-text-primary">{name}</span>
              <span className="block truncate text-xs text-text-muted">{companyOrContext}</span>
            </span>
            <span className="max-w-24 truncate rounded-full border border-border-subtle bg-surface-muted px-2 py-1 text-[10px] font-black text-text-muted">
              {accountTypeLabel}
            </span>
          </span>
        )}

        {unreadCount > 0 && (
          <span id={unreadDescriptionId} className="sr-only">
            {unreadCount} unread notifications
          </span>
        )}
      </button>

      {isOpen && panelTop !== null && (
        <div
          id={panelId}
          style={{ '--dashboard-account-panel-top': `${panelTop}px` }}
          className={`absolute right-0 top-full z-[90] pt-2 max-sm:fixed max-sm:right-[18px] max-sm:top-[var(--dashboard-account-panel-top)] ${ACCOUNT_MENU_WIDTH_CLASS}`}
        >
          <div className="max-h-[calc(100dvh-var(--dashboard-account-panel-top)-18px)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-card border border-border-subtle bg-surface text-text-primary shadow-modal">
            {state.view === 'notifications' ? (
              <NotificationPanel
                notificationState={notificationState}
                onBack={() => dispatch({ type: 'show-actions' })}
                onNotificationOpened={onNotificationOpened}
                onRequestClose={() => dispatch({ type: 'dismiss' })}
              />
            ) : (
              <section aria-label="Account actions" className="space-y-1 p-2">
                <button
                  type="button"
                  onClick={() => dismissThen(onProfile)}
                  className={`${ACTION_STRUCTURE_CLASS} ${ACTION_TONE_CLASS}`}
                >
                  <UserRound size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate">Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => dispatch({ type: 'show-notifications' })}
                  className={`${ACTION_STRUCTURE_CLASS} ${ACTION_TONE_CLASS}`}
                >
                  <Bell size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[10px] font-black text-white">
                      <span aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>
                      <span className="sr-only">{unreadCount} unread</span>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onThemeToggle}
                  className={`${ACTION_STRUCTURE_CLASS} ${ACTION_TONE_CLASS}`}
                >
                  {isDarkMode ? (
                    <Sun size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
                  ) : (
                    <Moon size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={openGuide}
                  className={`${ACTION_STRUCTURE_CLASS} ${ACTION_TONE_CLASS}`}
                >
                  <BookOpen size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate">
                    {role === 'client' ? 'Client guide' : 'Professional guide'}
                  </span>
                </button>

                {matchmakerAction && (
                  <button
                    type="button"
                    aria-pressed={matchmakerAction.pressed}
                    onClick={() => dismissThen(matchmakerAction.onToggle)}
                    className={`${ACTION_STRUCTURE_CLASS} ${ACTION_TONE_CLASS}`}
                  >
                    <Sparkles size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{matchmakerAction.label}</span>
                  </button>
                )}

                <div className="mt-2 border-t border-border-subtle pt-2">
                  <button
                    type="button"
                    onClick={() => dismissThen(onLogout)}
                    className={`${ACTION_STRUCTURE_CLASS} ${DANGER_ACTION_TONE_CLASS}`}
                  >
                    <LogOut size={18} aria-hidden="true" className="shrink-0" />
                    <span>Log out</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
