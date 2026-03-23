"use client";

import { useState } from "react";
import { ThreadCard } from "@/components/inbox/ThreadCard";
import { ThreadDrawer } from "@/components/inbox/ThreadDrawer";

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

interface DomainThreadsClientProps {
  threads: Thread[];
  todoistEnabled?: boolean;
}

export function DomainThreadsClient({ threads, todoistEnabled = false }: DomainThreadsClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      <div className="rounded-lg border bg-white overflow-hidden">
        {threads.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            todoistEnabled={todoistEnabled}
            isSelected={selectedId === thread.id}
            onSelect={() => setSelectedId((prev) => (prev === thread.id ? null : thread.id))}
          />
        ))}
      </div>

      <ThreadDrawer
        thread={selectedThread ? { id: selectedThread.id, gmailThreadId: selectedThread.gmailThreadId, subject: selectedThread.subject } : null}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
