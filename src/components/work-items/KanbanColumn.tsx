"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { KanbanCard, type KanbanWorkItem } from "./KanbanCard";
import type { KanbanColumnConfig } from "@/app/api/domains/[id]/kanban-config/route";

const STATUS_DOT_COLORS: Record<string, string> = {
  NEW: "bg-slate-400",
  ACTIVE: "bg-blue-500",
  WAITING: "bg-amber-500",
  DELEGATED: "bg-purple-500",
  TODOIST: "bg-green-500",
  DONE: "bg-slate-300",
};

interface KanbanColumnProps {
  config: KanbanColumnConfig;
  items: KanbanWorkItem[];
}

export function KanbanColumn({ config, items }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: config.status });

  return (
    <div className="flex w-64 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className={cn(
            "h-2 w-2 rounded-full flex-shrink-0",
            STATUS_DOT_COLORS[config.status] ?? "bg-slate-400"
          )}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 truncate">
          {config.label}
        </span>
        <span className="ml-auto flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-lg border-2 p-2 space-y-2 min-h-24 transition-colors",
          isOver ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"
        )}
      >
        {items.map((item) => (
          <KanbanCard key={item.id} workItem={item} />
        ))}
        {items.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400">No items</p>
        )}
      </div>
    </div>
  );
}
