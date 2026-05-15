"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { DomainSidebar } from "./DomainSidebar";

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

interface MobileNavDrawerProps {
  domains: Domain[];
  counts: WorkItemCounts;
  todayCount: number;
  syncFailedCount?: number;
}

export function MobileNavDrawer({ domains, counts, todayCount, syncFailedCount = 0 }: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 transition-colors hover:bg-black/5"
        style={{ color: "var(--ds-ink-2)" }}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute left-0 top-0 h-full shadow-xl" style={{ width: "min(256px, 85vw)" }}>
            <DomainSidebar
              domains={domains}
              counts={counts}
              todayCount={todayCount}
              syncFailedCount={syncFailedCount}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
