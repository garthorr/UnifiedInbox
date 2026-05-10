import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const { accountId, to, subject, body: emailBody } = (body ?? {}) as {
    accountId?: string;
    to?: string;
    subject?: string;
    body?: string;
  };

  if (!accountId?.trim() || !to?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: "accountId, to, and body are required" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { accountType: true },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  try {
    if (account.accountType === "IMAP") {
      const imap = await import("@/lib/imap/actions");
      await imap.sendEmail(accountId, { to: to.trim(), subject: subject?.trim() ?? "(no subject)", body: emailBody.trim() });
    } else {
      const gmail = await import("@/lib/gmail/actions");
      await gmail.sendEmail(accountId, { to: to.trim(), subject: subject?.trim() ?? "(no subject)", body: emailBody.trim() });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[compose] send failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to send";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
