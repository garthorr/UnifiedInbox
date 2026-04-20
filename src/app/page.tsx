import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { isConfigured as todoistConfigured } from "@/lib/todoist";
import { parsePositiveInt, parseISODateOrNull } from "@/lib/params";
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
    from?: string;
    hasAttachment?: string;
    before?: string;
    after?: string;
  }>;
}

async function InboxContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const q              = params.q?.trim() ?? "";
  const from           = params.from?.trim() ?? "";
  const hasAttachment  = params.hasAttachment === "true";
  const afterDate      = parseISODateOrNull(params.after);
  const beforeDate     = parseISODateOrNull(params.before);

  const hasSearch = !!(q || from || hasAttachment || afterDate || beforeDate);
  const days = hasSearch ? 90 : parsePositiveInt(params.days, 7, 365);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const threadWhere: Prisma.ThreadMirrorWhereInput = {
    isStale: false,
    lastMessageAt: {
      gte: afterDate ?? cutoff,
      ...(beforeDate ? { lte: beforeDate } : {}),
    },
    ...(params.accountId ? { accountId: params.accountId } : {}),
    ...(params.isUnread === "true" ? { isUnread: true } : {}),
    ...(params.label ? { gmailLabelIds: { has: params.label } } : {}),
    ...(hasAttachment ? { hasAttachments: true } : {}),
    ...(from ? { participantAddresses: { hasSome: [from] } } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { snippet:  { contains: q, mode: Prisma.QueryMode.insensitive } },
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

  const unreadCount = threads.filter((t) => t.isUnread).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--ds-panel)" }}>
      <div
        className="flex-shrink-0 border-b px-5 pt-[14px] pb-[10px] flex flex-col gap-0"
        style={{ background: "var(--ds-panel)", borderColor: "var(--ds-line)" }}
      >
        <div className="flex items-start gap-2">
          <InboxFilters
            accounts={accounts}
            labels={labels}
            totalCount={threads.length}
            unreadCount={unreadCount}
          />
          <div className="ml-auto pt-1 flex items-center gap-2 flex-shrink-0">
            <SyncAllButton />
          </div>
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
