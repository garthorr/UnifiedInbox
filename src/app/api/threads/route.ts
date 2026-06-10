import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePositiveInt, parseISODateOrNull } from "@/lib/params";
import { notSnoozedFilter, isSnoozedFilter } from "@/lib/thread-filters";
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
  const snoozedFilter  = searchParams.get("snoozed"); // "true" => only snoozed, otherwise hide snoozed
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

  // Build the AND chain so it composes cleanly with the search OR.
  const andClauses: Prisma.ThreadMirrorWhereInput[] = [];
  if (snoozedFilter === "true") andClauses.push(isSnoozedFilter());
  else                          andClauses.push(notSnoozedFilter());

  if (q) {
    andClauses.push({
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        { snippet:  { contains: q, mode: "insensitive" } },
        { participantAddresses: { hasSome: [q] } },
      ],
    });
  }

  // Keyset pagination on (lastMessageAt, id): the opaque cursor encodes the
  // last row's sort key, so pages stay stable when new threads arrive (a
  // row-id cursor shifts when rows are inserted ahead of it) and the DB can
  // seek instead of re-finding the cursor row.
  if (cursor) {
    const sep = cursor.lastIndexOf("|");
    const cursorDate = sep > 0 ? parseISODateOrNull(cursor.slice(0, sep)) : null;
    const cursorId = sep > 0 ? cursor.slice(sep + 1) : "";
    if (cursorDate && cursorId) {
      andClauses.push({
        OR: [
          { lastMessageAt: { lt: cursorDate } },
          { lastMessageAt: cursorDate, id: { lt: cursorId } },
        ],
      });
    }
  }

  if (andClauses.length > 0) where.AND = andClauses;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const dateFilter: Prisma.DateTimeFilter<"ThreadMirror"> = {
    gte: afterDate ?? cutoff,
    ...(beforeDate ? { lte: beforeDate } : {}),
  };
  where.lastMessageAt = dateFilter;

  const threads = await prisma.threadMirror.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      account:  { select: { id: true, email: true, displayName: true } },
      domain:   { select: { id: true, name: true, color: true } },
      workItem: { select: { id: true, title: true, status: true } },
    },
  });

  const hasMore = threads.length > limit;
  const items   = hasMore ? threads.slice(0, limit) : threads;
  const last    = items[items.length - 1];
  const nextCursor = hasMore && last ? `${last.lastMessageAt.toISOString()}|${last.id}` : null;

  return NextResponse.json({ threads: items, nextCursor });
}
