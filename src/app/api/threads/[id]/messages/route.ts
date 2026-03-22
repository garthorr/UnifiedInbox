import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const thread = await prisma.threadMirror.findUnique({ where: { id } });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const gmail = await getGmailClient(thread.accountId);
  const full = await gmail.users.threads.get({
    userId: "me",
    id: thread.gmailThreadId,
    format: "full",
  });

  const messages = (full.data.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const h = (name: string) =>
      headers.find((hh) => hh.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const payload = msg.payload as GmailPart | undefined;
    const html = payload ? findBody(payload, "text/html") : null;
    const text = payload ? findBody(payload, "text/plain") : null;

    return {
      id: msg.id,
      from: h("from"),
      to: h("to"),
      date: h("date"),
      snippet: msg.snippet ?? null,
      html,
      text,
    };
  });

  return NextResponse.json(messages);
}
