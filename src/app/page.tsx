import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { isConfigured as todoistConfigured } from "@/lib/todoist";
import { AppShell } from "@/components/layout/AppShell";
import { InboxFilters } from "@/components/inbox/InboxFilters";
import { InboxPane } from "@/components/inbox/InboxPane";
import { SyncAllButton } from "@/components/inbox/SyncAllButton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DomainBadge } from "@/components/shared/DomainBadge";

interface PageProps {
  searchParams: Promise<{
    accountId?: string;
    isUnread?: string;
    days?: string;
    q?: string;
    view?: string;
    label?: string;
  }>;
}

async function InboxContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const days = q ? 90 : parseInt(params.days ?? "7");
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - days);

  const threadWhere = {
    isStale: false,
    lastMessageAt: { gte: afterDate },
    ...(params.accountId ? { accountId: params.accountId } : {}),
    ...(params.isUnread === "true" ? { isUnread: true } : {}),
    ...(params.label ? { gmailLabelIds: { has: params.label } } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { snippet: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { participantAddresses: { hasSome: [q] } },
          ],
        }
      : {}),
  };

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  const accountIds = accounts.map((a) => a.id);

  const [threads, workItemResults, labels] = await Promise.all([
    prisma.threadMirror.findMany({
      where: threadWhere,
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        account: { select: { id: true, email: true, displayName: true, color: true } },
        domain: { select: { id: true, name: true, color: true } },
        workItem: { select: { id: true, title: true, status: true } },
      },
    }),
    q
      ? prisma.workItem.findMany({
          where: {
            status: { not: "DONE" },
            OR: [
              { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { notes: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            status: true,
            domain: { select: { id: true, name: true, color: true } },
          },
        })
      : Promise.resolve([]),
    prisma.label.findMany({
      where: { accountId: { in: accountIds } },
      select: { accountId: true, gmailLabelId: true, name: true, color: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // label lookup for chips: accountId → gmailLabelId → {name, color} (user labels only)
  type LabelInfo = { name: string; color: string | null };
  const labelMap: Record<string, Record<string, LabelInfo>> = {};
  for (const l of labels) {
    if (l.type === "user") {
      (labelMap[l.accountId] ??= {})[l.gmailLabelId] = { name: l.name, color: l.color };
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b bg-white px-6 py-3 flex items-center gap-4">
        <h1 className="text-base font-semibold text-slate-900 shrink-0">Unified Intake</h1>
        <InboxFilters accounts={accounts} labels={labels} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {threads.length} thread{threads.length !== 1 ? "s" : ""}
          </span>
          <SyncAllButton />
        </div>
      </div>
      {workItemResults.length > 0 && (
        <div className="flex-shrink-0 border-b bg-slate-50 px-6 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
            Work Items ({workItemResults.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {workItemResults.map((wi) => (
              <Link
                key={wi.id}
                href={`/work-items/${wi.id}`}
                className="flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm hover:shadow transition-shadow"
              >
                {wi.domain && <DomainBadge name={wi.domain.name} color={wi.domain.color} />}
                <span className="font-medium text-slate-800 max-w-[200px] truncate">{wi.title}</span>
                <StatusBadge status={wi.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
      <InboxPane threads={threads} labelMap={labelMap} todoistEnabled={todoistConfigured()} />
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
