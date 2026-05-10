import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const { workItemId, threadIds } = (body ?? {}) as { workItemId?: string; threadIds?: string[] };

  if (!workItemId || !Array.isArray(threadIds) || threadIds.length === 0) {
    return NextResponse.json({ error: "workItemId and threadIds are required" }, { status: 400 });
  }

  const workItem = await prisma.workItem.findUnique({ where: { id: workItemId } });
  if (!workItem) return NextResponse.json({ error: "Work item not found" }, { status: 404 });

  const threads = await prisma.threadMirror.findMany({
    where: { id: { in: threadIds } },
    select: { id: true, accountId: true, subject: true, gmailThreadId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.threadMirror.updateMany({
      where: { id: { in: threads.map((t) => t.id) } },
      data: { workItemId },
    });

    if (threads.length > 0) {
      await tx.activityLog.createMany({
        data: threads.map((t) => ({
          eventType: "THREAD_ATTACHED",
          workItemId,
          accountId: t.accountId,
          description: `Thread attached: ${t.subject}`,
          metadata: { threadId: t.id, gmailThreadId: t.gmailThreadId },
        })),
      });
    }
  });

  return NextResponse.json({ ok: true, updated: threads.length });
}
