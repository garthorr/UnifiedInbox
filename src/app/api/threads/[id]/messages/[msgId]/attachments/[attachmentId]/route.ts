import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";

export async function GET(
  _request: Request,
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

  if (thread.account.accountType === "IMAP") {
    return NextResponse.json(
      { error: "IMAP attachment download not yet supported" },
      { status: 501 }
    );
  }

  try {
    const gmail = await getGmailClient(thread.accountId);
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
        "Content-Disposition": `attachment; filename="attachment"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("[attachment] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 502 });
  }
}
