import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const { to, subject, body: replyBody, inReplyTo, references } = (body ?? {}) as {
    to?: string;
    subject?: string;
    body?: string;
    inReplyTo?: string | null;
    references?: string | null;
  };

  if (!to?.trim() || !replyBody?.trim()) {
    return NextResponse.json({ error: "to and body are required" }, { status: 400 });
  }

  const thread = await prisma.threadMirror.findUnique({
    where: { id },
    include: { account: { select: { accountType: true } } },
  });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  try {
    if (thread.account.accountType === "IMAP") {
      const imap = await import("@/lib/imap/actions");
      await imap.sendReply(thread.accountId, {
        to: to.trim(),
        subject: subject ?? thread.subject,
        body: replyBody.trim(),
        inReplyTo,
        references,
      });
    } else {
      const gmail = await import("@/lib/gmail/actions");
      await gmail.sendReply(thread.accountId, thread.gmailThreadId, {
        to: to.trim(),
        subject: subject ?? thread.subject,
        body: replyBody.trim(),
        inReplyTo,
        references,
      });
    }

    // Mark thread as read after replying
    await prisma.threadMirror.update({
      where: { id },
      data: { isUnread: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reply] send failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to send reply";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
