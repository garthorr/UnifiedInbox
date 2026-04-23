import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

const COOKIE_NAME = "console_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Hash the APP_SECRET so we never store it plaintext in the cookie.
 */
function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Return true if the current request has a valid session cookie.
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;
  const expected = hashSecret(process.env.APP_SECRET ?? "");
  // Both are fixed-length SHA-256 hex digests; timingSafeEqual prevents
  // an attacker from brute-forcing the hash one byte at a time via timing.
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

/**
 * Set the session cookie. Call from an API route after verifying the password.
 */
export function buildSessionCookie(): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    maxAge: number;
    path: string;
  };
} {
  const value = hashSecret(process.env.APP_SECRET ?? "");
  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    },
  };
}

export { COOKIE_NAME };
