"use client";

import { useState, useCallback } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard, type KanbanWorkItem } from "./KanbanCard";
import type { KanbanColumnConfig } from "@/app/api/domains/[id]/kanban-config/route";
import type { WorkItemStatus } from "@prisma/client";

interface KanbanBoardProps {
  workItems: KanbanWorkItem[];
  domainId: string;
  columns: KanbanColumnConfig[];
}

export function KanbanBoard({ workItems: initialItems, columns }: KanbanBoardProps) {
  const [items, setItems] = useState<KanbanWorkItem[]>(initialItems);
  const [activeItem, setActiveItem] = useState<KanbanWorkItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visibleColumns = columns.filter((c) => c.visible);

  const itemsByStatus = useCallback(
    (status: WorkItemStatus) => items.filter((i) => i.status === status),
    [items]
  );

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const draggedId = active.id as string;
    const targetStatus = over.id as WorkItemStatus;
    const dragged = items.find((i) => i.id === draggedId);

    if (!dragged || dragged.status === targetStatus) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === draggedId ? { ...i, status: targetStatus, updatedAt: new Date() } : i
      )
    );

    try {
      const res = await fetch(`/api/work-items/${draggedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === draggedId ? { ...i, status: dragged.status } : i))
      );
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 px-1">
        {visibleColumns.map((col) => (
          <KanbanColumn
            key={col.status}
            config={col}
            items={itemsByStatus(col.status as WorkItemStatus)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? <KanbanCard workItem={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
