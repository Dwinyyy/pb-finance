import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profile = readFileSync(
  new URL('../src/components/ClientProfileDashboard.jsx', import.meta.url),
  'utf8',
);
const clientPage = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');

const between = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex < 0 ? source.length : endIndex);
};

test('client profile composes the account and existing verification workspaces', () => {
  assert.match(profile, /export function ClientProfileDashboard\(\{[\s\S]*section[\s\S]*onSectionChange[\s\S]*onUserUpdated/);
  assert.match(profile, />\s*Account\s*</);
  assert.match(profile, />\s*Verification\s*</);
  assert.match(profile, /aria-pressed=\{normalizedSection === 'account'\}/);
  assert.match(profile, /aria-pressed=\{normalizedSection === 'verification'\}/);
  assert.equal([...profile.matchAll(/<ClientVerificationDashboard\b/g)].length, 1);

  for (const primitive of ['FormField', 'FileDropzone', 'Button', 'StatusBadge', 'SurfaceCard']) {
    assert.match(profile, new RegExp(`<${primitive}\\b`));
  }
  assert.doesNotMatch(profile, /#[0-9a-f]{3,8}/i);
});

test('account loading and mutations preserve a dirty draft on failures', () => {
  assert.match(profile, /backendApi\.client\.getMyProfile\(\)/);
  assert.match(profile, /backendApi\.client\.updateMyProfile\(/);
  assert.match(profile, /backendApi\.client\.uploadProfilePhoto\(/);
  assert.match(profile, /createClientProfileDraft/);
  assert.match(profile, /validateClientProfileDraft/);
  assert.match(profile, /shouldRequestProtectedNameReason/);
  assert.match(profile, /loadError[\s\S]*Retry/);

  const saveHandler = between(profile, 'const handleSave', 'const handlePhoto');
  assert.match(saveHandler, /setSaveError/);
  assert.match(saveHandler, /onUserUpdated\(result\.sessionSummary\)/);
  assert.doesNotMatch(saveHandler, /catch[\s\S]*setDraft\(createClientProfileDraft/);

  const photoHandler = between(profile, 'const handlePhoto', 'const handleCancel');
  assert.match(photoHandler, /setUploadError/);
  assert.match(photoHandler, /onUserUpdated\(result\.sessionSummary\)/);
  assert.doesNotMatch(photoHandler, /verification|uploadVerificationDocument/);
  assert.doesNotMatch(photoHandler, /catch[\s\S]*setDraft\(/);
});

test('protected names and account-only avatar behavior remain explicit', () => {
  assert.match(profile, /requiresProtectedNameReason\s*&&/);
  assert.match(profile, /A 1 to 1,000 character explanation/);
  assert.match(profile, /pendingNameRequest[\s\S]*readOnly/);
  assert.match(profile, /pendingNameRequest\.requestedFullName/);
  assert.match(profile, /pendingNameRequest\.requestReason/);
  assert.match(profile, /latestNameRequest[\s\S]*decisionReason/);
  assert.match(profile, /Verified legal business name/);
  assert.match(profile, /JPEG or PNG[\s\S]*3 MB/);
  assert.match(profile, /display avatar[\s\S]*not verification evidence/i);
  assert.match(profile, /handleCancel[\s\S]*createClientProfileDraft\(canonical\.account\)/);
});

test('client profile routing is hidden from primary navigation and preserves search state', () => {
  assert.match(clientPage, /const CLIENT_ROUTE_TABS = \[[^\]]*'profile'/);
  const primaryTabs = between(clientPage, 'const availableTabs = useMemo', 'const availableTabIds');
  assert.doesNotMatch(primaryTabs, /id: 'profile'|label: 'Profile'/);
  assert.doesNotMatch(primaryTabs, /id: 'verification'/);
  assert.match(clientPage, /appView === 'profile'[\s\S]*<ClientProfileDashboard/);
  assert.match(clientPage, /searchParams\.get\('section'\) === 'verification' \? 'verification' : 'account'/);
  assert.match(clientPage, /new URLSearchParams\(searchParams\)/);
  assert.match(clientPage, /nextParams\.set\('tab', 'profile'\)/);
  assert.match(clientPage, /nextParams\.set\('section', 'verification'\)/);
  assert.match(clientPage, /setSearchParams\(nextParams, \{ replace: true \}\)/);
});
