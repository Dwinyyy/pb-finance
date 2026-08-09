import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

import * as notificationNavigation from '../src/utils/notificationNavigation.js';

const panelSource = readFileSync(new URL('../src/components/NotificationPanel.jsx', import.meta.url), 'utf8');
const bellSource = readFileSync(new URL('../src/components/NotificationBell.jsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../src/utils/notificationNavigation.js', import.meta.url), 'utf8');
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

test('notification targets allow same-origin and HTTP(S), and reject unsafe protocols', () => {
  assert.deepEqual(notificationNavigation.getNotificationNavigationTarget('/?tab=profile', 'https://pb.test'), {
    href: '/?tab=profile',
    kind: 'internal',
  });
  assert.deepEqual(notificationNavigation.getNotificationNavigationTarget('https://docs.example.com/help', 'https://pb.test'), {
    href: 'https://docs.example.com/help',
    kind: 'external',
  });
  assert.deepEqual(notificationNavigation.getNotificationNavigationTarget('javascript:alert(1)', 'https://pb.test'), {
    href: '',
    kind: 'none',
  });
});

test('reusable notification components generate unique paired accessibility IDs', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const [{ NotificationBell }, { NotificationPanel }] = await Promise.all([
      vite.ssrLoadModule('/src/components/NotificationBell.jsx'),
      vite.ssrLoadModule('/src/components/NotificationPanel.jsx'),
    ]);
    const bellHtml = renderToStaticMarkup(createElement(
      MemoryRouter,
      null,
      createElement('div', null,
        createElement(NotificationBell, { key: 'first', notificationState, userId: 'first-user' }),
        createElement(NotificationBell, { key: 'second', notificationState, userId: 'second-user' }),
      ),
    ));
    const unreadDescriptionIds = [...bellHtml.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
    const controlledPanelIds = [...bellHtml.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1]);
    const bellElementIds = new Set([...bellHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

    assert.equal(unreadDescriptionIds.length, 2);
    assert.equal(new Set(unreadDescriptionIds).size, 2);
    assert.equal(controlledPanelIds.length, 2);
    assert.equal(new Set(controlledPanelIds).size, 2);
    for (const id of unreadDescriptionIds) assert.equal(bellElementIds.has(id), true);
    assert.match(bellSource, /useId/);
    assert.match(bellSource, /aria-controls=\{panelId\}/);
    assert.match(bellSource, /id=\{panelId\}/);

    const panelHtml = renderToStaticMarkup(createElement(
      MemoryRouter,
      null,
      createElement('div', null,
        createElement(NotificationPanel, { key: 'first', notificationState }),
        createElement(NotificationPanel, { key: 'second', notificationState }),
      ),
    ));
    const headingIds = [...panelHtml.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
    const panelElementIds = new Set([...panelHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

    assert.equal(headingIds.length, 2);
    assert.equal(new Set(headingIds).size, 2);
    for (const id of headingIds) assert.equal(panelElementIds.has(id), true);
    assert.match(panelSource, /useId/);
  } finally {
    await vite.close();
  }
});

test('rejected notification work still closes and navigates in sequence', async () => {
  assert.equal(typeof notificationNavigation.openNotificationSafely, 'function');

  const calls = [];
  const notification = { actionUrl: '/?tab=profile', id: 'notification-1' };

  await assert.doesNotReject(() => notificationNavigation.openNotificationSafely({
    assign: (href) => calls.push(`assign:${href}`),
    markRead: async (receivedNotification) => {
      calls.push(`mark:${receivedNotification.id}`);
      throw new Error('read failed');
    },
    navigate: (href) => calls.push(`navigate:${href}`),
    notification,
    onNotificationOpened: async (receivedNotification) => {
      await Promise.resolve();
      calls.push(`opened:${receivedNotification.id}`);
      throw new Error('refresh failed');
    },
    onRequestClose: () => calls.push('close'),
    origin: 'https://pb.test',
  }));

  assert.deepEqual(calls, [
    'mark:notification-1',
    'opened:notification-1',
    'close',
    'navigate:/?tab=profile',
  ]);
});

test('shared panel owns refresh, retry, push, read, and viewport-safe presentation', () => {
  assert.match(panelSource, /loadNotifications\(\{ showLoading: true \}\)/);
  assert.match(panelSource, /getPushNotificationState/);
  assert.match(panelSource, /markAllRead/);
  assert.match(navigationSource, /await markRead\(notification\)/);
  assert.match(panelSource, /Retry/);
  assert.match(panelSource, /max-h-\[min\(32rem,calc\(100dvh-8rem\)\)\]/);
  assert.match(panelSource, /overflow-y-auto/);
  assert.match(panelSource, /aria-live="polite"/);
});

test('configured push controls leave the notification list as the bounded scrollport', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const { NotificationPanel } = await vite.ssrLoadModule('/src/components/NotificationPanel.jsx');
    const html = renderToStaticMarkup(createElement(
      MemoryRouter,
      null,
      createElement(NotificationPanel, { notificationState }),
    ));

    assert.match(html, /<section[^>]*class="[^"]*flex[^"]*max-h-\[min\(32rem,calc\(100dvh-8rem\)\)\][^"]*flex-col[^"]*overflow-hidden/);
    assert.match(html, /<header class="[^"]*shrink-0/);
    assert.match(html, /aria-live="polite" class="[^"]*min-h-0[^"]*flex-1[^"]*overflow-y-auto/);
    assert.match(
      panelSource,
      /pushState\?\.supported && pushState\.configured[\s\S]*?<div className="shrink-0 border-b border-border-subtle bg-surface-muted/,
    );
  } finally {
    await vite.close();
  }
});

test('standalone NotificationBell delegates content to the shared panel', () => {
  assert.match(bellSource, /<NotificationPanel/);
  assert.match(bellSource, /aria-expanded=\{isOpen\}/);
  assert.match(bellSource, /aria-controls=/);
});
