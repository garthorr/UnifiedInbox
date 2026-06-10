import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * JSON export of everything that can't be rebuilt from the mailboxes:
 * domains, work items (notes, checklists, due dates), rules, Todoist links,
 * Kanban config, and the thread↔work-item/domain associations (keyed by
 * provider thread ID + account email so they survive a re-import).
 *
 * Credentials are deliberately excluded — full disaster recovery is the
 * pg_dump documented in the README; this is the human-readable safety net.
 */
export async function GET() {
  const [domains, workItems, rules, kanbanSetting, threadLinks, accounts] =
    await Promise.all([
      prisma.domain.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.workItem.findMany({
        include: { taskLinks: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.rule.findMany({ orderBy: { priority: "asc" } }),
      prisma.kanbanSetting.findUnique({ where: { id: "singleton" } }),
      prisma.threadMirror.findMany({
        where: { OR: [{ workItemId: { not: null } }, { domainId: { not: null } }] },
        select: {
          gmailThreadId: true,
          subject: true,
          workItemId: true,
          domainId: true,
          account: { select: { email: true } },
        },
      }),
      prisma.account.findMany({
        select: {
          email: true,
          displayName: true,
          accountType: true,
          imapHost: true,
          imapPort: true,
          smtpHost: true,
          smtpPort: true,
          color: true,
        },
      }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    domains,
    workItems,
    rules,
    kanbanSetting,
    threadLinks: threadLinks.map((t) => ({
      providerThreadId: t.gmailThreadId,
      subject: t.subject,
      accountEmail: t.account.email,
      workItemId: t.workItemId,
      domainId: t.domainId,
    })),
    // Account settings only — no tokens or passwords.
    accounts,
  };

  const filename = `unified-inbox-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
