import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, MapPin, Building, Star, Filter,
  CheckCircle, User, Briefcase,
  Menu, X, Calculator, PieChart, ShieldCheck,
  Mail, Lock, Sparkles, Layers3,
  BarChart3, BadgeCheck, Clock3, Handshake,
  Globe2, TrendingDown, ChevronDown, ChevronUp,
  Bookmark, MessageSquare, SlidersHorizontal,
  ChevronLeft, ChevronRight, FileText, Calendar, Video, Download, CreditCard, Receipt,
  DollarSign, Settings, Bot, Send, Loader2
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { ClientProfileDashboard } from '../components/ClientProfileDashboard';
import { ClientWorkflowOnboardingModal } from '../components/ClientWorkflowOnboardingModal';
import { DashboardAccountMenu } from '../components/DashboardAccountMenu';
import { EmptyState } from '../components/EmptyState';
import { BrandMark } from '../components/ui/BrandMark';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { useNotifications } from '../hooks/useNotifications';
import { useTabNotificationIndicators } from '../hooks/useTabNotificationIndicators';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useBackendResource } from '../hooks/useBackendResource';
import { backendApi, isBackendConfigured } from '../services/api';
import { AVAILABILITY_OPTIONS, SOFTWARE_OPTIONS, SKILLS_OPTIONS } from '../data/constants';
import {
  getPortalGuideStorageKey,
  markPortalGuideSeen,
  shouldShowPortalGuide,
} from '../utils/portalGuideStorage';

const EMPTY_LIST = Object.freeze([]);
const EMPTY_BILLING = Object.freeze({
  contracts: EMPTY_LIST,
  invoices: EMPTY_LIST,
  paymentMethods: EMPTY_LIST,
});
const SUCCESS_MESSAGE_TIMEOUT_MS = 2500;
const TALENT_SKILL_FILTERS = ['All', ...SKILLS_OPTIONS];
const CLIENT_ROUTE_TABS = ['discover', 'profile', 'agencies', 'shortlist', 'interviews', 'billing'];
const CLIENT_TIER_PERMISSIONS = Object.freeze({
  basic: Object.freeze({
    canDiscoverAgencies: false,
    canScheduleInterviews: false,
    canUseMatchmaker: false,
    canViewFullDocuments: false,
    label: 'Basic',
    matchmakerLevel: 'none',
    shortlistLimit: 5,
  }),
  verified: Object.freeze({
    canDiscoverAgencies: true,
    canScheduleInterviews: true,
    canUseMatchmaker: true,
    canViewFullDocuments: true,
    label: 'Verified',
    matchmakerLevel: 'basic',
    shortlistLimit: null,
  }),
  vip: Object.freeze({
    canDiscoverAgencies: true,
    canScheduleInterviews: true,
    canUseMatchmaker: true,
    canViewFullDocuments: true,
    label: 'VIP',
    matchmakerLevel: 'pro',
    shortlistLimit: null,
  }),
});
const CLIENT_NOTIFICATION_TAB_FALLBACKS = {
  client_verification_approved: 'profile',
  client_verification_rejected: 'profile',
  client_verification_reset: 'profile',
  interview_accepted: 'interviews',
  interview_cancelled: 'interviews',
  interview_declined: 'interviews',
  interview_requested: 'interviews',
};
const CLIENT_IDENTITY_NOTIFICATION_TYPES = new Set([
  'client_name_change_approved',
  'client_name_change_rejected',
  'client_verification_approved',
  'client_verification_rejected',
  'client_verification_reset',
]);

const asList = (value) => (Array.isArray(value) ? value : []);
const normalizeClientTier = (value) => {
  const tier = String(value || '').trim().toLowerCase();

  return Object.hasOwn(CLIENT_TIER_PERMISSIONS, tier) ? tier : 'basic';
};
const getClientPortalPermissions = (user) => ({
  ...CLIENT_TIER_PERMISSIONS[normalizeClientTier(user?.clientTier || user?.client_tier)],
  ...(user?.clientPermissions || {}),
  tier: normalizeClientTier(user?.clientTier || user?.client_tier || user?.clientPermissions?.tier),
});
const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString()}` : value || 'Pending');
const interviewStatusLabel = (status) => String(status === 'requested' ? 'requesting' : status || 'scheduled').replace(/_/g, ' ');
const interviewStatusStyles = {
  accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  contacted: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  declined: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  invited: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  requested: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  requesting: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  saved: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  scheduled: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
};
const padTimePart = (value) => String(value).padStart(2, '0');
const formatLocalDate = (date) => `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;
const formatLocalTime = (date) => `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
const isScheduleDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isScheduleTime = (value) => /^\d{2}:\d{2}$/.test(value);
const getScheduleDefault = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return {
    date: formatLocalDate(date),
    time: formatLocalTime(date),
  };
};
const combineScheduleDateTime = ({ date, time }) => {
  if (!isScheduleDate(date) || !isScheduleTime(time)) return '';

  const parsed = new Date(`${date}T${time}:00`);

  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString();
};



const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const scheduleTimeOptions = Array.from({ length: 23 }, (_, index) => {
  const hour = 8 + Math.floor(index / 2);
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${padTimePart(hour)}:${minutes}`;
});
function DocumentPreviewer({ url, type }) {
  const isImage = type?.includes('image') || url?.match(/\.(jpeg|jpg|gif|png)$/i);
  return (
    <div className="relative flex h-[600px] w-full select-none items-center justify-center overflow-hidden rounded-card border border-border-subtle bg-surface-muted">
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="verified-document-watermark">PB Finance - Verified Preview</div>
      </div>
      {isImage ? (
         <img src={url} alt="Document preview" className="max-w-full max-h-full object-contain" onContextMenu={(e) => e.preventDefault()} draggable={false} />
      ) : (
         <iframe src={`${url}#toolbar=0`} className="w-full h-full" title="Document preview" />
      )}
      {/* Invisible overlay for images to prevent drag/drop right click */}
      {isImage && <div className="absolute inset-0 z-20 bg-transparent" onContextMenu={(e) => e.preventDefault()} draggable={false}></div>}
    </div>
  );
}

const getDocumentKey = (document) => document?.key || document?.id || document?.label || document?.fileName || document?.documentType || '';

