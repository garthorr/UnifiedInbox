import { ThreadCard } from "./ThreadCard";

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

interface ThreadListProps {
  threads: Thread[];
  todoistEnabled?: boolean;
}

export function ThreadList({ threads, todoistEnabled = false }: ThreadListProps) {
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
        <ThreadCard key={thread.id} thread={thread} todoistEnabled={todoistEnabled} />
      ))}
    </div>
  );
}
