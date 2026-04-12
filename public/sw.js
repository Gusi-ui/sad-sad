/* Service Worker para Web Push (trabajadoras) */

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Planificación actualizada',
    body: 'Se han aplicado cambios en tu agenda. Entra para verlos.',
    url: '/w/planning'
  };

  let data = fallback;
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...fallback, ...(parsed || {}) };
    }
  } catch {
    data = fallback;
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/w/planning' }
  };

  event.waitUntil(
    (async () => {
      // Si hay ventanas abiertas, preferimos avisar dentro de la app (sin notificación del sistema).
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (allClients.length > 0) {
        for (const c of allClients) {
          try {
            c.postMessage({ type: 'planning_update', payload: data });
          } catch {}
        }
        return;
      }
      await self.registration.showNotification(data.title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/w/planning';
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of allClients) {
        if (c.url && new URL(c.url).pathname.startsWith('/w')) {
          await c.focus();
          return;
        }
      }
      await clients.openWindow(url);
    })()
  );
});
