import type { WorkItemStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  WorkItemStatus,
  { label: string; className: string }
> = {
  NEW: { label: "New", className: "bg-slate-100 text-slate-700 border-slate-200" },
  ACTIVE: { label: "Active", className: "bg-blue-100 text-blue-700 border-blue-200" },
  WAITING: { label: "Waiting", className: "bg-amber-100 text-amber-700 border-amber-200" },
  DELEGATED: { label: "Delegated", className: "bg-purple-100 text-purple-700 border-purple-200" },
  TODOIST: { label: "Todoist", className: "bg-green-100 text-green-700 border-green-200" },
  DONE: { label: "Done", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

interface StatusBadgeProps {
  status: WorkItemStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
