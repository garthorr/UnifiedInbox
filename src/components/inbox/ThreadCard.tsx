"use client";

import { useState, memo } from "react";
import Link from "next/link";
import { ExternalLink, Plus, ArrowRight, Paperclip } from "lucide-react";
import { DomainBadge, UnassignedBadge } from "@/components/shared/DomainBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { gmailThreadUrl, relativeTime, primarySender, parseEmailDisplay } from "@/lib/utils";
import { CreateWorkItemModal } from "@/components/work-items/CreateWorkItemModal";

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
    account: { id: string; email: string; displayName: string };
    domain: { id: string; name: string; color: string } | null;
    workItem: { id: string; title: string; status: string } | null;
  };
  todoistEnabled?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const ThreadCard = memo(function ThreadCard({
  thread,
  todoistEnabled = false,
  isSelected = false,
  onSelect,
}: ThreadCardProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const sender = parseEmailDisplay(
    primarySender(thread.participantAddresses, thread.account.email)
  );

  return (
    <>
      <div
        className={`flex items-start gap-3 border-b px-4 py-3 ${
          isSelected
            ? "bg-blue-50 border-l-2 border-l-blue-500"
            : thread.isUnread
            ? "bg-white hover:bg-slate-50"
            : "bg-slate-50/50 hover:bg-slate-100/60"
        }`}
      >
        {/* Unread indicator */}
        <div className="mt-1.5 flex-shrink-0">
          {thread.isUnread ? (
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-transparent" />
          )}
        </div>

        {/* Content — clicking selects the thread */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onSelect}>
          <div className="flex items-center gap-2 mb-0.5">
            {thread.domain ? (
              <DomainBadge name={thread.domain.name} color={thread.domain.color} />
            ) : (
              <UnassignedBadge />
            )}
            {thread.workItem && (
              <StatusBadge status={thread.workItem.status as never} />
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p
              className={`truncate text-sm ${
                thread.isUnread ? "font-semibold text-slate-900" : "text-slate-700"
              }`}
            >
              {thread.subject}
            </p>
            <span className="flex-shrink-0 text-xs text-slate-400">
              {relativeTime(thread.lastMessageAt)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
            <span className="truncate max-w-[200px]">{sender.name || sender.email}</span>
            <span>·</span>
            <span className="text-slate-400">{thread.account.email}</span>
            <span>·</span>
            <span>{thread.messageCount} msg{thread.messageCount !== 1 ? "s" : ""}</span>
            {thread.hasAttachments && <Paperclip className="h-3 w-3" />}
          </div>

          <p className="mt-1 text-xs text-slate-500 line-clamp-1">{thread.snippet}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {thread.workItem ? (
            <Link href={`/work-items/${thread.workItem.id}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <ArrowRight className="h-3 w-3" />
                WI
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-3 w-3" />
              WI
            </Button>
          )}
          <a
            href={gmailThreadUrl(thread.gmailThreadId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
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
