"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Subscribes to the SSE stream and refreshes the current route when the server
// reports that threads or work items changed (e.g. a background sync imported
// new mail). Server components re-render with fresh data; client state is
// preserved by React reconciliation.
export function LiveSync() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const es = new EventSource("/api/stream");

    es.addEventListener("refresh", () => {
      // Coalesce bursts of events into a single refresh.
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 300);
    });

    // EventSource reconnects automatically on transient errors; nothing to do.
    es.onerror = () => {};

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      es.close();
    };
  }, [router]);

  return null;
}
