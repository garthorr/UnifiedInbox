import cron from "node-cron";
import { validateEnv } from "../src/lib/env";
import { prisma } from "../src/lib/db";

validateEnv();
import { syncAccount, pruneThreadImportLogs } from "../src/lib/gmail/sync";
import { drainQueue, enqueueSyncJob, pruneOldJobs, reclaimStuckJobs } from "../src/lib/sync-queue";
import { drainImapPool } from "../src/lib/imap/pool";
import { syncIdleAccounts, stopAllIdle } from "../src/lib/imap/idle";
import { syncTodoistLinks, isConfigured as todoistConfigured } from "../src/lib/todoist";
import { deliverDueReminders } from "../src/lib/notifications";
import { isPushConfigured } from "../src/lib/push";

const SYNC_INTERVAL = process.env.SYNC_INTERVAL_MINUTES ?? "15";

// Gmail has no LAN-safe push (Pub/Sub needs a public webhook), so we poll Gmail
// accounts on a tighter cadence than the general sweep. IMAP accounts get
// real-time delivery from IDLE, so they don't need this. Clamp to >= 1 minute.
const GMAIL_SYNC_INTERVAL = String(
  Math.max(1, parseInt(process.env.GMAIL_SYNC_INTERVAL_MINUTES ?? "2", 10) || 2)
);

async function enqueueAllAccounts(): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, email: true },
  });
  if (accounts.length === 0) return;
  console.log(`[worker] Enqueueing ${accounts.length} account(s) for sync...`);
  await Promise.all(accounts.map((a) => enqueueSyncJob(a.id)));
}

async function enqueueGmailAccounts(): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true, accountType: "GMAIL" },
    select: { id: true },
  });
  if (accounts.length === 0) return;
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

// Heartbeat: touch the WorkerStatus singleton so the web app (status panel,
// /api/health) can tell the worker is alive. Runs on its own schedule so a
// slow sweep doesn't make a healthy worker look dead.
const WORKER_STARTED_AT = new Date();
async function beatHeartbeat(): Promise<void> {
  await prisma.workerStatus.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", startedAt: WORKER_STARTED_AT, heartbeatAt: new Date() },
    update: { startedAt: WORKER_STARTED_AT, heartbeatAt: new Date() },
  });
}
beatHeartbeat().catch((err) => console.error("[worker] Heartbeat error:", err));
cron.schedule("*/30 * * * * *", async () => {
  try {
    await beatHeartbeat();
  } catch (err) {
    console.error("[worker] Heartbeat error:", err);
  }
});

// On startup: run initial syncs for any never-synced accounts, then start
// IMAP IDLE watchers for real-time delivery.
runInitialSyncs()
  .then(() => syncIdleAccounts())
  .catch(console.error);

// Scheduled cron: enqueue all accounts then drain the queue
const schedule = `*/${SYNC_INTERVAL} * * * *`;
console.log(`[worker] Scheduling sync every ${SYNC_INTERVAL} minutes`);

// node-cron does not wait for the previous invocation to finish, so a slow
// sweep (large/slow mailbox) could overlap the next one and double-start IDLE
// watchers. Guard against re-entrancy.
let sweepRunning = false;
cron.schedule(schedule, async () => {
  if (sweepRunning) {
    console.warn("[worker] Previous sweep still running — skipping this tick");
    return;
  }
  sweepRunning = true;
  try {
    await reclaimStuckJobs(); // reset any jobs orphaned by a prior worker crash
    await enqueueAllAccounts();
    await drainQueue();
    await pruneOldJobs();
    await pruneThreadImportLogs();
    // Keep IMAP IDLE watchers in sync with the current set of active accounts.
    await syncIdleAccounts();
  } catch (err) {
    console.error("[worker] Cron error:", err);
  } finally {
    sweepRunning = false;
  }
  syncTodoist().catch(console.error);
});

// Tight Gmail polling: enqueue Gmail accounts on a short cadence (IMAP relies
// on IDLE instead). The 30s drain below picks the jobs up promptly.
const gmailSchedule = `*/${GMAIL_SYNC_INTERVAL} * * * *`;
console.log(`[worker] Polling Gmail accounts every ${GMAIL_SYNC_INTERVAL} minute(s)`);

cron.schedule(gmailSchedule, async () => {
  try {
    await enqueueGmailAccounts();
    await drainQueue();
  } catch (err) {
    console.error("[worker] Gmail poll error:", err);
  }
});

// Also drain the queue every 30 seconds to pick up API-triggered jobs quickly
cron.schedule("*/30 * * * * *", async () => {
  try {
    await drainQueue();
  } catch (err) {
    console.error("[worker] Queue drain error:", err);
  }
});

// Deliver due task reminders every minute (no-op when push isn't configured).
if (isPushConfigured()) {
  console.log("[worker] Push configured — task reminders enabled");
  cron.schedule("* * * * *", async () => {
    try {
      const sent = await deliverDueReminders();
      if (sent > 0) console.log(`[worker] Delivered ${sent} reminder(s)`);
    } catch (err) {
      console.error("[worker] Reminder error:", err);
    }
  });
} else {
  console.log("[worker] Push not configured (no VAPID keys) — reminders disabled");
}

console.log("[worker] Started. Waiting for scheduled syncs...");

async function shutdown() {
  console.log("[worker] Shutting down...");
  stopAllIdle();
  drainImapPool();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// The worker is a long-lived process running many fire-and-forget async chains
// (cron handlers, IMAP IDLE, push). A single unhandled rejection would
// otherwise terminate the process (Node's default), silently killing all
// background sync. Log and keep running instead.
process.on("unhandledRejection", (reason) => {
  console.error("[worker] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[worker] Uncaught exception:", err);
});
