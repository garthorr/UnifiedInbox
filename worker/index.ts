import cron from "node-cron";
import { prisma } from "../src/lib/db";
import { syncAccount } from "../src/lib/gmail/sync";
import { getTask, isConfigured as todoistConfigured } from "../src/lib/todoist";

const SYNC_INTERVAL = process.env.SYNC_INTERVAL_MINUTES ?? "15";

async function syncAllAccounts(): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, email: true },
  });

  if (accounts.length === 0) return;

  console.log(`[worker] Syncing ${accounts.length} account(s)...`);

  for (const account of accounts) {
    try {
      await syncAccount(account.id);
      console.log(`[worker] ✓ ${account.email}`);
    } catch (err) {
      console.error(`[worker] ✗ ${account.email}:`, err);
    }
  }
}

async function runInitialSyncs(): Promise<void> {
  // On startup, trigger initial sync for any accounts that haven't been synced yet
  const unsynced = await prisma.account.findMany({
    where: { isActive: true, lastSyncAt: null },
    select: { id: true, email: true },
  });

  if (unsynced.length > 0) {
    console.log(
      `[worker] Running initial sync for ${unsynced.length} account(s)...`
    );
    for (const account of unsynced) {
      try {
        await syncAccount(account.id);
        console.log(`[worker] ✓ Initial sync complete: ${account.email}`);
      } catch (err) {
        console.error(`[worker] ✗ Initial sync failed: ${account.email}`, err);
      }
    }
  }
}

async function syncTodoist(): Promise<void> {
  if (!todoistConfigured()) return;

  // Find work items linked to Todoist that aren't already DONE
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
              metadata: {
                from: link.workItem.status,
                to: "DONE",
                todoistTaskId: link.externalId,
              },
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

// Run initial syncs on startup
runInitialSyncs().catch(console.error);

// Schedule incremental sync every N minutes
const schedule = `*/${SYNC_INTERVAL} * * * *`;
console.log(`[worker] Scheduling sync every ${SYNC_INTERVAL} minutes`);

cron.schedule(schedule, () => {
  syncAllAccounts().catch(console.error);
  syncTodoist().catch(console.error);
});

console.log("[worker] Started. Waiting for scheduled syncs...");

// Keep the process alive
process.on("SIGTERM", async () => {
  console.log("[worker] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});
