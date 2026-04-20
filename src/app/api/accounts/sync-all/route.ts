import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueSyncJob } from "@/lib/sync-queue";

export async function POST() {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const jobs = await Promise.all(accounts.map((a) => enqueueSyncJob(a.id)));
  return NextResponse.json({ ok: true, enqueued: jobs.length });
}
