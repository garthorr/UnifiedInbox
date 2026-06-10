import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, destroySession } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  // Revoke server-side so the cookie value is dead even if a copy leaked.
  if (token) await destroySession(token).catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}
