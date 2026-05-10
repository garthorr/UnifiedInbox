"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { ThreadList } from "./ThreadList";
import { BulkActionBar } from "./BulkActionBar";
import { EmailViewer } from "./EmailViewer";
import { ComposeEmail } from "./ComposeEmail";
import { CreateWorkItemModal } from "@/components/work-items/CreateWorkItemModal";
import { BulkAssignWorkItemModal } from "@/components/work-items/BulkAssignWorkItemModal";
import { messageCache } from "@/lib/client-message-cache";
import { cn } from "@/lib/utils";

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

interface Account {
  id: string;
  email: string;
  displayName: string;
}

interface InboxPaneProps {
  threads: Thread[];
  labelMap?: Record<string, Record<string, LabelInfo>>;
  todoistEnabled?: boolean;
  accounts?: Account[];
}

export function InboxPane({ threads, labelMap = {}, todoistEnabled = false, accounts = [] }: InboxPaneProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [unreadOverrides, setUnreadOverrides] = useState<Record<string, boolean>>({});
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

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
    handleStale(id); // optimistic — remove immediately
    try {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setStaleIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, []);

  const handleArchiveSingleRef = useRef(handleArchiveSingle);
  handleArchiveSingleRef.current = handleArchiveSingle;

  const handleMarkReadToggle = useCallback(async (id: string, currentlyUnread: boolean) => {
    setUnreadOverrides((prev) => ({ ...prev, [id]: !currentlyUnread })); // optimistic
    try {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: currentlyUnread ? "markRead" : "markUnread" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setUnreadOverrides((prev) => ({ ...prev, [id]: currentlyUnread })); // rollback
    }
  }, []);

  const handleBulkAction = useCallback(
    async (action: "archive" | "trash" | "markRead" | "markUnread") => {
      const ids = [...checkedIds];
      if (!ids.length) return;

      // Optimistic update
      if (action === "archive" || action === "trash") {
        setStaleIds((prev) => new Set([...prev, ...ids]));
        setSelectedThreadId((prev) => (prev && ids.includes(prev) ? null : prev));
        setCheckedIds(new Set());
      } else {
        const isUnread = action === "markUnread";
        setUnreadOverrides((prev) => {
          const next = { ...prev };
          ids.forEach((id) => { next[id] = isUnread; });
          return next;
        });
        setCheckedIds(new Set());
      }

      const res = await fetch("/api/threads/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: ids, action }),
      });
      if (!res.ok && res.status !== 207) {
        // Full failure — rollback all
        if (action === "archive" || action === "trash") {
          setStaleIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
          setCheckedIds(new Set(ids));
        } else {
          const wasUnread = action === "markUnread"; // reverse: undo what we set
          setUnreadOverrides((prev) => {
            const next = { ...prev };
            ids.forEach((id) => { next[id] = !wasUnread; });
            return next;
          });
          setCheckedIds(new Set(ids));
        }
        return;
      }

      const { failedIds = [] }: { updated: number; failedIds: string[] } = await res.json();
      if (failedIds.length > 0) {
        // Partial failure — rollback only the ones that failed
        if (action === "archive" || action === "trash") {
          setStaleIds((prev) => { const next = new Set(prev); failedIds.forEach((id) => next.delete(id)); return next; });
        } else {
          const wasUnread = action === "markUnread";
          setUnreadOverrides((prev) => {
            const next = { ...prev };
            failedIds.forEach((id) => { next[id] = !wasUnread; });
            return next;
          });
        }
        setCheckedIds(new Set(failedIds));
      }
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
      } else if (e.key === "e" && currentId) {
        e.preventDefault();
        handleArchiveSingleRef.current(currentId);
      } else if (e.key === "Enter" && !currentId) {
        const first = threads[0];
        if (first) setSelectedThreadId(first.id);
      } else if (e.key === "c" || e.key === "C") {
        setShowCompose(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compose accounts: prefer prop, fall back to unique accounts from threads
  const composeAccounts = accounts.length > 0
    ? accounts
    : Array.from(
        new Map(threads.map((t) => [t.account.id, t.account])).values()
      );

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Thread list — full-width on mobile, fixed 380px on desktop */}
      <div
        className={cn(
          "flex-shrink-0 overflow-y-auto border-r flex flex-col",
          "md:w-[380px]",
          selectedThreadId ? "hidden md:flex" : "w-full"
        )}
        style={{ borderColor: "var(--ds-line)" }}
      >
        {anyChecked ? (
          <BulkActionBar
            count={checkedIds.size}
            allSelected={allSelected}
            onSelectAll={() => setCheckedIds(new Set(threadsWithOverrides.map((t) => t.id)))}
            onClearAll={() => setCheckedIds(new Set())}
            onArchive={() => handleBulkAction("archive")}
            onMarkRead={() => handleBulkAction("markRead")}
            onMarkUnread={() => handleBulkAction("markUnread")}
            onCreateWorkItem={() => setShowBulkCreateModal(true)}
            onAssignToWorkItem={() => setShowBulkAssignModal(true)}
            onDelete={() => handleBulkAction("trash")}
          />
        ) : (
          <div className="flex items-center justify-end px-3 py-1.5 border-b">
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md px-2.5 py-1 transition-colors"
              title="Compose new email (C)"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z" />
              </svg>
              Compose
            </button>
          </div>
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

      {/* Reading pane — hidden on mobile when nothing selected, full-screen when selected */}
      <div
        className={cn(
          "overflow-hidden flex flex-col",
          "md:flex-1",
          selectedThreadId ? "flex-1" : "hidden md:flex md:flex-1"
        )}
      >
        {selectedThread ? (
          <>
            {/* Mobile back button */}
            <div
              className="md:hidden flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b"
              style={{ borderColor: "var(--ds-line)", background: "var(--ds-panel)" }}
            >
              <button
                onClick={() => setSelectedThreadId(null)}
                className="flex items-center gap-1 text-sm font-medium"
                style={{ color: "var(--ds-accent)" }}
              >
                <ChevronLeft className="h-4 w-4" />
                Inbox
              </button>
              <span className="ml-2 text-xs truncate" style={{ color: "var(--ds-muted)" }}>
                {selectedThread.subject}
              </span>
            </div>
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
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 select-none">
            <svg
              className="h-8 w-8 opacity-15"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: "var(--ds-ink)" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm" style={{ color: "var(--ds-muted)" }}>
              Select a thread to read
            </p>
            <p className="text-xs" style={{ color: "var(--ds-muted)", opacity: 0.6 }}>
              Use <kbd className="font-mono bg-black/5 px-1 py-0.5 rounded text-[11px]">j</kbd> / <kbd className="font-mono bg-black/5 px-1 py-0.5 rounded text-[11px]">k</kbd> to navigate
            </p>
          </div>
        )}
      </div>

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


      {showBulkAssignModal && checkedThreads.length > 0 && (
        <BulkAssignWorkItemModal
          threadIds={checkedThreads.map((t) => t.id)}
          onClose={() => {
            setShowBulkAssignModal(false);
            setCheckedIds(new Set());
          }}
        />
      )}

      {showCompose && composeAccounts.length > 0 && (
        <ComposeEmail
          accounts={composeAccounts}
          defaultAccountId={composeAccounts[0].id}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}
