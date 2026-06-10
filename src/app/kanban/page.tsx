export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard, type KanbanSwimlane } from "@/components/work-items/KanbanBoard";
import { KanbanConfigDialog } from "@/components/domains/KanbanConfigDialog";
import { resolveKanbanColumns } from "@/lib/kanban";
import type { WorkItemStatus } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{ domain?: string }>;
}

const WORK_ITEM_SELECT = {
  id: true,
  title: true,
  status: true,
  domainId: true,
  dueDate: true,
  updatedAt: true,
  _count: { select: { threads: true } },
} as const;

export default async function KanbanPage({ searchParams }: PageProps) {
  const { domain: domainParam } = await searchParams;

  const domains = await prisma.domain.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true, kanbanColumns: true },
  });

  // ── Individual domain board ──────────────────────────────────────────────
  if (domainParam) {
    const domain = domains.find((d) => d.id === domainParam);
    if (!domain) notFound();

    const workItems = await prisma.workItem.findMany({
      where: { domainId: domain.id, status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      select: WORK_ITEM_SELECT,
    });
    const columns = resolveKanbanColumns(domain.kanbanColumns);

    return (
      <KanbanShell
        domains={domains}
        activeDomainId={domain.id}
        count={workItems.length}
        configDialog={
          <KanbanConfigDialog
            domainId={domain.id}
            endpoint={`/api/domains/${domain.id}/kanban-config`}
            columns={columns}
          />
        }
      >
        <KanbanBoard
          workItems={workItems.map((wi) => ({ ...wi, status: wi.status as WorkItemStatus }))}
          domainId={domain.id}
          columns={columns}
        />
      </KanbanShell>
    );
  }

  // ── Global board (all domains as swimlanes) ──────────────────────────────
  const [globalConfig, workItems] = await Promise.all([
    prisma.kanbanSetting.findUnique({ where: { id: "singleton" } }),
    prisma.workItem.findMany({
      where: { status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      select: WORK_ITEM_SELECT,
    }),
  ]);

  const columns = resolveKanbanColumns(globalConfig?.columns ?? null);
  const swimlanes: KanbanSwimlane[] = [
    ...domains.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    { id: null, name: "Unassigned", color: "#94a3b8" },
  ];

  return (
    <KanbanShell
      domains={domains}
      activeDomainId={null}
      count={workItems.length}
      configDialog={<KanbanConfigDialog endpoint="/api/kanban-config" columns={columns} />}
    >
      <KanbanBoard
        workItems={workItems.map((wi) => ({ ...wi, status: wi.status as WorkItemStatus }))}
        columns={columns}
        swimlanes={swimlanes}
      />
    </KanbanShell>
  );
}

// ── Shared layout: header, domain switcher, config dialog, board ───────────
function KanbanShell({
  domains,
  activeDomainId,
  count,
  configDialog,
  children,
}: {
  domains: { id: string; name: string; color: string }[];
  activeDomainId: string | null;
  count: number;
  configDialog: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex-shrink-0 border-b px-4 py-3 flex items-center gap-3 flex-wrap"
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
            {count} active
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline"
              style={{ color: "var(--ds-muted)" }}
            >
              {activeDomainId === null ? "rows = domains · drag to move" : "drag to move"}
            </span>
            {configDialog}
          </div>
        </div>

        {/* Domain switcher: "All" + one pill per domain */}
        <div
          className="flex-shrink-0 flex items-center gap-1.5 overflow-x-auto border-b px-4 py-2"
          style={{ background: "var(--ds-panel)", borderColor: "var(--ds-line)" }}
        >
          <DomainPill href="/kanban" label="All domains" active={activeDomainId === null} />
          {domains.map((d) => (
            <DomainPill
              key={d.id}
              href={`/kanban?domain=${d.id}`}
              label={d.name}
              color={d.color}
              active={activeDomainId === d.id}
            />
          ))}
        </div>

        {/* Board */}
        <div className="flex-1 overflow-auto px-6 py-4">{children}</div>
      </div>
    </AppShell>
  );
}

function DomainPill({
  href,
  label,
  color,
  active,
}: {
  href: string;
  label: string;
  color?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-slate-300 bg-slate-100 font-medium text-slate-900"
          : "border-transparent text-slate-500 hover:bg-slate-50"
      }`}
    >
      {color && (
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
      )}
      {label}
    </Link>
  );
}
