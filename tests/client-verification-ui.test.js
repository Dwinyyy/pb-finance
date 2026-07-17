import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientPage = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const adminPage = readFileSync(new URL('../src/pages/AdminPages.jsx', import.meta.url), 'utf8');
const clientDashboard = readFileSync(new URL('../src/components/ClientVerificationDashboard.jsx', import.meta.url), 'utf8');
const adminReview = readFileSync(new URL('../src/components/ClientVerificationReview.jsx', import.meta.url), 'utf8');
const onboarding = readFileSync(new URL('../src/components/ClientWorkflowOnboardingModal.jsx', import.meta.url), 'utf8');
const notificationBell = readFileSync(new URL('../src/components/NotificationBell.jsx', import.meta.url), 'utf8');
const notificationPanel = readFileSync(new URL('../src/components/NotificationPanel.jsx', import.meta.url), 'utf8');
const sourceBetween = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const clientPortal = sourceBetween(clientPage, 'export function ClientPortal', 'function AITalentMatchmaker');
const qualifications = sourceBetween(clientPage, 'function ProfileQualificationsSection', 'function InterviewDateTimePicker');
const dateTimePicker = sourceBetween(clientPage, 'function InterviewDateTimePicker', 'export function ClientPortal');
const discoverView = sourceBetween(clientPage, 'function AppDiscoverView', 'function AppAgenciesView');
const shortlistView = sourceBetween(clientPage, 'function AppShortlistView', 'function AppInterviewsView');
const interviewsView = sourceBetween(clientPage, 'function AppInterviewsView', 'function AppBillingView');
const matchmaker = sourceBetween(clientPage, 'function AITalentMatchmaker', 'function AppDiscoverView');

test('client shell and tiers use shared signature primitives and semantic states', () => {
  assert.match(clientPage, /<BrandMark/);
  assert.match(clientPage, /<StatusBadge/);
  assert.match(clientPage, /toneForTier/);
  assert.match(clientPage, /vip:[\s\S]*label: 'VIP'/);
  assert.match(clientPortal, /<SurfaceCard/);
  assert.match(clientPortal, /<Button/);
  assert.match(clientPortal, /bg-canvas/);
  assert.match(clientPortal, /text-premium-detail/);
  assert.match(clientPortal, /aria-current=\{appView === tab\.id \? 'page' : undefined\}/);
  assert.match(clientPortal, /aria-label="Client workspace navigation"/);
  assert.match(clientPortal, /min-h-11/);
  assert.match(clientPortal, /\[&>div>button\]:min-h-11/);
});

