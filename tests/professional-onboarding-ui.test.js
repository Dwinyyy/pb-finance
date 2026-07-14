import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
const apiService = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
const adminPage = readFileSync(new URL('../src/pages/AdminPages.jsx', import.meta.url), 'utf8');
const notificationBell = readFileSync(new URL('../src/components/NotificationBell.jsx', import.meta.url), 'utf8');
const professionalPage = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
const pushService = readFileSync(new URL('../src/services/pushNotifications.js', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/pb-push-sw.js', import.meta.url), 'utf8');

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
