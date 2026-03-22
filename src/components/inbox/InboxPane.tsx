"use client";

import { useState } from "react";
import { ThreadList } from "./ThreadList";
import { EmailViewer } from "./EmailViewer";

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

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Thread list */}
      <div
        className={`flex-shrink-0 overflow-y-auto border-r ${
          selectedThreadId ? "w-[380px]" : "w-full"
        }`}
      >
        <ThreadList
          threads={threads}
          todoistEnabled={todoistEnabled}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
        />
      </div>

      {/* Email viewer */}
      {selectedThread && (
        <div className="flex-1 overflow-hidden">
          <EmailViewer
            threadId={selectedThread.id}
            gmailThreadId={selectedThread.gmailThreadId}
            subject={selectedThread.subject}
          />
        </div>
      )}
    </div>
  );
}
