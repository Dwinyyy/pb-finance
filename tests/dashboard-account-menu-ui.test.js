import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const source = readFileSync(new URL('../src/components/DashboardAccountMenu.jsx', import.meta.url), 'utf8');
const clientPage = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const professionalPage = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const sourceBetween = (value, start, end) => {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  return value.slice(startIndex, endIndex < 0 ? value.length : endIndex);
};

const clientPortal = sourceBetween(clientPage, 'export function ClientPortal', 'function ClientHome');
const professionalPortal = sourceBetween(professionalPage, 'export function ProfessionalPortal', 'function AppTalentProfileView');

const notificationState = {
  error: '',
  isLoading: false,
  loadNotifications: async () => [],
  markAllRead: async () => {},
  markRead: async () => {},
  notifications: [],
  unreadCount: 2,
};

const baseProps = {
  accountTypeLabel: 'Verified account',
  avatarUrl: '/aldwin-profile.png',
  companyOrContext: 'PB Finance',
  isDarkMode: false,
  name: 'Aldwin Gotingco',
  notificationState,
  onGuide: () => {},
  onLogout: () => {},
  onNotificationOpened: () => {},
  onProfile: () => {},
  onThemeToggle: () => {},
  role: 'client',
};

const renderMenu = (DashboardAccountMenu, props = {}) => renderToStaticMarkup(createElement(
  MemoryRouter,
  null,
  createElement(DashboardAccountMenu, { ...baseProps, ...props }),
));

test('account menu server-renders an accessible closed avatar trigger', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const { DashboardAccountMenu } = await vite.ssrLoadModule('/src/components/DashboardAccountMenu.jsx');
    const html = renderMenu(DashboardAccountMenu);
    const initialsHtml = renderMenu(DashboardAccountMenu, { avatarUrl: '' });

    assert.match(html, /aria-label="Open account menu for Aldwin Gotingco"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /aria-controls=/);
    assert.match(html, /class="[^"]*min-h-11 min-w-11/);
    assert.match(html, /alt="Aldwin Gotingco profile"/);
    assert.match(initialsHtml, /aria-hidden="true"[^>]*>AG</);
    assert.equal([...html.matchAll(/<button\b/g)].length, 1);
    assert.equal([...initialsHtml.matchAll(/<button\b/g)].length, 1);
    assert.doesNotMatch(html, />Profile<|>Notifications<|>Client guide<|>Log out</);
  } finally {
    await vite.close();
  }
});

test('account menu source preserves the interaction and design contracts', () => {
  assert.match(source, /ACCOUNT_MENU_WIDTH_CLASS = 'w-\[min\(286px,calc\(100vw-36px\)\)\]'/);
  assert.match(source, /pt-2/);
  assert.match(source, /aria-pressed=\{matchmakerAction\.pressed\}/);
  assert.match(source, /UserRound/);
  assert.match(source, /Bell/);
  assert.match(source, /BookOpen/);
  assert.match(source, /Sparkles/);
  assert.match(source, /LogOut/);
  assert.match(source, /alt=\{`\$\{name\} profile`\}/);
  assert.match(source, /aria-hidden="true"/);
  assert.doesNotMatch(source, /role="menu"/);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}/i);
});

test('account actions use Lucide icons, destination-aware theme labels, and accessible targets', () => {
  const imports = source.slice(source.indexOf("from 'lucide-react'") - 180, source.indexOf("from 'lucide-react'") + 20);

  for (const icon of ['Bell', 'BookOpen', 'LogOut', 'Moon', 'Sparkles', 'Sun', 'UserRound']) {
    assert.match(imports, new RegExp(`\\b${icon}\\b`));
    assert.match(source, new RegExp(`<${icon}\\b`));
  }

  assert.match(source, /isDarkMode \? 'Switch to light mode' : 'Switch to dark mode'/);
  assert.match(source, /isDarkMode \? \([\s\S]*<Sun[\s\S]*\) : \([\s\S]*<Moon/);
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /focus-visible:ring-4 focus-visible:ring-focus\/25/);
  assert.match(source, /aria-label=\{getDashboardAccountMenuTriggerLabel\(state, name\)\}/);
  assert.doesNotMatch(source, /(?:🔔|🌙|☀️|✨|👤|🚪)/u);
});

