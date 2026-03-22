import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encrypt";
import { testImapConnection } from "@/lib/imap/sync";
import { syncAccount } from "@/lib/gmail/sync";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { email, password, imapHost, imapPort, smtpHost, smtpPort, displayName } = body as {
    email?: string;
    password?: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    displayName?: string;
  };

  if (!email || !password || !imapHost) {
    return NextResponse.json(
      { error: "email, password, and imapHost are required" },
      { status: 400 }
    );
  }

  // Test the connection before saving
  try {
    await testImapConnection(
      imapHost,
      imapPort ?? 993,
      email,
      password
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `IMAP connection failed: ${msg}` },
      { status: 422 }
    );
  }

  const account = await prisma.account.upsert({
    where: { email },
    create: {
      accountType: "IMAP",
      email,
      displayName: displayName || email,
      accessToken: encrypt(password),
      imapHost,
      imapPort: imapPort ?? 993,
      smtpHost: smtpHost ?? null,
      smtpPort: smtpPort ?? null,
      isActive: true,
    },
    update: {
      accountType: "IMAP",
      displayName: displayName || email,
      accessToken: encrypt(password),
      imapHost,
      imapPort: imapPort ?? 993,
      smtpHost: smtpHost ?? null,
      smtpPort: smtpPort ?? null,
      isActive: true,
      historyId: null, // reset so initial sync runs
    },
  });

  await prisma.activityLog.create({
    data: {
      eventType: "ACCOUNT_CONNECTED",
      accountId: account.id,
      description: `IMAP account connected: ${email}`,
      metadata: { imapHost, imapPort },
    },
  });

  // Kick off initial sync in the background
  syncAccount(account.id).catch((err) => {
    console.error(`Initial IMAP sync failed for ${account.id}:`, err);
  });

  return NextResponse.json({ id: account.id, email: account.email }, { status: 201 });
}
