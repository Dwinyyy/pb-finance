import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldSendNotificationEmail } from '../server/notifications.js';
import {
  getWebPushConfig,
  normalizePushSubscription,
  sendPushNotifications,
} from '../server/pushNotifications.js';

const configuredEnv = {
  WEB_PUSH_SUBJECT: 'mailto:security@pbfinance.com',
  WEB_PUSH_VAPID_PRIVATE_KEY: 'private-key',
  WEB_PUSH_VAPID_PUBLIC_KEY: 'public-key',
};

test('configured notification email sends unless explicitly disabled', () => {
  assert.equal(shouldSendNotificationEmail({}), true);
  assert.equal(shouldSendNotificationEmail({ NOTIFICATION_EMAILS_DISABLED: 'false' }), true);
  assert.equal(shouldSendNotificationEmail({ NOTIFICATION_EMAILS_DISABLED: 'TRUE' }), false);
});

test('web push config requires all VAPID values', () => {
  assert.deepEqual(getWebPushConfig({}), {
    configured: false,
    publicKey: '',
  });
  assert.deepEqual(getWebPushConfig(configuredEnv), {
    configured: true,
    publicKey: 'public-key',
  });
});

test('push subscriptions are normalized without accepting an owner id', () => {
  assert.deepEqual(normalizePushSubscription({
    endpoint: 'https://push.example.test/subscription/123',
    expirationTime: 123456,
    keys: {
      auth: 'auth-key',
      p256dh: 'p256dh-key',
    },
    userId: 'attacker-controlled',
  }), {
    auth: 'auth-key',
    endpoint: 'https://push.example.test/subscription/123',
    expirationTime: 123456,
    p256dh: 'p256dh-key',
  });
});

test('web push delivers to active subscriptions and deletes stale endpoints', async () => {
  const restCalls = [];
  const sentPayloads = [];
  const restRequest = async (path, options = {}) => {
    restCalls.push({ options, path });

    if (options.method === 'DELETE') return null;

    return [
      {
        auth: 'active-auth',
        endpoint: 'https://push.example.test/active',
        id: 'active-id',
        p256dh: 'active-p256dh',
      },
      {
        auth: 'stale-auth',
        endpoint: 'https://push.example.test/stale',
        id: 'stale-id',
        p256dh: 'stale-p256dh',
      },
    ];
  };
  const sendNotification = async (subscription, payload, options) => {
    sentPayloads.push({ options, payload: JSON.parse(payload), subscription });

    if (subscription.endpoint.endsWith('/stale')) {
      const error = new Error('Gone');
      error.statusCode = 410;
      throw error;
    }

    return { statusCode: 201 };
  };

  const result = await sendPushNotifications({
    actionUrl: '/?tab=profile',
    body: 'Your PRC license expires soon.',
    recipientId: '22222222-2222-4222-8222-222222222222',
    title: 'Document expiring soon',
    type: 'document_expiring',
  }, { env: configuredEnv, restRequest, sendNotification });

  assert.deepEqual(result, {
    attempted: 2,
    configured: true,
    errors: 0,
    removed: 1,
    sent: 1,
  });
  assert.equal(sentPayloads[0].payload.actionUrl, '/?tab=profile');
  assert.equal(sentPayloads[0].options.vapidDetails.subject, configuredEnv.WEB_PUSH_SUBJECT);
  assert.equal(
    restCalls.some((call) => call.path === '/push_subscriptions?id=eq.stale-id' && call.options.method === 'DELETE'),
    true
  );
});
