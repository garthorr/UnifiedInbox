import { createImapClient } from "./sync";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";
import nodemailer from "nodemailer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAccount(accountId: string) {
  return prisma.account.findUniqueOrThrow({ where: { id: accountId } });
}

/** Search for all UIDs belonging to a thread (by root Message-ID). */
async function getThreadUids(
  client: import("imapflow").ImapFlow,
  rootMessageId: string
): Promise<number[]> {
  const bareId = rootMessageId.replace(/[<>]/g, "");
  const rootUids = (await client.search(
    { header: { "message-id": `<${bareId}>` } },
    { uid: true }
  )) as number[];
  const replyUids = (await client.search(
    { header: { "in-reply-to": `<${bareId}>` } },
    { uid: true }
  )) as number[];
  return [...new Set([...rootUids, ...replyUids])];
}

// ─── Thread-level actions ────────────────────────────────────────────────────

export async function markThreadRead(accountId: string, threadMessageId: string) {
  const account = await getAccount(accountId);
  const client = createImapClient(account as Parameters<typeof createImapClient>[0]);
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) {
        await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function markThreadUnread(accountId: string, threadMessageId: string) {
  const account = await getAccount(accountId);
  const client = createImapClient(account as Parameters<typeof createImapClient>[0]);
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) {
        await client.messageFlagsRemove(uids, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function archiveThread(accountId: string, threadMessageId: string) {
  const account = await getAccount(accountId);
  const client = createImapClient(account as Parameters<typeof createImapClient>[0]);
  await client.connect();
  try {
    // Find the archive mailbox (try special-use attribute first, then common names)
    const mailboxes = await client.list();
    const archiveBox =
      mailboxes.find((m) => (m.specialUse ?? "").toLowerCase() === "\\archive")?.path ??
      mailboxes.find((m) => /^(archive|all mail|\[gmail\]\/all mail)$/i.test(m.name))?.path ??
      "Archive";

    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) {
        await client.messageMove(uids, archiveBox, { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function trashThread(accountId: string, threadMessageId: string) {
  const account = await getAccount(accountId);
  const client = createImapClient(account as Parameters<typeof createImapClient>[0]);
  await client.connect();
  try {
    const mailboxes = await client.list();
    const trashBox =
      mailboxes.find((m) => (m.specialUse ?? "").toLowerCase() === "\\trash")?.path ??
      mailboxes.find((m) => /^(trash|deleted|bin|\[gmail\]\/trash)$/i.test(m.name))?.path ??
      "Trash";

    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) {
        await client.messageMove(uids, trashBox, { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

// ─── Send reply ──────────────────────────────────────────────────────────────

export async function sendReply(
  accountId: string,
  opts: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string | null;
    references?: string | null;
  }
) {
  const account = await getAccount(accountId);
  if (!account.smtpHost) throw new Error("No SMTP host configured for this account.");

  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort ?? 587,
    secure: (account.smtpPort ?? 587) === 465,
    auth: { user: account.email, pass: decrypt(account.accessToken) },
  });

  const from = account.displayName
    ? `${account.displayName} <${account.email}>`
    : account.email;

  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject.startsWith("Re:") ? opts.subject : `Re: ${opts.subject}`,
    text: opts.body,
    headers: {
      ...(opts.inReplyTo ? { "In-Reply-To": opts.inReplyTo } : {}),
      ...(opts.references ? { References: opts.references } : {}),
    },
  });
}
