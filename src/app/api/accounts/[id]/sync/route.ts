import { NextResponse } from "next/server";
import { syncAccount } from "@/lib/gmail/sync";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fire-and-forget for quick response; sync runs in background
  syncAccount(id).catch((err) => {
    console.error(`Sync failed for account ${id}:`, err);
  });

  return NextResponse.json({ ok: true, message: "Sync started" });
}
