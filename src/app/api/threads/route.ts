import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId      = searchParams.get("accountId");
  const domainId       = searchParams.get("domainId");
  const isUnread       = searchParams.get("isUnread");
  const unlinked       = searchParams.get("unlinked");
  const label          = searchParams.get("label");
  const q              = searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const from           = searchParams.get("from")?.trim() ?? "";
  const hasAttachment  = searchParams.get("hasAttachment") === "true";
  const before         = searchParams.get("before");
  const after          = searchParams.get("after");
  const limit          = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
  const cursor         = searchParams.get("cursor");

  const hasSearch = !!(q || from || hasAttachment || before || after);
  const days = hasSearch ? 90 : Math.max(parseInt(searchParams.get("days") ?? "7", 10) || 7, 1);

  const where: Prisma.ThreadMirrorWhereInput = { isStale: false };

  if (accountId)          where.accountId = accountId;
  if (domainId)           where.domainId = domainId;
  if (isUnread === "true") where.isUnread = true;
  if (unlinked === "true") where.workItemId = null;
  if (label)              where.gmailLabelIds = { has: label };
  if (hasAttachment)      where.hasAttachments = true;
  if (from)               where.participantAddresses = { hasSome: [from] };

  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { snippet:  { contains: q, mode: "insensitive" } },
      { participantAddresses: { hasSome: [q] } },
    ];
  }

  // Date range: explicit before/after take priority, else rolling window
  const dateFilter: Prisma.DateTimeFilter<"ThreadMirror"> = {};
  if (after) {
    dateFilter.gte = new Date(after);
  } else {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    dateFilter.gte = cutoff;
  }
  if (before) dateFilter.lte = new Date(before);
  where.lastMessageAt = dateFilter;

  const threads = await prisma.threadMirror.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      account:  { select: { id: true, email: true, displayName: true } },
      domain:   { select: { id: true, name: true, color: true } },
      workItem: { select: { id: true, title: true, status: true } },
    },
  });

  const hasMore   = threads.length > limit;
  const items     = hasMore ? threads.slice(0, limit) : threads;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ threads: items, nextCursor });
}
