"use client";

import { useState, useMemo, useEffect } from "react";
import { ThreadList } from "./ThreadList";
import { EmailViewer } from "./EmailViewer";
import { messageCache } from "@/lib/client-message-cache";

interface Thread {
  id: string;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  participantAddresses: string[];
  messageCount: number;
  hasAttachments: boolean;
  isUnread: boolean;
  lastMessageAt: Date | string;
  workItemId: string | null;
  account: { id: string; email: string; displayName: string };
  domain: { id: string; name: string; color: string } | null;
  workItem: { id: string; title: string; status: string } | null;
}

interface InboxPaneProps {
  threads: Thread[];
  todoistEnabled?: boolean;
}

export function InboxPane({ threads, todoistEnabled = false }: InboxPaneProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  // Track local overrides for isUnread (changed via action bar without full page refresh)
  const [unreadOverrides, setUnreadOverrides] = useState<Record<string, boolean>>({});
  // Track stale threads so they visually disappear from the list
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());

  const visibleThreads = useMemo(
    () => threads.filter((t) => !staleIds.has(t.id)),
    [threads, staleIds]
  );
  const threadsWithOverrides = useMemo(
    () => visibleThreads.map((t) => ({ ...t, isUnread: unreadOverrides[t.id] ?? t.isUnread })),
    [visibleThreads, unreadOverrides]
  );
  const selectedThread = useMemo(
    () => visibleThreads.find((t) => t.id === selectedThreadId) ?? null,
    [visibleThreads, selectedThreadId]
  );

  // Background-prefetch the top 5 threads after the page settles so clicks are instant
  useEffect(() => {
    const top5 = threads.slice(0, 5);
    if (top5.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      top5.forEach(async (t) => {
        if (cancelled || messageCache.has(t.id)) return;
        try {
          const r = await fetch(`/api/threads/${t.id}/messages`);
          if (!r.ok || cancelled) return;
          messageCache.set(t.id, await r.json());
        } catch { /* silently ignore prefetch failures */ }
      });
    }, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [threads]);

  function handleStale(id: string) {
    setStaleIds((prev) => new Set([...prev, id]));
    setSelectedThreadId(null);
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div
        className={`flex-shrink-0 overflow-y-auto border-r ${
          selectedThreadId ? "w-[380px]" : "w-full"
        }`}
      >
        <ThreadList
          threads={threadsWithOverrides}
          todoistEnabled={todoistEnabled}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
        />
      </div>

      {selectedThread && (
        <div className="flex-1 overflow-hidden">
          <EmailViewer
            threadId={selectedThread.id}
            gmailThreadId={selectedThread.gmailThreadId}
            subject={selectedThread.subject}
            isUnread={unreadOverrides[selectedThread.id] ?? selectedThread.isUnread}
            onStale={() => handleStale(selectedThread.id)}
            onUnreadChange={(v) =>
              setUnreadOverrides((prev) => ({ ...prev, [selectedThread.id]: v }))
            }
          />
        </div>
      )}
    </div>
  );
}
