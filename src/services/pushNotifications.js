import { backendApi } from './api';

const isSupported = () => (
  typeof window !== 'undefined'
  && 'Notification' in window
  && 'serviceWorker' in navigator
  && 'PushManager' in window
);

const urlBase64ToUint8Array = (value) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
};

const getRegistration = async ({ create = false } = {}) => {
  if (!isSupported()) return null;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const existing = registrations.find((registration) => (
    registration.active?.scriptURL?.endsWith('/pb-push-sw.js')
    || registration.installing?.scriptURL?.endsWith('/pb-push-sw.js')
    || registration.waiting?.scriptURL?.endsWith('/pb-push-sw.js')
  ));

  if (existing || !create) return existing || null;

  return navigator.serviceWorker.register('/pb-push-sw.js');
};

export const getPushNotificationState = async () => {
  const supported = isSupported();

  if (!supported) {
    return { configured: false, enabled: false, permission: 'unsupported', supported: false };
  }

  const config = await backendApi.notifications.getPushConfig();
  const registration = await getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;

  return {
    configured: Boolean(config?.configured),
    enabled: Boolean(subscription),
    permission: Notification.permission,
    supported: true,
  };
};

export const enablePushNotifications = async () => {
  if (!isSupported()) {
    throw new Error('Browser push notifications are not supported on this device.');
  }

  const config = await backendApi.notifications.getPushConfig();

  if (!config?.configured || !config.publicKey) {
    throw new Error('PB Finance push notifications are not configured yet.');
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Allow notifications in your browser settings to enable push alerts.');
  }

  const registration = await getRegistration({ create: true });
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    userVisibleOnly: true,
  });

  await backendApi.notifications.savePushSubscription({ subscription: subscription.toJSON() });

  return { configured: true, enabled: true, permission, supported: true };
};

export const disablePushNotifications = async () => {
  if (!isSupported()) {
    return { configured: false, enabled: false, permission: 'unsupported', supported: false };
  }

  const registration = await getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;

  if (subscription) {
    await backendApi.notifications.removePushSubscription({ endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }

  return {
    configured: true,
    enabled: false,
    permission: Notification.permission,
    supported: true,
  };
};
