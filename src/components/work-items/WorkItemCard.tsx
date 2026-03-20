import Link from "next/link";
import type { WorkItemStatus } from "@prisma/client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowRight, MessageSquare, Calendar } from "lucide-react";
import { relativeTime, formatDate } from "@/lib/utils";

interface WorkItemCardProps {
  workItem: {
    id: string;
    title: string;
    status: WorkItemStatus;
    dueDate: Date | string | null;
    updatedAt: Date | string;
    _count: { threads: number };
  };
}

export function WorkItemCard({ workItem }: WorkItemCardProps) {
  return (
    <Link href={`/work-items/${workItem.id}`} className="block group">
      <div className="flex items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow group-hover:border-slate-300">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={workItem.status} />
          </div>
          <p className="text-sm font-medium text-slate-900 truncate">{workItem.title}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {workItem._count.threads} thread{workItem._count.threads !== 1 ? "s" : ""}
            </span>
            {workItem.dueDate && (
              <span className="flex items-center gap-1 text-amber-600">
                <Calendar className="h-3 w-3" />
                Due {formatDate(workItem.dueDate)}
              </span>
            )}
            <span>Updated {relativeTime(workItem.updatedAt)}</span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-slate-600 mt-0.5" />
      </div>
    </Link>
  );
}
