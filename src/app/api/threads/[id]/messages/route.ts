import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";
import { createImapClient } from "@/lib/imap/sync";
import { findBody } from "@/lib/gmail/mime";
import type { GmailPart } from "@/lib/gmail/mime";

type MessageMeta = {
  id: string;
  messageId: string | null;
  from: string;
  to: string;
  replyTo: string | null;
  references: string | null;
  date: string;
  snippet: string | null;
  html: string | null;
  text: string | null;
  bodyLoaded: boolean;
};

// ─── Gmail handler ────────────────────────────────────────────────────────────
// Uses format:"metadata" for the thread list (fast, no body data) and fetches
// the full body only for the last (auto-expanded) message.

async function getGmailMessages(accountId: string, gmailThreadId: string): Promise<MessageMeta[]> {
  const gmail = await getGmailClient(accountId);

  // Step 1: lightweight metadata fetch — no body payloads, just headers + snippets
  const threadRes = await gmail.users.threads.get({
    userId: "me",
    id: gmailThreadId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Date", "Message-ID", "Reply-To", "References"],
  });

  const msgs = threadRes.data.messages ?? [];
  if (msgs.length === 0) return [];

  // Step 2: full body for the last message only (the one that auto-expands)
  const lastId = msgs[msgs.length - 1].id!;
  const fullRes = await gmail.users.messages.get({
    userId: "me",
    id: lastId,
    format: "full",
  });

  const lastPayload = fullRes.data.payload as GmailPart | undefined;
  const lastHtml = lastPayload ? findBody(lastPayload, "text/html") : null;
  const lastText = lastPayload ? findBody(lastPayload, "text/plain") : null;

  return msgs.map((msg, i) => {
    const headers = msg.payload?.headers ?? [];
    const h = (name: string) =>
      headers.find((hh) => hh.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const isLast = i === msgs.length - 1;
    return {
      id: msg.id ?? "",
      messageId: h("message-id") || null,
      from: h("from"),
      to: h("to"),
      replyTo: h("reply-to") || null,
      references: h("references") || null,
      date: h("date"),
      snippet: msg.snippet ?? null,
      html: isLast ? lastHtml : null,
      text: isLast ? lastText : null,
      bodyLoaded: isLast,
    };
  });
}

// ─── IMAP helpers ─────────────────────────────────────────────────────────────

function fmtAddr(a: { name?: string | null; address?: string | null }): string {
  if (a.name && a.address) return `${a.name} <${a.address}>`;
  return a.address ?? a.name ?? "";
}

// ─── IMAP handler ─────────────────────────────────────────────────────────────
// Runs both SEARCHes in parallel, fetches envelope (metadata) for all messages,
// then fetches the source only for the last message.

async function getImapMessages(accountId: string, threadId: string): Promise<MessageMeta[]> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const client = createImapClient(account as Parameters<typeof createImapClient>[0]);
  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const bareId = threadId.replace(/[<>]/g, "");

      // Parallel SEARCH instead of sequential
      const [rootUids, replyUids] = await Promise.all([
        client.search({ header: { "message-id": `<${bareId}>` } }, { uid: true }) as Promise<number[]>,
        client.search({ header: { "in-reply-to": `<${bareId}>` } }, { uid: true }) as Promise<number[]>,
      ]);

      const allUids = [...new Set([...rootUids, ...replyUids])].sort((a, b) => a - b);
      if (allUids.length === 0) return [];

      // Step 1: envelope (metadata) for all — no body download
      type EnvMsg = {
        uid: number;
        envelope: {
          date?: Date | null;
          messageId?: string | null;
          from?: Array<{ name?: string | null; address?: string | null }> | null;
          to?: Array<{ name?: string | null; address?: string | null }> | null;
          replyTo?: Array<{ name?: string | null; address?: string | null }> | null;
        };
      };
      const envMessages: EnvMsg[] = [];
      for await (const msg of client.fetch(allUids, { uid: true, envelope: true }, { uid: true })) {
        envMessages.push({ uid: msg.uid, envelope: msg.envelope as EnvMsg["envelope"] });
      }

      // Step 2: full source for the last message only
      const lastUid = allUids[allUids.length - 1];
      let lastHtml: string | null = null;
      let lastText: string | null = null;
      let lastSnippet: string | null = null;
      let lastMessageId: string | null = null;
      let lastReferences: string | null = null;

      const { simpleParser } = await import("mailparser");
      for await (const msg of client.fetch([lastUid], { uid: true, source: true }, { uid: true })) {
        const parsed = await simpleParser(msg.source as Buffer);
        lastHtml = parsed.html || null;
        lastText = parsed.text || null;
        lastSnippet = (parsed.text ?? "").slice(0, 200) || null;
        lastMessageId = parsed.messageId ?? null;
        lastReferences = Array.isArray(parsed.references)
          ? parsed.references.join(" ")
          : (parsed.references ?? null);
      }

      return envMessages.map((em, i) => {
        const env = em.envelope;
        const isLast = i === envMessages.length - 1;
        const msgId = isLast ? lastMessageId : (env.messageId ?? null);
        return {
          id: String(em.uid),
          messageId: msgId,
          from: (env.from?.[0] ? fmtAddr(env.from[0]) : ""),
          to: (env.to ?? []).map(fmtAddr).join(", "),
          replyTo: env.replyTo?.[0] ? fmtAddr(env.replyTo[0]) : null,
          references: isLast ? lastReferences : null,
          date: env.date?.toISOString() ?? "",
          snippet: isLast ? lastSnippet : null,
          html: isLast ? lastHtml : null,
          text: isLast ? lastText : null,
          bodyLoaded: isLast,
        };
      });
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const thread = await prisma.threadMirror.findUnique({
    where: { id },
    include: { account: { select: { accountType: true } } },
  });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

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
