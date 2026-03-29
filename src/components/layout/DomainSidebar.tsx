"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Inbox, RefreshCw, Settings, Sunrise } from "lucide-react";

interface Domain {
  id: string;
  name: string;
  color: string;
}

interface WorkItemCounts {
  active: number;
  waiting: number;
  delegated: number;
}

interface DomainSidebarProps {
  domains: Domain[];
  counts: WorkItemCounts;
  todayCount: number;
}

export function DomainSidebar({ domains, counts, todayCount }: DomainSidebarProps) {
  const pathname = usePathname();
  const totalActive = counts.active + counts.waiting + counts.delegated;

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-slate-50">
      {/* App header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Inbox className="h-5 w-5 text-slate-600" />
        <span className="text-sm font-semibold text-slate-800">Work Console</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {/* Today */}
        <Link
          href="/today"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/today"
              ? "bg-slate-200 font-medium text-slate-900"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <Sunrise className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">Today</span>
          {todayCount > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              {todayCount}
            </span>
          )}
        </Link>

        {/* All / Unified Intake */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/"
              ? "bg-slate-200 font-medium text-slate-900"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <span className="flex-1">All Mail</span>
          {totalActive > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
              {totalActive}
            </span>
          )}
        </Link>

        <div className="mt-3 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Domains
        </div>

        {domains.map((domain) => (
          <Link
            key={domain.id}
            href={`/domains/${domain.id}`}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === `/domains/${domain.id}`
                ? "bg-slate-200 font-medium text-slate-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: domain.color }}
            />
            <span className="flex-1 truncate">{domain.name}</span>
          </Link>
        ))}
      </nav>

      {/* Summary counts */}
      <div className="border-t px-4 py-2 text-xs text-slate-500">
        <div className="flex justify-between">
          <span>Active</span>
          <span className="font-medium text-blue-600">{counts.active}</span>
        </div>
        <div className="flex justify-between">
          <span>Waiting</span>
          <span className="font-medium text-amber-600">{counts.waiting}</span>
        </div>
        <div className="flex justify-between">
          <span>Delegated</span>
          <span className="font-medium text-purple-600">{counts.delegated}</span>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center border-t px-2 py-2 gap-1">
        <Link
          href="/settings"
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
        <Link
          href="/sync-log"
          className="flex items-center rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          title="Sync log"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Link>
      </div>
    </aside>
  );
}
