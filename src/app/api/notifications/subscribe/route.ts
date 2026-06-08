import { NextResponse } from "next/server";
import { saveSubscription, type BrowserSubscription } from "@/lib/push";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sub = body?.subscription as BrowserSubscription | undefined;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const userAgent = request.headers.get("user-agent") ?? undefined;
  await saveSubscription(sub, userAgent);
  return NextResponse.json({ ok: true });
}
