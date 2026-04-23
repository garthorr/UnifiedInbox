"use client";

import { useState, memo } from "react";
import Link from "next/link";
import { ExternalLink, Plus, ArrowRight, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gmailThreadUrl, relativeTime, primarySender, parseEmailDisplay } from "@/lib/utils";
import { CreateWorkItemModal } from "@/components/work-items/CreateWorkItemModal";

type LabelInfo = { name: string; color: string | null };

interface ThreadCardProps {
  thread: {
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
    account: { id: string; email: string; displayName: string; color: string };
    domain: { id: string; name: string; color: string } | null;
    workItem: { id: string; title: string; status: string } | null;
  };
  labels?: LabelInfo[];
  todoistEnabled?: boolean;
  isSelected?: boolean;
  isChecked?: boolean;
  anyChecked?: boolean;
  index: number;
  onSelect?: () => void;
  onToggleCheck?: (id: string, index: number, shiftKey: boolean) => void;
  onArchive?: (id: string) => void;
  onMarkReadToggle?: (id: string, currentlyUnread: boolean) => void;
}

function StatusChip({ workItem }: { workItem: ThreadCardProps["thread"]["workItem"] }) {
  if (!workItem) {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-[0.04em] px-1.5 py-px rounded-[3px] border"
        style={{
          background: "var(--ds-panel-2)",
          borderColor: "var(--ds-line)",
          color: "var(--ds-muted)",
        }}
      >
        unassigned
      </span>
    );
  }
  const isTask = workItem.status === "TODOIST" || workItem.status === "DONE";
  if (isTask) {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-[0.04em] px-1.5 py-px rounded-[3px] border"
        style={{
          background: "color-mix(in oklch, var(--ds-hot) 15%, transparent)",
          borderColor: "color-mix(in oklch, var(--ds-hot) 30%, transparent)",
          color: "var(--ds-hot)",
        }}
      >
        ● {workItem.status === "DONE" ? "task-done" : "task-synced"}
      </span>
    );
  }
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-[0.04em] px-1.5 py-px rounded-[3px] border"
      style={{
        background: "var(--ds-accent-bg)",
        borderColor: "color-mix(in oklch, var(--ds-accent) 35%, transparent)",
        color: "var(--ds-accent-ink)",
      }}
    >
      {workItem.status.toLowerCase()}
    </span>
  );
}

