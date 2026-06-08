// Service worker for UnifiedInbox PWA: handles Web Push display and clicks.
// Kept dependency-free and minimal so it can be served as a static file.

self.addEventListener("install", (event) => {
  // Activate this worker immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "UnifiedInbox", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "UnifiedInbox";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab and navigate it if one is open.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
            return;
          }
        }
        // Otherwise open a new window.
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});
