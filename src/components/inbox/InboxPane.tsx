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

  // Keep a ref so keyboard handler can read it without being a dependency
  const selectedThreadIdRef = useRef(selectedThreadId);
  selectedThreadIdRef.current = selectedThreadId;

  // Deduplicate in-flight prefetches so rapid list changes don't double-fetch
  const inFlightPrefetchRef = useRef<Set<string>>(new Set());

  // Background-prefetch the top 5 threads during idle time
  useEffect(() => {
    const top5 = threads.slice(0, 5);
    if (top5.length === 0) return;
    let cancelled = false;

    const schedule =
      typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 800);
    const cancelSchedule =
      typeof cancelIdleCallback !== "undefined" ? cancelIdleCallback : clearTimeout;

    const handle = schedule(() => {
      top5.forEach(async (t) => {
        if (cancelled || messageCache.has(t.id) || inFlightPrefetchRef.current.has(t.id)) return;
        inFlightPrefetchRef.current.add(t.id);
        try {
          const r = await fetch(`/api/threads/${t.id}/messages`);
          if (!r.ok || cancelled) return;
          messageCache.set(t.id, await r.json());
        } catch { /* silently ignore prefetch failures */ }
        finally { inFlightPrefetchRef.current.delete(t.id); }
      });
    });
    return () => { cancelled = true; cancelSchedule(handle as number); };
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
      if (!res.ok && res.status !== 207) return;

      const { failedIds = [] }: { updated: number; failedIds: string[] } = await res.json();
      const successIds = ids.filter((id) => !failedIds.includes(id));

      if (action === "archive" || action === "trash") {
        setStaleIds((prev) => new Set([...prev, ...successIds]));
        setSelectedThreadId((prev) => (prev && successIds.includes(prev) ? null : prev));
      } else {
        const isUnread = action === "markUnread";
        setUnreadOverrides((prev) => {
          const next = { ...prev };
          successIds.forEach((id) => { next[id] = isUnread; });
          return next;
        });
      }
      setCheckedIds(new Set(failedIds)); // keep failed ones checked so user can retry
    },
    [checkedIds]
  );

  const anyChecked = checkedIds.size > 0;
  const allSelected = checkedIds.size === threadsWithOverrides.length && threadsWithOverrides.length > 0;

  // Keyboard navigation — reads from refs so the listener is registered once only
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      const threads = visibleThreadsRef.current;
      const currentId = selectedThreadIdRef.current;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const idx = threads.findIndex((t) => t.id === currentId);
        const next = threads[idx + 1];
        if (next) setSelectedThreadId(next.id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = threads.findIndex((t) => t.id === currentId);
        const prev = threads[idx - 1] ?? threads[0];
        if (prev) setSelectedThreadId(prev.id);
      } else if (e.key === "Escape") {
        setSelectedThreadId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            snippet={selectedThread.snippet ?? ""}
            isUnread={unreadOverrides[selectedThread.id] ?? selectedThread.isUnread}
            todoistEnabled={todoistEnabled}
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
