export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { isConfigured as todoistConfigured } from "@/lib/todoist";
import { notSnoozedFilter } from "@/lib/thread-filters";
import { AppShell } from "@/components/layout/AppShell";
import { TodayClient } from "./TodayClient";

export default async function TodayPage() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [triageThreads, activeItems] = await Promise.all([
    prisma.threadMirror.findMany({
      where: {
        isStale: false,
        isUnread: true,
        workItemId: null,
        lastMessageAt: { gte: sevenDaysAgo },
        AND: [notSnoozedFilter()],
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      include: {
        account: { select: { id: true, email: true, displayName: true, color: true } },
        domain: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.workItem.findMany({
      where: { status: { in: ["ACTIVE", "WAITING", "DELEGATED"] } },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      include: {
        domain: { select: { id: true, name: true, color: true } },
        threads: {
          where: { isStale: false },
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: {
            id: true,
            subject: true,
            lastMessageAt: true,
            isUnread: true,
          },
        },
      },
    }),
  ]);

  return (
    <AppShell>
      <TodayClient
        triageThreads={triageThreads.map((t) => ({
          ...t,
          lastMessageAt: t.lastMessageAt.toISOString(),
          workItem: null,
        }))}
        activeItems={activeItems.map((wi) => ({
          ...wi,
          dueDate: wi.dueDate?.toISOString() ?? null,
          updatedAt: wi.updatedAt.toISOString(),
          threads: wi.threads.map((th) => ({
            ...th,
            lastMessageAt: th.lastMessageAt.toISOString(),
          })),
        }))}
        todoistEnabled={todoistConfigured()}
      />
    </AppShell>
  );
}
