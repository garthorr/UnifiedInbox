import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createSession } from "@/lib/auth";

// In-process sliding-window rate limiter: max 10 failed attempts per 15 min per IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Evict expired windows so the map doesn't grow unbounded across IPs.
  if (attempts.size > 100) {
    for (const [key, entry] of attempts) {
      if (now - entry.windowStart > WINDOW_MS) attempts.delete(key);
    }
  }
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

function resetAttempts(ip: string) {
  attempts.delete(ip);
}

/** Constant-time password check — a plain !== leaks match length/prefix timing. */
function secretMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { secret } = body as { secret?: string };

  const expected = process.env.APP_SECRET ?? "";
  if (!expected || !secret || !secretMatches(secret, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  resetAttempts(ip);
  const cookie = await createSession(request.headers.get("user-agent"));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
