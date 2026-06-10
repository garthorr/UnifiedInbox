import { withImap } from "./pool";
import { prisma } from "../db";
import { decrypt } from "../encrypt";
import { sanitizeHeader } from "../mail-headers";
import nodemailer from "nodemailer";
import type { ImapFlow } from "imapflow";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Search for all UIDs belonging to a thread (by root Message-ID).
 *  Runs both searches in parallel — they're independent IMAP commands. */
async function getThreadUids(
  client: ImapFlow,
  rootMessageId: string
): Promise<number[]> {
  const bareId = rootMessageId.replace(/[<>]/g, "");
  const [rootUids, replyUids] = await Promise.all([
    client.search({ header: { "message-id": `<${bareId}>` } }, { uid: true }) as Promise<number[]>,
    client.search({ header: { "in-reply-to": `<${bareId}>` } }, { uid: true }) as Promise<number[]>,
  ]);
  return [...new Set([...rootUids, ...replyUids])];
}

type MailboxPaths = { archive?: string; trash?: string };

/** Discover and cache the archive/trash special-use mailbox paths. */
async function resolveMailbox(
  client: ImapFlow,
  paths: MailboxPaths,
  kind: "archive" | "trash"
): Promise<string> {
  if (paths[kind]) return paths[kind]!;

  const mailboxes = await client.list();
  const specialUse = kind === "archive" ? "\\Archive" : "\\Trash";
  const fallbackRe = kind === "archive"
    ? /^(archive|all mail|\[gmail\]\/all mail)$/i
    : /^(trash|deleted|bin|\[gmail\]\/trash)$/i;
  const fallbackName = kind === "archive" ? "Archive" : "Trash";

  const path =
    mailboxes.find((m) => (m.specialUse ?? "").toLowerCase() === specialUse.toLowerCase())?.path ??
    mailboxes.find((m) => fallbackRe.test(m.name))?.path ??
    fallbackName;

  paths[kind] = path; // cache on the pool entry so next call skips list()
  return path;
}

// ─── Thread-level actions ────────────────────────────────────────────────────

export async function markThreadRead(accountId: string, threadMessageId: string) {
  await withImap(accountId, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function markThreadUnread(accountId: string, threadMessageId: string) {
  await withImap(accountId, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) await client.messageFlagsRemove(uids, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function archiveThread(accountId: string, threadMessageId: string) {
  await withImap(accountId, async (client, paths) => {
    const archiveBox = await resolveMailbox(client, paths, "archive");
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) await client.messageMove(uids, archiveBox, { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function trashThread(accountId: string, threadMessageId: string) {
  await withImap(accountId, async (client, paths) => {
    const trashBox = await resolveMailbox(client, paths, "trash");
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await getThreadUids(client, threadMessageId);
      if (uids.length > 0) await client.messageMove(uids, trashBox, { uid: true });
    } finally {
      lock.release();
    }
  });
}

// ─── Send email ──────────────────────────────────────────────────────────────

export async function sendEmail(
  accountId: string,
  opts: { to: string; subject: string; body: string }
) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { email: true, displayName: true, smtpHost: true, smtpPort: true, accessToken: true },
  });
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
    to: sanitizeHeader(opts.to),
    subject: sanitizeHeader(opts.subject),
    text: opts.body,
  });
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
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { email: true, displayName: true, smtpHost: true, smtpPort: true, accessToken: true },
  });
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

  // Subject and Message-IDs originate from inbound mail (sender-controlled);
  // sanitize before they reach header lines.
  const subject = sanitizeHeader(opts.subject);
  await transport.sendMail({
    from,
    to: sanitizeHeader(opts.to),
    subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
    text: opts.body,
    headers: {
      ...(opts.inReplyTo ? { "In-Reply-To": sanitizeHeader(opts.inReplyTo) } : {}),
      ...(opts.references ? { References: sanitizeHeader(opts.references) } : {}),
    },
  });
}
