"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import Link from "next/link";
import { ThreadCard } from "@/components/inbox/ThreadCard";
import { toast } from "@/lib/toast";

type LabelInfo = { name: string; color: string | null };

interface Thread {
  id: string;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  participantAddresses: string[];
  gmailLabelIds: string[];
  messageCount: number;
  hasAttachments: boolean;
  isUnread: boolean;
  lastMessageAt: string;
  snoozedUntil: string;
  workItemId: string | null;
  account: { id: string; email: string; displayName: string; color: string };
  domain: { id: string; name: string; color: string } | null;
  workItem: { id: string; title: string; status: string } | null;
}

interface SnoozedClientProps {
  threads: Thread[];
  labelMap: Record<string, Record<string, LabelInfo>>;
  todoistEnabled: boolean;
  accounts: { id: string; email: string; displayName: string }[];
}

function formatSnoozedUntil(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) {
    return `tomorrow ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function SnoozedClient({ threads, labelMap, todoistEnabled }: SnoozedClientProps) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  async function handleUnsnooze(id: string) {
    setRemovedIds((prev) => new Set([...prev, id]));
    try {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsnooze" }),
      });
      if (!res.ok) throw new Error();
      toast({ message: "Snooze removed" });
    } catch {
      setRemovedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast({ message: "Couldn't remove snooze", variant: "error" });
    }
  }

  const visible = threads.filter((t) => !removedIds.has(t.id));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Clock className="h-10 w-10 opacity-20 mb-3" style={{ color: "var(--ds-muted)" }} />
        <h2 className="text-base font-semibold" style={{ color: "var(--ds-ink-2)" }}>
          Nothing snoozed
        </h2>
        <p className="text-sm mt-1 max-w-sm" style={{ color: "var(--ds-muted)" }}>
          Press <kbd className="font-mono text-[11px] px-1 py-0.5 rounded border" style={{ borderColor: "var(--ds-line)" }}>S</kbd> on any thread in
          the <Link href="/" className="underline">inbox</Link> to snooze it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--ds-panel)" }}>
      <div
        className="flex-shrink-0 border-b px-5 py-3 flex items-center gap-2"
        style={{ borderColor: "var(--ds-line)" }}
      >
        <Clock className="h-4 w-4" style={{ color: "var(--ds-muted)" }} />
        <h1 className="font-serif font-bold text-[18px] tracking-tight" style={{ color: "var(--ds-ink)" }}>
          Snoozed
        </h1>
        <span className="font-mono text-[11px] ml-1" style={{ color: "var(--ds-muted)" }}>
          {visible.length} thread{visible.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {visible.map((thread, i) => (
          <div key={thread.id} className="relative">
            <div
              className="absolute right-5 top-3 z-10 flex items-center gap-2"
              style={{ pointerEvents: "none" }}
            >
              <span
                className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                style={{
                  background: "var(--ds-panel-2)",
                  borderColor: "var(--ds-line)",
                  color: "var(--ds-muted)",
                  pointerEvents: "auto",
                }}
                title={new Date(thread.snoozedUntil).toLocaleString()}
              >
                wakes {formatSnoozedUntil(thread.snoozedUntil)}
              </span>
              <button
                type="button"
                onClick={() => handleUnsnooze(thread.id)}
                className="rounded border px-2 py-0.5 text-[11px] font-semibold transition-colors hover:bg-ds-ink hover:text-ds-panel"
                style={{
                  background: "var(--ds-panel)",
                  borderColor: "var(--ds-line)",
                  color: "var(--ds-ink-2)",
                  pointerEvents: "auto",
                }}
                title="Remove snooze and return to inbox"
              >
                Unsnooze
              </button>
            </div>
            <ThreadCard
              thread={thread}
              index={i}
              labels={Object.entries(labelMap[thread.account.id] ?? {})
                .filter(([lid]) => thread.gmailLabelIds.includes(lid))
                .map(([, l]) => l)}
              todoistEnabled={todoistEnabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
