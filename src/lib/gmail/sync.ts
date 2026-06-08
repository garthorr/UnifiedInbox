import type { gmail_v1 } from "googleapis";
import { getGmailClient } from "./client";
import { prisma } from "../db";
import { applyRulesToThread } from "../rules";
import { notifyNewMail } from "../notifications";

const INITIAL_SYNC_DAYS = 90;
const INITIAL_SYNC_MAX_THREADS = 500;
const METADATA_HEADERS = ["Subject", "From", "To", "Cc", "Date"];

// ─── Retry helper ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry a Gmail API call on rate-limit (429) or server errors (5xx).
 *  Back-off: 1 s → 2 s → 4 s (three attempts total). */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    const retryable = code === 429 || (code !== undefined && code >= 500);
    if (attempts > 1 && retryable) {
      await sleep(delayMs);
      return withRetry(fn, attempts - 1, delayMs * 2);
    }
    throw err;
  }
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function extractAddresses(value: string): string[] {
  // Handles: "Name <email@x.com>, Other <other@x.com>" and plain "email@x.com"
  const results: string[] = [];
  // Match "Name <email>" or bare "email"
  const parts = value.split(/,(?![^<]*>)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) results.push(trimmed);
  }
  return results;
}

function parseParticipants(
  messages: gmail_v1.Schema$Message[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const msg of messages) {
    for (const header of msg.payload?.headers ?? []) {
      const name = header.name?.toLowerCase();
      if (name === "from" || name === "to" || name === "cc") {
        for (const addr of extractAddresses(header.value ?? "")) {
          const key = addr.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            result.push(addr);
          }
        }
      }
    }
  }
  return result;
}

function hasAttachmentsInParts(
  parts: gmail_v1.Schema$MessagePart[] | undefined
): boolean {
  if (!parts) return false;
  for (const part of parts) {
    if (part.filename && part.filename.length > 0) return true;
    if (part.parts && hasAttachmentsInParts(part.parts)) return true;
  }
  return false;
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

// ─── Label sync ───────────────────────────────────────────────────────────────

async function syncLabels(accountId: string, gmail: gmail_v1.Gmail): Promise<void> {
  const { data } = await withRetry(() =>
    gmail.users.labels.list({ userId: "me" })
  );
  const labels = data.labels ?? [];
  await Promise.all(
    labels.map((label) =>
      prisma.label.upsert({
        where: {
          accountId_gmailLabelId: {
            accountId,
            gmailLabelId: label.id!,
          },
        },
        create: {
          accountId,
          gmailLabelId: label.id!,
          name: label.name!,
          color: label.color?.backgroundColor ?? null,
          type: label.type === "user" ? "user" : "system",
        },
        update: {
          name: label.name!,
          color: label.color?.backgroundColor ?? null,
        },
      })
    )
  );
}

// ─── Thread upsert ────────────────────────────────────────────────────────────

async function upsertThread(
  accountId: string,
  thread: gmail_v1.Schema$Thread
): Promise<{ id: string; isNew: boolean; isUnread: boolean; subject: string }> {
  const messages = thread.messages ?? [];
  if (messages.length === 0) return { id: "", isNew: false, isUnread: false, subject: "" };

  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];

  const subject =
    getHeader(firstMsg.payload?.headers, "Subject") || "(no subject)";
  const snippet = thread.snippet ?? "";
  const participants = parseParticipants(messages);
  const gmailLabelIds = thread.messages
    ?.flatMap((m) => m.labelIds ?? [])
    .filter((v, i, a) => a.indexOf(v) === i) ?? [];
  const messageCount = messages.length;
  const hasAttachments = messages.some((m) =>
    hasAttachmentsInParts(m.payload?.parts)
  );
  const isUnread = gmailLabelIds.includes("UNREAD");
  const lastMessageAt = new Date(Number(lastMsg.internalDate ?? Date.now()));
  const firstMessageAt = new Date(Number(firstMsg.internalDate ?? Date.now()));
  const historyId = thread.historyId ?? "0";

  const existing = await prisma.threadMirror.findUnique({
    where: { gmailThreadId_accountId: { gmailThreadId: thread.id!, accountId } },
    select: { id: true },
  });

  const row = await prisma.threadMirror.upsert({
    where: {
      gmailThreadId_accountId: {
        gmailThreadId: thread.id!,
        accountId,
      },
    },
    create: {
      gmailThreadId: thread.id!,
      accountId,
      subject,
      snippet,
      participantAddresses: participants,
      gmailLabelIds,
      messageCount,
      hasAttachments,
      isUnread,
      lastMessageAt,
      firstMessageAt,
      historyId,
      isStale: false,
    },
    update: {
      subject,
      snippet,
      participantAddresses: participants,
      gmailLabelIds,
      messageCount,
      hasAttachments,
      isUnread,
      lastMessageAt,
      firstMessageAt,
      historyId,
      isStale: false,
      syncedAt: new Date(),
    },
    select: { id: true },
  });

  // Per-thread import logs are very high-volume; only write them when opted in.
  if (process.env.SYNC_LOG_THREADS === "true") {
    await prisma.activityLog.create({
      data: {
        eventType: "THREAD_IMPORTED",
        accountId,
        description: `Thread synced: ${subject}`,
        metadata: { gmailThreadId: thread.id },
      },
    });
  }

  return { id: row.id, isNew: !existing, isUnread, subject };
}

