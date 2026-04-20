import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type BulkAction = "archive" | "trash" | "markRead" | "markUnread";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.threadIds) || !body.action) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { threadIds, action } = body as { threadIds: string[]; action: BulkAction };

  if (!["archive", "trash", "markRead", "markUnread"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (!threadIds.length) return NextResponse.json({ updated: 0, failedIds: [] });

  const threads = await prisma.threadMirror.findMany({
    where: { id: { in: threadIds } },
    include: { account: { select: { accountType: true } } },
  });

  const [gmail, imap] = await Promise.all([
    import("@/lib/gmail/actions"),
    import("@/lib/imap/actions"),
  ]);

  // Run provider actions — capture which threads actually succeeded
  const results = await Promise.allSettled(
    threads.map(async (t) => {
      const actions = t.account.accountType === "IMAP" ? imap : gmail;
      if (action === "markRead")   await actions.markThreadRead(t.accountId, t.gmailThreadId);
      else if (action === "markUnread") await actions.markThreadUnread(t.accountId, t.gmailThreadId);
      else if (action === "archive") await actions.archiveThread(t.accountId, t.gmailThreadId);
      else if (action === "trash")   await actions.trashThread(t.accountId, t.gmailThreadId);
      return t.id;
    })
  );

  const successIds: string[] = [];
  const failedIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") successIds.push(threads[i].id);
    else failedIds.push(threads[i].id);
  });

  if (successIds.length === 0) {
    return NextResponse.json({ updated: 0, failedIds }, { status: 207 });
  }

  const dbData: Record<string, unknown> =
    action === "markRead"   ? { isUnread: false }
    : action === "markUnread" ? { isUnread: true }
    : { isStale: true };

  const result = await prisma.threadMirror.updateMany({
    where: { id: { in: successIds } },
    data: dbData,
  });

  const status = failedIds.length > 0 ? 207 : 200;
  return NextResponse.json({ updated: result.count, failedIds }, { status });
}
