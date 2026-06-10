import { prisma } from "./db";

/**
 * Retention sweep for unbounded tables. THREAD_IMPORTED logs have their own
 * tighter 3-day prune (gmail/sync.ts); this catches everything else plus
 * expired sessions. Called from the worker's periodic sweep.
 */
export async function pruneOldData(activityLogDays = 90): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - activityLogDays);

  const [logs, sessions] = await Promise.all([
    prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  ]);

  if (logs.count > 0 || sessions.count > 0) {
    console.log(
      `[maintenance] Pruned ${logs.count} activity log(s) older than ${activityLogDays}d, ${sessions.count} expired session(s)`
    );
  }
}
