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

  // Basic input validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (password.length < 1 || password.length > 512) {
    return NextResponse.json({ error: "Password must be 1–512 characters" }, { status: 400 });
  }
  if (imapHost.length > 253 || !/^[a-zA-Z0-9._-]+$/.test(imapHost)) {
    return NextResponse.json({ error: "Invalid IMAP host" }, { status: 400 });
  }
  const normalizedImapPort = imapPort ?? 993;
  const normalizedSmtpPort = smtpPort ?? 587;
  if (normalizedImapPort < 1 || normalizedImapPort > 65535) {
    return NextResponse.json({ error: "IMAP port must be 1–65535" }, { status: 400 });
  }
  if (smtpHost && (normalizedSmtpPort < 1 || normalizedSmtpPort > 65535)) {
    return NextResponse.json({ error: "SMTP port must be 1–65535" }, { status: 400 });
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
    // Log internally but don't leak server error details to the client
    console.error("[imap] connection test failed:", err);
    return NextResponse.json(
      { error: "Could not connect to IMAP server. Check host, port, and credentials." },
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