test('client shell migration preserves permission, onboarding, notification, and matchmaker wiring', () => {
  for (const permission of [
    "canDiscoverAgencies: false",
    "canScheduleInterviews: false",
    "canUseMatchmaker: false",
    "canViewFullDocuments: false",
    "matchmakerLevel: 'none'",
    'shortlistLimit: 5',
    "matchmakerLevel: 'basic'",
    "matchmakerLevel: 'pro'",
  ]) {
    assert.match(clientPage, new RegExp(permission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(clientPortal, /const availableTabs = useMemo/);
  assert.match(clientPortal, /CLIENT_ROUTE_TABS\.includes\(normalizedRequestedTab\)[\s\S]*routeTabIds\.includes\(normalizedRequestedTab\)/);
  assert.match(clientPortal, /localStorage\.setItem\(onboardingStorageKey, 'true'\)/);
  assert.match(clientPortal, /setShowWorkflowOnboarding\(true\)/);
  assert.match(clientPortal, /useTabNotificationIndicators/);
  assert.match(clientPortal, /tabUnreadCounts\[tab\.id\]/);
  assert.match(clientPortal, /clientPermissions\.canUseMatchmaker && matchmakerVisible/);
  assert.match(clientPortal, /setMatchmakerVisible\(!matchmakerVisible\)/);
  assert.match(clientPortal, /onClick=\{onLogout\}/);
  assert.match(clientPortal, /<ClientWorkflowOnboardingModal[\s\S]*open=\{showWorkflowOnboarding\}/);
  assert.match(onboarding, /<Modal/);
  assert.doesNotMatch(onboarding, /createPortal|useEffect/);
});

test('Discover layout shrinks without exposing closed matchmaker controls', () => {
  assert.match(discoverView, /className="flex min-w-0 flex-col items-start gap-8 lg:flex-row portal-fade-in"/);
  assert.match(discoverView, /className="w-full min-w-0 flex-1 lg:w-auto"/);
  assert.doesNotMatch(discoverView, /className="flex-1 w-full"/);
  assert.match(discoverView, /overflow-x-auto scrollbar-hide/);
  assert.match(matchmaker, /inert=\{!isOpen\}/);
  assert.match(matchmaker, /aria-hidden=\{!isOpen\}/);
});

test('shared and native client controls meet the 44px target contract', () => {
  assert.match(notificationBell, /className="relative flex h-11 w-11 items-center justify-center"/);
  assert.match(notificationBell, /className="relative flex h-11 w-11 items-center justify-center text-text-muted/);
  assert.match(notificationPanel, /<Button[\s\S]*?aria-label="Mark all notifications read"[\s\S]*?className="size-11 shrink-0 p-0"/);
  assert.match(notificationPanel, /<Button[\s\S]*?onClick=\{togglePushNotifications\}[\s\S]*?className="min-h-11 shrink-0[^"]*text-action"/);

  assert.match(discoverView, /Reset[\s\S]*?min-h-11|className="inline-flex min-h-11[^\n]*"[\s\S]*?Reset/);
  assert.match(discoverView, /min-h-11[^"]*TALENT_SKILL_FILTERS|TALENT_SKILL_FILTERS[\s\S]*className=\{`min-h-11/);
  assert.match(discoverView, /<label key=\{software\} className="[^"]*min-h-11/);
  assert.match(discoverView, /className="min-h-11[^"]*"[\s\S]*?View/);
  assert.match(discoverView, /className="min-h-11[^"]*"[\s\S]*?Save/);
});

test('client notification trigger and panel stay semantic and viewport-safe', () => {
  for (const className of [
    '[&>div>button:hover]:!text-action',
    '[&>div>button:focus-visible]:!text-action',
    '[&>div>div]:!fixed',
    '[&>div>div]:!inset-x-4',
    '[&>div>div]:!top-32',
    '[&>div>div]:!w-auto',
    'sm:[&>div>div]:!absolute',
    'sm:[&>div>div]:!inset-x-auto',
    'sm:[&>div>div]:!right-0',
    'sm:[&>div>div]:!top-12',
    'sm:[&>div>div]:!w-[min(22rem,calc(100vw-2rem))]',
  ]) {
    assert.ok(clientPortal.includes(className), `missing notification shell class: ${className}`);
  }

  assert.match(clientPortal, /<NotificationBell notificationState=\{notificationState\} unreadClassName="bg-action" userId=\{user\.id\} \/>/);
});

test('all four client modal bodies use shared semantic presentation and accessible controls', () => {
  assert.equal([...clientPage.matchAll(/<Modal\b/g)].length, 4);
  assert.equal([...clientPage.matchAll(/<Modal[^>]*description=/g)].length, 4);

  for (const modalView of [discoverView, shortlistView, interviewsView]) {
    assert.match(modalView, /<SurfaceCard/);
    assert.match(modalView, /<Button/);
    assert.match(modalView, /border-border-subtle/);
    assert.match(modalView, /text-text-primary/);
    assert.match(modalView, /text-text-muted/);
  }

  assert.match(qualifications, /<SurfaceCard/);
  assert.match(qualifications, /<Button/);
  assert.match(qualifications, /bg-verified-surface/);
  assert.match(dateTimePicker, /aria-label="Previous month"/);
  assert.match(dateTimePicker, /aria-label="Next month"/);
  assert.match(dateTimePicker, /aria-pressed=\{isSelected\}/);
  assert.match(shortlistView, /<form onSubmit=\{submitSchedule\}[\s\S]*role="alert"/);
  assert.match(interviewsView, /<form onSubmit=\{submitCancelInterview\}[\s\S]*role="alert"/);
});

test('client modal migration preserves preview, scheduling, and cancellation callbacks', () => {
  assert.equal([...clientPage.matchAll(/onClose=\{\(\) => setPreviewProfile\(null\)\}/g)].length, 2);
  assert.match(shortlistView, /onClose=\{closeScheduleModal\}/);
  assert.match(shortlistView, /<form onSubmit=\{submitSchedule\}/);
  assert.match(shortlistView, /onChange=\{\(nextSchedule\) => \{ setScheduleForm\(nextSchedule\); setScheduleFormError\(''\); \}\}/);
  assert.match(shortlistView, /disabled=\{busyAction === `schedule:\$\{scheduleTarget\.id\}`\}/);
  assert.match(interviewsView, /<form onSubmit=\{submitCancelInterview\}/);
  assert.match(interviewsView, /setCancelReason\(event\.target\.value\); setCancelFormError\(''\)/);
  assert.match(interviewsView, /disabled=\{busyAction === `cancel:\$\{cancelTarget\.id\}`\}/);
});

test('client portal keeps verification inside the hidden Profile route while protected tabs require permissions', () => {
  assert.match(clientPage, /CLIENT_ROUTE_TABS[^\n]*'profile'/);
  assert.doesNotMatch(clientPortal, /id: 'verification', label: 'Verification'/);
  assert.match(clientPage, /clientPermissions\.canScheduleInterviews[\s\S]*id: 'interviews'/);
  assert.match(clientPage, /clientPermissions\.canViewFullDocuments[\s\S]*id: 'billing'/);
  assert.match(clientPage, /appView === 'profile'[\s\S]*ClientProfileDashboard/);
  assert.match(clientPage, /requestedTab === 'verification'[\s\S]*section', 'verification'[\s\S]*replace: true/);
  assert.match(clientPage, /client_verification_approved: 'profile'/);
  assert.match(clientPage, /client_verification_rejected: 'profile'/);
  assert.match(clientPage, /client_verification_reset: 'profile'/);
});

test('client dashboard requires all four evidence categories and regulated business proof', () => {
  for (const label of [
    'Valid government ID',
    'Liveness selfie',
    'Profile picture',
    'Proof of business',
    'US EIN Letter (CP575)',
    'State Business Registration',
    'EU VAT Certificate',
  ]) {
    assert.match(clientDashboard, new RegExp(label.replace(/[()]/g, '\\$&')));
  }

  assert.match(clientDashboard, /backendApi\.client\.uploadVerificationDocument/);
  assert.match(clientDashboard, /backendApi\.client\.submitVerification/);
  assert.match(clientDashboard, /FileDropzone/);
  assert.match(clientDashboard, /handleUpload\(config\.kind, file\)/);
  assert.match(clientDashboard, /role="status"|aria-live="polite"/);
  assert.match(clientDashboard, /<div[^>]*role="status"[^>]*>[\s\S]*Loading verification requirements/);
  assert.match(clientDashboard, /verifiedBusinessName/);
  assert.match(clientDashboard, /proper attire/i);
  assert.match(clientDashboard, /exact Legal Business Name/i);
  assert.match(clientDashboard, /\{ label: 'US EIN Letter \(CP575\)', value: 'cp575_ein_letter' \}/);
  assert.match(clientDashboard, /\{ label: 'State Business Registration', value: 'state_business_registration' \}/);
  assert.match(clientDashboard, /\{ label: 'EU VAT Certificate', value: 'eu_vat_certificate' \}/);
  assert.match(clientDashboard, /You cannot edit that protected value/);
  assert.doesNotMatch(clientDashboard, /value=\{verification\.verifiedBusinessName\}|onChange=.*verifiedBusinessName/);
});

test('admin console exposes the client verification review queue', () => {
  assert.match(adminPage, /id: 'client-verifications', label: 'Client Verification'/);
  assert.match(adminPage, /activeTab === 'client-verifications'[\s\S]*ClientVerificationReview/);
  assert.match(adminReview, /verifiedBusinessNameConfirmation/);
  assert.match(adminReview, /businessProofAccepted/);
  assert.match(adminReview, /profilePhotoMatches/);
  assert.match(adminReview, /backendApi\.admin\.decideClientVerification/);
  assert.match(adminReview, /backendApi\.admin\.resetClientVerification/);
});
