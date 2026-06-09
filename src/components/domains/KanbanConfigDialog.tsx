"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings2, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultKanbanColumns, type KanbanColumnConfig } from "@/lib/kanban";

interface KanbanConfigDialogProps {
  columns: KanbanColumnConfig[];
  /** Per-domain board. Omit (and pass `endpoint`) for the global board. */
  domainId?: string;
  /** PATCH endpoint that accepts `{ columns }`. Defaults to the domain endpoint. */
  endpoint?: string;
}

function SortableRow({
  col,
  onChange,
}: {
  col: KanbanColumnConfig;
  onChange: (updated: Partial<KanbanColumnConfig>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.status });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-white px-3 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-400 hover:text-slate-600"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        type="checkbox"
        checked={col.visible}
        onChange={(e) => onChange({ visible: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300 accent-slate-700"
        aria-label={`Show ${col.label} column`}
      />
      <Input
        value={col.label}
        onChange={(e) => onChange({ label: e.target.value })}
        className="h-7 flex-1 text-xs"
        aria-label="Column label"
      />
      <span className="text-xs text-slate-400 w-20 text-right truncate">{col.status}</span>
    </div>
  );
}

export function KanbanConfigDialog({
  domainId,
  endpoint,
  columns: initialColumns,
}: KanbanConfigDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(initialColumns);
  const [saving, setSaving] = useState(false);

  const saveUrl = endpoint ?? `/api/domains/${domainId}/kanban-config`;

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((cols) => {
        const oldIndex = cols.findIndex((c) => c.status === active.id);
        const newIndex = cols.findIndex((c) => c.status === over.id);
        return arrayMove(cols, oldIndex, newIndex);
      });
    }
  }

  function updateColumn(status: string, patch: Partial<KanbanColumnConfig>) {
    setColumns((cols) =>
      cols.map((c) => (c.status === status ? { ...c, ...patch } : c))
    );
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(saveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleOpen(next: boolean) {
    if (next) setColumns(initialColumns);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Configure board columns">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Configure Board Columns</DialogTitle>
          <DialogDescription className="text-xs">
            Drag to reorder, toggle to show/hide, and rename columns as needed.
          </DialogDescription>
        </DialogHeader>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={columns.map((c) => c.status)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {columns.map((col) => (
                <SortableRow
                  key={col.status}
                  col={col}
                  onChange={(patch) => updateColumn(col.status, patch)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500"
            onClick={() => setColumns(defaultKanbanColumns())}
          >
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
