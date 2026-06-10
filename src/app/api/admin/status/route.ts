import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Worker beats every 30s; allow three missed beats before calling it dead.
const WORKER_STALE_MS = 90_000;

/**
 * Operational status for the Settings page: worker liveness, sync queue
 * depth, and per-account sync/token health.
 */
export async function GET() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [worker, pendingJobs, runningJobs, accounts, recentFailures, sessions] =
    await Promise.all([
      prisma.workerStatus.findUnique({ where: { id: "singleton" } }),
      prisma.syncJob.count({ where: { status: "pending" } }),
      prisma.syncJob.findMany({
        where: { status: "running" },
        select: { claimedAt: true, account: { select: { email: true } } },
      }),
      prisma.account.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          accountType: true,
          isActive: true,
          lastSyncAt: true,
          tokenExpiresAt: true,
        },
      }),
      prisma.activityLog.findMany({
        where: { eventType: "ACCOUNT_SYNC_FAILED", createdAt: { gte: dayAgo } },
        orderBy: { createdAt: "desc" },
        select: { accountId: true, description: true, createdAt: true },
      }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);

  const failuresByAccount = new Map<
    string,
    { count: number; lastError: string; lastErrorAt: Date }
  >();
  for (const f of recentFailures) {
    if (!f.accountId) continue;
    const existing = failuresByAccount.get(f.accountId);
    if (existing) existing.count++;
    else
      failuresByAccount.set(f.accountId, {
        count: 1,
        lastError: f.description,
        lastErrorAt: f.createdAt,
      });
  }

  const workerAlive =
    !!worker && Date.now() - worker.heartbeatAt.getTime() < WORKER_STALE_MS;

  return NextResponse.json({
    worker: {
      alive: workerAlive,
      heartbeatAt: worker?.heartbeatAt ?? null,
      startedAt: worker?.startedAt ?? null,
    },
    queue: {
      pending: pendingJobs,
      running: runningJobs.map((j) => ({
        account: j.account.email,
        claimedAt: j.claimedAt,
      })),
    },
    accounts: accounts.map((a) => {
      const failures = failuresByAccount.get(a.id);
      return {
        id: a.id,
        email: a.email,
        accountType: a.accountType,
        isActive: a.isActive,
        lastSyncAt: a.lastSyncAt,
        // Gmail access tokens auto-refresh; an *expired* token with failing
        // syncs means the refresh token died and the account needs reconnecting.
        tokenExpired:
          a.accountType === "GMAIL" &&
          !!a.tokenExpiresAt &&
          a.tokenExpiresAt.getTime() < Date.now(),
        failures24h: failures?.count ?? 0,
        lastError: failures?.lastError ?? null,
        lastErrorAt: failures?.lastErrorAt ?? null,
      };
    }),
    activeSessions: sessions,
  });
}
