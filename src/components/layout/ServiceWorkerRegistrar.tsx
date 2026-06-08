"use client";

import { useEffect } from "react";

// Registers the PWA service worker once on the client. The worker handles
// Web Push display + click routing (see public/sw.js). Push *subscription*
// itself is user-initiated from Settings → Notifications.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[pwa] service worker registration failed:", err);
    });
  }, []);

  return null;
}
