import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const source = readFileSync(new URL('../src/components/DashboardAccountMenu.jsx', import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

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

  assert.match(source, /const updatePanelTop = useCallback/);
  assert.match(source, /const handleTriggerClick = \(\) => \{[\s\S]*?updatePanelTop\(\);[\s\S]*?dispatch\(\{ type: 'toggle-pin' \}\);/);
  assert.match(source, /const handlePointerEnter = \(event\) => \{[\s\S]*?updatePanelTop\(\);[\s\S]*?dispatch\(\{ type: 'hover-enter' \}\);/);
  assert.match(source, /\{isOpen && panelTop !== null && \(/);
});
