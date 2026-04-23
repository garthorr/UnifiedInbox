/**
 * Per-account IMAP connection pool.
 *
 * Keeps one persistent ImapFlow connection per accountId so that
 * short actions (markRead, archive, trash) reuse the existing TLS session
 * instead of paying a fresh handshake on every request (~500 ms–1 s each).
 *
 * Guarantees:
 *  - Operations on the same account are serialized (IMAP is single-threaded per connection).
 *  - Connections idle for more than IDLE_MS are closed automatically.
 *  - If a connection becomes unusable (server closed it), it is evicted and one
 *    transparent reconnect is attempted before surfacing the error.
 */

import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";

const IDLE_MS = 5 * 60 * 1000; // close idle connections after 5 minutes

interface Entry {
  client: ImapFlow;
  idle: ReturnType<typeof setTimeout>;
  // Serialization queue: each caller chains onto the previous operation's promise.
  tail: Promise<void>;
  // Cache discovered special-use mailbox paths to avoid list() on every action.
  mailboxPaths: { archive?: string; trash?: string };
}

const pool = new Map<string, Entry>();

function scheduleIdle(accountId: string, entry: Entry): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    pool.delete(accountId);
    entry.client.logout().catch(() => {});
  }, IDLE_MS);
}

async function openEntry(accountId: string): Promise<Entry> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { email: true, accessToken: true, imapHost: true, imapPort: true },
  });

  const client = new ImapFlow({
    host: account.imapHost!,
    port: account.imapPort ?? 993,
    secure: (account.imapPort ?? 993) !== 143,
    auth: { user: account.email, pass: decrypt(account.accessToken) },
    logger: false,
    // Hard socket timeout so a frozen server never leaks a file descriptor.
    socketTimeout: 30_000,
    connectionTimeout: 15_000,
  });

  await client.connect();

  const entry: Entry = {
    client,
    tail: Promise.resolve(),
    mailboxPaths: {},
    idle: null as unknown as ReturnType<typeof setTimeout>,
  };
  entry.idle = scheduleIdle(accountId, entry);
  pool.set(accountId, entry);
  return entry;
}

async function acquire(accountId: string): Promise<Entry> {
  const existing = pool.get(accountId);
  if (existing?.client.usable) {
    clearTimeout(existing.idle);
    existing.idle = scheduleIdle(accountId, existing);
    return existing;
  }

  // Stale / disconnected — evict and open fresh
  if (existing) {
    clearTimeout(existing.idle);
    pool.delete(accountId);
    existing.client.logout().catch(() => {});
  }

  return openEntry(accountId);
}

/**
 * Run `fn` with the pooled IMAP client for `accountId`.
 * Operations on the same account are automatically serialized.
 * On a broken connection, one transparent reconnect is attempted.
 */
export async function withImap<T>(
  accountId: string,
  fn: (client: ImapFlow, mailboxPaths: Entry["mailboxPaths"]) => Promise<T>
): Promise<T> {
  const entry = await acquire(accountId);

  return new Promise<T>((resolve, reject) => {
    entry.tail = entry.tail
      .then(async () => {
        try {
          resolve(await fn(entry.client, entry.mailboxPaths));
        } catch (err) {
          // If the connection dropped, evict and retry once with a fresh one
          if (!entry.client.usable) {
            pool.delete(accountId);
            clearTimeout(entry.idle);
            try {
              const fresh = await openEntry(accountId);
              resolve(await fn(fresh.client, fresh.mailboxPaths));
            } catch (retryErr) {
              reject(retryErr);
            }
          } else {
            reject(err);
          }
        }
      })
      // Absorb rejections so subsequent queued operations still run
      .catch(() => {});
  });
}

/** Close all pooled connections (call on process shutdown). */
export function drainImapPool(): void {
  for (const [id, entry] of pool) {
    clearTimeout(entry.idle);
    entry.client.logout().catch(() => {});
    pool.delete(id);
  }
}
