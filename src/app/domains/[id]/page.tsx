export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { isConfigured as todoistConfigured } from "@/lib/todoist";
import { AppShell } from "@/components/layout/AppShell";
import { WorkItemCard } from "@/components/work-items/WorkItemCard";
import { KanbanBoard } from "@/components/work-items/KanbanBoard";
import { DomainThreadsClient } from "@/components/domains/DomainThreadsClient";
import { DomainViewToggle } from "@/components/domains/DomainViewToggle";
import { KanbanConfigDialog } from "@/components/domains/KanbanConfigDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import type { WorkItemStatus } from "@prisma/client";
import { resolveKanbanColumns } from "@/lib/kanban";

const STATUS_ORDER: WorkItemStatus[] = ["ACTIVE", "WAITING", "DELEGATED", "NEW", "TODOIST"];
const STATUS_LABELS: Record<WorkItemStatus, string> = {
  NEW: "New",
  ACTIVE: "Active",
  WAITING: "Waiting",
  DELEGATED: "Delegated",
  TODOIST: "In Todoist",
  DONE: "Done",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function DomainPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { view } = await searchParams;
  const isKanban = view === "kanban";

  const domain = await prisma.domain.findUnique({
    where: { id },
    select: { id: true, name: true, color: true, kanbanColumns: true },
  });

  if (!domain) notFound();

  const [workItems, unlinkedThreads] = await Promise.all([
    prisma.workItem.findMany({
      where: { domainId: id, status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { threads: true } } },
    }),
    prisma.threadMirror.findMany({
      where: { domainId: id, workItemId: null, isStale: false },
      orderBy: { lastMessageAt: "desc" },
      take: 30,
      include: {
        account: { select: { id: true, email: true, displayName: true, color: true } },
        domain: { select: { id: true, name: true, color: true } },
        workItem: { select: { id: true, title: true, status: true } },
      },
    }),
  ]);

  const kanbanColumns = resolveKanbanColumns(domain.kanbanColumns);

  // Group work items by status for the list view
  const grouped = new Map<WorkItemStatus, typeof workItems>();
  for (const status of STATUS_ORDER) {
    const items = workItems.filter((wi) => wi.status === status);
    if (items.length > 0) grouped.set(status, items);
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <div className="border-b bg-white px-4 py-3 flex items-center gap-3 flex-wrap">
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Link href="/">
              <ArrowLeft className="h-3 w-3" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: domain.color }}
            />
            <h1 className="text-base font-semibold text-slate-900">{domain.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Suspense>
              <DomainViewToggle />
            </Suspense>
            {isKanban && (
              <KanbanConfigDialog domainId={domain.id} columns={kanbanColumns} />
            )}
            <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Link href={`/?domainId=${domain.id}`}>
                <Plus className="h-3 w-3" />
                New Work Item
              </Link>
            </Button>
          </div>
        </div>

        {isKanban ? (
          <div className="flex-1 overflow-auto px-6 py-4">
            <KanbanBoard
              workItems={workItems}
              domainId={domain.id}
              columns={kanbanColumns}
            />
            {unlinkedThreads.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unlinked Threads ({unlinkedThreads.length})
                </h2>
                <DomainThreadsClient
                  threads={unlinkedThreads}
                  todoistEnabled={todoistConfigured()}
                />
              </section>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {grouped.size === 0 && unlinkedThreads.length === 0 && (
              <p className="py-12 text-center text-sm text-slate-400">
                No active work items or unlinked threads in this domain.
              </p>
            )}

            {Array.from(grouped.entries()).map(([status, items]) => (
              <section key={status}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {STATUS_LABELS[status]} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((wi) => (
                    <WorkItemCard key={wi.id} workItem={wi} />
                  ))}
                </div>
              </section>
            ))}

            {unlinkedThreads.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unlinked Threads ({unlinkedThreads.length})
                </h2>
                <DomainThreadsClient
                  threads={unlinkedThreads}
                  todoistEnabled={todoistConfigured()}
                />
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
