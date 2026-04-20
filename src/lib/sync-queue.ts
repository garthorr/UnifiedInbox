import { prisma } from "@/lib/db";
import { syncAccount } from "@/lib/gmail/sync";

/** Enqueue a sync job for one account. Deduplicates: if a pending job already
 *  exists for this account, returns the existing job rather than creating a duplicate. */
export async function enqueueSyncJob(accountId: string) {
  const existing = await prisma.syncJob.findFirst({
    where: { accountId, status: "pending" },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.syncJob.create({
    data: { accountId, status: "pending" },
  });
}

/** Atomically claim the oldest pending job and run it.
 *  Returns true if a job was processed, false if the queue was empty. */
export async function drainOneJob(): Promise<boolean> {
  // Atomic claim: find + update in a transaction to prevent double-processing
  const job = await prisma.$transaction(async (tx) => {
    const pending = await tx.syncJob.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (!pending) return null;
    return tx.syncJob.update({
      where: { id: pending.id },
      data: { status: "running", claimedAt: new Date() },
    });
  });

  if (!job) return false;

  try {
    await syncAccount(job.accountId);
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "done", completedAt: new Date() },
    });
  } catch (err) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date(), error: String(err) },
    });
  }

  return true;
}

/** Drain all pending jobs sequentially (used by worker after cron enqueue). */
export async function drainQueue(): Promise<void> {
  while (await drainOneJob()) { /* continue until empty */ }
}

/** Prune finished jobs older than `days` days to keep the table small. */
export async function pruneOldJobs(days = 7): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  await prisma.syncJob.deleteMany({
    where: { status: { in: ["done", "failed"] }, completedAt: { lt: cutoff } },
  });
}
