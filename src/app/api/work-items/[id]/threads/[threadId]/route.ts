import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const { id: workItemId, threadId } = await params;

  const thread = await prisma.threadMirror.findUnique({ where: { id: threadId } });
  if (!thread || thread.workItemId !== workItemId) {
    return NextResponse.json({ error: "Thread not attached to this work item" }, { status: 404 });
  }

  await prisma.threadMirror.update({
    where: { id: threadId },
    data: { workItemId: null },
  });

  await prisma.activityLog.create({
    data: {
      eventType: "THREAD_DETACHED",
      workItemId,
      accountId: thread.accountId,
      description: `Thread detached: ${thread.subject}`,
      metadata: { threadId, gmailThreadId: thread.gmailThreadId },
    },
  });

  return NextResponse.json({ ok: true });
}
