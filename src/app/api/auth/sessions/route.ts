import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { COOKIE_NAME, destroyOtherSessions } from "@/lib/auth";

/** List active sessions, flagging the caller's own. */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const currentHash = createHash("sha256").update(token).digest("hex");

  const sessions = await prisma.session.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, tokenHash: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      current: s.tokenHash === currentHash,
    })),
  });
}

/** Revoke every session except the caller's ("sign out everywhere else"). */
export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const revoked = await destroyOtherSessions(token);
  return NextResponse.json({ ok: true, revoked });
}
