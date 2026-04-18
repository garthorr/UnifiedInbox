import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard, type KanbanSwimlane } from "@/components/work-items/KanbanBoard";
import { KanbanConfigDialog } from "@/components/domains/KanbanConfigDialog";
import type { KanbanColumnConfig } from "@/app/api/domains/[id]/kanban-config/route";
import type { WorkItemStatus } from "@prisma/client";

const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
  { status: "ACTIVE",    label: "Active",      visible: true },
  { status: "WAITING",   label: "Waiting",     visible: true },
  { status: "DELEGATED", label: "Delegated",   visible: true },
  { status: "NEW",       label: "New",         visible: true },
  { status: "TODOIST",   label: "In Todoist",  visible: true },
];

export default async function KanbanPage() {
  const [domains, workItems] = await Promise.all([
    prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.workItem.findMany({
      where: { status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        domainId: true,
        dueDate: true,
        updatedAt: true,
        _count: { select: { threads: true } },
      },
    }),
  ]);

  const swimlanes: KanbanSwimlane[] = [
    ...domains.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    { id: null, name: "Unassigned", color: "#94a3b8" },
  ];

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex-shrink-0 border-b px-6 py-3 flex items-center gap-3"
          style={{ background: "var(--ds-panel)", borderColor: "var(--ds-line)" }}
        >
          <h1
            className="font-serif font-bold text-[22px] tracking-tight"
            style={{ color: "var(--ds-ink)" }}
          >
            Kanban
          </h1>
          <span
            className="font-mono text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: "var(--ds-panel-2)", color: "var(--ds-muted)" }}
          >
            {workItems.length} active
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--ds-muted)" }}
            >
              rows = domains · drag to move
            </span>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <KanbanBoard
            workItems={workItems.map((wi) => ({
              ...wi,
              status: wi.status as WorkItemStatus,
              domainId: wi.domainId,
              dueDate: wi.dueDate,
              updatedAt: wi.updatedAt,
            }))}
            columns={DEFAULT_COLUMNS}
            swimlanes={swimlanes}
          />
        </div>
      </div>
    </AppShell>
  );
}
