import { ImapFlow } from "imapflow";
import { prisma } from "../db";
import { decrypt } from "../encrypt";
import { applyRulesToThread } from "../rules";

const INITIAL_SYNC_DAYS = 90;
const INITIAL_SYNC_MAX = 500;

// ─── Types ─────────────────────────────────────────────────────────────────

interface ImapAccount {
  id: string;
  email: string;
  accessToken: string; // encrypted password
  imapHost: string;
  imapPort: number | null;
}

// ─── Client ────────────────────────────────────────────────────────────────

export function createImapClient(account: ImapAccount): ImapFlow {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort ?? 993,
    secure: (account.imapPort ?? 993) !== 143,
    auth: { user: account.email, pass: decrypt(account.accessToken) },
    logger: false,
  });
}

/** Test connectivity only — throws on failure. */
export async function testImapConnection(
  host: string,
  port: number,
  user: string,
  pass: string
): Promise<void> {
  const client = new ImapFlow({
    host,
    port,
    secure: port !== 143,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  await client.logout();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeId(id: string | null | undefined): string {
  return (id ?? "").replace(/[<>\s]/g, "");
}

/** Derive the root thread ID from a message's envelope fields. */
function threadId(
  messageId: string | null | undefined,
  inReplyTo: string | null | undefined
): string {
  if (inReplyTo) return normalizeId(inReplyTo);
  return normalizeId(messageId) || `unknown-${Date.now()}`;
}

function formatAddr(a: { name?: string; address?: string } | null | undefined): string {
  if (!a) return "";
  if (a.name && a.address) return `${a.name} <${a.address}>`;
  return a.address ?? a.name ?? "";
}

function hasAtt(bodyStructure: unknown): boolean {
  if (!bodyStructure || typeof bodyStructure !== "object") return false;
  const b = bodyStructure as Record<string, unknown>;
  if (typeof b.disposition === "string" && b.disposition.toLowerCase() === "attachment") return true;
  if (Array.isArray(b.childNodes)) return (b.childNodes as unknown[]).some(hasAtt);
  return false;
}

interface ThreadAccum {
  uids: number[];
  subject: string;
  participants: Set<string>;
  lastDate: Date;
  firstDate: Date;
  isUnread: boolean;
  hasAttachments: boolean;
}

// ─── Initial sync ──────────────────────────────────────────────────────────

export async function initialSync(accountId: string): Promise<void> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

  const since = new Date();
  since.setDate(since.getDate() - INITIAL_SYNC_DAYS);

  const client = createImapClient(account as unknown as ImapAccount);
  await client.connect();

  const threads = new Map<string, ThreadAccum>();
  let maxUid = 0;

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search({ since }, { uid: true })) as number[];

      if (uids.length > 0) {
        const batch = uids.slice(-INITIAL_SYNC_MAX);

        for await (const msg of client.fetch(
          batch,
          { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true },
          { uid: true }
        )) {
          const uid = msg.uid;
          if (uid > maxUid) maxUid = uid;

          const tid = threadId(msg.envelope?.messageId, msg.envelope?.inReplyTo);
          const subject = msg.envelope?.subject ?? "(no subject)";
          const isUnread = !msg.flags?.has("\\Seen");
          const date = msg.internalDate instanceof Date ? msg.internalDate : new Date();

          const addrs = [
            ...(msg.envelope?.from ?? []),
            ...(msg.envelope?.to ?? []),
            ...(msg.envelope?.cc ?? []),
          ].map((a) => formatAddr(a as { name?: string; address?: string })).filter(Boolean);

          const existing = threads.get(tid);
          if (existing) {
            existing.uids.push(uid);
            addrs.forEach((a) => existing.participants.add(a));
            if (date > existing.lastDate) existing.lastDate = date;
            if (date < existing.firstDate) existing.firstDate = date;
            if (isUnread) existing.isUnread = true;
            if (hasAtt(msg.bodyStructure)) existing.hasAttachments = true;
          } else {
            threads.set(tid, {
              uids: [uid],
              subject,
              participants: new Set(addrs),
              lastDate: date,
              firstDate: date,
              isUnread,
              hasAttachments: hasAtt(msg.bodyStructure),
            });
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  // Persist threads and apply rules to new ones
  for (const [tid, t] of threads) {
    const existing = await prisma.threadMirror.findUnique({
      where: { gmailThreadId_accountId: { gmailThreadId: tid, accountId } },
      select: { id: true },
    });
    const row = await prisma.threadMirror.upsert({
      where: { gmailThreadId_accountId: { gmailThreadId: tid, accountId } },
      create: {
        gmailThreadId: tid,
        accountId,
        subject: t.subject,
        snippet: "",
        participantAddresses: [...t.participants],
        gmailLabelIds: ["INBOX"],
        messageCount: t.uids.length,
        hasAttachments: t.hasAttachments,
        isUnread: t.isUnread,
        lastMessageAt: t.lastDate,
        firstMessageAt: t.firstDate,
        historyId: String(Math.max(...t.uids)),
        isStale: false,
      },
      update: {
        subject: t.subject,
        participantAddresses: [...t.participants],
        gmailLabelIds: ["INBOX"],
        messageCount: t.uids.length,
        hasAttachments: t.hasAttachments,
        isUnread: t.isUnread,
        lastMessageAt: t.lastDate,
        firstMessageAt: t.firstDate,
        historyId: String(Math.max(...t.uids)),
        isStale: false,
        syncedAt: new Date(),
      },
      select: { id: true },
    });
    if (!existing) applyRulesToThread(row.id).catch(() => {});
  }

  await prisma.account.update({
    where: { id: accountId },
    data: { lastSyncAt: new Date(), historyId: `uid:${maxUid}` },
  });

  await prisma.activityLog.create({
    data: {
      eventType: "ACCOUNT_SYNC_COMPLETED",
      accountId,
      description: `IMAP initial sync complete: ${threads.size} threads`,
    },
  });
}

// ─── Incremental sync ──────────────────────────────────────────────────────

export async function incrementalSync(accountId: string): Promise<void> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

  const lastUid = parseInt((account.historyId ?? "uid:0").replace("uid:", ""), 10) || 0;

  const client = createImapClient(account as unknown as ImapAccount);
  await client.connect();

  let maxUid = lastUid;
  let synced = 0;

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const newUids = (await client.search(
        { uid: `${lastUid + 1}:*` },
        { uid: true }
      )) as number[];

      for await (const msg of client.fetch(
        newUids.filter((u) => u > lastUid),
        { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true },
        { uid: true }
      )) {
        const uid = msg.uid;
        if (uid > maxUid) maxUid = uid;

        const tid = threadId(msg.envelope?.messageId, msg.envelope?.inReplyTo);
        const subject = msg.envelope?.subject ?? "(no subject)";
        const isUnread = !msg.flags?.has("\\Seen");
        const date = msg.internalDate instanceof Date ? msg.internalDate : new Date();

        const addrs = [
          ...(msg.envelope?.from ?? []),
          ...(msg.envelope?.to ?? []),
          ...(msg.envelope?.cc ?? []),
        ].map((a) => formatAddr(a as { name?: string; address?: string })).filter(Boolean);

        const existing = await prisma.threadMirror.findUnique({
          where: { gmailThreadId_accountId: { gmailThreadId: tid, accountId } },
          select: { id: true },
        });
        const row = await prisma.threadMirror.upsert({
          where: { gmailThreadId_accountId: { gmailThreadId: tid, accountId } },
          create: {
            gmailThreadId: tid,
            accountId,
            subject,
            snippet: "",
            participantAddresses: addrs,
            gmailLabelIds: ["INBOX"],
            messageCount: 1,
            hasAttachments: hasAtt(msg.bodyStructure),
            isUnread,
            lastMessageAt: date,
            firstMessageAt: date,
            historyId: String(uid),
          },
          update: {
            messageCount: { increment: 1 },
            lastMessageAt: date,
            ...(isUnread && { isUnread: true }),
            historyId: String(uid),
            syncedAt: new Date(),
          },
          select: { id: true },
        });
        if (!existing) applyRulesToThread(row.id).catch(() => {});
        synced++;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  await prisma.account.update({
    where: { id: accountId },
    data: { lastSyncAt: new Date(), historyId: `uid:${maxUid}` },
  });

  if (synced > 0) {
    await prisma.activityLog.create({
      data: {
        eventType: "ACCOUNT_SYNC_COMPLETED",
        accountId,
        description: `IMAP incremental sync: ${synced} new messages`,
      },
    });
  }
}
