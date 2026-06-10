import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";
import { withImap } from "@/lib/imap/pool";
import type { gmail_v1 } from "googleapis";

// Sanitize a filename for use in Content-Disposition — strip control characters
// and path traversal characters, fall back to "attachment" if empty.
function safeFilename(name: string): string {
  const sanitized = name.replace(/[/\\?%*:|"<>\x00-\x1f]/g, "_").trim();
  return sanitized || "attachment";
}

// Build a Content-Disposition with both the sanitized ASCII fallback and the
// RFC 5987 UTF-8 form so non-ASCII filenames survive the download.
function contentDisposition(name: string): string {
  const safe = safeFilename(name);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; msgId: string; attachmentId: string }>;
  }
) {
  const { id, msgId, attachmentId } = await params;

  const thread = await prisma.threadMirror.findUnique({
    where: { id },
    include: { account: { select: { accountType: true } } },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // ── IMAP ──────────────────────────────────────────────────────────────────
  // attachmentId is "{uid}:{index}" — re-fetch + re-parse the message source.
  if (thread.account.accountType === "IMAP") {
    const parts = attachmentId.split(":");
    if (parts.length !== 2) {
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });
    }
    const uid = parseInt(parts[0], 10);
    const idx = parseInt(parts[1], 10);
    if (isNaN(uid) || isNaN(idx)) {
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });
    }

    try {
      const { simpleParser } = await import("mailparser");
      const result = await withImap(thread.accountId, async (client) => {
        const lock = await client.getMailboxLock("INBOX");
        try {
          let source: Buffer | null = null;
          for await (const msg of client.fetch([uid], { uid: true, source: true }, { uid: true })) {
            source = msg.source as Buffer;
          }
          return source;
        } finally {
          lock.release();
        }
      });

      if (!result) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      const parsed = await simpleParser(result);
      const att = (parsed.attachments ?? [])[idx];
      if (!att) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }

      const bytes = new Uint8Array(att.content);
      return new Response(bytes, {
        headers: {
          "Content-Type": att.contentType ?? "application/octet-stream",
          "Content-Disposition": contentDisposition(att.filename ?? "attachment"),
          "Content-Length": bytes.length.toString(),
        },
      });
    } catch (err) {
      console.error("[attachment/imap] fetch failed:", err);
      return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 502 });
    }
  }

  // ── Gmail ──────────────────────────────────────────────────────────────────
  // Fetch the message metadata first to recover the real filename for the part,
  // then fetch the attachment binary.
  try {
    const gmail = await getGmailClient(thread.accountId);

    // Get the real filename from the message's MIME part list
    let filename = "attachment";
    try {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: msgId,
        format: "metadata",
        metadataHeaders: [],
      });
      function findPart(parts: gmail_v1.Schema$MessagePart[] | null | undefined, id: string): string | null {
        if (!parts) return null;
        for (const p of parts) {
          if (p.body?.attachmentId === id && p.filename) return p.filename;
          const found = findPart(p.parts ?? [], id);
          if (found) return found;
        }
        return null;
      }
      const found = findPart(msgRes.data.payload?.parts ?? [], attachmentId);
      if (found) filename = found;
    } catch {
      // Non-fatal — fall back to generic filename
    }

    const { data } = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: msgId,
      id: attachmentId,
    });

    if (!data.data) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // data.data is base64url — decode to binary
    const buffer = Buffer.from(
      data.data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": contentDisposition(filename),
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("[attachment/gmail] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 502 });
  }
}
