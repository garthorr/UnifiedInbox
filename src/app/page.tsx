import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { isConfigured as todoistConfigured } from "@/lib/todoist";
import { AppShell } from "@/components/layout/AppShell";
import { InboxFilters } from "@/components/inbox/InboxFilters";
import { InboxPane } from "@/components/inbox/InboxPane";

interface PageProps {
  searchParams: Promise<{
    accountId?: string;
    isUnread?: string;
    days?: string;
  }>;
}

async function InboxContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const days = parseInt(params.days ?? "7");
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - days);

  const [accounts, threads] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.threadMirror.findMany({
      where: {
        isStale: false,
        lastMessageAt: { gte: afterDate },
        ...(params.accountId ? { accountId: params.accountId } : {}),
        ...(params.isUnread === "true" ? { isUnread: true } : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        account: { select: { id: true, email: true, displayName: true } },
        domain: { select: { id: true, name: true, color: true } },
        workItem: { select: { id: true, title: true, status: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b bg-white px-6 py-3 flex items-center gap-4">
        <h1 className="text-base font-semibold text-slate-900 shrink-0">Unified Intake</h1>
        <InboxFilters accounts={accounts} />
        <span className="ml-auto text-xs text-slate-400">
          {threads.length} thread{threads.length !== 1 ? "s" : ""}
        </span>
      </div>
      <InboxPane threads={threads} todoistEnabled={todoistConfigured()} />
    </div>
  );
}

export default function HomePage({ searchParams }: PageProps) {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-slate-400">Loading...</div>
        }
      >
        <InboxContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}
