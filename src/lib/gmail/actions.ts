import { getGmailClient } from "./client";
import { prisma } from "../db";

// ─── Thread-level actions ────────────────────────────────────────────────────

export async function archiveThread(accountId: string, gmailThreadId: string) {
  const gmail = await getGmailClient(accountId);
  await gmail.users.threads.modify({
    userId: "me",
    id: gmailThreadId,
    requestBody: { removeLabelIds: ["INBOX"] },
  });
}

export async function trashThread(accountId: string, gmailThreadId: string) {
  const gmail = await getGmailClient(accountId);
  await gmail.users.threads.trash({ userId: "me", id: gmailThreadId });
}

export async function markThreadRead(accountId: string, gmailThreadId: string) {
  const gmail = await getGmailClient(accountId);
  await gmail.users.threads.modify({
    userId: "me",
    id: gmailThreadId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

export async function markThreadUnread(accountId: string, gmailThreadId: string) {
  const gmail = await getGmailClient(accountId);
  await gmail.users.threads.modify({
    userId: "me",
    id: gmailThreadId,
    requestBody: { addLabelIds: ["UNREAD"] },
  });
}

// ─── Send reply ──────────────────────────────────────────────────────────────

function buildRaw(fields: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}): string {
  const lines = [
    `From: ${fields.from}`,
    `To: ${fields.to}`,
    `Subject: ${fields.subject}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `MIME-Version: 1.0`,
  ];
  if (fields.inReplyTo) lines.push(`In-Reply-To: ${fields.inReplyTo}`);
  if (fields.references) lines.push(`References: ${fields.references}`);
  lines.push("", fields.body);

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendEmail(
  accountId: string,
  opts: { to: string; subject: string; body: string }
) {
  const gmail = await getGmailClient(accountId);
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { email: true, displayName: true },
  });

  const from = account.displayName
    ? `${account.displayName} <${account.email}>`
    : account.email;

  const raw = buildRaw({ from, to: opts.to, subject: opts.subject, body: opts.body });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

export async function sendReply(
  accountId: string,
  gmailThreadId: string,
  opts: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string | null;
    references?: string | null;
  }
) {
  const gmail = await getGmailClient(accountId);
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { email: true, displayName: true },
  });

  const from = account.displayName
    ? `${account.displayName} <${account.email}>`
    : account.email;

  const raw = buildRaw({
    from,
    to: opts.to,
    subject: opts.subject.startsWith("Re:") ? opts.subject : `Re: ${opts.subject}`,
    body: opts.body,
    inReplyTo: opts.inReplyTo,
    references: opts.references,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: gmailThreadId },
  });
}
