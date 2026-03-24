import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";
import { createImapClient } from "@/lib/imap/sync";
import { findBody } from "@/lib/gmail/mime";
import type { GmailPart } from "@/lib/gmail/mime";

// ─── Gmail body fetch ─────────────────────────────────────────────────────────

async function getGmailBody(accountId: string, gmailMsgId: string) {
  const gmail = await getGmailClient(accountId);
  const res = await gmail.users.messages.get({
    userId: "me",
    id: gmailMsgId,
    format: "full",
  });
  const payload = res.data.payload as GmailPart | undefined;
  return {
    html: payload ? findBody(payload, "text/html") : null,
    text: payload ? findBody(payload, "text/plain") : null,
  };
}

// ─── IMAP body fetch ──────────────────────────────────────────────────────────

async function getImapBody(accountId: string, uid: number) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const client = createImapClient(account as Parameters<typeof createImapClient>[0]);
  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const { simpleParser } = await import("mailparser");
      let html: string | null = null;
      let text: string | null = null;

      for await (const msg of client.fetch([uid], { uid: true, source: true }, { uid: true })) {
        const parsed = await simpleParser(msg.source as Buffer);
        html = parsed.html || null;
        text = parsed.text || null;
      }
      return { html, text };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const { id, msgId } = await params;

  const thread = await prisma.threadMirror.findUnique({
    where: { id },
    include: { account: { select: { accountType: true } } },
  });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  try {
    const body =
      thread.account.accountType === "IMAP"
        ? await getImapBody(thread.accountId, parseInt(msgId, 10))
        : await getGmailBody(thread.accountId, msgId);

    return NextResponse.json(body);
  } catch (err) {
    console.error("[message body] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch message body" }, { status: 502 });
  }
}
