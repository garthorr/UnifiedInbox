import { ThreadCard } from "./ThreadCard";

interface Thread {
  id: string;
  gmailThreadId: string;
  gmailLabelIds: string[];
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

type LabelInfo = { name: string; color: string | null };

interface ThreadListProps {
  threads: Thread[];
  labelMap?: Record<string, Record<string, LabelInfo>>;
  todoistEnabled?: boolean;
  selectedThreadId?: string | null;
  onSelectThread?: (id: string | null) => void;
}

export function ThreadList({
  threads,
  labelMap = {},
  todoistEnabled = false,
  selectedThreadId,
  onSelectThread,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        No threads found. Try adjusting your filters or syncing your accounts.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          labels={Object.entries(labelMap[thread.account.id] ?? {})
            .filter(([lid]) => thread.gmailLabelIds.includes(lid))
            .map(([, l]) => l)}
          todoistEnabled={todoistEnabled}
          isSelected={selectedThreadId === thread.id}
          onSelect={() =>
            onSelectThread?.(selectedThreadId === thread.id ? null : thread.id)
          }
        />
      ))}
    </div>
  );
}
