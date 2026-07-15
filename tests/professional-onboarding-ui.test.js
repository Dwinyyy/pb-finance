import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const apiSource = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
const apiService = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
const adminPage = readFileSync(new URL('../src/pages/AdminPages.jsx', import.meta.url), 'utf8');
const notificationBell = readFileSync(new URL('../src/components/NotificationBell.jsx', import.meta.url), 'utf8');
const professionalPage = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
const pushService = readFileSync(new URL('../src/services/pushNotifications.js', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/pb-push-sw.js', import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceBetween = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const professionalPortal = sourceBetween(professionalPage, 'export function ProfessionalPortal', 'function AppTalentProfileView');
const profileView = sourceBetween(professionalPage, 'function AppTalentProfileView', 'function ProfileSettingsModal');
const profileSettings = sourceBetween(professionalPage, 'function ProfileSettingsModal', 'function ProfessionalProfilePreviewModal');
const profilePreview = sourceBetween(professionalPage, 'function ProfessionalProfilePreviewModal', 'function ProfessionalIdentityVerificationPanel');
const identityPanel = sourceBetween(professionalPage, 'function ProfessionalIdentityVerificationPanel', 'function AppTalentCredentialsSection');
const credentialUploadRow = sourceBetween(professionalPage, 'function CredentialUploadRow', 'function DashboardMetric');
const credentialSection = sourceBetween(professionalPage, 'function AppTalentCredentialsSection', 'function AppTalentOpportunitiesView');

test('authenticated API exposes browser push subscription lifecycle', () => {
  for (const route of [
    'GET /notifications/push-config',
    'POST /notifications/push-subscription',
    'DELETE /notifications/push-subscription',
  ]) {
    assert.match(apiSource, new RegExp(`['"]${route.replaceAll('/', '\\/')}['"]`));
  }

  for (const method of ['getPushConfig', 'savePushSubscription', 'removePushSubscription']) {
    assert.match(apiService, new RegExp(`${method}:`));
  }
});

test('notification menu requests push permission only after explicit opt in', () => {
  assert.match(notificationBell, /Enable push alerts/i);
  assert.match(notificationBell, /enablePushNotifications/);
  assert.match(pushService, /navigator\.serviceWorker\.register\('\/pb-push-sw\.js'\)/);
  assert.match(pushService, /Notification\.requestPermission\(\)/);
  assert.match(serviceWorker, /addEventListener\('push'/);
  assert.match(serviceWorker, /addEventListener\('notificationclick'/);
});

test('professional valid ID captures expiry and locks approved identity evidence', () => {
  assert.match(professionalPage, /Valid ID expiration date/i);
  assert.match(professionalPage, /expiryDate: expiryDates\[row\.kind\]/);
  assert.match(professionalPage, /identityApproved/);
  assert.match(professionalPage, /Request Change\/Removal/);
  assert.match(apiSource, /targetType === 'identity'/);
  assert.match(apiSource, /identity_verification_documents/);
  assert.match(adminPage, /Identity Verification[\s\S]*Identity change request:/);
});

test('professional identity and every credential class use the shared drop zone without collapsing requirements', () => {
  assert.match(professionalPage, /import \{ FileDropzone \} from ['"]\.\.\/components\/ui\/FileDropzone['"]/);
  assert.match(identityPanel, /<FileDropzone/);
  assert.match(credentialUploadRow, /<FileDropzone/);
  assert.match(credentialSection, /<FileDropzone/);

  for (const label of ['Valid ID front', 'Valid ID back', 'Liveness selfie', 'PRC', 'BOA', 'Tax']) {
    assert.match(professionalPage, new RegExp(label, 'i'));
  }

  assert.match(identityPanel, /kind: 'valid_id_front'/);
  assert.match(identityPanel, /kind: 'valid_id_back'/);
  assert.match(identityPanel, /kind: 'liveness_selfie'/);
  assert.match(identityPanel, /capture: 'user'/);
  assert.match(identityPanel, /formatFileSize\(row\.document\?\.fileSize\)/);
  assert.match(credentialSection, /documentLabel="Resume"/);
  assert.match(credentialSection, /visibleCertificationRequirements\.map/);
  assert.match(credentialSection, /otherDocuments\.map/);
  assert.match(credentialSection, /uploadOtherDocumentRow\(row, file\)/);
  assert.match(credentialSection, /visibleCertificationRequirements\.map\(\(requirement\) =>/);
  assert.match(credentialSection, /documentKey=\{requirement\.upload\?\.key \|\| `certification:\$\{requirement\.label\}`\}/);
  assert.match(credentialSection, /documentType="certification"/);
  assert.doesNotMatch(credentialSection, /PRC\s+or\s+BOA|BOA\s+or\s+Tax|PRC\s*\/\s*BOA\s*\/\s*Tax/i);
  assert.match(professionalPage, /MAX_CREDENTIAL_UPLOAD_BYTES = 3 \* 1024 \* 1024/);
  assert.match(professionalPage, /validateCredentialFile/);
});

test('professional document expiry, locking, preview warmup, removal, and rejection states remain explicit', () => {
  assert.match(credentialUploadRow, /expiryDate/);
  assert.match(credentialUploadRow, /No expiration date/);
  assert.match(credentialUploadRow, /isLocked=\{isLockedApproved\}/);
  assert.match(credentialUploadRow, /status=\{dropzoneStatus\}/);
  assert.match(credentialUploadRow, /error=\{getCredentialReviewMessage\(upload\)\}/);
  assert.match(credentialUploadRow, /onMouseEnter=\{\(\) => onPreviewWarmup\?\.\(upload\)\}/);
  assert.match(credentialUploadRow, /onFocusCapture=\{\(\) => onPreviewWarmup\?\.\(upload\)\}/);
  assert.match(credentialUploadRow, /onRemove\(\{ documentKey, documentType, label: documentLabel \}\)/);
  assert.match(credentialUploadRow, /changeRequestStatus === 'pending'/);
});

test('identity and credential change requests use semantic shared modal forms and sticky actions', () => {
  for (const [source, title] of [
    [identityPanel, 'Request Identity Document Change/Removal'],
    [credentialSection, 'Request Document Change/Removal'],
  ]) {
    assert.match(source, new RegExp(`<Modal[\\s\\S]*title="${title.replace('/', '\\/')}"[\\s\\S]*footer=\\{`));
    assert.match(source, /<FormField/);
    assert.match(source, /bg-warning-surface/);
    assert.match(source, /border-warning-border/);
    assert.match(source, /<Button/);
    assert.match(source, /Submit Request/);
  }

  assert.match(identityPanel, /Document expired \/ needs renewal/);
  assert.match(identityPanel, /Remove this document/);
  assert.match(credentialSection, /Incorrect document uploaded/);
  assert.match(credentialSection, /Details are outdated/);
  assert.match(identityPanel, /changeRequestStatus === 'pending'/);
  assert.match(credentialUploadRow, /changeRequestStatus === 'pending'/);
});

test('professional shell and dashboard use shared signature primitives and semantic states', () => {
  for (const primitive of [
    'BrandMark',
    'Button',
    'FormField',
    'formControlClassName',
    'Modal',
    'SegmentedControl',
    'StatusBadge',
    'SurfaceCard',
    'Toggle',
    'toneForTier',
  ]) {
    assert.match(professionalPage, new RegExp(`\\b${primitive}\\b`));
  }

  assert.match(professionalPortal, /<BrandMark/);
  assert.match(professionalPortal, /<StatusBadge/);
  assert.match(professionalPortal, /toneForTier\(professionalPermissions\.tier\)/);
  assert.match(professionalPortal, /<SurfaceCard/);
  assert.match(professionalPortal, /<Button/);
  assert.match(professionalPortal, /bg-canvas/);
  assert.match(professionalPortal, /aria-label="Professional workspace navigation"/);
  assert.match(professionalPortal, /aria-current=\{appView === tab\.id \? 'page' : undefined\}/);
  assert.match(professionalPortal, /min-h-11/);
  assert.match(professionalPortal, /unreadClassName="bg-action"/);
});

test('professional migration preserves admin approval and dashboard permission locking', () => {
  for (const permission of [
    'canAccessDashboard: false',
    'canAppearInTalentPool: false',
    'canToggleProfileVisibility: false',
    'canViewFullClientProfiles: false',
    'canAccessDashboard: true',
    'canToggleProfileVisibility: true',
  ]) {
    assert.match(professionalPage, new RegExp(permission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(professionalPortal, /const availableTabs = professionalPermissions\.canAccessDashboard \? PROFESSIONAL_TABS : \['profile'\]/);
  assert.match(professionalPortal, /availableTabs\.includes\(requestedTab\) \? requestedTab : 'profile'/);
  assert.match(professionalPortal, /!professionalPermissions\.canAccessDashboard[\s\S]*admin approves your identity, resume, and required documents/i);
});

test('profile visibility and audience preview preserve separate state and API paths', () => {
  const previewHandler = sourceBetween(profileView, 'const openProfilePreview', 'const toggleProfileVisibility');
  const visibilityHandler = sourceBetween(profileView, 'const toggleProfileVisibility', 'return (');

  assert.match(profileView, /const \[isVisibilitySaving, setIsVisibilitySaving\] = useState\(false\)/);
  assert.match(profileView, /const profileVisibility = displayProfile\.profileVisibility \|\| displayProfile\.profile_visibility \|\| 'hidden'/);
  assert.match(profileView, /<Toggle/);
  assert.match(profileView, /onChange=\{toggleProfileVisibility\}/);
  assert.match(profileView, /isBusy=\{isVisibilitySaving\}/);
  assert.match(visibilityHandler, /backendApi\.talent\.updateVisibility\(\{ visibility: nextVisibility \}\)/);
  assert.match(visibilityHandler, /setIsVisibilitySaving\(true\)/);
  assert.match(visibilityHandler, /setIsVisibilitySaving\(false\)/);

  assert.match(profileView, /<SegmentedControl/);
  assert.match(profileView, /ariaLabel="View profile as"/);
  assert.match(profileView, /Basic Client/);
  assert.match(profileView, /Verified Client/);
  assert.match(profileView, /onChange=\{openProfilePreview\}/);
  assert.match(previewHandler, /backendApi\.talent\.getProfilePreview\(\{ tier \}\)/);
  assert.doesNotMatch(previewHandler, /updateMyProfile|updateVisibility|setSavedProfile/);
  assert.match(profilePreview, /const canViewFullDocuments = Boolean\(profile\?\.canViewFullDocuments\)/);
  assert.match(profilePreview, /Resume and required documents are hidden for Basic clients\./);
  assert.match(profilePreview, /previewTier: tier/);
});

test('Profile Settings remains a responsive modal with shared fields, guidance, and sticky actions', () => {
  assert.match(profileSettings, /<Modal[\s\S]*title="Profile Settings"/);
  assert.doesNotMatch(profileSettings, /<details|Accordion/);
  assert.match(profileSettings, /md:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(profileSettings, /proper attire/i);
  assert.match(profileSettings, /professional pose/i);
  assert.match(profileSettings, /accept="\.jpg,\.jpeg,\.png,image\/jpeg,image\/png"/);
  assert.match(profileSettings, /onPhotoUpload/);
  assert.match(profileSettings, /footer=\{/);
  assert.match(profileSettings, /aria-live="polite"/);

  for (const field of [
    'professional-full-name',
    'professional-location',
    'professional-titles',
    'professional-availability',
    'professional-bio',
    'professional-hourly-rate',
    'professional-years-experience',
    'professional-skills',
    'professional-tools',
  ]) {
    assert.match(profileSettings, new RegExp(`<FormField[\\s\\S]*?id="${field}"`));
  }

  assert.match(profileSettings, /formControlClassName/);
  assert.match(profileSettings, /<Button[\s\S]*Save Settings/);
});

test('Profile Settings only describes multi-select controls when FormField renders a description', () => {
  for (const field of [
    'professional-titles',
    'professional-skills',
    'professional-tools',
  ]) {
    const fieldStart = profileSettings.indexOf(`<FormField id="${field}"`);
    const fieldSource = profileSettings.slice(fieldStart, profileSettings.indexOf('</FormField>', fieldStart));

    assert.match(fieldSource, /\{\(\{ 'aria-describedby': ariaDescribedBy \}\) =>/);
    assert.match(fieldSource, /describedBy=\{ariaDescribedBy\}/);
    assert.doesNotMatch(fieldSource, /\{\(\{ describedBy \}\) =>/);
  }
});

test('professional profile columns can shrink inside the 320px workspace', () => {
  assert.match(profileView, /grid min-w-0 gap-6 xl:grid-cols-\[340px_minmax\(0,1fr\)\]/);
  assert.match(profileView, /className="min-w-0 w-full"/);
  assert.match(profileView, /className="min-w-0 flex-1 w-full space-y-6"/);
});

test('professional permission and profile-save helpers preserve exact output', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const module = await vite.ssrLoadModule('/src/pages/ProfessionalPages.jsx');
    assert.equal(typeof module.getProfessionalPortalPermissions, 'function');
    assert.equal(typeof module.buildProfileSavePayload, 'function');

    assert.deepEqual(module.getProfessionalPortalPermissions({ professional_tier: 'verified' }), {
      canAccessDashboard: true,
      canAppearInTalentPool: true,
      canCommentOnJobPosts: true,
      canContactClientsFromJobs: true,
      canToggleProfileVisibility: true,
      canViewFullClientProfiles: true,
      label: 'Verified',
      tier: 'verified',
    });

    assert.deepEqual(module.buildProfileSavePayload({
      available: 'Within two weeks',
      bio: 'Finance transformation lead.',
      certifications: ['CPA'],
      name: 'Ada Ledger',
      rate: 72,
      location: 'Manila',
      skills: ['Forecasting'],
      titles: ['Controller', 'Controller', ''],
      tools: ['Xero'],
      workPreferences: { timezone: 'Asia/Manila', remote: false },
      yearsExperience: 8,
    }, {
      certifications: ['CPA', 'CMA'],
      submitForReview: true,
      workPreferences: { remote: true },
    }), {
      availability: 'Within two weeks',
      bio: 'Finance transformation lead.',
      certifications: ['CPA', 'CMA'],
      fullName: 'Ada Ledger',
      hourlyRate: 72,
      location: 'Manila',
      skills: ['Forecasting'],
      submitForReview: true,
      titles: ['Controller'],
      tools: ['Xero'],
      workPreferences: { timezone: 'Asia/Manila', remote: true },
      yearsExperience: 8,
    });
  } finally {
    await vite.close();
  }
});

test('professional portal server-renders accessible signature state at 320px-safe markup boundaries', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const { ProfessionalPortal } = await vite.ssrLoadModule('/src/pages/ProfessionalPages.jsx');
    const html = renderToStaticMarkup(createElement(
      MemoryRouter,
      { initialEntries: ['/?tab=profile'] },
      createElement(ProfessionalPortal, {
        isDarkMode: false,
        onLogout: () => {},
        toggleDarkMode: () => {},
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Ada Ledger',
          professionalTier: 'verified',
          title: 'Controller',
        },
      }),
    ));

    assert.match(html, /aria-label="PB Finance"/);
    assert.match(html, /aria-label="Professional workspace navigation"/);
    assert.match(html, /aria-current="page"/);
    assert.match(html, /role="switch"/);
    assert.match(html, /role="radiogroup"/);
    assert.match(html, /Basic Client/);
    assert.match(html, /Verified Client/);
    assert.match(html, /Professional Dashboard/);
    assert.match(html, /overflow-x-auto/);
  } finally {
    await vite.close();
  }
});
