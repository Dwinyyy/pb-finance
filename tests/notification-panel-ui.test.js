import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getNotificationNavigationTarget } from '../src/utils/notificationNavigation.js';

const panelSource = readFileSync(new URL('../src/components/NotificationPanel.jsx', import.meta.url), 'utf8');
const bellSource = readFileSync(new URL('../src/components/NotificationBell.jsx', import.meta.url), 'utf8');

test('notification targets allow same-origin and HTTP(S), and reject unsafe protocols', () => {
  assert.deepEqual(getNotificationNavigationTarget('/?tab=profile', 'https://pb.test'), {
    href: '/?tab=profile',
    kind: 'internal',
  });
  assert.deepEqual(getNotificationNavigationTarget('https://docs.example.com/help', 'https://pb.test'), {
    href: 'https://docs.example.com/help',
    kind: 'external',
  });
  assert.deepEqual(getNotificationNavigationTarget('javascript:alert(1)', 'https://pb.test'), {
    href: '',
    kind: 'none',
  });
});

test('shared panel owns refresh, retry, push, read, and viewport-safe presentation', () => {
  assert.match(panelSource, /loadNotifications\(\{ showLoading: true \}\)/);
  assert.match(panelSource, /getPushNotificationState/);
  assert.match(panelSource, /markAllRead/);
  assert.match(panelSource, /markRead\(notification\)/);
  assert.match(panelSource, /Retry/);
  assert.match(panelSource, /max-h-\[min\(32rem,calc\(100dvh-8rem\)\)\]/);
  assert.match(panelSource, /overflow-y-auto/);
  assert.match(panelSource, /aria-live="polite"/);
});

test('standalone NotificationBell delegates content to the shared panel', () => {
  assert.match(bellSource, /<NotificationPanel/);
  assert.match(bellSource, /aria-expanded=\{isOpen\}/);
  assert.match(bellSource, /aria-controls=/);
});
