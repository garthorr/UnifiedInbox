"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ThreadList } from "./ThreadList";
import { BulkActionBar } from "./BulkActionBar";
import { EmailViewer } from "./EmailViewer";
import { CreateWorkItemModal } from "@/components/work-items/CreateWorkItemModal";
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
  gmailLabelIds: string[];
  account: { id: string; email: string; displayName: string; color: string };
  domain: { id: string; name: string; color: string } | null;
  workItem: { id: string; title: string; status: string } | null;
}

type LabelInfo = { name: string; color: string | null };

interface InboxPaneProps {
  threads: Thread[];
  labelMap?: Record<string, Record<string, LabelInfo>>;
  todoistEnabled?: boolean;
}

export function InboxPane({ threads, labelMap = {}, todoistEnabled = false }: InboxPaneProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [unreadOverrides, setUnreadOverrides] = useState<Record<string, boolean>>({});
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);

  const lastCheckedIndexRef = useRef<number | null>(null);

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
  const checkedThreads = useMemo(
    () => threadsWithOverrides.filter((t) => checkedIds.has(t.id)),
    [threadsWithOverrides, checkedIds]
  );

  const visibleThreadsRef = useRef(threadsWithOverrides);
  visibleThreadsRef.current = threadsWithOverrides;

  // Background-prefetch the top 5 threads after the page settles
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
    setSelectedThreadId((prev) => (prev === id ? null : prev));
    setCheckedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const toggleCheck = useCallback((id: string, index: number, shiftKey: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastCheckedIndexRef.current !== null) {
        const lo = Math.min(lastCheckedIndexRef.current, index);
        const hi = Math.max(lastCheckedIndexRef.current, index);
        const shouldSelect = !prev.has(id);
        visibleThreadsRef.current.slice(lo, hi + 1).forEach((t) => {
          if (shouldSelect) next.add(t.id);
          else next.delete(t.id);
        });
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastCheckedIndexRef.current = index;
  }, []);

  const handleArchiveSingle = useCallback(async (id: string) => {
    await fetch(`/api/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    handleStale(id);
  }, []);

  const handleMarkReadToggle = useCallback(async (id: string, currentlyUnread: boolean) => {
    await fetch(`/api/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: currentlyUnread ? "markRead" : "markUnread" }),
    });
    setUnreadOverrides((prev) => ({ ...prev, [id]: !currentlyUnread }));
  }, []);

  const handleBulkAction = useCallback(
    async (action: "archive" | "trash" | "markRead" | "markUnread") => {
      const ids = [...checkedIds];
      if (!ids.length) return;
      const res = await fetch("/api/threads/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: ids, action }),
      });
      if (!res.ok) return;

      if (action === "archive" || action === "trash") {
        setStaleIds((prev) => new Set([...prev, ...ids]));
        setSelectedThreadId((prev) => (prev && ids.includes(prev) ? null : prev));
      } else {
        const isUnread = action === "markUnread";
        setUnreadOverrides((prev) => {
          const next = { ...prev };
          ids.forEach((id) => { next[id] = isUnread; });
          return next;
        });
      }
      setCheckedIds(new Set());
    },
    [checkedIds]
  );

  const anyChecked = checkedIds.size > 0;
  const allSelected = checkedIds.size === threadsWithOverrides.length && threadsWithOverrides.length > 0;

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div
        className={`flex-shrink-0 overflow-y-auto border-r flex flex-col ${
          selectedThreadId ? "w-[380px]" : "w-full"
        }`}
      >
        {anyChecked && (
          <BulkActionBar
            count={checkedIds.size}
            allCount={threadsWithOverrides.length}
            allSelected={allSelected}
            onSelectAll={() => setCheckedIds(new Set(threadsWithOverrides.map((t) => t.id)))}
            onClearAll={() => setCheckedIds(new Set())}
            onArchive={() => handleBulkAction("archive")}
            onMarkRead={() => handleBulkAction("markRead")}
            onMarkUnread={() => handleBulkAction("markUnread")}
            onCreateWorkItem={() => setShowBulkCreateModal(true)}
          />
        )}
        <ThreadList
          threads={threadsWithOverrides}
          labelMap={labelMap}
          todoistEnabled={todoistEnabled}
          selectedThreadId={selectedThreadId}
          checkedIds={checkedIds}
          anyChecked={anyChecked}
          onSelectThread={setSelectedThreadId}
          onToggleCheck={toggleCheck}
          onArchive={handleArchiveSingle}
          onMarkReadToggle={handleMarkReadToggle}
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

      {showBulkCreateModal && checkedThreads.length > 0 && (
        <CreateWorkItemModal
          threads={checkedThreads.map((t) => ({ id: t.id, subject: t.subject }))}
          todoistEnabled={todoistEnabled}
          onClose={() => {
            setShowBulkCreateModal(false);
            setCheckedIds(new Set());
          }}
        />
      )}
    </div>
  );
}