// ─── Fetch thread with metadata ───────────────────────────────────────────────

async function fetchThreadMetadata(
  gmail: gmail_v1.Gmail,
  userId: string,
  threadId: string
): Promise<gmail_v1.Schema$Thread | null> {
  try {
    const { data } = await withRetry(() =>
      gmail.users.threads.get({
        userId,
        id: threadId,
        format: "metadata",
        metadataHeaders: METADATA_HEADERS,
      })
    );
    return data;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 404
    ) {
      return null;
    }
    throw err;
  }
}

// ─── Initial sync ─────────────────────────────────────────────────────────────

export async function initialSync(accountId: string): Promise<void> {
  const gmail = await getGmailClient(accountId);
  const userId = "me";

  await prisma.activityLog.create({
    data: {
      eventType: "ACCOUNT_SYNC_STARTED",
      accountId,
      description: "Initial sync started",
    },
  });

  // Sync label names/colors so thread cards can display them
  await syncLabels(accountId, gmail).catch(() => {}); // non-fatal

  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - INITIAL_SYNC_DAYS);
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, "0")}/${String(afterDate.getDate()).padStart(2, "0")}`;

  let threadIds: string[] = [];
  let pageToken: string | undefined;
  let totalFetched = 0;

  do {
    const { data } = await withRetry(() =>
      gmail.users.threads.list({
        userId,
        q: `after:${afterStr}`,
        maxResults: Math.min(100, INITIAL_SYNC_MAX_THREADS - totalFetched),
        pageToken,
      })
    );

    const threads = data.threads ?? [];
    threadIds = threadIds.concat(threads.map((t) => t.id!));
    totalFetched += threads.length;
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && totalFetched < INITIAL_SYNC_MAX_THREADS);

  let maxHistoryId = "0";
  let synced = 0;

  // Fetch and upsert in batches of 10 to parallelise without overwhelming the API
  const BATCH = 10;
  for (let i = 0; i < threadIds.length; i += BATCH) {
    const batch = threadIds.slice(i, i + BATCH);
    const threads = await Promise.all(
      batch.map((id) => fetchThreadMetadata(gmail, userId, id))
    );
    await Promise.all(
      threads.map(async (thread) => {
        if (!thread) return;
        const { id, isNew } = await upsertThread(accountId, thread);
        if (isNew) applyRulesToThread(id).catch(() => {});
        synced++;
        // historyId values are large integers; compare numerically, not
        // lexically ("9" > "100000" is true as a string compare).
        if (thread.historyId && BigInt(thread.historyId) > BigInt(maxHistoryId)) {
          maxHistoryId = thread.historyId;
        }
      })
    );
  }

  await prisma.account.update({
    where: { id: accountId },
    data: {
      lastSyncAt: new Date(),
      historyId: maxHistoryId,
    },
  });

  await prisma.activityLog.create({
    data: {
      eventType: "ACCOUNT_SYNC_COMPLETED",
      accountId,
      description: `Initial sync complete — ${synced} threads synced`,
      metadata: { threadCount: synced },
    },
  });
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function incrementalSync(accountId: string): Promise<void> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  if (!account.historyId) {
    // No history ID stored — fall back to initial sync
    return initialSync(accountId);
  }

  const gmail = await getGmailClient(accountId);
  const userId = "me";

  // Keep label names fresh on every incremental sync (fast, non-fatal)
  await syncLabels(accountId, gmail).catch(() => {});

  let historyItems: gmail_v1.Schema$History[] = [];
  let pageToken: string | undefined;
  let latestHistoryId: string | undefined;

  try {
    do {
      const { data } = await withRetry(() =>
        gmail.users.history.list({
          userId,
          startHistoryId: account.historyId ?? undefined,
          historyTypes: ["messageAdded", "labelAdded", "labelRemoved"],
          pageToken,
        })
      );
      historyItems = historyItems.concat(data.history ?? []);
      pageToken = data.nextPageToken ?? undefined;
      if (data.historyId) latestHistoryId = data.historyId;
    } while (pageToken);
    // NOTE: latestHistoryId is persisted only *after* the affected threads
    // are processed below — persisting it here would advance the cursor
    // before the threads are saved, so a crash mid-processing would skip
    // that mail permanently on the next incremental sync.
  } catch (err: unknown) {
    // historyId expired → fall back to initial sync
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 404
    ) {
      return initialSync(accountId);
    }
    throw err;
  }

  const affectedThreadIds = new Set<string>();
  for (const item of historyItems) {
    for (const m of [
      ...(item.messagesAdded?.map((ma) => ma.message) ?? []),
      ...(item.labelsAdded?.map((la) => la.message) ?? []),
      ...(item.labelsRemoved?.map((lr) => lr.message) ?? []),
    ]) {
      if (m?.threadId) affectedThreadIds.add(m.threadId);
    }
  }

  let synced = 0;
  const newUnreadSubjects: string[] = [];
  const affectedIds = [...affectedThreadIds];
  const BATCH = 10;
  for (let i = 0; i < affectedIds.length; i += BATCH) {
    const batch = affectedIds.slice(i, i + BATCH);
    const threads = await Promise.all(
      batch.map((id) => fetchThreadMetadata(gmail, userId, id))
    );
    await Promise.all(
      batch.map(async (threadId, idx) => {
        const thread = threads[idx];
        if (!thread) {
          await prisma.threadMirror.updateMany({
            where: { gmailThreadId: threadId, accountId },
            data: { isStale: true },
          });
          await prisma.activityLog.create({
            data: {
              eventType: "THREAD_STALE",
              accountId,
              description: `Thread no longer accessible in Gmail`,
              metadata: { gmailThreadId: threadId },
            },
          });
        } else {
          const { id, isNew, isUnread, subject } = await upsertThread(accountId, thread);
          if (isNew) {
            applyRulesToThread(id).catch(() => {});
            if (isUnread) newUnreadSubjects.push(subject);
          }
          synced++;
        }
      })
    );
  }

  // Advance the history cursor only now that the affected threads have been
  // persisted, so an interrupted sync re-reads the same history next time.
  await prisma.account.update({
    where: { id: accountId },
    data: {
      lastSyncAt: new Date(),
      ...(latestHistoryId ? { historyId: latestHistoryId } : {}),
    },
  });

  // Notify on genuinely new unread mail (no-op if push/settings disabled).
  if (newUnreadSubjects.length > 0) {
    await notifyNewMail(account.email, newUnreadSubjects.length, newUnreadSubjects[0]).catch(
      (err) => console.error("[push] new-mail notify failed:", err)
    );
  }

  await prisma.activityLog.create({
    data: {
      eventType: "ACCOUNT_SYNC_COMPLETED",
      accountId,
      description: `Incremental sync complete — ${synced} threads updated`,
      metadata: { threadsUpdated: synced },
    },
  });
}

// ─── Log pruning ──────────────────────────────────────────────────────────────

/** Delete THREAD_IMPORTED logs older than `days` days to keep activity_log lean. */
export async function pruneThreadImportLogs(days = 3): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  await prisma.activityLog.deleteMany({
    where: { eventType: "THREAD_IMPORTED", createdAt: { lt: cutoff } },
  });
}

// ─── Sync with error handling (for worker) ───────────────────────────────────

export async function syncAccount(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) return;

  try {
    if (account.accountType === "IMAP") {
      const { initialSync: imapInitial, incrementalSync: imapIncremental } =
        await import("../imap/sync");
      const isFirstSync = !account.historyId || account.historyId === "uid:0";
      if (isFirstSync) {
        await imapInitial(accountId);
      } else {
        await imapIncremental(accountId);
      }
    } else {
      if (!account.historyId) {
        await initialSync(accountId);
      } else {
        await incrementalSync(accountId);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isAuthError =
      message.includes("401") ||
      message.includes("invalid_grant") ||
      message.includes("Insufficient Permission") ||
      message.includes("insufficientPermissions") ||
      message.includes("403") ||
      message.includes("Authentication failed") ||
      message.includes("AUTHENTICATIONFAILED");

    if (isAuthError) {
      await prisma.account.update({
        where: { id: accountId },
        data: { isActive: false },
      });
    }

    await prisma.activityLog.create({
      data: {
        eventType: "ACCOUNT_SYNC_FAILED",
        accountId,
        description: `Sync failed: ${message}`,
        metadata: { error: message, authError: isAuthError },
      },
    });

    throw err;
  }
}
