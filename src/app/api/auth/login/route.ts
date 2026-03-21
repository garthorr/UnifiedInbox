import { NextResponse } from "next/server";
import { buildSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { secret } = body as { secret?: string };

  if (!secret || secret !== process.env.APP_SECRET) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookie = buildSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
