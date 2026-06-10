import { NextResponse } from "next/server";
import { saveSubscription, type BrowserSubscription } from "@/lib/push";

// Browser push endpoints are always public HTTPS URLs of a push service
// (FCM, Mozilla autopush, APNs web push, …). Reject anything that could
// point the worker's delivery POSTs at an internal host.
function isValidPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Literal IPv4/IPv6 hosts are never legitimate push services.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return false;
  return true;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sub = body?.subscription as BrowserSubscription | undefined;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  if (!isValidPushEndpoint(sub.endpoint)) {
    return NextResponse.json({ error: "Invalid push endpoint" }, { status: 400 });
  }
  const userAgent = request.headers.get("user-agent") ?? undefined;
  await saveSubscription(sub, userAgent);
  return NextResponse.json({ ok: true });
}