export const ThreadCard = memo(function ThreadCard({
  thread,
  labels = [],
  todoistEnabled = false,
  isSelected = false,
  isChecked = false,
  anyChecked = false,
  index,
  onSelect,
  onToggleCheck,
  onArchive,
  onMarkReadToggle,
}: ThreadCardProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const sender = parseEmailDisplay(
    primarySender(thread.participantAddresses, thread.account.email)
  );
  const showCheckbox = isChecked || anyChecked;

  return (
    <>
      <div
        className="group grid border-b cursor-pointer relative"
        style={{
          gridTemplateColumns: "44px 1fr auto",
          gap: "12px",
          padding: "12px 20px",
          borderColor: "var(--ds-line-2)",
          background: isSelected
            ? "var(--ds-selected)"
            : isChecked
            ? "color-mix(in oklch, var(--ds-accent) 8%, transparent)"
            : "var(--ds-panel)",
        }}
        onClick={onSelect}
      >
        {/* Selected left accent */}
        {isSelected && (
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: "var(--ds-accent)" }}
          />
        )}

        {/* Left column: checkbox/dot + domain tag */}
        <div className="flex flex-col items-center gap-2 pt-0.5">
          {/* Unread dot / checkbox */}
          <div className="relative w-4 h-4 flex items-center justify-center flex-shrink-0">
            <input
              type="checkbox"
              checked={isChecked}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCheck?.(thread.id, index, e.shiftKey);
              }}
              onChange={() => {}}
              className={`absolute inset-0 h-3.5 w-3.5 rounded cursor-pointer accent-ds-accent ${
                showCheckbox ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            />
            {thread.isUnread ? (
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${showCheckbox ? "hidden group-hover:hidden" : "block group-hover:hidden"}`}
                style={{
                  background: "var(--ds-accent)",
                  boxShadow: "0 0 0 3px color-mix(in oklch, var(--ds-accent) 18%, transparent)",
                }}
              />
            ) : (
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${showCheckbox ? "hidden group-hover:hidden" : "block group-hover:hidden"}`}
                style={{ boxShadow: "inset 0 0 0 1.5px var(--ds-line)" }}
              />
            )}
          </div>

          {/* Vertical domain tag */}
          {thread.domain && (
            <div
              className="font-mono text-[9px] uppercase tracking-[0.05em] rounded-sm px-px py-1 overflow-hidden max-h-12 flex-shrink-0"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                color: "var(--ds-muted)",
                border: "1px solid var(--ds-line)",
                lineHeight: 1,
              }}
            >
              {thread.domain.name.slice(0, 12)}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="min-w-0">
          {/* Meta row: status chip + sender */}
          <div
            className="flex items-center gap-2 mb-1 overflow-hidden"
            style={{ fontSize: "11.5px", color: "var(--ds-muted)" }}
          >
            <StatusChip workItem={thread.workItem} />
            <span
              className="font-medium truncate flex-shrink-0 max-w-[180px]"
              style={{ color: "var(--ds-ink-2)" }}
            >
              {sender.name || sender.email}
            </span>
            {thread.messageCount > 1 && (
              <>
                <span className="opacity-50">·</span>
                <span className="flex-shrink-0">{thread.messageCount}</span>
              </>
            )}
            {thread.hasAttachments && <Paperclip className="h-2.5 w-2.5 flex-shrink-0" />}
            {labels.map((label) => (
              <span
                key={label.name}
                className="inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium flex-shrink-0"
                style={{
                  backgroundColor: label.color ? `${label.color}22` : "#e2e8f022",
                  color: label.color ?? "#64748b",
                  border: `1px solid ${label.color ? `${label.color}44` : "#cbd5e122"}`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>

          {/* Subject */}
          <p
            className="text-[14px] leading-snug truncate mb-1"
            style={{
              fontWeight: thread.isUnread ? 600 : 500,
              color: thread.isUnread ? "var(--ds-ink)" : "var(--ds-ink-2)",
            }}
          >
            {thread.subject}
          </p>

          {/* Snippet */}
          <p
            className="text-[12.5px] leading-snug overflow-hidden"
            style={{
              color: "var(--ds-muted)",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
            }}
          >
            {thread.snippet}
          </p>
        </div>

        {/* Right column: time + actions */}
        <div className="flex flex-col items-end gap-2 pt-0.5 min-w-[92px]">
          <span
            className="font-mono text-[11px] group-hover:invisible"
            style={{ color: "var(--ds-muted)", whiteSpace: "nowrap" }}
          >
            {relativeTime(thread.lastMessageAt)}
          </span>

          {/* Hover actions */}
          <div className="hidden group-hover:flex items-center gap-1 -mt-5">
            <button
              className="rounded border px-1.5 py-0.5 text-[11px] font-semibold transition-colors hover:bg-ds-ink hover:text-ds-panel"
              style={{
                background: "var(--ds-panel)",
                borderColor: "var(--ds-line)",
                color: "var(--ds-ink-2)",
              }}
              title="Archive · E"
              onClick={(e) => { e.stopPropagation(); onArchive?.(thread.id); }}
            >
              E
            </button>
            <button
              className="rounded border px-1.5 py-0.5 text-[11px] font-semibold transition-colors hover:bg-ds-ink hover:text-ds-panel"
              style={{
                background: "var(--ds-panel)",
                borderColor: "var(--ds-line)",
                color: "var(--ds-ink-2)",
              }}
              title={thread.isUnread ? "Mark read" : "Mark unread"}
              onClick={(e) => { e.stopPropagation(); onMarkReadToggle?.(thread.id, thread.isUnread); }}
            >
              {thread.isUnread ? "R" : "U"}
            </button>
            {!thread.workItem ? (
              <button
                className="rounded border px-2 py-0.5 text-[11px] font-bold transition-colors"
                style={{
                  background: "var(--ds-ink)",
                  borderColor: "var(--ds-ink)",
                  color: "var(--ds-panel)",
                }}
                title="Turn into task · T"
                onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}
              >
                + TASK
              </button>
            ) : (
              <Link
                href={`/work-items/${thread.workItem.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded border px-2 py-0.5 text-[11px] font-semibold transition-colors hover:bg-ds-ink hover:text-ds-panel"
                style={{
                  background: "var(--ds-panel)",
                  borderColor: "var(--ds-line)",
                  color: "var(--ds-ink-2)",
                }}
              >
                WI →
              </Link>
            )}
          </div>

          {/* External link — always visible on selected */}
          <a
            href={gmailThreadUrl(thread.gmailThreadId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
          >
            <ExternalLink className="h-3 w-3" style={{ color: "var(--ds-muted)" }} />
          </a>
        </div>

        {/* Keyboard hint bar (bottom of row on hover) */}
        <div
          className="absolute right-5 bottom-1.5 hidden group-hover:flex items-center gap-2"
          style={{ fontSize: "9.5px", color: "var(--ds-muted)", fontFamily: "JetBrains Mono, monospace" }}
        >
          <span>
            <kbd
              className="rounded border px-1 py-px"
              style={{ background: "var(--ds-kbd-bg)", borderColor: "var(--ds-line)" }}
            >E</kbd>{" "}
            archive
          </span>
          <span>
            <kbd
              className="rounded border px-1 py-px"
              style={{ background: "var(--ds-kbd-bg)", borderColor: "var(--ds-line)" }}
            >T</kbd>{" "}
            task
          </span>
        </div>
      </div>

      {showCreateModal && (
        <CreateWorkItemModal
          thread={thread}
          todoistEnabled={todoistEnabled}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  );
});
