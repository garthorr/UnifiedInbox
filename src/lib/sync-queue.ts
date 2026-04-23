import { prisma } from "@/lib/db";
import { syncAccount } from "@/lib/gmail/sync";

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/** Enqueue a sync job for one account.
 *  Relies on the DB unique partial index on (accountId) WHERE status='pending'
 *  to prevent duplicates atomically — no TOCTOU window. */
export async function enqueueSyncJob(accountId: string) {
  try {
    return await prisma.syncJob.create({
      data: { accountId, status: "pending" },
    });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      // A pending job already exists — return it
      return prisma.syncJob.findFirstOrThrow({
        where: { accountId, status: "pending" },
        select: { id: true },
      });
    }
    throw err;
  }
}

/** Atomically claim the oldest pending job using SELECT FOR UPDATE SKIP LOCKED.
 *  Safe for concurrent callers — each picks a distinct job with no race. */
export async function drainOneJob(): Promise<boolean> {
  const claimed = await prisma.$queryRaw<Array<{ id: string; accountId: string }>>`
    UPDATE "SyncJob"
    SET    status = 'running',
           "claimedAt" = NOW(),
           "updatedAt" = NOW()
    WHERE  id = (
      SELECT id FROM "SyncJob"
      WHERE  status = 'pending'
      ORDER  BY "createdAt" ASC
      LIMIT  1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "accountId"
  `;

  const job = claimed[0] ?? null;
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

// Mutex: prevents two cron ticks from running concurrent drains in the same process.
let drainingQueue = false;

/** Drain all pending jobs with up to `concurrency` parallel workers.
 *  No-ops if a drain is already in progress (guards against cron overlap). */
export async function drainQueue(concurrency = 3): Promise<void> {
  if (drainingQueue) return;
  drainingQueue = true;
  try {
    await Promise.all(
      Array.from({ length: concurrency }, () =>
        (async () => { while (await drainOneJob()) { /* next job */ } })()
      )
    );
  } finally {
    drainingQueue = false;
  }
}

/** Prune finished jobs older than `days` days to keep the table small. */
export async function pruneOldJobs(days = 7): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  await prisma.syncJob.deleteMany({
    where: { status: { in: ["done", "failed"] }, completedAt: { lt: cutoff } },
  });
}

/** Reset jobs that have been stuck in 'running' for longer than `maxMinutes`.
 *  This happens when a worker process is killed mid-sync, leaving the row
 *  claimed but never completed.  Resetting to 'failed' unblocks future syncs
 *  for that account — the next cron will re-enqueue and retry. */
export async function reclaimStuckJobs(maxMinutes = 10): Promise<void> {
  const cutoff = new Date(Date.now() - maxMinutes * 60 * 1000);
  await prisma.syncJob.updateMany({
    where: { status: "running", claimedAt: { lt: cutoff } },
    data: { status: "failed", completedAt: new Date(), error: "Reclaimed: worker timeout" },
  });
}
