"use client";

import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MessageSquare, Calendar } from "lucide-react";
import { cn, relativeTime, formatDate } from "@/lib/utils";
import type { WorkItemStatus } from "@prisma/client";

export interface KanbanWorkItem {
  id: string;
  title: string;
  status: WorkItemStatus;
  dueDate: Date | string | null;
  updatedAt: Date | string;
  _count: { threads: number };
}

interface KanbanCardProps {
  workItem: KanbanWorkItem;
}

export function KanbanCard({ workItem }: KanbanCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: workItem.id,
    data: { status: workItem.status },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  function handleClick() {
    if (!isDragging) router.push(`/work-items/${workItem.id}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        "group rounded-lg border bg-white px-3 py-2.5 shadow-sm select-none",
        "transition-shadow hover:shadow",
        isDragging ? "opacity-50 shadow-lg cursor-grabbing" : "cursor-pointer"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 flex-shrink-0 touch-none text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          aria-label="Drag card"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-2">
            {workItem.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {workItem._count.threads > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {workItem._count.threads}
              </span>
            )}
            {workItem.dueDate && (
              <span className="flex items-center gap-1 text-amber-600">
                <Calendar className="h-3 w-3" />
                {formatDate(workItem.dueDate)}
              </span>
            )}
            <span className="text-slate-400">{relativeTime(workItem.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
