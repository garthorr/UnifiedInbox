import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePositiveInt } from "@/lib/params";
import type { Prisma, WorkItemStatus } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainId    = searchParams.get("domainId");
  const status      = searchParams.get("status") as WorkItemStatus | null;
  const excludeDone = searchParams.get("excludeDone") !== "false";
  const cursor      = searchParams.get("cursor");
  const limit       = parsePositiveInt(searchParams.get("limit"), 50, 200);

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
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      domain: { select: { id: true, name: true, color: true } },
      _count: { select: { threads: true } },
    },
  });

  const hasMore    = workItems.length > limit;
  const items      = hasMore ? workItems.slice(0, limit) : workItems;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ workItems: items, nextCursor });
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

  const allThreadIds = rawThreadIds?.length ? rawThreadIds : threadId ? [threadId] : [];

  // Batch-fetch attachable threads before transaction to avoid long-held locks
  const attachableThreads = allThreadIds.length
    ? await prisma.threadMirror.findMany({
        where: { id: { in: allThreadIds }, workItemId: null },
        select: { id: true, accountId: true, subject: true, gmailThreadId: true },
      })
    : [];

  const created = await prisma.$transaction(async (tx) => {
    const workItem = await tx.workItem.create({
      data: {
        title: title.trim(),
        domainId: domainId ?? null,
        summary: summary ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        eventType: "WORK_ITEM_CREATED",
        workItemId: workItem.id,
        description: `Work item created: ${workItem.title}`,
      },
    });

    if (attachableThreads.length > 0) {
      await tx.threadMirror.updateMany({
        where: { id: { in: attachableThreads.map((t) => t.id) } },
        data: { workItemId: workItem.id },
      });
      await tx.activityLog.createMany({
        data: attachableThreads.map((t) => ({
          eventType: "THREAD_ATTACHED",
          workItemId: workItem.id,
          accountId: t.accountId,
          description: `Thread attached: ${t.subject}`,
          metadata: { threadId: t.id, gmailThreadId: t.gmailThreadId },
        })),
      });
    }

    return tx.workItem.findUniqueOrThrow({
      where: { id: workItem.id },
      include: {
        domain: { select: { id: true, name: true, color: true } },
        _count: { select: { threads: true } },
      },
    });
  });

  return NextResponse.json(created, { status: 201 });
}
