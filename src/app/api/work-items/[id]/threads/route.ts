import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workItemId } = await params;
  const { threadId } = (await request.json()) as { threadId: string };

  if (!threadId) {
    return NextResponse.json({ error: "threadId is required" }, { status: 400 });
  }

  const workItem = await prisma.workItem.findUnique({ where: { id: workItemId } });
  if (!workItem) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  const thread = await prisma.threadMirror.findUnique({ where: { id: threadId } });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (thread.workItemId && thread.workItemId !== workItemId) {
    return NextResponse.json(
      { error: "Thread is already attached to another work item" },
      { status: 409 }
    );
  }

  await prisma.threadMirror.update({
    where: { id: threadId },
    data: { workItemId },
  });

  await prisma.activityLog.create({
    data: {
      eventType: "THREAD_ATTACHED",
      workItemId,
      accountId: thread.accountId,
      description: `Thread attached: ${thread.subject}`,
      metadata: { threadId, gmailThreadId: thread.gmailThreadId },
    },
  });

  return NextResponse.json({ ok: true });
}
