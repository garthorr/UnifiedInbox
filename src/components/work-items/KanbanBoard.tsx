"use client";

import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard, type KanbanWorkItem } from "./KanbanCard";
import type { KanbanColumnConfig } from "@/app/api/domains/[id]/kanban-config/route";
import type { WorkItemStatus } from "@prisma/client";

export interface KanbanSwimlane {
  id: string | null; // null = unassigned
  name: string;
  color: string;
}

interface KanbanBoardProps {
  workItems: KanbanWorkItem[];
  domainId?: string;
  columns: KanbanColumnConfig[];
  swimlanes?: KanbanSwimlane[]; // when provided → multi-row layout, rows = domains
}

const STATUS_DOT_COLORS: Record<string, string> = {
  NEW: "bg-slate-400",
  ACTIVE: "bg-blue-500",
  WAITING: "bg-amber-500",
  DELEGATED: "bg-purple-500",
  TODOIST: "bg-green-500",
  DONE: "bg-slate-300",
};

export function KanbanBoard({ workItems: initialItems, columns, swimlanes }: KanbanBoardProps) {
  const [items, setItems] = useState<KanbanWorkItem[]>(initialItems);
  const [activeItem, setActiveItem] = useState<KanbanWorkItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visibleColumns = columns.filter((c) => c.visible);

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(items.find((i) => i.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const draggedId = active.id as string;
    const dragged = items.find((i) => i.id === draggedId);
    if (!dragged) return;

    // Swimlane mode: droppableId is "domainId:status" (domainId may be "null")
    // Flat mode: droppableId is just the status string
    const overId = over.id as string;
    let targetStatus: WorkItemStatus;
    let targetDomainId: string | null | undefined = undefined;

    if (swimlanes) {
      const sep = overId.indexOf(":");
      const rawDomain = overId.slice(0, sep);
      targetStatus = overId.slice(sep + 1) as WorkItemStatus;
      targetDomainId = rawDomain === "null" ? null : rawDomain;
    } else {
      targetStatus = overId as WorkItemStatus;
    }

    const unchanged =
      dragged.status === targetStatus &&
      (targetDomainId === undefined || dragged.domainId === targetDomainId);
    if (unchanged) return;

    const optimistic: KanbanWorkItem = {
      ...dragged,
      status: targetStatus,
      ...(targetDomainId !== undefined ? { domainId: targetDomainId } : {}),
      updatedAt: new Date(),
    };

    setItems((prev) => prev.map((i) => (i.id === draggedId ? optimistic : i)));

    try {
      const body: Record<string, unknown> = { status: targetStatus };
      if (targetDomainId !== undefined) body.domainId = targetDomainId;
      const res = await fetch(`/api/work-items/${draggedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setItems((prev) => prev.map((i) => (i.id === draggedId ? dragged : i)));
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {swimlanes ? (
        <SwimlaneLayout items={items} columns={visibleColumns} swimlanes={swimlanes} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 px-1">
          {visibleColumns.map((col) => (
            <KanbanColumn
              key={col.status}
              config={col}
              items={items.filter((i) => i.status === col.status)}
            />
          ))}
        </div>
      )}
      <DragOverlay>
        {activeItem ? <KanbanCard workItem={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function SwimlaneLayout({
  items,
  columns,
  swimlanes,
}: {
  items: KanbanWorkItem[];
  columns: KanbanColumnConfig[];
  swimlanes: KanbanSwimlane[];
}) {
  return (
    <div className="overflow-auto">
      {/* Column headers */}
      <div className="flex gap-0 mb-1 sticky top-0 z-10 bg-white pb-1 border-b border-slate-100">
        <div className="w-36 flex-shrink-0" /> {/* domain label spacer */}
        {columns.map((col) => {
          const total = items.filter((i) => i.status === col.status).length;
          return (
            <div key={col.status} className="w-52 flex-shrink-0 px-1">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[col.status] ?? "bg-slate-400"}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 truncate">
                  {col.label}
                </span>
                <span className="ml-auto flex-shrink-0 text-[10px] font-mono text-slate-400">{total}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* One row per swimlane */}
      <div className="space-y-2 pt-1">
        {swimlanes.map((lane) => {
          const laneId = lane.id ?? "null";
          const laneItems = items.filter((i) =>
            lane.id === null ? i.domainId === null : i.domainId === lane.id
          );

          return (
            <div key={laneId} className="flex gap-0 items-start">
              {/* Row header */}
              <div className="w-36 flex-shrink-0 pr-3 pt-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: lane.color || "#94a3b8" }}
                  />
                  <span className="text-xs font-semibold text-slate-700 truncate">{lane.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block pl-4">
                  {laneItems.length} item{laneItems.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* One droppable cell per column */}
              {columns.map((col) => (
                <div key={col.status} className="w-52 flex-shrink-0 px-1">
                  <KanbanColumn
                    config={col}
                    items={laneItems.filter((i) => i.status === col.status)}
                    droppableId={`${laneId}:${col.status}`}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
