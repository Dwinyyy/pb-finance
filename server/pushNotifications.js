import webPush from 'web-push';

import { supabaseRestRequest } from './supabase.js';

const cleanString = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const getVapidDetails = (env = process.env) => ({
  privateKey: cleanString(env.WEB_PUSH_VAPID_PRIVATE_KEY, 500),
  publicKey: cleanString(env.WEB_PUSH_VAPID_PUBLIC_KEY, 500),
  subject: cleanString(env.WEB_PUSH_SUBJECT, 500),
});

export const getWebPushConfig = (env = process.env) => {
  const details = getVapidDetails(env);

  return {
    configured: Boolean(details.publicKey && details.privateKey && details.subject),
    publicKey: details.publicKey,
  };
};

export const normalizePushSubscription = (value) => {
  const subscription = value && typeof value === 'object' ? value : {};
  const keys = subscription.keys && typeof subscription.keys === 'object' ? subscription.keys : {};
  const endpoint = cleanString(subscription.endpoint, 2000);
  const p256dh = cleanString(keys.p256dh || subscription.p256dh, 1000);
  const auth = cleanString(keys.auth || subscription.auth, 1000);
  const expirationNumber = Number(subscription.expirationTime ?? subscription.expiration_time);
  let parsedEndpoint;

  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new Error('A valid push subscription endpoint is required.');
  }

  if (parsedEndpoint.protocol !== 'https:' || !p256dh || !auth) {
    throw new Error('A valid push subscription endpoint and browser keys are required.');
  }

  return {
    auth,
    endpoint: parsedEndpoint.href,
    expirationTime: Number.isFinite(expirationNumber) && expirationNumber > 0
      ? Math.trunc(expirationNumber)
      : null,
    p256dh,
  };
};

const toPushSubscription = (row) => ({
  endpoint: row.endpoint,
  expirationTime: row.expiration_time || null,
  keys: {
    auth: row.auth,
    p256dh: row.p256dh,
  },
});

export const sendPushNotifications = async ({
  actionUrl = '/',
  body,
  recipientId,
  title,
  type,
}, {
  env = process.env,
  restRequest = supabaseRestRequest,
  sendNotification = webPush.sendNotification.bind(webPush),
} = {}) => {
  const config = getWebPushConfig(env);
  const result = {
    attempted: 0,
    configured: config.configured,
    errors: 0,
    removed: 0,
    sent: 0,
  };

  const missingDefaultServiceRole = restRequest === supabaseRestRequest && !env.SUPABASE_SERVICE_ROLE_KEY;

  if (!config.configured || !recipientId || missingDefaultServiceRole) {
    return result;
  }

  const details = getVapidDetails(env);
  const rows = await restRequest(
    `/push_subscriptions?user_id=eq.${encodeURIComponent(recipientId)}&select=id,endpoint,p256dh,auth,expiration_time`,
    { useServiceRole: true }
  );
  const subscriptions = Array.isArray(rows) ? rows : [];
  const payload = JSON.stringify({
    actionUrl: cleanString(actionUrl, 500) || '/',
    body: cleanString(body, 1000),
    title: cleanString(title, 180) || 'PB Finance',
    type: cleanString(type, 80),
  });

  result.attempted = subscriptions.length;

  for (const row of subscriptions) {
    try {
      await sendNotification(toPushSubscription(row), payload, {
        TTL: 24 * 60 * 60,
        urgency: 'normal',
        vapidDetails: details,
      });
      result.sent += 1;
    } catch (error) {
      if ([404, 410].includes(Number(error?.statusCode))) {
        await restRequest(`/push_subscriptions?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'DELETE',
          prefer: 'return=minimal',
          useServiceRole: true,
        });
        result.removed += 1;
      } else {
        result.errors += 1;
      }
    }
  }

  return result;
};
