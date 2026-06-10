import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { prisma } from "./db";

const COOKIE_NAME = "console_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// Validation runs on every request (middleware), so cache verdicts briefly to
// keep the per-request DB cost near zero. Revocation latency is bounded by
// the TTL; destroySession/destroyOtherSessions clear the cache to make
// explicit logouts immediate in this process.
const VERDICT_TTL_MS = 60_000;
const verdictCache = new Map<string, { ok: boolean; until: number }>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    maxAge: number;
    path: string;
  };
};

/**
 * Create a session: random 256-bit token in the cookie, only its hash in the
 * database. Expired sessions are pruned opportunistically here so no separate
 * cleanup job is needed.
 */
export async function createSession(userAgent?: string | null): Promise<SessionCookie> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userAgent: userAgent?.slice(0, 255) ?? null, expiresAt },
  });

  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL_MS / 1000,
      path: "/",
    },
  };
}

/**
 * Validate a session token against the database. The lookup is by SHA-256
 * hash (indexed), so a timing side-channel can't recover token bytes.
 */
export async function validateSessionToken(token: string): Promise<boolean> {
  if (!token) return false;

  const now = Date.now();
  const cached = verdictCache.get(token);
  if (cached && cached.until > now) return cached.ok;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, expiresAt: true, lastSeenAt: true },
  });
  const ok = !!session && session.expiresAt.getTime() > now;

  // Touch lastSeenAt at most once per cache window so the sessions panel
  // shows activity without writing on every request.
  if (ok && session && now - session.lastSeenAt.getTime() > VERDICT_TTL_MS) {
    prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  verdictCache.set(token, { ok, until: now + VERDICT_TTL_MS });
  // Bound the cache: failed probes would otherwise grow it without limit.
  if (verdictCache.size > 1000) {
    for (const [k, v] of verdictCache) {
      if (v.until <= now) verdictCache.delete(k);
    }
    if (verdictCache.size > 1000) verdictCache.clear();
  }
  return ok;
}

/** Revoke the session behind the given cookie token. */
export async function destroySession(token: string): Promise<void> {
  verdictCache.delete(token);
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Revoke every session except the caller's ("sign out everywhere else"). */
export async function destroyOtherSessions(currentToken: string): Promise<number> {
  verdictCache.clear();
  const { count } = await prisma.session.deleteMany({
    where: { tokenHash: { not: hashToken(currentToken) } },
  });
  return count;
}

/** True if the current request carries a valid session cookie. */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? validateSessionToken(token) : false;
}

export { COOKIE_NAME };
