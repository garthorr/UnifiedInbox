import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverCacheDelete } from "@/lib/server-message-cache";

type Action = "archive" | "trash" | "markRead" | "markUnread";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action as Action | undefined;

  if (!action || !["archive", "trash", "markRead", "markUnread"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const thread = await prisma.threadMirror.findUnique({
    where: { id },
    include: { account: { select: { accountType: true } } },
  });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  try {
    if (thread.account.accountType === "IMAP") {
      const imap = await import("@/lib/imap/actions");
      if (action === "markRead") await imap.markThreadRead(thread.accountId, thread.gmailThreadId);
      else if (action === "markUnread") await imap.markThreadUnread(thread.accountId, thread.gmailThreadId);
      else if (action === "archive") await imap.archiveThread(thread.accountId, thread.gmailThreadId);
      else if (action === "trash") await imap.trashThread(thread.accountId, thread.gmailThreadId);
    } else {
      const gmail = await import("@/lib/gmail/actions");
      if (action === "markRead") await gmail.markThreadRead(thread.accountId, thread.gmailThreadId);
      else if (action === "markUnread") await gmail.markThreadUnread(thread.accountId, thread.gmailThreadId);
      else if (action === "archive") await gmail.archiveThread(thread.accountId, thread.gmailThreadId);
      else if (action === "trash") await gmail.trashThread(thread.accountId, thread.gmailThreadId);
    }

    // Reflect the change in the local DB
    const dbUpdate: Record<string, unknown> = {};
    if (action === "markRead") dbUpdate.isUnread = false;
    if (action === "markUnread") dbUpdate.isUnread = true;
    if (action === "archive" || action === "trash") dbUpdate.isStale = true;

    const updated = await prisma.threadMirror.update({
      where: { id },
      data: dbUpdate,
    });

    // Invalidate server message cache so next open re-fetches fresh state
    serverCacheDelete(id);

    return NextResponse.json(updated);
  } catch (err) {
    console.error(`[thread action] ${action} failed:`, err);
    const msg = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
