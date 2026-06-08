import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

// Returns the VAPID public key the browser needs to subscribe, plus whether
// push is configured server-side at all.
export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey(),
  });
}
