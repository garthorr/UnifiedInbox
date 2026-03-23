import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";
import { createImapClient } from "@/lib/imap/sync";
import { simpleParser } from "mailparser";

// ─── MIME helpers (Gmail) ──────────────────────────────────────────────────

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

function findBody(part: GmailPart, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return Buffer.from(
      part.body.data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
  }
  if (part.parts) {
    for (const p of part.parts) {
      const result = findBody(p, mimeType);
      if (result) return result;
    }
  }
  return null;
}

// ─── Gmail handler ─────────────────────────────────────────────────────────

async function getGmailMessages(accountId: string, gmailThreadId: string) {
  const gmail = await getGmailClient(accountId);
  const full = await gmail.users.threads.get({
    userId: "me",
    id: gmailThreadId,
    format: "full",
  });

  return (full.data.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const h = (name: string) =>
      headers.find((hh) => hh.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const payload = msg.payload as GmailPart | undefined;
    return {
      id: msg.id ?? "",
      from: h("from"),
      to: h("to"),
      date: h("date"),
      snippet: msg.snippet ?? null,
      html: payload ? findBody(payload, "text/html") : null,
      text: payload ? findBody(payload, "text/plain") : null,
    };
  });
}

// ─── IMAP handler ──────────────────────────────────────────────────────────

async function getImapMessages(accountId: string, threadId: string) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

  // Retrieve UIDs stored in ThreadMirror.historyId (highest UID) plus search
  const client = createImapClient(account as Parameters<typeof createImapClient>[0]);
  await client.connect();

  const messages: Array<{
    id: string;
    from: string;
    to: string;
    date: string;
    snippet: string | null;
    html: string | null;
    text: string | null;
  }> = [];

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Search for the root message and all replies by Message-ID / References
      const bareId = threadId.replace(/[<>]/g, "");
      const rootUids = (await client.search(
        { header: { "message-id": `<${bareId}>` } },
        { uid: true }
      )) as number[];
      const replyUids = (await client.search(
        { header: { "in-reply-to": `<${bareId}>` } },
        { uid: true }
      )) as number[];

      const allUids = [...new Set([...rootUids, ...replyUids])].sort((a, b) => a - b);
      if (allUids.length === 0) return messages;

      for await (const msg of client.fetch(
        allUids,
        { uid: true, source: true },
        { uid: true }
      )) {
        const source = msg.source as Buffer;
        const parsed = await simpleParser(source);

        messages.push({
          id: String(msg.uid),
          from: parsed.from?.text ?? "",
          to: Array.isArray(parsed.to)
            ? parsed.to.map((a) => a.text).join(", ")
            : (parsed.to?.text ?? ""),
          date: parsed.date?.toISOString() ?? "",
          snippet: (parsed.text ?? "").slice(0, 200) || null,
          html: parsed.html || null,
          text: parsed.text || null,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return messages;
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const thread = await prisma.threadMirror.findUnique({
    where: { id },
    include: { account: { select: { accountType: true } } },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const messages =
      thread.account.accountType === "IMAP"
        ? await getImapMessages(thread.accountId, thread.gmailThreadId)
        : await getGmailMessages(thread.accountId, thread.gmailThreadId);

    return NextResponse.json(messages);
  } catch (err) {
    console.error("[messages] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 502 });
  }
}
