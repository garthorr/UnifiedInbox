"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { EmailViewer } from "@/components/inbox/EmailViewer";
import { DomainBadge, UnassignedBadge } from "@/components/shared/DomainBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CreateWorkItemModal } from "@/components/work-items/CreateWorkItemModal";
import { relativeTime, parseEmailDisplay, primarySender } from "@/lib/utils";
import { ChevronRight, Paperclip } from "lucide-react";
import type { WorkItemStatus } from "@prisma/client";

interface TriageThread {
  id: string;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  participantAddresses: string[];
  messageCount: number;
  hasAttachments: boolean;
  isUnread: boolean;
  lastMessageAt: string;
  workItemId: string | null;
  account: { id: string; email: string; displayName: string; color: string };
  domain: { id: string; name: string; color: string } | null;
  workItem: null;
}

interface ActiveWorkItem {
  id: string;
  title: string;
  status: WorkItemStatus;
  dueDate: string | null;
  updatedAt: string;
  domain: { id: string; name: string; color: string } | null;
  threads: { id: string; subject: string; lastMessageAt: string; isUnread: boolean }[];
}

interface TodayClientProps {
  triageThreads: TriageThread[];
  activeItems: ActiveWorkItem[];
  todoistEnabled: boolean;
}

export function TodayClient({ triageThreads, activeItems, todoistEnabled }: TodayClientProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  const [unreadOverrides, setUnreadOverrides] = useState<Record<string, boolean>>({});
  const [creatingWorkItem, setCreatingWorkItem] = useState<TriageThread | null>(null);

  const visibleThreads = useMemo(
    () => triageThreads.filter((t) => !staleIds.has(t.id)),
    [triageThreads, staleIds]
  );
  const selectedThread = useMemo(
    () => visibleThreads.find((t) => t.id === selectedThreadId) ?? null,
    [visibleThreads, selectedThreadId]
  );

  const overdue = activeItems.filter(
    (wi) => wi.dueDate && new Date(wi.dueDate) < new Date()
  );
  const upcoming = activeItems.filter(
    (wi) => !wi.dueDate || new Date(wi.dueDate) >= new Date()
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 border-b bg-white px-6 py-3 flex items-center gap-4">
        <h1 className="text-base font-semibold text-slate-900">Today</h1>
        <span className="text-xs text-slate-400">
          {visibleThreads.length} to triage · {activeItems.length} active
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: needs triage */}
        <div className="w-[340px] flex-shrink-0 border-r flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-2.5 border-b bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Needs triage
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Unread · no work item · last 7 days</p>
          </div>

          {visibleThreads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-400">All caught up ✓</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {visibleThreads.map((t) => {
                const isSelected = t.id === selectedThreadId;
                const isUnread = unreadOverrides[t.id] ?? t.isUnread;
                const sender = parseEmailDisplay(primarySender(t.participantAddresses, t.account.email));
                return (
                  <div
                    key={t.id}
                    className={`flex items-start gap-2.5 border-b pl-2.5 pr-3 py-2.5 cursor-pointer transition-colors border-l-[3px] ${
                      isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                    style={{ borderLeftColor: isSelected ? "#3b82f6" : t.account.color }}
                    onClick={() => setSelectedThreadId(isSelected ? null : t.id)}
                  >
                    <div className="mt-1.5 flex-shrink-0">
                      {isUnread ? (
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      ) : (
                        <div className="h-2 w-2" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-xs truncate ${isUnread ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                          {sender.name || sender.email}
                        </p>
                        <span className="text-xs text-slate-400 flex-shrink-0">{relativeTime(t.lastMessageAt)}</span>
                      </div>
                      <p className="text-xs text-slate-700 truncate font-medium">{t.subject}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{t.snippet}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {t.domain ? (
                          <DomainBadge name={t.domain.name} color={t.domain.color} />
                        ) : (
                          <UnassignedBadge />
                        )}
                        {t.hasAttachments && <Paperclip className="h-3 w-3 text-slate-400" />}
                        <button
                          className="ml-auto text-xs text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreatingWorkItem(t);
                          }}
                        >
                          + Task
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: work items OR email viewer */}
        {selectedThread ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 border-b px-4 py-2 flex items-center gap-2 bg-white">
              <button
                className="text-xs text-slate-500 hover:text-slate-800"
                onClick={() => setSelectedThreadId(null)}
              >
                ← Back
              </button>
              <span className="text-xs text-slate-300">|</span>
              <p className="text-xs text-slate-600 truncate">{selectedThread.subject}</p>
            </div>
            <div className="flex-1 overflow-hidden">
              <EmailViewer
                threadId={selectedThread.id}
                gmailThreadId={selectedThread.gmailThreadId}
                subject={selectedThread.subject}
                isUnread={unreadOverrides[selectedThread.id] ?? selectedThread.isUnread}
                onStale={() => {
                  setStaleIds((p) => new Set([...p, selectedThread.id]));
                  setSelectedThreadId(null);
                }}
                onUnreadChange={(v) =>
                  setUnreadOverrides((p) => ({ ...p, [selectedThread.id]: v }))
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {activeItems.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-sm text-slate-400">No active work items</p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-5">
                {overdue.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">
                      Overdue ({overdue.length})
                    </p>
                    <WorkItemList items={overdue} />
                  </section>
                )}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Active & Waiting ({upcoming.length})
                  </p>
                  <WorkItemList items={upcoming} />
                </section>
              </div>
            )}
          </div>
        )}
      </div>

      {creatingWorkItem && (
        <CreateWorkItemModal
          thread={creatingWorkItem}
          todoistEnabled={todoistEnabled}
          onClose={() => setCreatingWorkItem(null)}
        />
      )}
    </div>
  );
}

function WorkItemList({ items }: { items: ActiveWorkItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((wi) => {
        const isOverdue = wi.dueDate && new Date(wi.dueDate) < new Date();
        return (
          <Link
            key={wi.id}
            href={`/work-items/${wi.id}`}
            className="flex items-start gap-3 rounded-lg border bg-white px-4 py-3 hover:shadow-sm transition-shadow group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {wi.domain ? (
                  <DomainBadge name={wi.domain.name} color={wi.domain.color} />
                ) : null}
                <StatusBadge status={wi.status} />
              </div>
              <p className="text-sm font-medium text-slate-800 truncate">{wi.title}</p>
              {wi.threads.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {wi.threads[0].subject}
                  {wi.threads[0].isUnread && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" />
                  )}
                </p>
              )}
              {wi.dueDate && (
                <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
                  {isOverdue ? "Overdue: " : "Due "}
                  {new Date(wi.dueDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-0.5" />
          </Link>
        );
      })}
    </div>
  );
}