function ProfileQualificationsSection({ profile }) {
  const canViewFullDocuments = Boolean(profile?.canViewFullDocuments);
  const resume = profile?.resume || null;
  const supportingDocuments = asList(profile?.supportingDocuments);
  const [preview, setPreview] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPreview(null);
    setBusyKey('');
    setError('');
  }, [profile?.id]);

  const loadDocumentPreview = async (document, fallbackType = 'supporting_document') => {
    if (!profile?.id || !document) return;

    const documentKey = getDocumentKey(document);
    const documentType = document.documentType || document.kind || fallbackType;

    setError('');
    setBusyKey(`${documentType}:${documentKey}`);

    try {
      const result = await backendApi.documents.getUrl({
        documentKey,
        documentType,
        professionalId: profile.id,
      });

      setPreview({
        ...document,
        contentType: result?.contentType || document.contentType,
        fileName: result?.fileName || document.fileName || document.label || 'Document preview',
        url: result?.url,
      });
    } catch (previewError) {
      setError(previewError.message || 'Unable to open this document.');
    } finally {
      setBusyKey('');
    }
  };

  if (!canViewFullDocuments) {
    return (
      <div>
        <h4 className="mb-3 text-sm font-bold text-text-primary">Verified Qualifications & Resume</h4>
        <SurfaceCard as="div" tone="muted" className="p-4 text-sm font-semibold text-text-muted shadow-none">
          Resume and required documents are hidden for Basic clients.
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-3 text-sm font-bold text-text-primary">Verified Qualifications & Resume</h4>
      {error && (
        <div role="alert" className="mb-4 rounded-control border border-danger-border bg-danger-surface px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {resume ? (
          <SurfaceCard as="div" tone="muted" className="p-4 shadow-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black text-text-primary">{resume.label || resume.fileName || 'Verified resume'}</div>
                <div className="text-xs font-semibold text-text-muted">{resume.fileName || 'Approved resume document'}</div>
              </div>
              <Button
                type="button"
                onClick={() => loadDocumentPreview(resume, 'resume')}
                disabled={busyKey === `resume:${getDocumentKey(resume)}`}
                size="sm"
                className="min-h-11"
              >
                {busyKey === `resume:${getDocumentKey(resume)}` ? 'Opening...' : 'Preview Resume'}
              </Button>
            </div>
          </SurfaceCard>
        ) : (
          <SurfaceCard as="div" tone="muted" className="p-4 text-sm font-semibold text-text-muted shadow-none">
            No approved resume is available for this profile.
          </SurfaceCard>
        )}

        {supportingDocuments.length > 0 && (
          <SurfaceCard as="div" className="p-4 shadow-none">
            <div className="mb-3 text-xs font-black uppercase tracking-wider text-verified">Certificates & Required Documents</div>
            <div className="space-y-2">
              {supportingDocuments.map((document) => {
                const documentKey = getDocumentKey(document);
                const documentType = document.documentType || document.kind || 'supporting_document';
                const busy = busyKey === `${documentType}:${documentKey}`;

                return (
                  <div key={`${documentType}:${documentKey}`} className="flex flex-col gap-2 rounded-control border border-verified-border bg-verified-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-bold text-text-primary">{document.label || document.fileName || 'Verified document'}</div>
                      <div className="text-xs font-semibold text-text-muted">{document.fileName || document.kind || 'Approved credential'}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadDocumentPreview(document, documentType)}
                      disabled={busy}
                      className="min-h-11"
                    >
                      {busy ? 'Opening...' : 'View'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        )}

        {preview?.url && (
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-text-muted">{preview.fileName || 'Document preview'}</div>
            <DocumentPreviewer url={preview.url} type={preview.contentType || 'pdf'} />
          </div>
        )}
      </div>
    </div>
  );
}

function InterviewDateTimePicker({ value, onChange }) {
  const parsedDate = isScheduleDate(value.date) ? new Date(`${value.date}T00:00:00`) : new Date();
  const [viewDate, setViewDate] = useState(() => new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));

  const monthLabel = useMemo(
    () => viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [viewDate]
  );
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const blanks = Array.from({ length: firstDay.getDay() }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
    return [...blanks, ...days];
  }, [viewDate]);

  const updateDate = (date) => {
    onChange({ ...value, date });

    if (isScheduleDate(date)) {
      const nextDate = new Date(`${date}T00:00:00`);
      setViewDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  };

  const selectDay = (day) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    updateDate(formatLocalDate(selected));
  };

  const shiftMonth = (amount) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <SurfaceCard as="div" tone="muted" className="min-w-0 p-3 shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => shiftMonth(-1)} className="size-11 !p-0 text-text-muted" title="Previous month" aria-label="Previous month">
            <ChevronLeft size={17} aria-hidden="true" />
          </Button>
          <div className="text-sm font-black text-text-primary" aria-live="polite">{monthLabel}</div>
          <Button type="button" variant="ghost" size="sm" onClick={() => shiftMonth(1)} className="size-11 !p-0 text-text-muted" title="Next month" aria-label="Next month">
            <ChevronRight size={17} aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 overflow-x-auto pb-1 text-center">
          {weekdayLabels.map((day) => (
            <div key={day} className="min-w-11 py-1 text-[10px] font-black uppercase tracking-wider text-text-muted">{day}</div>
          ))}
          {calendarDays.map((day, index) => {
            const dayDate = day ? formatLocalDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day)) : '';
            const isSelected = dayDate && dayDate === value.date;

            return day ? (
              <button
                key={dayDate}
                type="button"
                onClick={() => selectDay(day)}
                aria-label={`${monthLabel} ${day}`}
                aria-pressed={isSelected}
                className={`size-11 rounded-control text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 ${
                  isSelected
                    ? 'bg-action text-white shadow-card'
                    : 'text-text-muted hover:bg-surface hover:text-text-primary'
                }`}
              >
                {day}
              </button>
            ) : (
              <div key={`blank-${index}`} className="size-11" aria-hidden="true" />
            );
          })}
        </div>
      </SurfaceCard>

      <div className="space-y-3">
        <label htmlFor="client-interview-time" className="block text-sm font-bold text-text-primary">
          Preferred time
          <select
            id="client-interview-time"
            value={scheduleTimeOptions.includes(value.time) ? value.time : ''}
            onChange={(event) => onChange({ ...value, time: event.target.value })}
            className="mt-2 min-h-11 w-full rounded-control border border-border-control bg-surface px-4 py-3 text-sm font-semibold text-text-primary outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
          >
            <option value="" disabled>Choose a time</option>
            {scheduleTimeOptions.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </label>
        <div aria-live="polite">
          <SurfaceCard as="div" className="px-4 py-3 text-sm font-semibold text-text-muted shadow-none">
            {value.date && value.time ? `${value.date} at ${value.time}` : 'Select a date and time'}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. CLIENT PORTAL (LOGGED IN EXPERIENCE)
// ==========================================
export function ClientPortal({
  user,
  onLogout,
  isDarkMode,
  toggleDarkMode,
  onUserUpdated = () => {},
  refreshSessionUser = () => {},
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'discover';
  const section = searchParams.get('section') === 'verification' ? 'verification' : 'account';
  const clientPermissions = useMemo(() => getClientPortalPermissions(user), [user]);
  const availableTabs = useMemo(() => (
    [
      { id: 'discover', label: 'Discover Talent' },
      ...(clientPermissions.canDiscoverAgencies ? [{ id: 'agencies', label: 'Discover Agencies' }] : []),
      { id: 'shortlist', label: 'My Shortlist' },
      ...(clientPermissions.canScheduleInterviews ? [{ id: 'interviews', label: 'Interviews' }] : []),
      ...(clientPermissions.canViewFullDocuments ? [{ id: 'billing', label: 'Billing & Contracts' }] : []),
    ]
  ), [clientPermissions.canDiscoverAgencies, clientPermissions.canScheduleInterviews, clientPermissions.canViewFullDocuments]);
  const availableTabIds = useMemo(() => availableTabs.map((tab) => tab.id), [availableTabs]);
  const routeTabIds = useMemo(() => [...availableTabIds, 'profile'], [availableTabIds]);
  const normalizedRequestedTab = requestedTab === 'verification' ? 'profile' : requestedTab;
  const appView = CLIENT_ROUTE_TABS.includes(normalizedRequestedTab) && routeTabIds.includes(normalizedRequestedTab)
    ? normalizedRequestedTab
    : 'discover';
  const setAppView = (tab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    if (tab !== 'profile') nextParams.delete('section');
    setSearchParams(nextParams);
  };
  const setProfileSection = (nextSection) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', 'profile');
    nextParams.set('section', nextSection === 'verification' ? 'verification' : 'account');
    setSearchParams(nextParams);
  };
  const [matchmakerVisible, setMatchmakerVisible] = useState(() => clientPermissions.canUseMatchmaker);
  const guideStorage = typeof window === 'undefined' ? null : window.localStorage;
  const guideStorageKey = getPortalGuideStorageKey('client', user);
  const initialWorkflowOnboarding = useMemo(
    () => shouldShowPortalGuide('client', user, guideStorage),
    [guideStorage, user],
  );
  const [workflowOnboardingState, setWorkflowOnboardingState] = useState(() => ({
    key: guideStorageKey,
    open: initialWorkflowOnboarding,
  }));
  const showWorkflowOnboarding = workflowOnboardingState.key === guideStorageKey
    ? workflowOnboardingState.open
    : initialWorkflowOnboarding;
  const setShowWorkflowOnboarding = useCallback((nextOpen) => {
    setWorkflowOnboardingState((current) => {
      const currentOpen = current.key === guideStorageKey ? current.open : initialWorkflowOnboarding;
      return {
        key: guideStorageKey,
        open: typeof nextOpen === 'function' ? nextOpen(currentOpen) : nextOpen,
      };
    });
  }, [guideStorageKey, initialWorkflowOnboarding]);
  const handleRealtimeNotification = useCallback((notification) => {
    if (CLIENT_IDENTITY_NOTIFICATION_TYPES.has(notification?.type)) {
      Promise.resolve(refreshSessionUser()).catch(() => {});
    }
  }, [refreshSessionUser]);
  const handleNotificationOpened = useCallback(async (notification) => {
    if (CLIENT_IDENTITY_NOTIFICATION_TYPES.has(notification?.type)) {
      await refreshSessionUser();
    }
  }, [refreshSessionUser]);
  const notificationState = useNotifications(user?.id, {
    onRealtimeNotification: handleRealtimeNotification,
  });
  const { notifications } = notificationState;
  const tabUnreadCounts = useTabNotificationIndicators({
    activeTab: appView,
    fallbackByType: CLIENT_NOTIFICATION_TAB_FALLBACKS,
    notifications,
    storageKey: `pb_client_page_notification_indicators:${user?.id || user?.email || 'unknown'}`,
    tabIds: routeTabIds,
  });

  useEffect(() => {
    if (requestedTab === 'verification') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'profile');
      nextParams.set('section', 'verification');
      setSearchParams(nextParams, { replace: true });
      return;
    }

    if (!CLIENT_ROUTE_TABS.includes(requestedTab) || !routeTabIds.includes(requestedTab)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'discover');
      nextParams.delete('section');
      setSearchParams(nextParams, { replace: true });
    }
  }, [requestedTab, routeTabIds, searchParams, setSearchParams]);

  const dismissWorkflowOnboarding = useCallback(() => {
    markPortalGuideSeen('client', user, guideStorage);
    setShowWorkflowOnboarding(false);
  }, [guideStorage, setShowWorkflowOnboarding, user]);

  const navigateFromGuide = useCallback((destination) => {
    if (!destination?.tab || !routeTabIds.includes(destination.tab)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', destination.tab);
    if (destination.tab === 'profile' && destination.section) {
      nextParams.set('section', destination.section);
    } else {
      nextParams.delete('section');
    }
    setSearchParams(nextParams);
    markPortalGuideSeen('client', user, guideStorage);
    setShowWorkflowOnboarding(false);
  }, [guideStorage, routeTabIds, searchParams, setSearchParams, setShowWorkflowOnboarding, user]);

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas font-sans text-text-primary">
      <ClientWorkflowOnboardingModal
        clientPermissions={clientPermissions}
        user={user}
        open={showWorkflowOnboarding}
        onClose={dismissWorkflowOnboarding}
        onNavigate={navigateFromGuide}
      />

      {/* App Header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/95 shadow-card backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-[18px] sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center gap-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark compact className="shrink-0" />
              <span className="hidden text-sm font-bold tracking-tight text-text-primary sm:inline">Client Portal</span>
            </div>

            <div className="ml-auto shrink-0">
              <DashboardAccountMenu
                accountTypeLabel={clientPermissions.label}
                avatarUrl={user.avatarUrl || user.avatar_url || ''}
                companyOrContext={user.company || 'Client account'}
                isDarkMode={isDarkMode}
                matchmakerAction={clientPermissions.canUseMatchmaker ? {
                  label: matchmakerVisible ? 'Hide AI Matchmaker' : 'Open AI Matchmaker',
                  onToggle: () => setMatchmakerVisible((current) => !current),
                  pressed: matchmakerVisible,
                } : null}
                name={user.name || 'Client account'}
                notificationState={notificationState}
                onGuide={() => setShowWorkflowOnboarding(true)}
                onLogout={onLogout}
                onNotificationOpened={handleNotificationOpened}
                onProfile={() => setProfileSection('account')}
                onThemeToggle={toggleDarkMode}
                role="client"
              />
            </div>
          </div>
        </div>

        {/* App Sub-Navigation */}
        <nav className="border-t border-border-subtle bg-surface" aria-label="Client workspace navigation">
          <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
              {availableTabs.map(tab => {
                const unreadCount = tabUnreadCounts[tab.id] || 0;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAppView(tab.id)}
                    aria-current={appView === tab.id ? 'page' : undefined}
                    className={`relative inline-flex min-h-11 shrink-0 items-center rounded-control px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 ${appView === tab.id ? 'bg-action text-white shadow-card' : 'text-text-muted hover:bg-surface-muted hover:text-text-primary'}`}
                  >
                    {tab.label}
                    {unreadCount > 0 && (
                      <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black leading-none ${appView === tab.id ? 'bg-white text-action' : 'bg-action text-white'}`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* App Workspace */}
      <main className="min-w-0 flex-1 bg-canvas">
        <div className="relative mx-auto min-w-0 w-full max-w-[1600px] scroll-smooth px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          {appView === 'discover' && <AppDiscoverView user={user} />}
          {appView === 'profile' && (
            <ClientProfileDashboard
              user={user}
              section={section}
              onSectionChange={setProfileSection}
              onUserUpdated={onUserUpdated}
            />
          )}
          {appView === 'agencies' && clientPermissions.canDiscoverAgencies && <AppAgenciesView />}
          {appView === 'shortlist' && <AppShortlistView user={user} />}
          {appView === 'interviews' && <AppInterviewsView user={user} />}
          {appView === 'billing' && <AppBillingView />}
        </div>
      </main>

      {/* AI Matchmaker Feature */}
      {clientPermissions.canUseMatchmaker && matchmakerVisible && <AITalentMatchmaker clientPermissions={clientPermissions} />}
    </div>
  );
}

// --- AI MATCHMAKER COMPONENT ---
export function AITalentMatchmaker({ clientPermissions }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const matchmakerLabel = clientPermissions?.matchmakerLevel === 'pro' ? 'Pro AI Matchmaker' : 'Basic AI Matchmaker';
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: `Hi there! I'm your ${matchmakerLabel}. Describe the problem you're trying to solve and I'll find a strong fit.` }
  ]);

  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userMsg = inputMsg.trim();
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMsg }]);
    setInputMsg('');
    setIsTyping(true);

    if (!isBackendConfigured()) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: 'Request captured. Matching suggestions will appear here once recommendations are available.',
      }]);
      setIsTyping(false);
      return;
    }

    try {
      const result = await backendApi.matchmaker.suggestMatches({ message: userMsg });
      const matchData = result?.match || result?.matches?.[0] || null;

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: result?.message || result?.text || 'Matching suggestions are ready.',
        type: result?.type || matchData?.type || 'talent',
        matchData,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: error.message || 'Unable to load matching suggestions right now.',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Matchmaker"
        className={`fixed bottom-8 right-8 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl transition-transform hover:scale-105 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <Sparkles size={24} className="text-cyan-400" aria-hidden="true" />
      </button>

      {/* AI Chat Window */}
      <Motion.div
        drag
        dragMomentum={false}
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={`fixed inset-x-4 bottom-4 z-30 flex h-[min(600px,calc(100dvh-2rem))] w-auto max-h-[80dvh] origin-bottom-right flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 sm:left-auto sm:right-8 sm:bottom-8 sm:w-[400px] ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >

        {/* Chat Header */}
        <div className="bg-slate-950 p-4 rounded-t-3xl flex justify-between items-center shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/30 blur-[30px] rounded-full pointer-events-none"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-primary-600/20 border border-primary-500/30 rounded-xl flex items-center justify-center text-cyan-400">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white leading-none">{matchmakerLabel}</h3>
              <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold mt-1">{clientPermissions?.label || 'Client'} tier</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors relative z-10">
            <X size={20} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${msg.sender === 'user' ? 'bg-primary-600 text-white rounded-2xl rounded-tr-sm px-4 py-3' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm'}`}>
                <p className="text-sm">{msg.text}</p>

                {/* AI Rendered Mini-Card Match */}
                {msg.matchData && (
                  <div className="mt-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm cursor-pointer hover:border-primary-300 transition-colors group">
                    <div className="flex items-center gap-3 mb-3">
                       <div className="w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold shrink-0 group-hover:text-primary-600 transition-colors">
                          {msg.type === 'agency' ? <Building size={16}/> : (msg.matchData.name || msg.matchData.fullName || '?').charAt(0)}
                       </div>
                       <div>
                         <div className="font-bold text-slate-950 dark:text-white text-sm leading-tight">{msg.matchData.name || msg.matchData.fullName || 'Recommended match'}</div>
                         <div className="text-xs text-slate-500 font-medium">{msg.type === 'agency' ? msg.matchData.specialty : (msg.matchData.role || msg.matchData.title || 'Role pending')}</div>
                       </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Match!</div>
                      <div className="font-bold text-slate-950 dark:text-white text-sm">{formatMoney(msg.matchData.rate || msg.matchData.hourlyRate)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1">
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
               </div>
             </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Chat Input */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Describe your needs..."
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputMsg.trim() || isTyping}
              className="w-12 h-12 bg-slate-950 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </Motion.div>
    </>
  );
}

// Sub-views for Client Portal
function AppDiscoverView({ user }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [previewProfile, setPreviewProfile] = useState(null);
  const [selectedAvailabilities, setSelectedAvailabilities] = useState(new Set());
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const availabilityDropdownRef = useRef(null);
  const [selectedSoftware, setSelectedSoftware] = useState(new Set());
  const [maxRate, setMaxRate] = useState(50);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [busyProfileId, setBusyProfileId] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (availabilityDropdownRef.current && !availabilityDropdownRef.current.contains(event.target)) {
        setIsAvailabilityOpen(false);
      }
    };
    if (isAvailabilityOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvailabilityOpen]);
  const { data: profiles, error, isConfigured, isLoading } = useBackendResource(
    backendApi.talent.listProfiles,
    EMPTY_LIST,
    {
      refreshInterval: 30000,
    }
  );
  const { data: shortlistSnapshot } = useBackendResource(
    backendApi.client.listShortlist,
    EMPTY_LIST,
    {
      realtime: [
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'shortlists' } : null,
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'opportunities' } : null,
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'interviews' } : null,
      ],
      refreshInterval: 15000,
    }
  );

  useEffect(() => {
    setSavedIds(new Set(asList(shortlistSnapshot).map((profile) => profile.id)));
  }, [shortlistSnapshot]);

  const filteredProfiles = useMemo(() => {
    const profileList = asList(profiles);

    return profileList.filter((profile) => {
      // 1. Role / Tab filter
      if (activeFilter !== 'All') {
        const role = profile.role || profile.title || '';
        const allTags = [...asList(profile.tools), ...asList(profile.skills)];
        const lowerFilter = activeFilter.toLowerCase();
        const matchesTab = role.toLowerCase().includes(lowerFilter) || allTags.some((tag) => String(tag).toLowerCase().includes(lowerFilter));
        if (!matchesTab) return false;
      }

      // 2. Max Rate filter
      const rate = profile.rate || profile.hourlyRate || 0;
      if (rate > maxRate && maxRate < 50) return false;

      // 3. Availability filter
      if (selectedAvailabilities.size > 0) {
        const avail = profile.available || profile.availability || '';
        if (!selectedAvailabilities.has(avail)) return false;
      }

      // 4. Software filter
      if (selectedSoftware.size > 0) {
        const allTags = [...asList(profile.tools), ...asList(profile.skills)];
        const hasMatchingTool = allTags.some(tag => selectedSoftware.has(tag));
        if (!hasMatchingTool) return false;
      }

      return true;
    });
  }, [activeFilter, profiles, selectedAvailabilities, selectedSoftware, maxRate]);

  const handleSaveProfile = async (profile) => {
    if (!profile?.id || savedIds.has(profile.id)) return;

    setActionError('');
    setBusyProfileId(profile.id);
    setSavedIds((current) => new Set([...current, profile.id]));

    try {
      await backendApi.client.saveShortlist({ professionalId: profile.id });
    } catch (saveError) {
      setSavedIds((current) => {
        const next = new Set(current);
        next.delete(profile.id);
        return next;
      });
      setActionError(saveError.message || 'Unable to save this profile.');
    } finally {
      setBusyProfileId('');
    }
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-8 lg:flex-row portal-fade-in">

      {/* Sticky Advanced Filters Sidebar */}
      <div className="w-full lg:w-72 flex-shrink-0 sticky top-[150px]">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-950 dark:text-white flex items-center gap-2"><SlidersHorizontal size={18} className="text-primary-600"/> Filters</h3>
            <button
              type="button"
              onClick={() => {
                setActiveFilter('All');
                setSelectedAvailabilities(new Set());
                setSelectedSoftware(new Set());
                setMaxRate(50);
              }}
              className="inline-flex min-h-11 items-center text-xs font-bold text-primary-600 hover:underline"
            >
              Reset
            </button>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Availability</h4>
              <div
                ref={availabilityDropdownRef}
                onClick={() => setIsAvailabilityOpen(!isAvailabilityOpen)}
                className="relative border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent min-h-[50px] flex flex-wrap items-center gap-2 p-2 pr-10 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10 transition-all duration-300 cursor-pointer"
              >

                <AnimatePresence>
                  {[...selectedAvailabilities].map(val => (
                    <Motion.button
                      type="button"
                      key={val}
                      initial={{ opacity: 0, scale: 0.8, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -5 }}
                      transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 20 }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newSet = new Set(selectedAvailabilities);
                        newSet.delete(val);
                        setSelectedAvailabilities(newSet);
                      }}
                      className="relative z-10 flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                    >
                      {val} <X size={12} className="opacity-70 hover:opacity-100 transition-opacity"/>
                    </Motion.button>
                  ))}
                </AnimatePresence>

                {selectedAvailabilities.size === 0 && (
                  <Motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-bold text-slate-400 pl-2 pointer-events-none z-0"
                  >
                    Add availability filter
                  </Motion.span>
                )}

                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isAvailabilityOpen ? 'rotate-180' : ''}`} />
                </div>

                {/* Custom Dropdown Menu */}
                <AnimatePresence>
                  {isAvailabilityOpen && (
                    <Motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {selectedAvailabilities.size > 0 && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAvailabilities(new Set());
                              setIsAvailabilityOpen(false);
                            }}
                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          >
                            <X size={14} /> Deselect All
                          </button>
                        </div>
                      )}
                      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                        {AVAILABILITY_OPTIONS.map((opt) => {
                          const isSelected = selectedAvailabilities.has(opt);
                          return (
                            <button
                              type="button"
                              key={opt}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newSet = new Set(selectedAvailabilities);
                                if (isSelected) {
                                  newSet.delete(opt);
                                } else {
                                  newSet.add(opt);
                                }
                                setSelectedAvailabilities(newSet);
                              }}
                              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                              {opt}
                              {isSelected && <CheckCircle size={16} className="text-emerald-500" />}
                            </button>
                          );
                        })}
                      </div>
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Primary Software</h4>
              {SOFTWARE_OPTIONS.map((software) => {
                const isSelected = selectedSoftware.has(software);
                return (
                <label key={software} className="group mb-3 flex min-h-11 cursor-pointer items-center space-x-3 rounded-lg focus-within:ring-4 focus-within:ring-focus/20">
                  <input type="checkbox" className="sr-only" checked={isSelected} onChange={(e) => {
                    const newSet = new Set(selectedSoftware);
                    if (e.target.checked) newSet.add(software);
                    else newSet.delete(software);
                    setSelectedSoftware(newSet);
                  }} />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300 group-hover:border-primary-400 bg-white dark:bg-slate-900'}`}>
                    {isSelected && <CheckCircle size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:text-white transition-colors">{software}</span>
                </label>
              )})}
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Max Hourly Rate: ${maxRate}{maxRate >= 50 ? '+' : ''}</h4>
              <input type="range" className="w-full accent-primary-600" min="5" max="50" value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} />
              <div className="flex justify-between text-xs font-bold text-slate-500 mt-2">
                <span>$5</span>
                <span>$25/hr</span>
                <span>$50+</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="w-full min-w-0 flex-1 lg:w-auto">
        <div className="mb-6 flex min-w-0 items-center justify-between">
          <div className="flex min-w-0 gap-2 overflow-x-auto scrollbar-hide pb-2">
            {TALENT_SKILL_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`min-h-11 rounded-full px-5 py-2 text-sm font-bold whitespace-nowrap transition-all ${
                  activeFilter === filter
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="hidden sm:block text-sm font-bold text-slate-500">
            {isLoading ? 'Loading profiles' : `Showing ${filteredProfiles.length} profiles`}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {error.message}
          </div>
        )}
        {actionError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {actionError}
          </div>
        )}

        {filteredProfiles.length === 0 ? (
          <EmptyState
            icon={User}
            title={isConfigured ? 'No talent profiles yet' : 'Talent directory is empty'}
            description="Approved profiles will appear here once they are available."
          />
        ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredProfiles.map((profile, idx) => (
            <FadeIn key={profile.id || `profile-${idx}`} delay={(idx % 6) * 50} direction="up" hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl hover:border-primary-200 transition-all duration-300 group flex flex-col h-full">

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-xl border border-slate-200 dark:border-slate-800">
                    {(profile.name || profile.fullName || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-950 dark:text-white group-hover:text-primary-700 transition-colors leading-tight mb-1">{profile.name || profile.fullName || 'Unnamed profile'}</h3>
                    <p className="text-sm font-semibold text-slate-500">{profile.role || profile.title || 'Role pending'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6 flex-grow">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Experience</div>
                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center"><Briefcase size={14} className="mr-1.5 text-slate-400"/> {profile.exp || profile.experience || 'Pending'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Availability</div>
                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400"/> {profile.available || profile.availability || 'Pending'}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...asList(profile.skills), ...asList(profile.tools)])].map(tool => (
                    <span key={tool} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-800 mt-auto">
                <div className="flex items-baseline">
                  <span className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">{formatMoney(profile.rate || profile.hourlyRate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewProfile(profile)}
                    className="min-h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow flex items-center transform motion-safe:hover:-translate-y-0.5"
                  >
                    View
                  </button>
                  {savedIds.has(profile.id) ? (
                    <div className="flex items-center rounded-xl bg-primary-50 px-5 py-2.5 text-sm font-black text-primary-700 dark:bg-primary-950/30 dark:text-primary-300">
                      Saved <CheckCircle size={16} className="ml-2" />
                    </div>
                  ) : (
                  <button
                    type="button"
                    onClick={() => handleSaveProfile(profile)}
                    disabled={busyProfileId === profile.id}
                    className="min-h-11 bg-slate-950 text-white hover:bg-primary-600 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center transform motion-safe:hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-default disabled:transform-none"
                  >
                    {busyProfileId === profile.id ? (
                    <>
                      Saving <Loader2 size={16} className="ml-2 animate-spin" />
                    </>
                    ) : (
                    <>
                      Save <Bookmark size={16} className="ml-2" />
                    </>
                    )}
                  </button>
                  )}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
        )}
      </div>

      {previewProfile && (
        <Modal
          open={Boolean(previewProfile)}
          title={`${previewProfile.name || previewProfile.fullName || 'Candidate'}'s Profile & Qualifications`}
          description="Review experience, availability, skills, and the verified documents available to your client tier."
          onClose={() => setPreviewProfile(null)}
          size="wide"
        >
          <div className="space-y-6">
            <SurfaceCard as="div" tone="muted" className="flex items-center gap-4 p-4 shadow-none">
              <div className="grid size-16 shrink-0 place-items-center rounded-full border border-border-subtle bg-surface text-2xl font-bold text-text-muted" aria-hidden="true">
                {(previewProfile.name || previewProfile.fullName || '?').charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="mb-1 text-xl font-bold leading-tight text-text-primary">{previewProfile.name || previewProfile.fullName || 'Unnamed profile'}</h3>
                <p className="text-sm font-semibold text-text-muted">{previewProfile.role || previewProfile.title || 'Role pending'}</p>
              </div>
            </SurfaceCard>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <SurfaceCard as="div" tone="muted" className="p-4 shadow-none">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Experience</div>
                <div className="flex items-center text-base font-bold text-text-primary"><Briefcase size={16} className="mr-2 text-text-muted" aria-hidden="true" /> {previewProfile.exp || previewProfile.experience || 'Pending'}</div>
              </SurfaceCard>
              <SurfaceCard as="div" tone="muted" className="p-4 shadow-none">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Availability</div>
                <div className="flex items-center text-base font-bold text-text-primary"><Calendar size={16} className="mr-2 text-text-muted" aria-hidden="true" /> {previewProfile.available || previewProfile.availability || 'Pending'}</div>
              </SurfaceCard>
            </div>

            <SurfaceCard as="section" className="p-4 shadow-none">
              <h4 className="mb-3 text-sm font-bold text-text-primary">Skills & Tools</h4>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...asList(previewProfile.skills), ...asList(previewProfile.tools)])].map(tool => (
                  <span key={tool} className="rounded-control border border-border-subtle bg-surface-muted px-3 py-1.5 text-sm font-bold text-text-muted">
                    {tool}
                  </span>
                ))}
              </div>
            </SurfaceCard>

            <ProfileQualificationsSection profile={previewProfile} />
            
            <div className="mt-4 flex justify-end border-t border-border-subtle pt-4">
              <Button type="button" variant="outline" onClick={() => setPreviewProfile(null)} className="min-h-11">
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AppAgenciesView() {
  const { data: agencies, error, isConfigured, isLoading } = useBackendResource(
    backendApi.client.listAgencies,
    EMPTY_LIST,
    {
      realtime: [
        { table: 'agencies' },
      ],
    }
  );
  const agencyList = asList(agencies);

  return (
    <div className="portal-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Discover Enterprise Agencies</h2>
        <p className="text-slate-600 dark:text-slate-400">Browse fully-managed pods and BPO firms for large-scale financial operations.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error.message}
        </div>
      )}

      {agencyList.length === 0 ? (
        <EmptyState
          icon={Building}
          title={isLoading ? 'Loading agencies' : isConfigured ? 'No agencies yet' : 'Agency directory is empty'}
          description="Approved agency records will appear here once they are available."
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {agencyList.map((agency, idx) => (
          <FadeIn key={agency.id || `agency-${idx}`} delay={idx * 100} direction="up" hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 hover:shadow-xl hover:border-primary-200 transition-all duration-300 flex flex-col h-full">
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-md border border-slate-800">
                <Building size={28} className="text-white" />
              </div>
              <div className="flex items-center bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">
                <Star size={12} className="mr-1 fill-current" /> {agency.rating || 'New'}
              </div>
            </div>

            <h3 className="font-bold text-2xl text-slate-950 dark:text-white mb-2 leading-tight">{agency.name || 'Unnamed agency'}</h3>
            <p className="text-sm font-bold text-primary-600 mb-6">{agency.specialty || 'Specialty pending'}</p>

            <div className="space-y-4 mb-8 flex-grow">
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                <MapPin size={16} className="mr-3 text-slate-400" /> {agency.location || 'Location pending'}
              </div>
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                <User size={16} className="mr-3 text-slate-400" /> {agency.size || 'Team size pending'}
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3">Certifications</div>
              <div className="flex flex-wrap gap-2">
                {asList(agency.certs || agency.certifications).map(cert => (
                  <span key={cert} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Pricing</div>
                <div className="font-bold text-slate-950 dark:text-white">{formatMoney(agency.rate || agency.monthlyRate)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                Agency preview
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
      )}
    </div>
  );
}

function AppShortlistView({ user }) {
  const clientPermissions = useMemo(() => getClientPortalPermissions(user), [user]);
  const {
    data: shortlisted,
    error,
    isConfigured,
    isLoading,
    mutate,
    refetch,
  } = useBackendResource(backendApi.client.listShortlist, EMPTY_LIST, {
    realtime: [
      user?.id ? { filter: `client_id=eq.${user.id}`, table: 'shortlists' } : null,
      user?.id ? { filter: `client_id=eq.${user.id}`, table: 'opportunities' } : null,
      user?.id ? { filter: `client_id=eq.${user.id}`, table: 'interviews' } : null,
    ],
    refreshInterval: 10000,
  });
  const shortlist = asList(shortlisted);
  const [localShortlist, setLocalShortlist] = useState(shortlist);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(getScheduleDefault);
  const [scheduleFormError, setScheduleFormError] = useState('');
  const [previewProfile, setPreviewProfile] = useState(null);

  useEffect(() => {
    setLocalShortlist(asList(shortlisted));
  }, [shortlisted]);

  useEffect(() => {
    if (!actionMessage) return undefined;

    const timeoutId = window.setTimeout(() => setActionMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  const handleRemove = async (profile) => {
    setActionError('');
    setActionMessage('');
    setBusyAction(`remove:${profile.id}`);

    try {
      await backendApi.client.removeShortlist({ professionalId: profile.id });
      setLocalShortlist((current) => current.filter((item) => item.id !== profile.id));
      setActionMessage(`${profile.name || profile.fullName || 'Profile'} removed from shortlist.`);
    } catch (removeError) {
      setActionError(removeError.message || 'Unable to remove this profile.');
    } finally {
      setBusyAction('');
    }
  };

  const openScheduleModal = (profile) => {
    setActionError('');
    setActionMessage('');
    setScheduleFormError('');
    setScheduleTarget(profile);
    setScheduleForm(getScheduleDefault());
  };

  const closeScheduleModal = () => {
    if (busyAction) return;
    setScheduleFormError('');
    setScheduleTarget(null);
  };

  const submitSchedule = async (event) => {
    event.preventDefault();

    if (!scheduleTarget) return;

    const scheduledFor = combineScheduleDateTime(scheduleForm);

    if (!scheduledFor) {
      setScheduleFormError('Use a valid date and time, like 2026-05-24 and 09:00.');
      return;
    }

    setActionError('');
    setActionMessage('');
    setScheduleFormError('');
    setBusyAction(`schedule:${scheduleTarget.id}`);

    try {
      await backendApi.client.requestInterview({
        hourlyRate: scheduleTarget.rate || scheduleTarget.hourlyRate,
        professionalId: scheduleTarget.id,
        scheduledFor,
        title: scheduleTarget.role || scheduleTarget.title || 'Finance interview',
      });
      setLocalShortlist((current) => current.map((item) => (
        item.id === scheduleTarget.id
          ? {
            ...item,
            interviewStatus: 'requesting',
            scheduledFor,
          }
          : item
      )));
      mutate((current) => asList(current).map((item) => (
        item.id === scheduleTarget.id
          ? {
            ...item,
            interviewStatus: 'requesting',
            scheduledFor,
          }
          : item
      )));
      refetch().catch(() => {});
      setScheduleTarget(null);
      setActionMessage(`Interview request sent to ${scheduleTarget.name || scheduleTarget.fullName || 'the candidate'}.`);
    } catch (scheduleError) {
      setScheduleFormError(scheduleError.message || 'Unable to request this interview.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">My Shortlist</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {clientPermissions.canScheduleInterviews ? 'Review and schedule interviews with your saved candidates.' : 'Review your saved candidates.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error.message}
        </div>
      )}
      {actionError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div className="success-message mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {actionMessage}
        </div>
      )}

      {localShortlist.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={isLoading ? 'Loading shortlist' : isConfigured ? 'No saved candidates yet' : 'Shortlist is empty'}
          description="Saved profiles will appear here when clients add them to a shortlist."
        />
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {localShortlist.map((profile, idx) => {
          const hasActiveOpportunity = ['accepted', 'active', 'invited'].includes(profile.opportunityStatus);
          const currentStatus = hasActiveOpportunity
            ? (['requesting', 'requested', 'scheduled', 'cancelled'].includes(profile.interviewStatus) ? profile.interviewStatus : profile.opportunityStatus)
            : profile.interviewStatus || profile.opportunityStatus || profile.shortlistStatus;
          const hasActiveRequest = ['invited', 'accepted', 'active', 'requesting', 'requested', 'scheduled'].includes(currentStatus);

          return (
          <FadeIn key={profile.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-6 hover:shadow-lg transition-shadow">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-cyan-50 rounded-full flex items-center justify-center font-bold text-primary-700 text-2xl border border-primary-200">
                  {(profile.name || profile.fullName || '?').charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-950 dark:text-white leading-tight mb-1">{profile.name || profile.fullName || 'Unnamed profile'}</h3>
                  <p className="text-sm font-semibold text-primary-600">{profile.role || profile.title || 'Role pending'}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  <Briefcase size={16} className="mr-2 text-slate-400"/> {profile.exp || profile.experience || 'Experience pending'}
                </div>
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  <Calendar size={16} className="mr-2 text-slate-400"/> Available: {profile.available || profile.availability || 'Pending'}
                </div>
                {currentStatus && (
                  <div className={`inline-flex rounded-md px-2 py-1 text-xs font-bold capitalize ${interviewStatusStyles[currentStatus] || interviewStatusStyles.saved}`}>
                    {interviewStatusLabel(currentStatus)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                  {asList(profile.tools || profile.skills).slice(0,3).map(tool => (
                    <span key={tool} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md">
                      {tool}
                    </span>
                  ))}
              </div>
            </div>
            <div className="sm:border-l sm:border-slate-100 dark:border-slate-800 sm:pl-6 flex flex-col justify-between sm:w-48">
              <div className="text-right sm:text-left mb-4 sm:mb-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Hourly Rate</div>
                <div className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">{formatMoney(profile.rate || profile.hourlyRate)}</div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setPreviewProfile(profile)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                >
                  View Profile
                </button>
                {hasActiveRequest ? (
                  <div className="w-full rounded-xl bg-primary-50 py-2.5 text-center text-sm font-black text-primary-700 dark:bg-primary-950/30 dark:text-primary-300">
                    Requested
                  </div>
                ) : clientPermissions.canScheduleInterviews ? (
                  <button
                    onClick={() => openScheduleModal(profile)}
                    disabled={busyAction === `schedule:${profile.id}`}
                    className="w-full bg-slate-950 text-white hover:bg-primary-600 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md disabled:opacity-70 disabled:cursor-default"
                  >
                    {busyAction === `schedule:${profile.id}` ? 'Sending...' : 'Schedule'}
                  </button>
                ) : (
                  <div className="w-full rounded-xl bg-slate-100 py-2.5 text-center text-sm font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Scheduling unavailable
                  </div>
                )}
                <button
                  onClick={() => handleRemove(profile)}
                  disabled={busyAction === `remove:${profile.id}`}
                  className="w-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-red-600 border border-slate-200 dark:border-slate-800 hover:border-red-200 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-default"
                >
                  {busyAction === `remove:${profile.id}` ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </FadeIn>
          );
        })}
      </div>
      )}

      {previewProfile && (
        <Modal
          open={Boolean(previewProfile)}
          title={`${previewProfile.name || previewProfile.fullName || 'Candidate'}'s Profile & Qualifications`}
          description="Review experience, availability, skills, and the verified documents available to your client tier."
          onClose={() => setPreviewProfile(null)}
          size="wide"
        >
          <div className="space-y-6">
            <SurfaceCard as="div" tone="muted" className="flex items-center gap-4 p-4 shadow-none">
              <div className="grid size-16 shrink-0 place-items-center rounded-full border border-border-subtle bg-surface text-2xl font-bold text-text-muted" aria-hidden="true">
                {(previewProfile.name || previewProfile.fullName || '?').charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="mb-1 text-xl font-bold leading-tight text-text-primary">{previewProfile.name || previewProfile.fullName || 'Unnamed profile'}</h3>
                <p className="text-sm font-semibold text-text-muted">{previewProfile.role || previewProfile.title || 'Role pending'}</p>
              </div>
            </SurfaceCard>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <SurfaceCard as="div" tone="muted" className="p-4 shadow-none">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Experience</div>
                <div className="flex items-center text-base font-bold text-text-primary"><Briefcase size={16} className="mr-2 text-text-muted" aria-hidden="true" /> {previewProfile.exp || previewProfile.experience || 'Pending'}</div>
              </SurfaceCard>
              <SurfaceCard as="div" tone="muted" className="p-4 shadow-none">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Availability</div>
                <div className="flex items-center text-base font-bold text-text-primary"><Calendar size={16} className="mr-2 text-text-muted" aria-hidden="true" /> {previewProfile.available || previewProfile.availability || 'Pending'}</div>
              </SurfaceCard>
            </div>

            <SurfaceCard as="section" className="p-4 shadow-none">
              <h4 className="mb-3 text-sm font-bold text-text-primary">Skills & Tools</h4>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...asList(previewProfile.skills), ...asList(previewProfile.tools)])].map(tool => (
                  <span key={tool} className="rounded-control border border-border-subtle bg-surface-muted px-3 py-1.5 text-sm font-bold text-text-muted">
                    {tool}
                  </span>
                ))}
              </div>
            </SurfaceCard>

            <ProfileQualificationsSection profile={previewProfile} />
            
            <div className="mt-4 flex justify-end border-t border-border-subtle pt-4">
              <Button type="button" variant="outline" onClick={() => setPreviewProfile(null)} className="min-h-11">
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {scheduleTarget && (
        <Modal
          open={Boolean(scheduleTarget)}
          title="Request Interview"
          description="Choose one preferred date and time. The professional must accept before the interview is scheduled."
          onClose={closeScheduleModal}
          size="wide"
        >
          <form onSubmit={submitSchedule} className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-bold text-text-primary">Preferred date and time</div>
              <InterviewDateTimePicker value={scheduleForm} onChange={(nextSchedule) => { setScheduleForm(nextSchedule); setScheduleFormError(''); }} />
              <p className="mt-2 text-xs font-medium text-text-muted">Pick a date from the calendar and choose one preferred time.</p>
            </div>
            {scheduleFormError && (
              <div role="alert" className="rounded-control border border-danger-border bg-danger-surface px-4 py-3 text-sm font-semibold text-danger">
                {scheduleFormError}
              </div>
            )}
            <SurfaceCard as="div" tone="muted" className="border-border-subtle p-4 text-sm font-semibold text-text-muted shadow-none">
              {scheduleTarget.name || scheduleTarget.fullName || 'Candidate'} will receive this as a request first. It becomes scheduled after they accept.
            </SurfaceCard>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeScheduleModal} className="min-h-11 w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={busyAction === `schedule:${scheduleTarget.id}`} className="min-h-11 w-full sm:w-auto">
                {busyAction === `schedule:${scheduleTarget.id}` ? 'Sending...' : 'Send Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AppInterviewsView({ user }) {
  const { data: interviews, error, isConfigured, isLoading, mutate, refetch } = useBackendResource(
    backendApi.client.listInterviews,
    EMPTY_LIST,
    {
      realtime: [
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'interviews' } : null,
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'opportunities' } : null,
      ],
      refreshInterval: 10000,
    }
  );
  const interviewList = asList(interviews);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionMenuId, setActionMenuId] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFormError, setCancelFormError] = useState('');

  useEffect(() => {
    if (!actionMessage) return undefined;

    const timeoutId = window.setTimeout(() => setActionMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  const openCancelModal = (interview) => {
    setActionError('');
    setActionMessage('');
    setActionMenuId('');
    setCancelFormError('');
    setCancelTarget(interview);
    setCancelReason('');
  };

  const submitCancelInterview = async (event) => {
    event.preventDefault();

    if (!cancelTarget) return;

    const reason = cancelReason.trim();

    if (!reason) {
      setCancelFormError('Cancellation reason is required.');
      return;
    }

    setActionError('');
    setActionMessage('');
    setCancelFormError('');
    setBusyAction(`cancel:${cancelTarget.id}`);

    try {
      await backendApi.client.cancelInterview({ id: cancelTarget.id, reason });
      mutate((current) => asList(current).map((interview) => (
        interview.id === cancelTarget.id
          ? { ...interview, cancellationReason: reason, status: 'cancelled' }
          : interview
      )));
      refetch().catch(() => {});
      setCancelTarget(null);
      setActionMessage('Interview cancelled and the professional was notified.');
    } catch (cancelError) {
      setCancelFormError(cancelError.message || 'Unable to cancel this interview.');
    } finally {
      setBusyAction('');
    }
  };

  const handleRemoveCancelled = async (interview) => {
    setActionError('');
    setActionMessage('');
    setActionMenuId('');
    setBusyAction(`remove:${interview.id}`);

    try {
      await backendApi.client.removeInterview({ id: interview.id });
      mutate((current) => asList(current).filter((item) => item.id !== interview.id));
      refetch().catch(() => {});
      setActionMessage('Cancelled interview removed.');
    } catch (removeError) {
      setActionError(removeError.message || 'Unable to remove this interview.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="portal-fade-in max-w-4xl">
      <div className="mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Interviews</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage your upcoming candidate screenings.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error.message}
        </div>
      )}
      {actionError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div className="success-message mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {actionMessage}
        </div>
      )}

      {interviewList.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={isLoading ? 'Loading interviews' : isConfigured ? 'No interviews scheduled' : 'Interview schedule is empty'}
          description="Upcoming screenings will appear here once they are scheduled."
        />
      ) : (
      <div className="space-y-4">
        {interviewList.map((interview, idx) => (
          <FadeIn key={interview.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm hover:border-primary-300 transition-colors">
            <div className="flex items-center gap-6 w-full sm:w-auto">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase">{interview.month || 'TBD'}</span>
                <span className="text-xl font-black text-slate-900 dark:text-slate-50">{interview.day || '--'}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-950 dark:text-white leading-tight mb-1">{interview.name || interview.candidateName || 'Candidate pending'}</h3>
                <p className="text-sm font-medium text-slate-500 mb-2">Interview for {interview.role || interview.title || 'Role pending'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-md w-fit">
                    <Clock3 size={12} className="mr-1.5" /> {interview.time || interview.scheduledFor || 'Time pending'}
                  </div>
                  <div className={`rounded-md px-2 py-1 text-xs font-bold capitalize ${interviewStatusStyles[interview.status] || interviewStatusStyles.scheduled}`}>
                    {interviewStatusLabel(interview.status)}
                  </div>
                </div>
                {interview.status === 'cancelled' && interview.cancellationReason && (
                  <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                    Cancelled: {interview.cancellationReason}
                  </p>
                )}
              </div>
            </div>
            <div className="flex w-full sm:w-auto gap-3">
              {interview.status === 'cancelled' ? (
                <div className="flex flex-1 items-center justify-center rounded-xl bg-red-50 px-6 py-3 text-sm font-bold text-red-600 sm:flex-none dark:bg-red-950/20 dark:text-red-300">
                  Cancelled
                </div>
              ) : interview.meetingUrl ? (
                <a href={interview.meetingUrl} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-600 sm:flex-none">
                  Join Call <Video size={16} className="ml-2" />
                </a>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-500 sm:flex-none dark:bg-slate-800 dark:text-slate-400">
                  No link yet <Video size={16} className="ml-2" />
                </div>
              )}
              <div className="relative">
                <button
                  onClick={() => setActionMenuId((current) => (current === interview.id ? '' : interview.id))}
                  disabled={busyAction === `cancel:${interview.id}` || busyAction === `remove:${interview.id}`}
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-50 hover:border-slate-300 rounded-xl transition-colors disabled:cursor-default disabled:opacity-50"
                  title="Interview actions"
                >
                  <SlidersHorizontal size={18} />
                </button>
                {actionMenuId === interview.id && (
                  <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    {interview.status === 'cancelled' ? (
                      <button
                        onClick={() => handleRemoveCancelled(interview)}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Delete cancelled
                      </button>
                    ) : (
                      <button
                        onClick={() => openCancelModal(interview)}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Cancel interview
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
      )}

      {cancelTarget && (
        <Modal
          open={Boolean(cancelTarget)}
          title="Cancel Interview"
          description="Share a clear reason before notifying the professional and marking this interview cancelled."
          onClose={() => { setCancelFormError(''); setCancelTarget(null); }}
        >
          <form onSubmit={submitCancelInterview} className="space-y-5">
            <SurfaceCard as="div" tone="muted" className="border-border-subtle p-4 text-sm font-semibold text-text-muted shadow-none">
              This will notify {cancelTarget.name || cancelTarget.candidateName || 'the professional'} and keep the reason visible on the cancelled interview.
            </SurfaceCard>
            <label htmlFor="client-cancellation-reason" className="block text-sm font-bold text-text-primary">
              Cancellation reason
              <textarea
                id="client-cancellation-reason"
                value={cancelReason}
                onChange={(event) => { setCancelReason(event.target.value); setCancelFormError(''); }}
                rows={4}
                className="mt-2 w-full rounded-control border border-border-control bg-surface px-4 py-3 text-sm font-semibold text-text-primary outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
              />
            </label>
            {cancelFormError && (
              <div role="alert" className="rounded-control border border-danger-border bg-danger-surface px-4 py-3 text-sm font-semibold text-danger">
                {cancelFormError}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => { setCancelFormError(''); setCancelTarget(null); }} className="min-h-11 w-full sm:w-auto">
                Keep Interview
              </Button>
              <Button type="submit" variant="danger" disabled={busyAction === `cancel:${cancelTarget.id}`} className="min-h-11 w-full sm:w-auto">
                {busyAction === `cancel:${cancelTarget.id}` ? 'Cancelling...' : 'Cancel Interview'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AppBillingView() {
  const { data: billing, error, isConfigured, isLoading } = useBackendResource(backendApi.client.getBilling, EMPTY_BILLING);
  const contracts = asList(billing.contracts);
  const invoices = asList(billing.invoices);
  const paymentMethods = asList(billing.paymentMethods);
  const primaryContract = contracts[0] || {};
  const primaryPaymentMethod = paymentMethods[0] || {};

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Billing & Contracts</h2>
        <p className="text-slate-600 dark:text-slate-400">Manage your active pods, embedded hires, and payment methods.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Contracts */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg">Active Contracts</h3>
          <FadeIn delay={100} hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-6">
              <div>
                <div className="inline-flex items-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md mb-3">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span> {primaryContract.status || (isLoading ? 'Loading' : 'Pending')}
                </div>
                <h4 className="text-xl font-bold text-slate-950 dark:text-white mb-1">{primaryContract.name || primaryContract.title || (isConfigured ? 'No active contract yet' : 'Contracts will appear here')}</h4>
                <p className="text-sm font-medium text-slate-500">{primaryContract.startDate || 'Start date pending'}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-950 dark:text-white">{formatMoney(primaryContract.amount || primaryContract.monthlyAmount)}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{primaryContract.billingInterval || 'Billing'}</div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Talent</h5>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">--</div>
                <div><p className="text-sm font-bold text-slate-900 dark:text-slate-50">No assignments loaded</p><p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Contract talent will appear after assignment</p></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              Contract actions appear here after an agreement is active.
            </div>
          </FadeIn>
        </div>

        {/* Payment & Invoices */}
        <div className="space-y-8">
          <FadeIn delay={200}>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg mb-6">Payment Method</h3>
            <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 blur-[30px] rounded-full"></div>
              <CreditCard className="text-primary-400 w-8 h-8 mb-8" />
              <div className="font-mono text-lg tracking-widest mb-2">{primaryPaymentMethod.last4 ? `Card ending ${primaryPaymentMethod.last4}` : 'No payment method on file'}</div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cardholder</div>
                  <div className="text-sm font-bold">{primaryPaymentMethod.holderName || 'Billing profile pending'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Expires</div>
                  <div className="text-sm font-bold">{primaryPaymentMethod.expires || 'Pending'}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Payment updates will be available after billing setup.
            </div>
          </FadeIn>

          <FadeIn delay={300}>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg mb-6">Recent Invoices</h3>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {invoices.length === 0 && (
                <div className="p-6 text-sm font-medium text-slate-500">No invoices loaded yet.</div>
              )}
              {invoices.map((inv, i) => (
                <div key={inv.id || i} className={`flex items-center justify-between p-4 ${i !== invoices.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg"><Receipt size={16} className="text-slate-500"/></div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-50">{inv.number || inv.id || 'Invoice'}</div>
                      <div className="text-xs font-medium text-slate-500">{inv.date || 'Date pending'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900 dark:text-slate-50">{formatMoney(inv.amount)}</span>
                    {inv.downloadUrl ? (
                      <a href={inv.downloadUrl} target="_blank" rel="noreferrer" className="text-slate-400 transition-colors hover:text-primary-600" title="Download invoice">
                        <Download size={16}/>
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">PDF pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
