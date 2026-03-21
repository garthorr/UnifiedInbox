import { cn } from "@/lib/utils";

interface DomainBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function DomainBadge({ name, color, className }: DomainBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white",
        className
      )}
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

export function UnassignedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500",
        className
      )}
    >
      Unassigned
    </span>
  );
}
