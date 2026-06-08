/**
 * IMAP IDLE manager — real-time mail for IMAP accounts.
 *
 * Holds one long-lived ImapFlow connection per active IMAP account with INBOX
 * open. ImapFlow keeps the connection in IDLE and emits an `exists` event when
 * new messages arrive; we respond by enqueueing (and immediately draining) an
 * incremental sync for that account, which mirrors the new threads and fires
 * any new-mail notification.
 *
 * Runs in the worker process. This is separate from the action connection pool
 * (pool.ts) and from the sync's own short-lived connections — IMAP allows
 * multiple concurrent sessions per mailbox.
 */

import type { ImapFlow } from "imapflow";
import { prisma } from "../db";
import { createImapClient } from "./sync";
import { enqueueSyncJob, drainQueue } from "../sync-queue";

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;
const EXISTS_DEBOUNCE_MS = 1_500;

interface IdleConn {
  client: ImapFlow | null;
  stopping: boolean;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  syncTimer: ReturnType<typeof setTimeout> | null;
}

const conns = new Map<string, IdleConn>();

/** Debounced trigger: enqueue + drain an incremental sync for one account. */
function triggerSync(accountId: string, conn: IdleConn): void {
  if (conn.syncTimer) clearTimeout(conn.syncTimer);
  conn.syncTimer = setTimeout(async () => {
    try {
      await enqueueSyncJob(accountId);
      await drainQueue();
    } catch (err) {
      console.error(`[idle] sync trigger failed for ${accountId}:`, err);
    }
  }, EXISTS_DEBOUNCE_MS);
}

function scheduleReconnect(accountId: string, conn: IdleConn): void {
  if (conn.stopping) return;
  const delay = Math.min(
    RECONNECT_BASE_MS * 2 ** conn.reconnectAttempts,
    RECONNECT_MAX_MS
  );
  conn.reconnectAttempts++;
  conn.reconnectTimer = setTimeout(() => connect(accountId, conn), delay);
}

async function connect(accountId: string, conn: IdleConn): Promise<void> {
  if (conn.stopping) return;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive || account.accountType !== "IMAP") {
    stopAccount(accountId);
    return;
  }

  let client: ImapFlow;
  try {
    client = createImapClient(account as unknown as Parameters<typeof createImapClient>[0]);
    conn.client = client;

    client.on("error", (err: unknown) => {
      console.error(`[idle] connection error for ${account.email}:`, err);
    });
    client.on("close", () => {
      if (conn.stopping) return;
      conn.client = null;
      console.log(`[idle] connection closed for ${account.email}, reconnecting…`);
      scheduleReconnect(accountId, conn);
    });
    // New message(s) arrived while idling.
    client.on("exists", (data: { count: number; prevCount: number }) => {
      if (data.count > data.prevCount) {
        console.log(`[idle] new mail on ${account.email} (${data.prevCount} → ${data.count})`);
        triggerSync(accountId, conn);
      }
    });

    await client.connect();
    await client.mailboxOpen("INBOX");
    conn.reconnectAttempts = 0; // healthy again
    console.log(`[idle] watching INBOX for ${account.email}`);
  } catch (err) {
    console.error(`[idle] failed to connect ${account.email}:`, err);
    conn.client = null;
    scheduleReconnect(accountId, conn);
  }
}

function stopAccount(accountId: string): void {
  const conn = conns.get(accountId);
  if (!conn) return;
  conn.stopping = true;
  if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
  if (conn.syncTimer) clearTimeout(conn.syncTimer);
  conn.client?.logout().catch(() => {});
  conns.delete(accountId);
}

/**
 * Reconcile the set of IDLE connections with the active IMAP accounts:
 * start watchers for newly-added accounts, stop watchers for removed/inactive
 * ones. Safe to call repeatedly (e.g. on each cron tick).
 */
export async function syncIdleAccounts(): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true, accountType: "IMAP" },
    select: { id: true },
  });
  const activeIds = new Set(accounts.map((a) => a.id));

  // Stop watchers whose account is gone or deactivated.
  for (const id of conns.keys()) {
    if (!activeIds.has(id)) stopAccount(id);
  }

  // Start watchers for accounts not yet connected.
  for (const id of activeIds) {
    if (!conns.has(id)) {
      const conn: IdleConn = {
        client: null,
        stopping: false,
        reconnectAttempts: 0,
        reconnectTimer: null,
        syncTimer: null,
      };
      conns.set(id, conn);
      connect(id, conn).catch((err) => console.error("[idle] connect error:", err));
    }
  }
}

/** Close all IDLE connections (call on process shutdown). */
export function stopAllIdle(): void {
  for (const id of [...conns.keys()]) stopAccount(id);
}