test('danger actions have no competing neutral tone and mobile position is seeded before open', () => {
  const structureClass = source.match(/const ACTION_STRUCTURE_CLASS = '([^']+)'/)?.[1] || '';

  assert.ok(structureClass, 'missing structural action class');
  assert.doesNotMatch(
    structureClass,
    /\btext-text-primary\b|\btext-danger\b|\bbg-surface-muted\b|\bbg-danger-surface\b|hover:bg-/,
  );
  assert.match(source, /const ACTION_TONE_CLASS = 'text-text-primary hover:bg-surface-muted'/);
  assert.match(source, /const DANGER_ACTION_TONE_CLASS = 'bg-danger-surface text-danger hover:bg-danger-surface\/80'/);
  assert.match(source, /className={`\$\{ACTION_STRUCTURE_CLASS\} \$\{DANGER_ACTION_TONE_CLASS\}`}/);

  assert.match(source, /const updatePanelLayout = useCallback/);
  assert.match(source, /const handleTriggerClick = \(\) => \{[\s\S]*?updatePanelLayout\(\);[\s\S]*?dispatch\(\{ type: 'toggle-pin' \}\);/);
  assert.match(source, /const handlePointerEnter = \(event\) => \{[\s\S]*?updatePanelLayout\(\);[\s\S]*?dispatch\(\{ type: 'hover-enter' \}\);/);
  assert.match(source, /\{isOpen && panelLayout !== null && \(/);
  assert.match(source, /maxHeight: `\$\{panelLayout\.maxHeight\}px`/);
  assert.match(source, /className={`[^`]*flex max-sm:fixed[\s\S]*flex-col pt-2/);
  assert.match(source, /className="min-h-0 overflow-x-hidden overflow-y-auto/);
});

test('both portal shells render one account menu and no standalone account controls', () => {
  for (const [page, portal, role] of [
    [clientPage, clientPortal, 'client'],
    [professionalPage, professionalPortal, 'professional'],
  ]) {
    assert.match(page, /import \{ DashboardAccountMenu \} from ['"]\.\.\/components\/DashboardAccountMenu['"]/);
    assert.equal([...portal.matchAll(/<DashboardAccountMenu\b/g)].length, 1);
    assert.match(portal, new RegExp(`role="${role}"`));
    assert.match(portal, /px-\[18px\] sm:px-6 lg:px-8/);
    assert.doesNotMatch(portal, /<NotificationBell\b/);
    assert.doesNotMatch(portal, /aria-label="(?:Client|Professional) account controls"/);
    assert.doesNotMatch(portal, /aria-label="Toggle dark mode"/);
    assert.doesNotMatch(portal, /aria-label="Log out"/);
  }

  assert.doesNotMatch(clientPage, /import \{ NotificationBell \}/);
  assert.doesNotMatch(professionalPage, /import \{ NotificationBell \}/);
});

test('portal account menu callbacks preserve role-specific identity and destinations', () => {
  assert.match(clientPortal, /onProfile=\{\(\) => setProfileSection\('account'\)\}/);
  assert.match(
    clientPortal,
    /matchmakerAction=\{clientPermissions\.canUseMatchmaker\s*\?\s*\{/,
  );
  assert.match(clientPortal, /label:\s*matchmakerVisible\s*\?\s*'Hide AI Matchmaker'\s*:\s*'Open AI Matchmaker'/);
  assert.match(clientPortal, /onToggle:\s*\(\) => setMatchmakerVisible\(\(current\) => !current\)/);
  assert.match(clientPortal, /pressed:\s*matchmakerVisible/);
  assert.doesNotMatch(clientPortal, /clientPermissions\.canUseMatchmaker && matchmakerVisible\s*\?\s*\{/);
  assert.match(clientPortal, /companyOrContext=\{user\.company \|\| 'Client account'\}/);
  assert.match(clientPortal, /onLogout=\{onLogout\}/);

  assert.match(professionalPortal, /const professionalAccountContext = user\?\.company\s*\|\|\s*cleanProfileTitle\(user\?\.title\)\s*\|\|\s*'Independent professional'/);
  assert.match(professionalPortal, /onProfile=\{\(\) => setAppView\('profile'\)\}/);
  assert.match(professionalPortal, /companyOrContext=\{professionalAccountContext\}/);
  assert.match(professionalPortal, /onLogout=\{onLogout\}/);
  assert.doesNotMatch(professionalPortal, /matchmakerAction=/);
});

test('each portal owns one memoized notification source and refreshes identity before navigation', () => {
  for (const portal of [clientPortal, professionalPortal]) {
    assert.equal([...portal.matchAll(/useNotifications\(/g)].length, 1);
    assert.match(portal, /const handleRealtimeNotification = useCallback/);
    assert.match(portal, /const handleNotificationOpened = useCallback/);
    assert.match(portal, /onRealtimeNotification:\s*handleRealtimeNotification/);
    assert.match(portal, /onNotificationOpened=\{handleNotificationOpened\}/);
    assert.match(portal, /await refreshSessionUser\(\)/);
  }
});
