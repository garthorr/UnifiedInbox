import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueSyncJob } from "@/lib/sync-queue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (!account.isActive) return NextResponse.json({ error: "Account is inactive" }, { status: 409 });

  const job = await enqueueSyncJob(id);
  return NextResponse.json({ ok: true, jobId: job.id });
}
