import { NextResponse } from "next/server";
import { isPushConfigured, sendPushToAll } from "@/lib/push";

// Sends a test notification to all registered devices so the user can confirm
// push is working end-to-end.
export async function POST() {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY." },
      { status: 503 }
    );
  }
  const delivered = await sendPushToAll({
    title: "UnifiedInbox",
    body: "Test notification — push is working.",
    url: "/",
    tag: "test",
  });
  return NextResponse.json({ ok: true, delivered });
}
