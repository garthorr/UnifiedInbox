import cron from "node-cron";
import { validateEnv } from "../src/lib/env";
import { prisma } from "../src/lib/db";

validateEnv();
import { syncAccount, pruneThreadImportLogs } from "../src/lib/gmail/sync";
import { drainQueue, enqueueSyncJob, pruneOldJobs, reclaimStuckJobs } from "../src/lib/sync-queue";
import { drainImapPool } from "../src/lib/imap/pool";
import { syncTodoistLinks, isConfigured as todoistConfigured } from "../src/lib/todoist";

const SYNC_INTERVAL = process.env.SYNC_INTERVAL_MINUTES ?? "15";

async function enqueueAllAccounts(): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, email: true },
  });
  if (accounts.length === 0) return;
  console.log(`[worker] Enqueueing ${accounts.length} account(s) for sync...`);
  await Promise.all(accounts.map((a) => enqueueSyncJob(a.id)));
}

async function runInitialSyncs(): Promise<void> {
  const unsynced = await prisma.account.findMany({
    where: { isActive: true, lastSyncAt: null },
    select: { id: true, email: true },
  });
  if (unsynced.length === 0) return;

  console.log(`[worker] Running initial sync for ${unsynced.length} account(s)...`);
  for (const account of unsynced) {
    try {
      await syncAccount(account.id);
      console.log(`[worker] ✓ Initial sync complete: ${account.email}`);
    } catch (err) {
      console.error(`[worker] ✗ Initial sync failed: ${account.email}`, err);
    }
  }
}

async function syncTodoist(): Promise<void> {
  if (!todoistConfigured()) return;
  const { synced, completed, errors } = await syncTodoistLinks();
  if (synced > 0 || errors.length > 0) {
    console.log(`[worker] Todoist: ${synced} synced, ${completed} completed, ${errors.length} error(s)`);
    errors.forEach((e) => console.error(`[worker] Todoist error: ${e}`));
  }
}

// On startup: run initial syncs for any never-synced accounts
runInitialSyncs().catch(console.error);

// Scheduled cron: enqueue all accounts then drain the queue
const schedule = `*/${SYNC_INTERVAL} * * * *`;
console.log(`[worker] Scheduling sync every ${SYNC_INTERVAL} minutes`);

cron.schedule(schedule, async () => {
  try {
    await reclaimStuckJobs(); // reset any jobs orphaned by a prior worker crash
    await enqueueAllAccounts();
    await drainQueue();
    await pruneOldJobs();
    await pruneThreadImportLogs();
  } catch (err) {
    console.error("[worker] Cron error:", err);
  }
  syncTodoist().catch(console.error);
});

// Also drain the queue every 30 seconds to pick up API-triggered jobs quickly
cron.schedule("*/30 * * * * *", async () => {
  try {
    await drainQueue();
  } catch (err) {
    console.error("[worker] Queue drain error:", err);
  }
});

console.log("[worker] Started. Waiting for scheduled syncs...");

async function shutdown() {
  console.log("[worker] Shutting down...");
  drainImapPool();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
