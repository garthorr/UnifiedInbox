import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";
import { withImap } from "@/lib/imap/pool";
import { findBody, findAttachments } from "@/lib/gmail/mime";
import type { GmailPart, AttachmentMeta } from "@/lib/gmail/mime";
import { serverCacheGet, serverCacheSet } from "@/lib/server-message-cache";

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
  attachments: AttachmentMeta[];
};

// ─── Gmail handler ────────────────────────────────────────────────────────────
// Single format:"full" call returns all messages with bodies in one round-trip,
// eliminating the previous sequential metadata → last-message-body waterfall.

async function getGmailMessages(accountId: string, gmailThreadId: string): Promise<MessageMeta[]> {
  const gmail = await getGmailClient(accountId);

  const threadRes = await gmail.users.threads.get({
    userId: "me",
    id: gmailThreadId,
    format: "full",
  });

  const msgs = threadRes.data.messages ?? [];

  return msgs.map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const h = (name: string) =>
      headers.find((hh) => hh.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const payload = msg.payload as GmailPart | undefined;
    return {
      id: msg.id ?? "",
      messageId: h("message-id") || null,
      from: h("from"),
      to: h("to"),
      replyTo: h("reply-to") || null,
      references: h("references") || null,
      date: h("date"),
      snippet: msg.snippet ?? null,
      html: payload ? findBody(payload, "text/html") : null,
      text: payload ? findBody(payload, "text/plain") : null,
      bodyLoaded: true,
      attachments: payload ? findAttachments(payload) : [],
    };
  });
}

// ─── IMAP helpers ─────────────────────────────────────────────────────────────

function fmtAddr(a: { name?: string | null; address?: string | null }): string {
  if (a.name && a.address) return `${a.name} <${a.address}>`;
  return a.address ?? a.name ?? "";
}

// ─── IMAP handler ─────────────────────────────────────────────────────────────
// Uses the connection pool (withImap) so TLS connections are reused across
// requests instead of paying the handshake cost on every thread click.
// Fetches all message sources in one FETCH command so every message renders
// without a second lazy-load round-trip.

async function getImapMessages(accountId: string, threadId: string): Promise<MessageMeta[]> {
  const { simpleParser } = await import("mailparser");

  return withImap(accountId, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const bareId = threadId.replace(/[<>]/g, "");

      const [rootUids, replyUids] = await Promise.all([
        client.search({ header: { "message-id": `<${bareId}>` } }, { uid: true }) as Promise<number[]>,
        client.search({ header: { "in-reply-to": `<${bareId}>` } }, { uid: true }) as Promise<number[]>,
      ]);

      const allUids = [...new Set([...rootUids, ...replyUids])].sort((a, b) => a - b);
      if (allUids.length === 0) return [];

      // Fetch source for all messages in one FETCH command — every message
      // arrives pre-loaded, eliminating per-expand lazy-load round-trips.
      const results: MessageMeta[] = [];
      for await (const msg of client.fetch(allUids, { uid: true, source: true }, { uid: true })) {
        const parsed = await simpleParser(msg.source as Buffer);
        const snippet = (parsed.text ?? "").slice(0, 200) || null;
        const references = Array.isArray(parsed.references)
          ? parsed.references.join(" ")
          : (parsed.references ?? null);

        results.push({
          id: String(msg.uid),
          messageId: parsed.messageId ?? null,
          from: parsed.from?.text ?? "",
          to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((a) => a.text).join(", ") : parsed.to.text) : "",
          replyTo: parsed.replyTo?.text ?? null,
          references,
          date: parsed.date?.toISOString() ?? "",
          snippet,
          html: parsed.html || null,
          text: parsed.text || null,
          bodyLoaded: true,
          attachments: (parsed.attachments ?? []).map((att, idx) => ({
            id: `${msg.uid}:${idx}`,
            filename: att.filename ?? "attachment",
            mimeType: att.contentType ?? "application/octet-stream",
            size: att.size ?? 0,
          })),
        });
      }

      return results;
    } finally {
      lock.release();
    }
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cached = serverCacheGet(id);
  if (cached) return NextResponse.json(cached);

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

    serverCacheSet(id, messages);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[messages] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 502 });
  }
}

