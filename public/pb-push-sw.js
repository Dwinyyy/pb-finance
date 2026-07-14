self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || '' };
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'PB Finance', {
    body: payload.body || 'You have a new notification.',
    data: {
      actionUrl: payload.actionUrl || '/',
      type: payload.type || '',
    },
    tag: payload.type || 'pb-finance-notification',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = new URL('/', self.location.origin);

  try {
    const requestedUrl = new URL(event.notification.data?.actionUrl || '/', self.location.origin);
    if (requestedUrl.origin === self.location.origin) targetUrl = requestedUrl;
  } catch {
    targetUrl = new URL('/', self.location.origin);
  }

  event.waitUntil(self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(async (clients) => {
    const matchingClient = clients.find((client) => new URL(client.url).origin === targetUrl.origin);

    if (matchingClient) {
      await matchingClient.focus();
      if ('navigate' in matchingClient) await matchingClient.navigate(targetUrl.href);
      return;
    }

    await self.clients.openWindow(targetUrl.href);
  }));
});
