import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const workItemId = searchParams.get("workItemId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 500);

  const where: Prisma.ActivityLogWhereInput = {};
  if (accountId) where.accountId = accountId;
  if (workItemId) where.workItemId = workItemId;

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      account: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json(logs);
}
