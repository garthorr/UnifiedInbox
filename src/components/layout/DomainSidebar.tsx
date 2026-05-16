"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, FileEdit, Inbox, LayoutDashboard, RefreshCw, Settings, Sunrise, X } from "lucide-react";
import { listDrafts, subscribeDrafts } from "@/lib/drafts";

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
  snoozedCount?: number;
  syncFailedCount?: number;
  onClose?: () => void;
}

export function DomainSidebar({ domains, counts, todayCount, snoozedCount = 0, syncFailedCount = 0, onClose }: DomainSidebarProps) {
  const pathname = usePathname();
  const totalActive = counts.active + counts.waiting + counts.delegated;

  // Drafts live in localStorage, so count after mount and subscribe to changes.
  const [draftCount, setDraftCount] = useState(0);
  useEffect(() => {
    const refresh = () => setDraftCount(listDrafts().length);
    refresh();
    return subscribeDrafts(refresh);
  }, []);

  function navCls(active: boolean) {
    return cn(
      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium cursor-pointer transition-colors",
      active
        ? "bg-ds-ink text-ds-panel"
        : "text-ds-ink-2 hover:bg-black/5"
    );
  }

  function countCls(active: boolean) {
    return cn(
      "ml-auto font-mono text-[11px] px-1.5 py-0.5 rounded-full",
      active
        ? "bg-ds-panel text-ds-ink"
        : "bg-black/8 text-ds-muted"
    );
  }

  return (
    <aside
      className="flex h-full w-56 flex-col border-r"
      style={{ background: "var(--ds-panel-2)", borderColor: "var(--ds-line)" }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-4 py-[18px] border-b"
        style={{ borderColor: "var(--ds-line)" }}
      >
        {/* Brand mark: dark square with hot corner accent */}
        <div className="relative flex-shrink-0 w-7 h-7 rounded-[4px] bg-ds-ink grid place-items-center">
          <span className="font-sans font-extrabold text-base leading-none text-ds-panel">U</span>
          <span
            className="absolute -right-[3px] -bottom-[3px] w-2.5 h-2.5 rounded-[2px] bg-ds-hot border-[2px]"
            style={{ borderColor: "var(--ds-panel-2)" }}
          />
        </div>
        <span className="font-serif font-bold text-[17px] tracking-tight text-ds-ink">
          Unified Inbox
        </span>
        <div className="ml-auto flex items-center gap-1">
          {onClose ? (
            <button
              onClick={onClose}
              className="rounded-md p-1 transition-colors hover:bg-black/5"
              style={{ color: "var(--ds-muted)" }}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-ds-accent" />
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <p className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-ds-muted">
          Views
        </p>

        <Link href="/today" className={navCls(pathname === "/today")}>
          <Sunrise className="h-[14px] w-[14px] flex-shrink-0 opacity-75" />
          <span className="flex-1">Today</span>
          {todayCount > 0 && (
            <span className={cn(countCls(pathname === "/today"), "bg-ds-hot/15 text-ds-hot")}>
              {todayCount}
            </span>
          )}
        </Link>

        <Link href="/" className={navCls(pathname === "/")}>
          <Inbox className="h-[14px] w-[14px] flex-shrink-0 opacity-75" />
          <span className="flex-1">All Mail</span>
          {totalActive > 0 && (
            <span className={countCls(pathname === "/")}>
              {totalActive}
            </span>
          )}
        </Link>

        <Link href="/kanban" className={navCls(pathname === "/kanban")}>
          <LayoutDashboard className="h-[14px] w-[14px] flex-shrink-0 opacity-75" />
          <span className="flex-1">Kanban</span>
        </Link>

        {snoozedCount > 0 && (
          <Link href="/snoozed" className={navCls(pathname === "/snoozed")}>
            <Clock className="h-[14px] w-[14px] flex-shrink-0 opacity-75" />
            <span className="flex-1">Snoozed</span>
            <span className={countCls(pathname === "/snoozed")}>{snoozedCount}</span>
          </Link>
        )}

        {draftCount > 0 && (
          <Link href="/drafts" className={navCls(pathname === "/drafts")}>
            <FileEdit className="h-[14px] w-[14px] flex-shrink-0 opacity-75" />
            <span className="flex-1">Drafts</span>
            <span className={countCls(pathname === "/drafts")}>{draftCount}</span>
          </Link>
        )}

        {domains.length > 0 && (
          <p className="px-2.5 py-1 mt-3 font-mono text-[10px] uppercase tracking-widest text-ds-muted">
            Domains
          </p>
        )}

        {domains.map((domain) => {
          const active = pathname === `/domains/${domain.id}`;
          return (
            <Link key={domain.id} href={`/domains/${domain.id}`} className={navCls(active)}>
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: domain.color }}
              />
              <span className="flex-1 truncate">{domain.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Stats footer */}
      <div
        className="border-t p-3 space-y-1"
        style={{ borderColor: "var(--ds-line)" }}
      >
        <div
          className="rounded-md p-3 border"
          style={{ background: "var(--ds-panel)", borderColor: "var(--ds-line)" }}
        >
          <p
            className="font-sans font-bold text-[26px] leading-none tracking-tight tabular-nums"
            style={{ color: "var(--ds-ink)" }}
          >
            {counts.active + counts.waiting + counts.delegated}
          </p>
          <p className="font-mono text-[10.5px] uppercase tracking-widest mt-1" style={{ color: "var(--ds-muted)" }}>
            Active work items
          </p>
          <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: "var(--ds-line)" }}>
            <div
              className="h-full rounded-full"
              style={{
                background: "var(--ds-accent)",
                width: counts.active > 0 ? `${Math.min(100, (counts.active / Math.max(1, counts.active + counts.waiting + counts.delegated)) * 100)}%` : "0%",
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 pt-1">
          <Link
            href="/settings"
            className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
            style={{ color: "var(--ds-muted)" }}
            title={
              syncFailedCount > 0
                ? `${syncFailedCount} account${syncFailedCount === 1 ? "" : "s"} failed to sync recently`
                : "Settings"
            }
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="flex-1">Settings</span>
            {syncFailedCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: "color-mix(in oklch, var(--ds-hot) 18%, transparent)",
                  color: "var(--ds-hot)",
                }}
                aria-label={`${syncFailedCount} sync error${syncFailedCount === 1 ? "" : "s"}`}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {syncFailedCount}
              </span>
            )}
          </Link>
          <Link
            href="/sync-log"
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--ds-muted)" }}
            title="Sync log"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
