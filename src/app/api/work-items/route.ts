import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma, WorkItemStatus } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get("domainId");
  const status = searchParams.get("status") as WorkItemStatus | null;
  const excludeDone = searchParams.get("excludeDone") !== "false";

  const where: Prisma.WorkItemWhereInput = {};
  if (domainId) where.domainId = domainId;
  if (status) {
    where.status = status;
  } else if (excludeDone) {
    where.status = { not: "DONE" };
  }

  const workItems = await prisma.workItem.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      domain: { select: { id: true, name: true, color: true } },
      _count: { select: { threads: true } },
    },
  });

  return NextResponse.json(workItems);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { title, domainId, threadId, threadIds: rawThreadIds, summary } = body as {
    title: string;
    domainId?: string;
    threadId?: string;
    threadIds?: string[];
    summary?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const workItem = await prisma.workItem.create({
    data: {
      title: title.trim(),
      domainId: domainId ?? null,
      summary: summary ?? null,
    },
  });

  await prisma.activityLog.create({
    data: {
      eventType: "WORK_ITEM_CREATED",
      workItemId: workItem.id,
      description: `Work item created: ${workItem.title}`,
    },
  });

  // Collect all thread IDs to attach (multi-select or single)
  const allThreadIds = rawThreadIds?.length ? rawThreadIds : threadId ? [threadId] : [];

  for (const tid of allThreadIds) {
    const thread = await prisma.threadMirror.findUnique({ where: { id: tid } });
    if (!thread || thread.workItemId) continue; // skip missing or already-attached
    await prisma.threadMirror.update({
      where: { id: tid },
      data: { workItemId: workItem.id },
    });
    await prisma.activityLog.create({
      data: {
        eventType: "THREAD_ATTACHED",
        workItemId: workItem.id,
        accountId: thread.accountId,
        description: `Thread attached: ${thread.subject}`,
        metadata: { threadId: tid, gmailThreadId: thread.gmailThreadId },
      },
    });
  }

  const created = await prisma.workItem.findUniqueOrThrow({
    where: { id: workItem.id },
    include: {
      domain: { select: { id: true, name: true, color: true } },
      _count: { select: { threads: true } },
    },
  });

  return NextResponse.json(created, { status: 201 });
}
