import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const domainId = searchParams.get("domainId");
  const isUnread = searchParams.get("isUnread");
  const unlinked = searchParams.get("unlinked"); // only threads with no workItemId
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const cursor = searchParams.get("cursor");
  const days = parseInt(searchParams.get("days") ?? "7");

  const where: Prisma.ThreadMirrorWhereInput = {
    isStale: false,
  };

  if (accountId) where.accountId = accountId;
  if (domainId) where.domainId = domainId;
  if (isUnread === "true") where.isUnread = true;
  if (unlinked === "true") where.workItemId = null;

  // Date filter
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - days);
  where.lastMessageAt = { gte: afterDate };

  const threads = await prisma.threadMirror.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      account: { select: { id: true, email: true, displayName: true } },
      domain: { select: { id: true, name: true, color: true } },
      workItem: { select: { id: true, title: true, status: true } },
    },
  });

  const hasMore = threads.length > limit;
  const items = hasMore ? threads.slice(0, limit) : threads;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ threads: items, nextCursor });
}
