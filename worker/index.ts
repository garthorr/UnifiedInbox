import cron from "node-cron";
import { prisma } from "../src/lib/db";
import { syncAccount, pruneThreadImportLogs } from "../src/lib/gmail/sync";
import { drainQueue, enqueueSyncJob, pruneOldJobs } from "../src/lib/sync-queue";
import { getTask, isConfigured as todoistConfigured } from "../src/lib/todoist";

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

  const links = await prisma.taskLink.findMany({
    where: {
      provider: "TODOIST",
      workItem: { status: { not: "DONE" } },
    },
    include: { workItem: { select: { id: true, title: true, status: true } } },
  });
  if (links.length === 0) return;

  console.log(`[worker] Checking ${links.length} Todoist task(s)...`);

  for (const link of links) {
    try {
      const task = await getTask(link.externalId);
      const now = new Date();

      if (task.is_completed) {
        await prisma.$transaction([
          prisma.workItem.update({
            where: { id: link.workItemId },
            data: { status: "DONE" },
          }),
          prisma.taskLink.update({
            where: { id: link.id },
            data: { externalStatus: "completed", lastSyncAt: now },
          }),
          prisma.activityLog.create({
            data: {
              eventType: "WORK_ITEM_STATUS_CHANGED",
              workItemId: link.workItemId,
              description: `Marked DONE via Todoist completion`,
              metadata: { from: link.workItem.status, to: "DONE", todoistTaskId: link.externalId },
            },
          }),
        ]);
        console.log(`[worker] ✓ Todoist→DONE: ${link.workItem.title}`);
      } else {
        await prisma.taskLink.update({
          where: { id: link.id },
          data: { lastSyncAt: now },
        });
      }
    } catch (err) {
      console.error(`[worker] ✗ Todoist sync failed for task ${link.externalId}:`, err);
    }
  }
}

// On startup: run initial syncs for any never-synced accounts
runInitialSyncs().catch(console.error);

// Scheduled cron: enqueue all accounts then drain the queue
const schedule = `*/${SYNC_INTERVAL} * * * *`;
console.log(`[worker] Scheduling sync every ${SYNC_INTERVAL} minutes`);

cron.schedule(schedule, async () => {
  try {
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

process.on("SIGTERM", async () => {
  console.log("[worker] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});
