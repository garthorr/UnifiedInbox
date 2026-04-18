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
  account: { id: string; email: string; displayName: string; color: string };
  domain: { id: string; name: string; color: string } | null;
  workItem: { id: string; title: string; status: string } | null;
}

type LabelInfo = { name: string; color: string | null };

interface ThreadListProps {
  threads: Thread[];
  labelMap?: Record<string, Record<string, LabelInfo>>;
  todoistEnabled?: boolean;
  selectedThreadId?: string | null;
  checkedIds?: Set<string>;
  anyChecked?: boolean;
  onSelectThread?: (id: string | null) => void;
  onToggleCheck?: (id: string, index: number, shiftKey: boolean) => void;
  onArchive?: (id: string) => void;
  onMarkReadToggle?: (id: string, currentlyUnread: boolean) => void;
}

export function ThreadList({
  threads,
  labelMap = {},
  todoistEnabled = false,
  selectedThreadId,
  checkedIds,
  anyChecked = false,
  onSelectThread,
  onToggleCheck,
  onArchive,
  onMarkReadToggle,
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
      {threads.map((thread, index) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          index={index}
          labels={Object.entries(labelMap[thread.account.id] ?? {})
            .filter(([lid]) => thread.gmailLabelIds.includes(lid))
            .map(([, l]) => l)}
          todoistEnabled={todoistEnabled}
          isSelected={selectedThreadId === thread.id}
          isChecked={checkedIds?.has(thread.id) ?? false}
          anyChecked={anyChecked}
          onSelect={() =>
            onSelectThread?.(selectedThreadId === thread.id ? null : thread.id)
          }
          onToggleCheck={onToggleCheck}
          onArchive={onArchive}
          onMarkReadToggle={onMarkReadToggle}
        />
      ))}
    </div>
  );
}
