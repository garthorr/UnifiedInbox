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
  onTrash?: (id: string) => void;
  onMarkReadToggle?: (id: string, currentlyUnread: boolean) => void;
}

function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-[18px] sticky top-0 z-10"
      style={{
        background: "color-mix(in oklch, var(--ds-panel) 92%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      <h3
        className="font-mono text-[11px] uppercase tracking-[0.1em] whitespace-nowrap"
        style={{ color: "var(--ds-muted)", margin: 0, fontWeight: 500 }}
      >
        {title}
      </h3>
      <div className="flex-1 h-px" style={{ background: "var(--ds-line)" }} />
      <span className="font-mono text-[11px]" style={{ color: "var(--ds-muted)" }}>
        {String(count).padStart(2, "0")}
      </span>
    </div>
  );
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
  onTrash,
  onMarkReadToggle,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 px-6 text-center">
        <svg
          className="h-8 w-8 opacity-20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: "var(--ds-muted)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium" style={{ color: "var(--ds-ink-2)" }}>
          All clear
        </p>
        <p className="text-xs max-w-[240px]" style={{ color: "var(--ds-muted)" }}>
          No threads match your current filters. Try a different date range or clear the filters to see more.
        </p>
      </div>
    );
  }

  const unread = threads.filter((t) => t.isUnread);
  const read = threads.filter((t) => !t.isUnread);

  function renderCard(thread: Thread, flatIndex: number) {
    return (
      <ThreadCard
        key={thread.id}
        thread={thread}
        index={flatIndex}
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
        onTrash={onTrash}
        onMarkReadToggle={onMarkReadToggle}
      />
    );
  }

  return (
    <div>
      {unread.length > 0 && (
        <>
          <GroupHeader title="Needs attention" count={unread.length} />
          {unread.map((t, i) => renderCard(t, i))}
        </>
      )}
      {read.length > 0 && (
        <>
          <GroupHeader title="Caught up" count={read.length} />
          {read.map((t, i) => renderCard(t, unread.length + i))}
        </>
      )}
    </div>
  );
}
