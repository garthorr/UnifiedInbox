import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePositiveInt, parseISODateOrNull } from "@/lib/params";
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
  const limit          = parsePositiveInt(searchParams.get("limit"), 50, 200);
  const cursor         = searchParams.get("cursor");

  const afterParam  = searchParams.get("after");
  const beforeParam = searchParams.get("before");
  const afterDate   = parseISODateOrNull(afterParam);
  const beforeDate  = parseISODateOrNull(beforeParam);

  if (afterParam && !afterDate)  return NextResponse.json({ error: "Invalid 'after' date" },  { status: 400 });
  if (beforeParam && !beforeDate) return NextResponse.json({ error: "Invalid 'before' date" }, { status: 400 });

  const hasSearch = !!(q || from || hasAttachment || afterDate || beforeDate);
  const days = hasSearch
    ? 90
    : parsePositiveInt(searchParams.get("days"), 7, 365);

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

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const dateFilter: Prisma.DateTimeFilter<"ThreadMirror"> = {
    gte: afterDate ?? cutoff,
    ...(beforeDate ? { lte: beforeDate } : {}),
  };
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

  const hasMore    = threads.length > limit;
  const items      = hasMore ? threads.slice(0, limit) : threads;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ threads: items, nextCursor });
}
