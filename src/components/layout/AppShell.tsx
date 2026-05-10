import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { DomainSidebar } from "./DomainSidebar";
import { MobileNavDrawer } from "./MobileNavDrawer";

async function getSidebarData() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [domains, counts, todayCount] = await Promise.all([
    prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.workItem.groupBy({
      by: ["status"],
      where: { status: { in: ["ACTIVE", "WAITING", "DELEGATED"] } },
      _count: true,
    }),
    prisma.threadMirror.count({
      where: {
        isStale: false,
        isUnread: true,
        workItemId: null,
        lastMessageAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  const countMap = { active: 0, waiting: 0, delegated: 0 };
  for (const c of counts) {
    if (c.status === "ACTIVE") countMap.active = c._count;
    if (c.status === "WAITING") countMap.waiting = c._count;
    if (c.status === "DELEGATED") countMap.delegated = c._count;
  }

  return { domains, counts: countMap, todayCount };
}

export async function AppShell({ children }: { children: ReactNode }) {
  const { domains, counts, todayCount } = await getSidebarData();

  return (
    <div className="flex h-screen items-stretch justify-center">
      <div className="flex w-full max-w-[1600px] overflow-hidden md:shadow-sm">

        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block flex-shrink-0">
          <DomainSidebar domains={domains} counts={counts} todayCount={todayCount} />
        </div>

        {/* Content column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-white">

          {/* Mobile header — hidden on desktop */}
          <div
            className="md:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b"
            style={{ background: "var(--ds-panel-2)", borderColor: "var(--ds-line)" }}
          >
            <MobileNavDrawer domains={domains} counts={counts} todayCount={todayCount} />
            <div className="flex items-center gap-2">
              <div
                className="relative flex-shrink-0 w-6 h-6 rounded-[4px] grid place-items-center"
                style={{ background: "var(--ds-ink)" }}
              >
                <span className="font-sans font-extrabold text-sm leading-none" style={{ color: "var(--ds-panel)" }}>U</span>
                <span
                  className="absolute -right-[3px] -bottom-[3px] w-2 h-2 rounded-[2px] border-[2px]"
                  style={{ background: "var(--ds-hot)", borderColor: "var(--ds-panel-2)" }}
                />
              </div>
              <span className="font-serif font-bold text-[16px] tracking-tight" style={{ color: "var(--ds-ink)" }}>
                Unified Inbox
              </span>
            </div>
          </div>

          <main className="flex-1 overflow-hidden">{children}</main>
        </div>

      </div>
    </div>
  );
}
