export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { isConfigured as todoistConfigured } from "@/lib/todoist";
import { isSnoozedFilter } from "@/lib/thread-filters";
import { AppShell } from "@/components/layout/AppShell";
import { SnoozedClient } from "./SnoozedClient";

export default async function SnoozedPage() {
  const [accounts, threads, labels] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      select: { id: true, email: true, displayName: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.threadMirror.findMany({
      where: { isStale: false, AND: [isSnoozedFilter()] },
      orderBy: { snoozedUntil: "asc" },
      take: 200,
      include: {
        account: { select: { id: true, email: true, displayName: true, color: true } },
        domain: { select: { id: true, name: true, color: true } },
        workItem: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.label.findMany({
      select: { accountId: true, gmailLabelId: true, name: true, color: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

  type LabelInfo = { name: string; color: string | null };
  const labelMap: Record<string, Record<string, LabelInfo>> = {};
  for (const l of labels) {
    if (l.type === "user") {
      (labelMap[l.accountId] ??= {})[l.gmailLabelId] = { name: l.name, color: l.color };
    }
  }

  return (
    <AppShell>
      <SnoozedClient
        threads={threads.map((t) => ({
          id: t.id,
          gmailThreadId: t.gmailThreadId,
          subject: t.subject,
          snippet: t.snippet,
          participantAddresses: t.participantAddresses,
          gmailLabelIds: t.gmailLabelIds,
          messageCount: t.messageCount,
          hasAttachments: t.hasAttachments,
          isUnread: t.isUnread,
          lastMessageAt: t.lastMessageAt.toISOString(),
          snoozedUntil: t.snoozedUntil!.toISOString(),
          workItemId: t.workItemId,
          account: t.account,
          domain: t.domain,
          workItem: t.workItem,
        }))}
        labelMap={labelMap}
        todoistEnabled={todoistConfigured()}
        accounts={accounts}
      />
    </AppShell>
  );
}
